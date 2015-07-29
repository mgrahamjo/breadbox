'use strict';

var db = require('./db'),
    fs = require('fs'),
    bcrypt = require('bcrypt-nodejs'),
    path = require('path'),
    session = require('./session'),
    thisDir = path.join(__dirname, '..'),
    parentDir = path.join(__dirname, '../../..');

module.exports = {

    '/admin': function(response, request) {

        var collections = [];

        request.getSession.then(function(session) {

            fs.readdir(parentDir + '/models', function(err, files) {

                if (files) {

                    files.forEach(function(file, index) {

                        collections.push(file.replace('.json', ''));

                        if (index === files.length - 1) {
                            response.resolve({
                                collections: collections,
                                className: 'admin',
                                userRole: session.role
                            });
                        }
                    });
                }
            });
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

                    response.resolve(context, thisDir + '/views/collection.html');
                });

            } catch(err) {

                console.error(err);

                db.get(request.params.collection).then(function(data) {

                    context.json = JSON.stringify(data, null, 4);

                    context.error = 'Save failed, probably due to malformed JSON.';

                    response.resolve(context, thisDir + '/views/collection.html');
                });
            }

        } else {

            db.get(request.params.collection).then(function(data) {

                context.json = JSON.stringify(data, null, 4);

                response.resolve(context, thisDir + '/views/collection.html');
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

                db.put(request.params.collection, {}).then(function() {

                    response.resolve(context, thisDir + '/views/collection.html');
                });
            }
        });
    },

    '/admin/new-user': function(response, request) {

        var context = {
            className: 'admin'
        };

        if (request.body) {

            try {

                bcrypt.genSalt(10, (err, salt) => {
                    bcrypt.hash(request.body.password, salt, null, (err, passHash) => {
                        
                        let user = {
                            password: passHash,
                            role: request.body.role
                        };

                        db.put('users', user, request.body.name).then(function(success) {

                            context.saved = success;

                            response.resolve(context, thisDir + '/views/newuser.html');
                        });
                    });
                });

            } catch(err) {

                console.error(err);

                context.error = 'Save failed.';

                response.resolve(context, thisDir + '/views/newuser.html');
            }

        } else {

            response.resolve(context, thisDir + '/views/newuser.html');
        }        
    },

    '/admin/delete/{{collection}}': function(response, request) {

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

                    bcrypt.compare(pass, users[user].password, function(err, success) {

                        if (success) {

                            session.save(user, {
                                name: user,
                                role: users[user].role
                            });

                            // HANDLE UNDEFINED FROM
                        
                            request.redirect(302, {
                                'Set-Cookie': 'user=' + user,
                                'Content-Type': 'text/html; charset=UTF-8',
                                'Location': request.body.from || '/'
                            });
                        
                        } else {

                            response.resolve({ failed: true, from: request.query.from });
                        }
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

    '/logout' : function(response, request) {

        request.getSession.then(function(data) {

            if (data) {
                session.end(data.name);
            }

            response.resolve(undefined, undefined, {'Set-Cookie': 'user=""'});
        });
    }

};