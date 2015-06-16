'use strict';

var http = require('http'),
  url    = require('url'),
  fs     = require('fs'),
  path   = require('path'),
  render = require('./render'),
  routes = require('../routes');
 
http.createServer(function(req, res) {
    // filepath is (eventually) the full path to the template
  var filepath = __dirname.replace('/lib', ''),
    // pathname is the requested relative URL
    pathname = url.parse(req.url, true).pathname,
    // relPath is (eventually) the path to the template, relative to the views/ folder
    relPath = pathname === '/' ? '/index' : pathname,
    // routeName is the key we will use on the routes object to get the correct context
    routeName = relPath,
    // extension is the filetype, falls back to html
    extension = path.extname(pathname),
    // varRegx matches route names that contain variables
    varRegx = /{{([\s\S]*?)}}/g,
    // params is for URL parameters, which can be query strings or URL variables
    params = {};

  function parseVars(route, keys) {
    // Replace the variable in the route with a capturing group, cast it as
    // a regex, and test that against the URL
    var pathMatches = new RegExp(route.replace(varRegx, '([\\S]*)')).exec(relPath);
    // If the URL matches the route regex...
    if (pathMatches) {
      // Save the route so we can reference it when we get our context
      routeName = route;
      // disregard relPath returned by exec
      pathMatches.shift();
      // Map values in URL to variables in route
      for (var i = 0; i < pathMatches.length; i++) {
        console.log(keys[i]);
        console.log(pathMatches[i]);
        keys[i] = keys[i].replace('{{', '').replace('}}', '');
        params[keys[i]] = pathMatches[i];
        console.log(keys[i] + ' = ' + pathMatches[i]);
        // Remove the variable from the URL since we've converted it to a parameter,
        // then remove any unnecessary slashes that are left over.
        relPath = relPath.replace(pathMatches[i], '').replace(/\/\//g, '/').replace(/\/$/, '');
      }
      return true;
    }
    return false;
  }

  function parseRoute(route) {
    // If this route has a variable in it...
    var routeMatches = route.match(varRegx);
    
    if (routeMatches) {
      return parseVars(route, routeMatches);
    }
  }

  // See if any dynamic routes match this URL.
  Object.keys(routes).forEach(function(route) {
    if (parseRoute(route)) {
      return;
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