'use strict';

var db = require('./db'),
    fs = require('fs'),
    bcrypt = require('bcrypt-nodejs'),
    path = require('path'),
    csrf = require('./csrf'),
    thisDir = path.join(__dirname, '..'),
    parentDir = path.join(__dirname, '../../..'),
    css = path.join(__dirname, '../..').split(path.sep).pop() + '/breadbox/css';

module.exports = {

    '/index': function index(response, request) {

        var context = {
            parent: parentDir,
            className: 'admin',
            css: css
        };

        // POST
        if (request.body) {

            global.attempt(function () {

                bcrypt.genSalt(10, function (err, salt) {

                    bcrypt.hash(request.body.password, salt, null, function (err, passHash) {

                        var user = {};

                        user[request.body.name] = {
                            password: passHash,
                            role: request.body.role
                        };

                        console.log(user);

                        db.put('users', user).then(function (success) {

                            context.saved = success;

                            response.resolve(context, parentDir + '/views/breadbox-setup.html');
                        });
                    });
                });
            }, function (err) {

                console.trace(err);

                context.error = 'Save failed.';

                response.resolve(context, parentDir + '/views/breadbox-setup.html');
            });

            // GET
        } else {

            fs.exists(parentDir + '/views/breadbox-setup.html', function (exists) {

                if (!exists) {

                    fs.readFile(thisDir + '/views/breadbox-setup.html', function (err, data) {

                        fs.writeFile(parentDir + '/views/breadbox-setup.html', data);
                    });
                }

                db.get('users').then(function (users) {

                    if (!users) {
                        context.noUsers = true;
                        context.token = request.sess.token;
                    }

                    response.resolve(context, exists ? parentDir + '/views/breadbox-setup.html' : thisDir + '/views/breadbox-setup.html');
                });
            });
        }
    },

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
                            userRole: request.sess.role,
                            css: css
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
            token: request.sess.token,
            css: css
        };

        if (request.body) {

            global.attempt(function () {

                context.json = JSON.parse(request.body.json);

                db.put(request.params.collection, context.json).then(function () {

                    context.json = JSON.stringify(context.json, null, 4);

                    context.saved = true;

                    response.resolve(context, thisDir + '/views/collection.html');
                });
            }, function (err) {

                console.trace(err);

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
            token: request.sess.token,
            css: css
        };

        fs.exists(parentDir + '/models/' + request.params.collection + '.json', function (exists) {

            if (exists) {

                request.redirect('/admin/' + request.params.collection);
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
            token: request.sess.token,
            css: css
        };

        if (request.body) {

            global.attempt(function () {

                bcrypt.genSalt(10, function (err, salt) {

                    bcrypt.hash(request.body.password, salt, null, function (err, passHash) {

                        var user = {
                            password: passHash,
                            role: request.body.role
                        };

                        db.put('users', user, request.body.email).then(function (success) {

                            context.saved = success;

                            response.resolve(context, thisDir + '/views/newuser.html');
                        });
                    });
                });
            }, function (err) {

                console.trace(err);

                context.error = 'Save failed.';

                response.resolve(context, thisDir + '/views/newuser.html');
            });
        } else {

            response.resolve(context, thisDir + '/views/newuser.html');
        }
    },

    '/admin/delete/{{collection}}': function adminDeleteCollection(response, request) {

        db.drop(request.params.collection).then(function () {

            request.redirect('/admin');
        });
    },

    '/login': function login(response, request) {

        var context = {
            className: 'admin',
            from: request.query.from || '/admin',
            failed: false,
            css: css
        },
            fails = request.sess ? request.sess.fails || 0 : 0;

        if (fails >= 2) {
            context.multipleAttempts = true;
        }

        if (fails >= 5) {
            context.tooManyAttempts = true;
        }

        function fail() {
            context.failed = true;
            request.session.save(request.cookies.id, fails + 1, 'fails');
            csrf.makeToken(request).then(function (headers, token) {
                context.token = token;
                response.resolve(context, request.settings.loginPage, headers);
            });
        }

        // If this is a post request, then let's try to log in.
        if (request.body) {

            global.attempt(function () {

                var user = request.body.email,
                    pass = request.body.password;

                db.get('users').then(function (users) {
                    // If this user exists,
                    if (users[user]) {
                        // See if the password is correct.
                        bcrypt.compare(pass, users[user].password, function (err, success) {
                            // If the password is correct,
                            if (success) {

                                request.session.save(request.cookies.id, {
                                    email: user,
                                    role: users[user].role,
                                    token: request.sess.token,
                                    expires: request.sess.expires
                                });

                                request.redirect(context.from);
                                // Incorrect password
                            } else {
                                fail();
                            }
                        });
                        // User does not exist
                    } else {
                        fail();
                    }
                });
                // Something went wrong.
            }, function (err) {

                console.trace(err);

                fail();
            });
            // This is not a post request
        } else {

            csrf.makeToken(request).then(function (headers, token) {
                context.token = token;
                response.resolve(context, request.settings.loginPage, headers);
            });
        }
    },

    '/logout': function logout(response, request) {

        request.session.end(request.cookies.id);

        response.resolve({
            className: 'admin',
            loginPage: request.settings.loginPage,
            css: css
        }, request.settings.logoutPage, { 'Set-Cookie': 'id=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT' });
    },

    '/error': function error(response, _error) {
        response.resolve({
            error: _error,
            css: css
        });
    }

};
