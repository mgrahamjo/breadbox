'use strict';

var http = require('http'),
  url    = require('url'),
  fs     = require('fs'),
  path   = require('path'),
  render = require('./render'),
  routes = require('../routes'),
  formidable = require('formidable');

module.exports = function(settings) {
   
  http.createServer(function(req, res) {
    
    var parentDir = path.join(__dirname, '../..').split('/').pop(),
      // filepath is (eventually) the full path to the template
      filepath = __dirname.replace(parentDir + '/breadbox/lib', ''),
      // parsedUrl contains all the parts of the URL
      parsedUrl = url.parse(req.url, true),
      // pathname is the requested relative URL
      pathname = parsedUrl.pathname,
      // relPath is (eventually) the path to the template, relative to the views/ folder
      relPath = pathname === '/' ? '/index' : pathname,
      // routeName is the key we will use on the routes object to get the correct context
      routeName = relPath.replace(/\/\//g, '/').replace(/\/$/, ''),
      // extension is the filetype, falls back to html
      extension = path.extname(pathname),
      // varRegx matches route names that contain variables
      varRegx = /{{([\s\S]*?)}}/g,
      // params is for URL parameters
      params = {},
      controllers = settings.controllers,
      loginPage = settings.loginPage || '/login',
      logoutPage = settings.logoutPage || '/logout',
      authenticate = false,
      session = {},
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
      cookies,
      controller,
      request;

    // parseVars takes a requested route and an array of pre-interpolated 
    // variables in that route and populates the params object.
    // Param keys are the variables defined in routes.js,
    // and values are the respective globs in the given route.
    function parseVars(route, keys) {
      // Replace the variable in the route with a capturing group, cast it as
      // a regex, and test that against the URL
      var pathMatches = new RegExp(route.split('|')[0].replace(varRegx, '([^\/]+)[\/]{0,1}$')).exec(relPath);
      // If the URL matches the route regex...
      if (pathMatches) {
        // Save the route so we can reference it when we get our context
        routeName = route;
        // disregard relPath returned by exec
        pathMatches.shift();
        // Map values in URL to variables in route
        for (var i = 0; i < pathMatches.length; i++) {
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

    // To avoid parsing routes that don't contain variables,
    // this function performs a quick regex.
    function lookForVars(route) {
      // If this route has a variable in it...
      var routeMatches = route.match(varRegx);
      // ... parse it.
      return routeMatches ? parseVars(route, routeMatches) : false;
    }

    // See if any dynamic routes match this URL.
    function checkRoutes(routeNames) {

      Object.keys(routeNames).forEach(function(route) {
        if (lookForVars(route)) {
          return true;
        }
      });

      return false;
    }

    if (!checkRoutes(controllers)) {
      checkRoutes(routes);
    }

    relPath = relPath.replace(/\/\//g, '/').replace(/\/$/, '');

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
        'Location': loginPage + '?from=' + pathname
      });
      res.end();
    }

    function fourZeroFour(type, data) {

      console.log(type + ' not found: ' + data);

      res.writeHead(404, {'Content-Type': 'text/plain'});

      res.end(type + ' not found: ' + data);
    }

    function redirect(status, headers) {
      res.writeHead(status, headers);
      res.end();
    }

    if (extension === '.html') {

      controller = controllers[routeName];

      if (typeof controller === 'undefined') {
        controller = controllers[routeName + '|authenticate'];
        authenticate = true;
        if (typeof controller === 'undefined') {
          filepath = filepath.replace('/views', '/' + parentDir + '/breadbox/views');
          controller = routes[routeName];
          if (typeof controller === 'undefined') {
            fourZeroFour('controller', routeName);
          }
        }
      }
    }

    if (req.headers.cookie) {
      if (req.headers.cookie.indexOf(';') > -1) {
        cookies = req.headers.cookie.split[';'];
      } else {
        cookies = [req.headers.cookie];
      }

      cookies.forEach(function(cookie){
        var cookieParts = cookie.split('=');
        session[cookieParts[0]] = cookieParts[1];
      });

    }

    if (authenticate && pathname !== '/login' && !session.user) {
      login();
    }
    
    console.log('Request: ' + filepath);

    // getTemplate passes the name of the route we want, 
    // the path to the default template for this route,
    // and the request object to our rendering function,
    // and sends the result to the client.
    function getTemplate() {
      render(routeName.replace(/.html$/, ''), filepath, request, controller).then(function(response) {

        if (routeName === logoutPage) {
          res.writeHead(200, {
              'Set-Cookie': 'user=',
              'Content-Type': mime[extension]
          });
        } else {

          res.writeHead(200, {'Content-Type': mime[extension]});

        }
        
        res.end(response);

      });
    }

    // If there's a template to get, we have some work to do.
    if (extension === '.html') {

      request = {
        data: req,
        params: params,
        query: parsedUrl.query,
        redirect: redirect
      };

      // If this is a post request, we'll let formidable handle
      // the buffer stream and add the post data to the request object.
      if (req.method.toLowerCase() === 'post') {

        new formidable.IncomingForm().parse(req, function(err, fields, files) {
          if (err) { throw err; }
          request.body = fields;
          request.files = files;
          getTemplate();
        });

      // If this is not a post request,
      // leave the request object as-is and render the template.
      } else {
        getTemplate();
      }

    // If this isn't an html request, send the file directly.
    // Breadbox doesn't currently support controllers
    // for non-html requests.
    } else {

      fs.exists(filepath, function(exists) {

        if (exists) {

          fs.readFile(filepath, function(err, file) {

            if (err) { throw err; }

            res.end(file);

          });

        } else {

          fourZeroFour('file', filepath);
        }

      });
    }

  }).listen(settings.port || 1337);

  console.log('Server running at http://localhost:' + (settings.port || 1337));

};