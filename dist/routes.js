'use strict';

var db = require('./db'),
    fs = require('fs'),
    bcrypt = require('bcrypt-nodejs'),
    path = require('path'),
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
            className: 'admin'
        };

        if (request.body) {

            try {

                context.json = JSON.parse(request.body.json);

                db.put(request.params.collection, context.json).then(function () {

                    context.json = JSON.stringify(context.json, null, 4);

                    context.saved = true;

                    response.resolve(context, thisDir + '/views/collection.html');
                });
            } catch (err) {

                console.error(err);

                db.get(request.params.collection).then(function (data) {

                    context.json = JSON.stringify(data, null, 4);

                    context.error = 'Save failed, probably due to malformed JSON.';

                    response.resolve(context, thisDir + '/views/collection.html');
                });
            }
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
            className: 'admin'
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
            className: 'admin'
        };

        if (request.body) {

            try {

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
            } catch (err) {

                console.error(err);

                context.error = 'Save failed.';

                response.resolve(context, thisDir + '/views/newuser.html');
            }
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

        var context = { className: 'admin' };

        if (request.body) {

            context.from = request.body.from;

            try {
                (function () {

                    var user = request.body.username,
                        pass = request.body.password;

                    db.get('users').then(function (users) {

                        if (users[user]) {

                            bcrypt.compare(pass, users[user].password, function (err, success) {

                                if (success) {

                                    require('crypto').randomBytes(16, function (err, buffer) {

                                        if (err) {
                                            throw err;
                                        }

                                        var id = buffer.toString('hex');

                                        request.session.save(id, {
                                            name: user,
                                            role: users[user].role
                                        });

                                        request.redirect(302, {
                                            'Set-Cookie': 'id=' + id,
                                            'Content-Type': 'text/html; charset=UTF-8',
                                            'Location': request.body.from
                                        });
                                    });
                                } else {
                                    context.failed = true;
                                }
                            });
                        } else {
                            context.failed = true;
                        }
                    });
                })();
            } catch (err) {

                console.error(err);

                context.failed = true;
            }
        } else {

            context.from = request.query.from || '/admin';
        }

        response.resolve(context);
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
