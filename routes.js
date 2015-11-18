'use strict';

const db = require('./db'),
    fs = require('fs'),
    bcrypt = require('bcrypt-nodejs'),
    path = require('path'),
    csrf = require('./csrf'),
    thisDir = path.join(__dirname, '..'),
    parentDir = path.join(__dirname, '../../..'),
    css = path.join(__dirname, '../..').split(path.sep).pop() + '/breadbox/css';

module.exports = {

    '/index': function(response, request) {

        let context = {
            parent: parentDir,
            className: 'admin',
            css: css
        };

        // POST
        if (request.body) {

            global.attempt(() => {

                bcrypt.genSalt(10, (err, salt) => {

                    bcrypt.hash(request.body.password, salt, null, (err, passHash) => {
                        
                        let user = {};

                        user[request.body.name] = {
                            password: passHash,
                            role: request.body.role
                        };

                        console.log(user);

                        db.put('users', user).then(success => {

                            context.saved = success;

                            response.resolve(context, parentDir + '/views/breadbox-setup.html');
                        });
                    });
                });

            }, err => {

                console.trace(err);

                context.error = 'Save failed.';

                response.resolve(context, parentDir + '/views/breadbox-setup.html');
            });

        // GET
        } else {

            fs.exists(parentDir + '/views/breadbox-setup.html', exists => {

                if (!exists) {

                    fs.readFile(thisDir + '/views/breadbox-setup.html', (err, data) => {

                        fs.writeFile(parentDir + '/views/breadbox-setup.html', data);
                    });
                }

                db.get('users').then(users => {

                    if (!users) {
                        context.noUsers = true;
                        context.token = request.sess.token;
                    }

                    response.resolve(context, exists ? parentDir + '/views/breadbox-setup.html' : thisDir + '/views/breadbox-setup.html');
                });
            });
        }
    },

    '/admin': function(response, request) {

        let collections = [];

        fs.readdir(parentDir + '/models', (err, files) => {

            if (files) {

                files.forEach((file, index) => {

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

    '/admin/{{collection}}': function(response, request) {

        let context = {
            collection: request.params.collection,
            className: 'admin',
            token: request.sess.token,
            css: css
        };

        if (request.body) {

            global.attempt(() => {

                context.json = JSON.parse(request.body.json);

                db.put(request.params.collection, context.json).then(() => {

                    context.json = JSON.stringify(context.json, null, 4);

                    context.saved = true;

                    response.resolve(context, thisDir + '/views/collection.html');
                });

            }, (err) => {

                console.trace(err);

                db.get(request.params.collection).then(data => {

                    context.json = JSON.stringify(data, null, 4);

                    context.error = 'Save failed, probably due to malformed JSON.';

                    response.resolve(context, thisDir + '/views/collection.html');
                });
            });

        } else {

            db.get(request.params.collection).then(data => {

                context.json = JSON.stringify(data, null, 4);

                response.resolve(context, thisDir + '/views/collection.html');
            });
        }
    },

    '/admin/new/{{collection}}': function(response, request) {

        let context = {
            collection: request.params.collection,
            className: 'admin',
            token: request.sess.token,
            css: css
        };

        fs.exists(parentDir + '/models/' + request.params.collection + '.json', exists => {

            if (exists) {

                request.redirect('/admin/' + request.params.collection);

            } else {

                db.put(request.params.collection, {}).then(() => {

                    response.resolve(context, thisDir + '/views/collection.html');
                });
            }
        });
    },

    '/admin/new-user': function(response, request) {

        let context = {
            className: 'admin',
            token: request.sess.token,
            css: css
        };

        if (request.body) {

            global.attempt(() => {

                bcrypt.genSalt(10, (err, salt) => {

                    bcrypt.hash(request.body.password, salt, null, (err, passHash) => {
                        
                        let user = {
                            password: passHash,
                            role: request.body.role
                        };

                        db.put('users', user, request.body.email).then(success => {

                            context.saved = success;

                            response.resolve(context, thisDir + '/views/newuser.html');
                        });
                    });
                });

            }, err => {

                console.trace(err);

                context.error = 'Save failed.';

                response.resolve(context, thisDir + '/views/newuser.html');
            });

        } else {

            response.resolve(context, thisDir + '/views/newuser.html');
        }        
    },

    '/admin/delete/{{collection}}': function(response, request) {

        db.drop(request.params.collection).then(() => {

            request.redirect('/admin');
        });
    },

    '/login': function(response, request) {

        let context = {
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
            csrf.makeToken(request).then((headers, token) => {
                context.token = token;
                response.resolve(context, request.settings.loginPage, headers);
            });
        }

        // If this is a post request, then let's try to log in.
        if (request.body) {

            global.attempt(() => {

                let user = request.body.email,
                    pass = request.body.password;

                db.get('users').then(users => {
                    // If this user exists,
                    if (users[user]) {
                        // See if the password is correct.
                        bcrypt.compare(pass, users[user].password, (err, success) => {
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
            }, err => {

                console.trace(err);

                fail();
            });
        // This is not a post request
        } else {

            csrf.makeToken(request).then((headers, token) => {
                context.token = token;
                response.resolve(context, request.settings.loginPage, headers);
            });
        }
    }, 

    '/logout': function(response, request) {

        request.session.end(request.cookies.id);

        response.resolve({
            className: 'admin', 
            loginPage: request.settings.loginPage,
            css: css
        }, request.settings.logoutPage, { 'Set-Cookie': 'id=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT' });
    },

    '/error': function(response, error) {
        response.resolve({
            error: error,
            css: css
        });
    }

};