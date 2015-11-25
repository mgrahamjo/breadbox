'use strict';

var
// For creating server
http = require('http'),

// Filesystem IO
fs = require('fs'),

// JSON db
jdrop = require('jdrop'),

// For parsing URLs
url = require('url'),

// For other kinds of url parsing
path = require('path'),

// For managing tokens
csrf = require('./csrf'),

// Our function that returns an interpolated template
manila = require('manila')(),

// Our promise implementation
promise = require('./promise'),

// Session management
session = require('./session'),

// Third party form data parsing
formidable = require('formidable'),

// regex for matching URLs that contain variables
varRegx = /{{([\s\S]*?)}}/g,

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

module.exports = function (config) {

  // Parse settings
  var settings = {};
  settings.controllers = config.controllers || {};
  settings.loginPage = config.loginPage || '/login';
  settings.logoutPage = config.logoutPage || '/logout';
  settings.cacheHtml = config.cacheHtml === undefined ? true : settings.cacheHtml;
  settings.cacheLength = config.cacheLength || 2419200; // 1 month cache
  settings.sessionLength = config.sessionLength || 600000; // 10 minute session
  settings.dataPath = config.dataPath || 'data';
  global.settings = settings;

  // Set up error handling
  var blooper = initBlooper(function (error, status) {
    var errorData = {
      status: status,
      stack: error.stack || error
    };
    console.error(error);
    getTemplate(__dirname.replace('/dist', '/views/error.html'), errorData, function (response, error) {
      response.resolve({
        error: error
      });
    });
  });

  var response = undefined;

  var db = jdrop({
    path: settings.dataPath,
    autocatch: blooper.handle
  });

  global.breadbox = {
    init: init,
    db: db,
    promise: promise,
    handle: blooper.handle,
    attempt: blooper.attempt,
    csrf: csrf
  };

  var appRoutes = require('./routes');

  // Before crashing, save current sessions.
  process.on('uncaughtException', function (err) {
    fs.writeFile(basePath + 'models/session-dump.json', JSON.stringify(session.all()), function () {
      console.error(err.stack);
      process.exit(1);
    });
  });

  // Before interrupting the server manually, save current sessions.
  process.on('SIGINT', function () {
    db.put('session-dump', session.all()).then(function () {
      process.exit();
    });
  });

  // On start up, recover session data, if any.
  db.get('session-dump').then(function (data) {
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
  function sortRoutes() {

    var variableUrls = [],
        staticUrls = [];

    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;
    var _iteratorError = undefined;

    try {
      for (var _len = arguments.length, controllers = Array(_len), _key = 0; _key < _len; _key++) {
        controllers[_key] = arguments[_key];
      }

      for (var _iterator = controllers[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
        var routeNames = _step.value;

        Object.keys(routeNames).forEach(function (route) {

          if (route.match(varRegx)) {

            variableUrls.push({
              route: route,
              regx: new RegExp('^' + route.split('|')[0].replace(varRegx, '([^/]+)') + '$')
            });
          } else {

            staticUrls.push(route);
          }
        });
      }
    } catch (err) {
      _didIteratorError = true;
      _iteratorError = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion && _iterator['return']) {
          _iterator['return']();
        }
      } finally {
        if (_didIteratorError) {
          throw _iteratorError;
        }
      }
    }

    return {
      variable: variableUrls,
      'static': staticUrls
    };
  }

  function mergeHeaders(headers) {

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

  function redirect(location) {
    var status = arguments[1] === undefined ? 302 : arguments[1];
    var headers = arguments[2] === undefined ? {} : arguments[2];

    console.log('redirecting to ' + location);
    headers.Location = location;
    response.writeHead(status, mergeHeaders(headers));
    response.end();
  }

  function isAuthenticated(id) {

    var sess = session.get(id);

    return sess && sess.email;
  }

  function getContext(request, controller) {

    var context = promise();

    controller(context, request);

    return context;
  }

  // getTemplate passes the name of the route we want,
  // the path to the default template for this route,
  // and the request object to our rendering function,
  // and sends the result to the client.
  function getTemplate(filepath, request, controller) {

    getContext(request, controller).then(function (context, customPath) {
      var headers = arguments[2] === undefined ? {} : arguments[2];

      manila(customPath || filepath, context, function (err, template) {
        console.log(err);
        blooper.handle(err).then(function () {

          var status = headers.status;

          response.writeHead(status || 200, mergeHeaders(headers));

          response.end(template);
        });
      });
    });
  }

  // Map values in URL to variables in route
  function parseVars(pathMatches, keys) {

    var params = {};

    for (var i = 0; i < pathMatches.length; i++) {

      keys[i] = keys[i].replace('{{', '').replace('}}', '');

      params[keys[i]] = pathMatches[i];
    }

    return params;
  }

  // init is passed to the user and called with the app settings
  // to initialize the server
  function init() {

    var urls = sortRoutes(settings.controllers, appRoutes);

    http.createServer(function (req, res) {

      var
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
      controller = undefined,

      // the request object we will make available to controllers
      request = undefined;

      response = res;

      // If this is a template and it isn't a static URL...
      if (isView && urls['static'].indexOf(relPath) === -1) {
        var pathMatches = undefined;
        // ...loop through the variable URLs,
        for (var i = 0; i < urls.variable.length; i++) {
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

      filepath = fixDoubleSlashes(filepath).replace(/\.html$/, '.mnla');

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
                blooper.handle('Controller not found: ' + routeName, 404);
              }
            }
          }
        }

        if (req.headers.cookie) {
          (function () {

            var cookieList = undefined,
                cookieParts = undefined;

            if (req.headers.cookie.indexOf(';') > -1) {
              cookieList = req.headers.cookie.split(';');
            } else {
              cookieList = [req.headers.cookie];
            }

            cookieList.forEach(function (cookie) {
              cookieParts = cookie.split('=');
              cookies[cookieParts[0].trim()] = cookieParts[1].trim();
            });
          })();
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

            new formidable.IncomingForm().parse(req, function (err, fields, files) {

              blooper.handle(err).then(function () {

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

        fs.exists(filepath, function (exists) {

          if (exists) {

            fs.readFile(filepath, function (err, file) {

              blooper.handle(err).then(function () {

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

  return global.breadbox;
};
