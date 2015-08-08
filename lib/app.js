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
  throw err;
  // fs.writeFile(basePath +'models/session-dump.json', JSON.stringify(session.get()), () => {
  //   throw err;
  // });
});

// Before interrupting the server manually, save current sessions.
process.on('SIGINT', () => {
  db.put('session-dump', session.get()).then(() => {
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
  return route.replace(/\/\//g, '/').replace(/\/$/, '');
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
        variableUrls.push(route);
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

// init is passed to the user and called with the app settings
// to initialize the server
function init(settings = {}) {

  let urls = sortRoutes(settings.controllers, appRoutes);

  settings.loginPage = settings.loginPage || '/login';
  settings.logoutPage = settings.logoutPage || '/logout';

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
      routeName = fixDoubleSlashes(relPath),
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

    // parseVars takes a requested route and an array of pre-interpolated 
    // variables in that route and populates the params object.
    // Param keys are the variables defined in the controllers,
    // and values are the respective globs in the given route.
    function parseVars(route, keys) {
      // Replace the variable in the route with a capturing group, cast it as
      // a regex, and test that against the URL
      let pathMatches = new RegExp('^' + route.split('|')[0].replace(varRegx, '([^\/]+)') + '$').exec(relPath);
      // If the URL matches the route regex...
      if (pathMatches) {
        // Save the route so we can reference it when we get our context
        routeName = route;
        // disregard relPath returned by exec
        pathMatches.shift();
        // Map values in URL to variables in route
        for (let i = 0; i < pathMatches.length; i++) {
          keys[i] = keys[i].replace('{{', '').replace('}}', '');
          params[keys[i]] = pathMatches[i];
          // Remove the variable from the URL since we've converted it to a parameter,
          // then remove any unnecessary slashes that are left over.
          relPath = relPath.replace(pathMatches[i], '');
        }
        return true;
      }
      return false;
    }

    // If this is a template and it isn't a static URL...
    if (isView && urls.static.indexOf(relPath) === -1) {
      // ...loop through the variable URLs,
      for (let i = 0; i < urls.variable.length; i++) {
        // get the param names,
        let keys = urls.variable[i].match(varRegx);
        // and look see if any variable routes match
        if (keys && parseVars(urls.variable[i], keys)) {
          break;
        }
      }
      
    }

    relPath = fixDoubleSlashes(relPath);

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

    function login() {
      res.writeHead(302, {
        'Location': settings.loginPage + '?from=' + pathname
      });
      res.end();
    }

    function redirect(status, headers) {
      res.writeHead(status, headers);
      res.end();
    }

    // getTemplate passes the name of the route we want, 
    // the path to the default template for this route,
    // and the request object to our rendering function,
    // and sends the result to the client.
    function getTemplate() {

      render(filepath, request, controller).then((template, headers = {}) => {

        let status = headers.status;

        delete headers.status;

        headers['Content-Type'] = headers['Content-Type'] || mime[extension];

        res.writeHead(status || 200, headers);
        
        res.end(template);

      });
    }

    filepath = fixDoubleSlashes(filepath);

    if (isView) {

      controller = controllers[routeName];

      if (typeof controller === 'undefined') {
        controller = controllers[routeName + '|authenticate'];
        authenticate = true;
        if (typeof controller === 'undefined') {
          filepath = filepath.replace('/views', '/' + parentDir + '/breadbox/views');
          controller = appRoutes[routeName];
          if (typeof controller === 'undefined') {
            crash.handle('Controller not found: ' + routeName, 404);
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

      if (authenticate && pathname !== settings.loginPage && !session.get(cookies.id)) {
        
        login();

      } else if (controller) {

        request = {
          data: req,
          params: params,
          query: parsedUrl.query,
          cookies: cookies,
          redirect: redirect,
          settings: settings,
          session: session
        };

        console.log('Request: ' + filepath);

        // If this is a post request, we'll let formidable crash.handle
        // the buffer stream and add the post data to the request object.
        if (req.method.toLowerCase() === 'post') {

          new formidable.IncomingForm().parse(req, (err, fields, files) => {

            crash.handle(err).then(() => {
              request.body = fields;
              request.files = files;
              getTemplate();
            });
          });

        // If this is not a post request,
        // leave the request object as-is and render the template.
        } else {
          getTemplate();
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
                'Content-Type': mime[extension]
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
  attempt: crash.attempt
};