'use strict';

var db = require('./db'),
    fs = require('fs'),
    bcrypt = require('bcrypt-nodejs'),
    path = require('path'),
    crash = require('./crash'),
    csrf = require('./csrf'),
    thisDir = path.join(__dirname, '..'),
    parentDir = path.join(__dirname, '../../..');

module.exports = {

    '/admin': function admin(response, request) {

        var collections = [];

        fs.readdir(parentDir + '/models', function (err, files) {

            if (files) {

                files.forEach(function (file, index) {

                    collections.push(file.replace('.json', ''));

                    if (index === files.length - 1) {
                        response.resolve({
                            collections: collections,
                            className: 'admin',
                            userRole: request.session.get(request.cookies.id).role
                        });
                    }
                });
            }
        });
    },

    '/admin/{{collection}}': function adminCollection(response, request) {

        var context = {
            collection: request.params.collection,
            className: 'admin',
            token: request.session.get(request.cookies.id).token
        };

        if (request.body) {

            crash.attempt(function () {

                context.json = JSON.parse(request.body.json);

                db.put(request.params.collection, context.json).then(function () {

                    context.json = JSON.stringify(context.json, null, 4);

                    context.saved = true;

                    response.resolve(context, thisDir + '/views/collection.html');
                });
            }, function (err) {

                console.error(err);

                db.get(request.params.collection).then(function (data) {

                    context.json = JSON.stringify(data, null, 4);

                    context.error = 'Save failed, probably due to malformed JSON.';

                    response.resolve(context, thisDir + '/views/collection.html');
                });
            });
        } else {

            db.get(request.params.collection).then(function (data) {

                context.json = JSON.stringify(data, null, 4);

                response.resolve(context, thisDir + '/views/collection.html');
            });
        }
    },

    '/admin/new/{{collection}}': function adminNewCollection(response, request) {

        var context = {
            collection: request.params.collection,
            className: 'admin',
            token: request.session.get(request.cookies.id).token
        };

        fs.exists(parentDir + '/models/' + request.params.collection + '.json', function (exists) {

            if (exists) {

                request.redirect(302, {
                    'Content-Type': 'text/html; charset=UTF-8',
                    'Location': '/admin/' + request.params.collection
                });
            } else {

                db.put(request.params.collection, {}).then(function () {

                    response.resolve(context, thisDir + '/views/collection.html');
                });
            }
        });
    },

    '/admin/new-user': function adminNewUser(response, request) {

        var context = {
            className: 'admin',
            token: request.session.get(request.cookies.id).token
        };

        if (request.body) {

            crash.attempt(function () {

                bcrypt.genSalt(10, function (err, salt) {

                    bcrypt.hash(request.body.password, salt, null, function (err, passHash) {

                        var user = {
                            password: passHash,
                            role: request.body.role
                        };

                        db.put('users', user, request.body.name).then(function (success) {

                            context.saved = success;

                            response.resolve(context, thisDir + '/views/newuser.html');
                        });
                    });
                });
            }, function (err) {

                console.error(err);

                context.error = 'Save failed.';

                response.resolve(context, thisDir + '/views/newuser.html');
            });
        } else {

            response.resolve(context, thisDir + '/views/newuser.html');
        }
    },

    '/admin/delete/{{collection}}': function adminDeleteCollection(response, request) {

        db.drop(request.params.collection).then(function () {

            request.redirect(302, {
                'Content-Type': 'text/html; charset=UTF-8',
                'Location': '/admin'
            });
        });
    },

    '/login': function login(response, request) {

        var context = {
            className: 'admin',
            from: request.query.from || '/admin',
            failed: false
        };

        // If this is a post request, then let's try to log in.
        if (request.body) {

            crash.attempt(function () {

                var user = request.body.username,
                    pass = request.body.password;

                db.get('users').then(function (users) {
                    // If this user exists,
                    if (users[user]) {
                        // See if the password is correct.
                        bcrypt.compare(pass, users[user].password, function (err, success) {
                            // If the password is correct,
                            if (success) {

                                request.session.save(request.cookies.id, {
                                    name: user,
                                    role: users[user].role,
                                    token: request.session.get(request.cookies.id).token
                                });

                                request.redirect(302, {
                                    'Content-Type': 'text/html; charset=UTF-8',
                                    'Location': context.from
                                });
                                // Incorrect password
                            } else {
                                context.failed = true;
                                response.resolve(context);
                            }
                        });
                        // User does not exist
                    } else {
                        context.failed = true;
                        response.resolve(context);
                    }
                });
                // Something went wrong.
            }, function (err) {

                console.error(err);

                context.failed = true;

                response.resolve(context);
            });
            // This is not a post request
        } else {

            csrf.makeToken(request).then(function (id, token) {
                context.token = token;
                response.resolve(context, undefined, {
                    'Set-Cookie': 'id=' + id
                });
            });
        }
    },

    '/logout': function logout(response, request) {

        request.session.end(request.cookies.id);

        response.resolve({
            className: 'admin',
            loginPage: request.settings.loginPage
        }, undefined, { 'Set-Cookie': 'id=', 'expires': 'Thu, 01 Jan 1970 00:00:00 GMT' });
    },

    '/error': function error(response, _error) {

        response.resolve({ error: _error });
    }

};
