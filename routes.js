'use strict';

var db = require('./dist/db'),
    fs = require('fs'),
    bcrypt = require('bcrypt-nodejs'),
    path = require('path'),
    parentDir = path.join(__dirname, '../..');

module.exports = {

    '/admin': function(response) {

        var collections = [];

        fs.readdir(parentDir + '/models', function(err, files) {

            if (files) {

                files.forEach(function(file, index) {

                    collections.push(file.replace('.json', ''));

                    if (index === files.length - 1) {
                        response.resolve({ collections: collections, className: 'admin' });
                    }
                });
            }
        });
    },

    '/admin/{{collection}}': function(response, request) {

        var context = {
            collection: request.params.collection,
            className: 'admin'
        };

        if (request.body) {

            try {

                context.json = JSON.parse(request.body.json);

                db.put(request.params.collection, context.json).then(function() {

                    context.json = JSON.stringify(context.json, null, 4);

                    context.saved = true;

                    response.resolve(context, __dirname + '/views/collection.html');
                });

            } catch(err) {

                console.error(err);

                db.get(request.params.collection).then(function(data) {

                    context.json = JSON.stringify(data, null, 4);

                    context.error = 'Save failed, probably due to malformed JSON.';

                    response.resolve(context, __dirname + '/views/collection.html');
                });

            }

        } else {

            db.get(request.params.collection).then(function(data) {

                context.json = JSON.stringify(data, null, 4);

                response.resolve(context, __dirname + '/views/collection.html');
            });
        }
    },

    '/admin/new/{{collection}}': function(response, request) {

        var context = {
            collection: request.params.collection,
            className: 'admin'
        };

        fs.exists(parentDir + '/models/' + request.params.collection + '.json', function(exists) {

            if (exists) {

                request.redirect(302, {
                    'Content-Type': 'text/html; charset=UTF-8',
                    'Location': '/admin/' + request.params.collection
                });

            } else {

                db.put(request.params.collection, data || {}).then(function() {

                    response.resolve(context, __dirname + '/views/collection.html');
                });
            }
        });
    },

    '/admin/delete/{{collection}}': function(response, request) {

        var context = {
            collection: request.params.collection,
            className: 'admin'
        };

        db.drop(request.params.collection).then(function() {

            request.redirect(302, {
                'Content-Type': 'text/html; charset=UTF-8',
                'Location': '/admin'
            });
        });
    },

    '/login': function(response, request) {

        if (request.body) {

            try {

                var user = request.body.username,
                    pass = request.body.password;

                db.get('users').then(function(users) {

                    bcrypt.compare(pass, users[user], function(err, success) {

                        //if (success) {
                        
                            request.redirect(302, {
                                'Set-Cookie': 'user=' + user,
                                'Content-Type': 'text/html; charset=UTF-8',
                                'Location': request.body.from || '/'
                            });
                        
                        //} else {

                            //response.resolve({ failed: true, from: request.query.from });
                        //}
                    });
                });

            } catch(err) {

                console.error(err);

                response.resolve({ failed: true });

            }

        } else {

            response.resolve({ from: request.query.from });
        }
    }, 

    '/logout' : function(response) {

        response.resolve();
    }

};