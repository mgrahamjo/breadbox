'use strict';

var fs = require('fs'),
    bcrypt = require('bcrypt-nodejs'),
    path = require('path'),
    csrf = require('./csrf'),
    thisDir = path.join(__dirname, '..'),
    parentDir = path.dirname(require.main.filename),
    css = path.join(__dirname, '../..').split(path.sep).pop() + '/breadbox/css',
    db = global.breadbox.db,
    attempt = global.breadbox.attempt,
    handle = global.breadbox.handle,
    dataPath = path.join(parentDir, global.breadbox.settings.dataPath),
    settings = global.breadbox.settings;

module.exports = {

    '/index': function index(resolve, request) {

        var context = {
            parent: parentDir,
            className: 'admin',
            css: css
        };

        // POST
        if (request.body) {

            attempt(function () {

                bcrypt.genSalt(10, function (err, salt) {

                    bcrypt.hash(request.body.password, salt, null, function (err, passHash) {

                        var user = {};

                        user[request.body.email] = {
                            password: passHash,
                            role: request.body.role
                        };

                        db.put('users', user).then(function (success) {

                            context.saved = success;

                            resolve(context, path.join(parentDir, settings.viewsPath, 'breadbox-setup.mnla'));
                        });
                    });
                });
            }, function (err) {

                console.trace(err);

                context.error = 'Save failed.';

                resolve(context, path.join(parentDir, settings.viewsPath, 'breadbox-setup.mnla'));
            });

            // GET
        } else {
                (function () {

                    var breadboxSetupPath = path.join(parentDir, settings.viewsPath, 'breadbox-setup.mnla');

                    fs.exists(breadboxSetupPath, function (exists) {

                        if (!exists) {

                            fs.readFile(thisDir + '/views/breadbox-setup.mnla', function (err, data) {

                                fs.writeFile(breadboxSetupPath, data);
                            });
                        }

                        db.get('users').then(function (users) {

                            var customPath = exists ? breadboxSetupPath : thisDir + '/views/breadbox-setup.mnla';

                            if (!users || Object.keys(users).length === 0) {
                                context.noUsers = true;
                                csrf.makeToken(request).then(function (headers, token) {
                                    context.token = token;
                                    resolve(context, customPath, headers);
                                });
                            } else {
                                resolve(context, customPath);
                            }
                        });
                    });
                })();
            }
    },

    '/admin': function admin(resolve, request) {

        var collections = [];

        function readDir(dir, outer) {

            fs.readdir(dir, function (err, files) {

                handle(err).then(function () {

                    if (files) {

                        files.forEach(function (file, index) {

                            var modelPath = path.join(dir, file);

                            fs.lstat(modelPath, function (err, stats) {

                                handle(err).then(function () {

                                    if (stats.isDirectory()) {

                                        readDir(modelPath);
                                    } else {

                                        var collection = path.relative(dataPath, modelPath).replace('.json', '');

                                        collections.push({
                                            name: collection,
                                            path: collection.replace('/', '--')
                                        });

                                        if (outer === true && index === files.length - 1) {
                                            resolve({
                                                collections: collections,
                                                className: 'admin',
                                                userRole: request.sess.role,
                                                css: css
                                            });
                                        }
                                    }
                                });
                            });
                        });
                    }
                });
            });
        }

        readDir(dataPath, true);
    },

    '/admin/<<collection>>': function adminCollection(resolve, request) {

        var collection = {
            name: request.params.collection.replace('--', '/'),
            path: request.params.collection
        },
            context = {
            collection: collection,
            className: 'admin',
            token: request.sess.token,
            css: css
        };

        if (request.body) {

            attempt(function () {

                context.json = JSON.parse(request.body.json);

                db.put(collection.name, context.json).then(function () {

                    context.json = JSON.stringify(context.json, null, 4);

                    context.saved = true;

                    resolve(context, thisDir + '/views/collection.mnla');
                });
            }, function (err) {

                console.trace(err);

                db.get(collection.name).then(function (data) {

                    context.json = JSON.stringify(data, null, 4);

                    context.error = 'Save failed, probably due to malformed JSON.';

                    resolve(context, thisDir + '/views/collection.mnla');
                });
            });
        } else {

            db.get(collection.name).then(function (data) {

                context.json = JSON.stringify(data, null, 4);

                resolve(context, thisDir + '/views/collection.mnla');
            });
        }
    },

    '/admin/new/<<collection>>': function adminNewCollection(resolve, request) {

        var collection = {
            name: request.params.collection.replace('--', '/'),
            path: request.params.collection
        },
            context = {
            collection: collection,
            className: 'admin',
            token: request.sess.token,
            css: css
        };

        fs.exists(path.join(dataPath, collection.name, '.json'), function (exists) {

            if (exists) {

                request.redirect('/admin/' + collection.path);
            } else {

                db.put(collection.name, {}).then(function () {

                    resolve(context, thisDir + '/views/collection.mnla');
                });
            }
        });
    },

    '/admin/new-user': function adminNewUser(resolve, request) {

        var context = {
            className: 'admin',
            token: request.sess.token,
            css: css
        };

        if (request.body) {

            attempt(function () {

                bcrypt.genSalt(10, function (err, salt) {

                    bcrypt.hash(request.body.password, salt, null, function (err, passHash) {

                        var user = {
                            password: passHash,
                            role: request.body.role
                        };

                        db.put('users', user, request.body.email).then(function (success) {

                            context.saved = success;

                            resolve(context, thisDir + '/views/newuser.mnla');
                        });
                    });
                });
            }, function (err) {

                console.trace(err);

                context.error = 'Save failed.';

                resolve(context, thisDir + '/views/newuser.mnla');
            });
        } else {

            resolve(context, thisDir + '/views/newuser.mnla');
        }
    },

    '/admin/delete/<<collection>>': function adminDeleteCollection(resolve, request) {

        db.del(request.params.collection.replace('--', '/')).then(function () {

            request.redirect('/admin');
        });
    },

    '/login': function login(resolve, request) {

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
                resolve(context, settings.loginView, headers);
            });
        }

        // If this is a post request, then let's try to log in.
        if (request.body) {

            attempt(function () {

                var user = request.body.email,
                    pass = request.body.password;

                db.get('users').then(function (users) {
                    // If this user exists,
                    if (users[user]) {
                        // See if the password is correct.
                        bcrypt.compare(pass, users[user].password, function (err, success) {

                            handle(err).then(function () {
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
                    resolve(context, settings.loginView, headers);
                });
            }
    },

    '/logout': function logout(resolve, request) {

        request.session.end(request.cookies.id);

        resolve({
            className: 'admin',
            loginPage: request.settings.loginPage,
            css: css
        }, settings.logoutView, { 'Set-Cookie': 'id=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT' });
    },

    '/error': function error(resolve, _error) {
        resolve({
            error: _error,
            css: css
        });
    }

};
