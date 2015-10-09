'use strict';

const 
  // For creating server
  http       = require('http'),
  // Filesystem IO
  fs         = require('fs'),
  // JSON db
  db         = require('./db'),
  // For parsing URLs
  url        = require('url'),
  // For other kinds of url parsing
  path       = require('path'),
  // For managing tokens
  csrf       = require('./csrf'),
  // Our function that returns an interpolated template
  render     = require('./render'),
  // Our promise implementation
  promise    = require('./promise'),
  // Session management
  session    = require('./session'),
  // Out-of-the-box controllers
  appRoutes  = require('./routes'),
  // Third party form data parsing
  formidable = require('formidable'),
  // regex for matching URLs that contain variables
  varRegx    = /{{([\s\S]*?)}}/g,
  // the parent directory of /breadbox
  parentDir = path.join(__dirname, '../..').split('/').pop(),
  // the full path to the root directory of the app
  basePath = __dirname.replace(parentDir + '/breadbox/dist', ''),
  // mime types by extension
  mime = {
    '.css': 'text/css; charset=UTF-8',
    '.js': 'text/javascript; charset=UTF-8',
    '.json': 'application/json; charset=UTF-8',
    '.txt': 'text/plain; charset=UTF-8',
    '.html': 'text/html; charset=UTF-8',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.jpg': 'image/jpeg'
  },
  // Awesome error interceptor
  crash = require('./crash');

// Before crashing, save current sessions.
process.on('uncaughtException', err => {
  fs.writeFile(basePath +'models/session-dump.json', JSON.stringify(session.all()), () => {
    console.log(err.stack);
    process.exit(1);
  });
});

// Before interrupting the server manually, save current sessions.
process.on('SIGINT', () => {
  db.put('session-dump', session.all()).then(() => {
    process.exit();
  });
});

// On start up, recover session data, if any.
db.get('session-dump').then(data => {
  session.set(data);
  db.drop('session-dump');
});

// Utility function for removing extra slashes in route strings.
function fixDoubleSlashes(route) {
  return path.normalize(route).replace(/\/$/, '');
}

// sortRoutes accepts any number of controller objects
// and returns an object containing those controllers
// sorted into those whose routes contain variable placeholders (variable)
// and those that don't (static)
function sortRoutes(...controllers) {

  let variableUrls = [],
      staticUrls = [];

  for (let routeNames of controllers) {

    Object.keys(routeNames).forEach(route => {

      if (route.match(varRegx)) {

        variableUrls.push({
          route: route,
          regx: new RegExp('^' + route.split('|')[0].replace(varRegx, '([^\/]+)') + '$')
        });

      } else {

        staticUrls.push(route);
      }
    });
  }

  return {
    variable: variableUrls,
    static: staticUrls
  };
}

function mergeHeaders(headers) {

  delete headers.status;

  headers['Content-Type'] = headers['Content-Type'] || mime['.html'];

  headers['Cache-Control'] = headers['Cache-Control'] || 'max-age=' + (global.settings.cacheHtml ? global.settings.cacheLength : 0);

  headers['Keep-Alive'] = headers['Keep-Alive'] || 'timeout=15, max=100';

  return headers;
}

function csrfFail() {
  crash.handle('CSRF verfication failed.', 401, mergeHeaders({ 'Set-Cookie': 'id=; expires=Thu, 01 Jan 1970 00:00:00 GMT' }));
}

function redirect(location, status = 302, headers = {}) {
  console.log('redirecting to ' + location);
  headers.Location = location;
  global.res.writeHead(status, mergeHeaders(headers));
  global.res.end();
}

function isAuthenticated(id) {

  let sess = session.get(id);
  
  return sess && sess.name;
}

// getTemplate passes the name of the route we want, 
// the path to the default template for this route,
// and the request object to our rendering function,
// and sends the result to the client.
function getTemplate(filepath, request, controller) {

  render(filepath, request, controller).then((template, headers = {}) => {

    let status = headers.status;

    global.res.writeHead(status || 200, mergeHeaders(headers));
    
    global.res.end(template);
  });
}

// Map values in URL to variables in route
function parseVars(pathMatches, keys) {

  let params = {};

  for (let i = 0; i < pathMatches.length; i++) {

    keys[i] = keys[i].replace('{{', '').replace('}}', '');

    params[keys[i]] = pathMatches[i];
  }
  
  return params;
}

// init is passed to the user and called with the app settings
// to initialize the server
function init(settings = {}) {

  settings.loginPage = settings.loginPage || '/login';
  settings.logoutPage = settings.logoutPage || '/logout';
  settings.cacheHtml = settings.cacheHtml === undefined ? true : settings.cacheHtml;
  settings.cacheLength = settings.cacheLength || 2419200; // 1 month cache
  settings.sessionLength = settings.sessionLength || 600000; // 10 minute session

  global.settings = settings;

  let urls = sortRoutes(settings.controllers, appRoutes);

  http.createServer((req, res) => {

    global.res = res;
    
    let
      // root directory of app
      filepath = basePath,
      // parsedUrl contains all the parts of the URL
      parsedUrl = url.parse(req.url, true),
      // pathname is the requested relative URL
      pathname = parsedUrl.pathname,
      // relPath is (eventually) the path to the template, relative to the views/ folder
      relPath = pathname === '/' ? '/index' : pathname,
      // routeName is the key we will use on the routes object to get the correct context
      routeName = relPath,
      // extension is the filetype, falls back to html
      extension = path.extname(pathname),
      // params is for URL parameters
      params = {},
      // user-defined routes
      controllers = settings.controllers,
      // for keeping track of whether the current request must be authenticated
      authenticate = false,
      // for keeping track of whether this request is for a view
      isView = extension === '' || extension === '.html',
      // container for cookies
      cookies = {},
      // the controller we should use for this request
      controller,
      // the request object we will make available to controllers
      request;

    // If this is a template and it isn't a static URL...
    if (isView && urls.static.indexOf(relPath) === -1) {
      let pathMatches;
      // ...loop through the variable URLs,
      for (let i = 0; i < urls.variable.length; i++) {
        // get the param names,
        pathMatches = urls.variable[i].regx.exec(relPath);
        // and look see if any variable routes match
        if (pathMatches) {
          pathMatches.shift();
          routeName = urls.variable[i].route;
          params = parseVars(pathMatches, routeName.match(varRegx));
          relPath = fixDoubleSlashes(relPath.replace(varRegx, ''));
          break;
        }
      }
    }

    // Treat all extensionless requests as html.
    // Re-route html requests to views folder.
    if (extension === '') {
      extension = '.html';
      filepath += 'views' + relPath + '.html';
    } else if (extension === '.html') {
      filepath += 'views' + relPath;
    } else {
      filepath += relPath;
    }

    filepath = fixDoubleSlashes(filepath);

    routeName = routeName.replace(/\.html$/, '');

    if (isView) {

      controller = controllers[routeName];

      authenticate = routeName.indexOf('|authenticate') !== -1;

      if (controller === undefined) {
        if (routeName === '/index') {
          controller = appRoutes['/index'];
        } else {
          controller = controllers[routeName];
        }
        if (controller === undefined) {
          controller = controllers[routeName + '|authenticate'];
          if (controller !== undefined) {
            authenticate = true;
          } else {
            filepath = filepath.replace('/views', '/' + parentDir + '/breadbox/views');
            controller = appRoutes[routeName];
            if (controller !== undefined) {
              authenticate = true;
            } else {
              crash.handle('Controller not found: ' + routeName, 404);
            }
          }
        }
      }

      if (req.headers.cookie) {

        let cookieList, cookieParts;

        if (req.headers.cookie.indexOf(';') > -1) {
          cookieList = req.headers.cookie.split(';');
        } else {
          cookieList = [req.headers.cookie];
        }

        cookieList.forEach(cookie => {
          cookieParts = cookie.split('=');
          cookies[cookieParts[0].trim()] = cookieParts[1].trim();
        });
      }

      if (authenticate && pathname !== settings.loginPage && !isAuthenticated(cookies.id)) {

        redirect(settings.loginPage + '?from=' + pathname);

      } else if (controller) {

        request = {
          data: req,
          params: params,
          query: parsedUrl.query,
          cookies: cookies,
          redirect: redirect,
          settings: settings,
          session: session,
          sess: session.get(cookies.id)
        };

        console.log('Request: ' + filepath);

        // If this is a post request, we'll let formidable crash.handle
        // the buffer stream and add the post data to the request object.
        if (req.method.toLowerCase() === 'post') {

          new formidable.IncomingForm().parse(req, (err, fields, files) => {

            crash.handle(err).then(() => {

              if (request.sess && request.sess.token) {

                let token = request.sess.token;
                
                if (fields.token === token) {
                  request.body = fields;
                  request.files = files;
                  getTemplate(filepath, request, controller);
                } else {
                  csrfFail();
                }
              } else {
                csrfFail();
              }
            });
          });

        // If this is not a post request,
        // leave the request object as-is and render the template.
        } else {
          getTemplate(filepath, request, controller);
        }
      }

    // If this isn't an html request, send the file directly.
    // Breadbox doesn't currently support controllers
    // for non-html requests.
    } else {

      fs.exists(filepath, exists => {

        if (exists) {

          fs.readFile(filepath, (err, file) => {

            crash.handle(err).then(() => {

              res.writeHead(200, {
                'Content-Type': mime[extension],
                'Cache-Control': 'max-age=' + settings.cacheLength
              });

              res.end(file);
            });
          });

        } else {

          crash.handle('Asset not found: ' + filepath, 404);
        }

      });
    }

  }).listen(settings.port || 1337);

  console.log('Server running at http://localhost:' + (settings.port || 1337));

}

module.exports = {
  init: init,
  db: db,
  promise: promise,
  handle: crash.handle,
  attempt: crash.attempt,
  csrf: csrf,
};