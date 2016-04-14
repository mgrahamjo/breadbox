'use strict';

const 
    // For creating server
    http       = require('http'),
    // Filesystem IO
    fs         = require('fs'),
    // JSON db
    jdrop      = require('jdrop'),
    // For parsing URLs
    url        = require('url'),
    // For other kinds of url parsing
    path       = require('path'),
    // Our function that returns an interpolated template
    initManila = require('manila'),
    // Our promise implementation
    treaty     = require('treaty'),
    // Session management
    session    = require('./session'),
    // Third party form data parsing
    formidable = require('formidable'),
    // regex for matching URLs that contain variables
    varRegx    = /<<([\s\S]*?)>>/g,
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
    initBlooper = require('blooper');

function breadbox(config) {

  // Parse settings
  let settings = {};
  settings.cacheHtml      = config.cacheHtml;
  settings.controllers    = config.controllers    || {};
  settings.loginPage      = config.loginPage      || '/login';
  settings.logoutPage     = config.logoutPage     || '/logout';
  settings.cacheLength    = config.cacheLength    || 2419200; // 1 month cache
  settings.sessionLength  = config.sessionLength  || 600000; // 10 minute session
  settings.dataPath       = config.dataPath       || 'data';
  settings.viewsPath      = config.viewsPath      || 'views';
  settings.partialsPath   = config.partialsPath   || settings.viewsPath;
  settings.loginView      = config.loginView      || path.join(__dirname, '../views/login.mnla');
  settings.logoutView     = config.logoutView     || path.join(__dirname, '../views/logout.mnla');

  // Set up error handling
  let response;

  let manila = initManila({
    views: settings.viewsPath,
    partials: settings.partialsPath
  });

  let blooper = initBlooper((error, status = 500) => {
      let errorData = {
        status: status,
        stack: error.stack || error
      };
      console.trace(error);
      manila(__dirname.replace('/dist', '/views/error.mnla'), errorData, (err, template) => {
          response.writeHead(status, {'Content-Type': 'text/html; charset=UTF-8'});
          response.end(template);
      });
    });

  // JSON file store
  const db = jdrop({
      path: settings.dataPath,
      autocatch: blooper.handle
    });

  // Public API
  global.breadbox = {
    db: db,
    promise: treaty,
    handle: blooper.handle,
    attempt: blooper.attempt,
    settings: settings,
    init: init
  };
  // CSRF depends on global.breadbox
  global.breadbox.csrf = require('./csrf');

  // defaultRoutes depends on global.breadbox
  const defaultRoutes = require('./routes');

  // Before crashing, save current sessions.
  process.on('uncaughtException', err => {
    let allSessions = session.all();
    console.trace(err.stack);
    if (Object.keys(allSessions).length) {
      fs.writeFile(basePath +'models/session-dump.json', JSON.stringify(allSessions), () => {
        process.exit(1);
      });
    } else {
      process.exit(1);
    }
  });

  // Before interrupting the server manually, save current sessions.
  process.on('SIGINT', () => {
    let allSessions = session.all();
    if (Object.keys(allSessions).length) {
      db.put('session-dump', allSessions).then(() => {
        process.exit();
      });
    } else {
      process.exit();
    }
  });

  // On start up, recover session data, if any.
  db.get('session-dump').then(data => {
    session.set(data);
    db.del('session-dump');
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

  function mergeHeaders(headers = {}) {

    delete headers.status;

    headers['Content-Type'] = headers['Content-Type'] || mime['.html'];

    headers['Cache-Control'] = headers['Cache-Control'] || 'max-age=' + (settings.cacheHtml ? settings.cacheLength : 0);

    headers['Keep-Alive'] = headers['Keep-Alive'] || 'timeout=15, max=100';

    headers['X-XSS-Protection'] = 1;

    headers['X-Content-Type-Options'] = 'nosniff';

    return headers;
  }

  function csrfFail() {
    blooper.handle('CSRF verfication failed.', 401, mergeHeaders({ 'Set-Cookie': 'id=; expires=Thu, 01 Jan 1970 00:00:00 GMT' }));
  }

  function redirect(location, status = 302, headers = {}) {
    console.log('redirecting to ' + location);
    headers.Location = location;
    response.writeHead(status, mergeHeaders(headers));
    response.end();
  }

  function isAuthenticated(id) {

    let sess = session.get(id);
    
    return sess && sess.email;
  }

  function getContext(request, controller) {

      return treaty(resolve => {
        controller(resolve, request);
      });
  }

  // getTemplate passes the name of the route we want, 
  // the path to the default template for this route,
  // and the request object to our rendering function,
  // and sends the result to the client.
  function getTemplate(filepath, request, controller) {

    getContext(request, controller).then((context, customPath, headers = {}) => {

      function end(data) {

        let status = headers.status;

        response.writeHead(status || 200, mergeHeaders(headers));
          
        response.end(data);
      }

      if (customPath.toLowerCase() === 'json' || headers['Content-Type'] === 'application/json') {

        headers['Content-Type'] = 'application/json';
        
        end(context);

      } else {

        manila(customPath || filepath, context, (err, template) => {

          blooper.handle(err).then(() => {

            end(template);

          });
        });
      }
    });
  }

  // Map values in URL to variables in route
  function parseVars(pathMatches, keys) {

    let params = {};

    for (let i = 0; i < pathMatches.length; i++) {

      keys[i] = keys[i].replace('<<', '').replace('>>', '');

      params[keys[i]] = pathMatches[i];
    }
    
    return params;
  }

  // init is passed to the user and called with the app settings
  // to initialize the server
  function init() {

    let urls = sortRoutes(settings.controllers, defaultRoutes);

    http.createServer((req, res) => {
      
      let
        // root directory of app
        filepath = basePath,
        // parsedUrl contains all the parts of the URL
        parsedUrl = url.parse(req.url, true),
        // pathname is the requested relative URL
        pathname = parsedUrl.pathname.replace(/\/$/, ''),
        // relPath is (eventually) the path to the template, relative to the views/ folder
        relPath = pathname === '' ? '/index' : pathname,
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

      response = res;

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
        filepath = path.join(filepath, settings.viewsPath, relPath);
      } else if (extension === '.html') {
        filepath = path.join(filepath, settings.viewsPath, relPath.replace('.html', ''));
      } else {
        filepath = path.join(filepath, relPath);
      }

      if (extension === '.html') {
        filepath += '.mnla';
      }

      routeName = routeName.replace(/\.html$/, '');

      if (isView) {

        controller = controllers[routeName];

        authenticate = routeName.indexOf('|authenticate') !== -1;

        if (controller === undefined) {
          if (routeName === '/index') {
            controller = defaultRoutes['/index'];
          } else {
            controller = controllers[routeName];
          }
          if (controller === undefined) {
            controller = controllers[routeName + '|authenticate'];
            if (controller !== undefined) {
              authenticate = true;
            } else {
              let viewsPathWithSlashes = path.normalize('/' + settings.viewsPath + '/');
              filepath = filepath.replace(viewsPathWithSlashes, '/' + parentDir + '/breadbox/views/');
              controller = defaultRoutes[routeName];
              if (controller !== undefined) {
                authenticate = true;
              } else {
                blooper.handle('Controller not found: ' + routeName, 404);
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

          // If this is a post request, we'll let formidable handle
          // the buffer stream and add the post data to the request object.
          if (req.method.toLowerCase() === 'post') {

            new formidable.IncomingForm().parse(req, (err, fields, files) => {

              blooper.handle(err).then(() => {

                if (request.sess && request.sess.token && fields.token === request.sess.token) {
                    request.body = fields;
                    request.files = files;
                    getTemplate(filepath, request, controller);
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

              blooper.handle(err).then(() => {

                res.writeHead(200, {
                  'Content-Type': mime[extension],
                  'Cache-Control': 'max-age=' + settings.cacheLength
                });

                res.end(file);
              });
            });

          } else {

            blooper.handle('Asset not found: ' + filepath, 404);
          }

        });
      }

    }).listen(settings.port || 1337);

    console.log('Server running at http://localhost:' + (settings.port || 1337));

  }

  init();

  breadbox.db = db;
  breadbox.promise = treaty;
  breadbox.handle = blooper.handle;
  breadbox.attempt = blooper.attempt;
  breadbox.settings = settings;
  breadbox.csrf = global.breadbox.csrf;

  return global.breadbox;
}

module.exports = breadbox;