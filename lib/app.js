'use strict';

var http = require('http'),
  url    = require('url'),
  fs     = require('fs'),
  path   = require('path'),
  render = require('./render'),
  routes = require('../routes');
 
http.createServer(function(req, res) {
  
  var filepath = __dirname.replace('/lib', ''),

    pathname = url.parse(req.url, true).pathname,

    relPath = pathname === '/' ? '/index' : pathname,

    routeName = relPath,

    extension = path.extname(pathname),

    varRegx = /{{([\s\S]*?)}}/,

    params = {};

  // See if any dynamic routes match this URL.
  Object.keys(routes).forEach(function(route) {

    var routeMatch = varRegx.exec(route),
        routeKey, routeRegx, pathMatch;
    // If this route has a variable in it...
    if (routeMatch) {
      // save the variable name...
      routeKey = routeMatch[1];
      // If the URL and the route start with the same base...
      if (relPath.indexOf(route.replace(varRegx, '').replace(/\/\//g, '/')) === 0) {
        // Replace the variable in the route with a capturing group to match
        // against the URL
        routeRegx = new RegExp(route.replace(varRegx, '([\\S]*)'));
        // If the URL matches the route regex...
        if (pathMatch = routeRegx.exec(relPath)) {
          // Save the part of the URL that should be a param value
          params[routeKey] = pathMatch[1];
          // Save the route so we can reference it when we get our context
          routeName = route;
          // Remove the variable from the URL since we've converted it to a parameter,
          // then remove any unnecessary slashes that are left over.
          relPath = relPath.replace(pathMatch[1], '').replace(/\/\//g, '/').replace(/\/$/, '');

          break;
        }
      }
    }
  });

  // treat all extensionless requests as html
  // re-route html requests to views folder  
  if (extension === '') {
    extension = '.html';
    filepath += '/views' + relPath + '.html';
  } else if (extension === '.html') {
    filepath += '/views' + relPath;
  } else {
    filepath += relPath;
  }

  console.log('request: ' + filepath);
  
  fs.exists(filepath, function(exists) {

    var mime, request;

    if (exists) {

      mime = {
        '.js': 'text/javascript; charset=UTF-8',
        '.json': 'application/json; charset=UTF-8',
        '.txt': 'text/plain; charset=UTF-8',
        '.html': 'text/html; charset=UTF-8',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.jpg': 'image/jpeg'
      };

      res.writeHead(200, {'Content-Type': mime[extension]});

      // View files
      if (extension === '.html') {

        request = {
          data: req,
          params: params
        };

        render(routeName.replace(/.html$/, ''), filepath, request).then(function(response) {
          res.end(response);
        });

      // Static files
      } else {

        fs.readFile(filepath, function(err, file) {

          if (err) { throw err; }

          res.end(file);

        });
      }

    // 404s
    } else {

      console.log('not found: ' + path);

      res.writeHead(404, {'Content-Type': 'text/plain'});

      res.end('file not found');
    }
    
    

  });

}).listen(1337);

console.log('Server running at http://localhost:1337/');