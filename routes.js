'use strict';

const fs = require('fs'),
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

    '/index': function(resolve, request) {

        let context = {
            parent: parentDir,
            className: 'admin',
            css: css
        };

        // POST
        if (request.body) {

            attempt(() => {

                bcrypt.genSalt(10, (err, salt) => {

                    bcrypt.hash(request.body.password, salt, null, (err, passHash) => {
                        
                        let user = {};

                        user[request.body.email] = {
                            password: passHash,
                            role: request.body.role
                        };

                        db.put('users', user).then(success => {

                            context.saved = success;

                            resolve(context, path.join(parentDir, settings.viewsPath, 'breadbox-setup.mnla'));
                        });
                    });
                });

            }, err => {

                console.trace(err);

                context.error = 'Save failed.';

                resolve(context, path.join(parentDir, settings.viewsPath, 'breadbox-setup.mnla'));
            });

        // GET
        } else {

            let breadboxSetupPath = path.join(parentDir, settings.viewsPath, 'breadbox-setup.mnla');

            fs.exists(breadboxSetupPath, exists => {

                if (!exists) {

                    fs.readFile(thisDir + '/views/breadbox-setup.mnla', (err, data) => {

                        fs.writeFile(breadboxSetupPath, data);
                    });
                }

                db.get('users').then(users => {

                    let customPath = exists ? breadboxSetupPath : thisDir + '/views/breadbox-setup.mnla';

                    if (!users || Object.keys(users).length === 0) {
                        context.noUsers = true;
                        csrf.makeToken(request).then((headers, token) => {
                            context.token = token;
                            resolve(context, customPath, headers);
                        });
                    } else {
                        resolve(context, customPath);
                    }
                });
            });
        }
    },

    '/admin': function(resolve, request) {

        let collections = [];

        function readDir(dir, totalFileCount) {

            let files = fs.readdirSync(dir);

            if (files) {

                files.forEach(file => {

                    let modelPath = path.join(dir, file),

                        stats = fs.lstatSync(modelPath);

                    if (stats.isDirectory()) {

                        readDir(modelPath, totalFileCount);

                    } else if (file !== '.DS_Store') {

                        let collection = path.relative(dataPath, modelPath).replace('.json', '');

                        collections.push({
                            name: collection,
                            path: collection.replace('/', '--')
                        });
                    }
                });
            }
        }

        readDir(dataPath);

        resolve({
            collections: collections,
            className: 'admin',
            userRole: request.sess.role,
            css: css
        });
        
    },

    '/admin/<:collection:>': function(resolve, request) {

        let collection = {
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

            attempt(() => {

                context.json = JSON.parse(request.body.json);

                db.put(collection.name, context.json).then(() => {

                    context.json = JSON.stringify(context.json, null, 4);

                    context.saved = true;

                    resolve(context, thisDir + '/views/collection.mnla');
                });

            }, err => {

                console.trace(err);

                db.get(collection.name).then(data => {

                    context.json = JSON.stringify(data, null, 4);

                    context.error = 'Save failed, probably due to malformed JSON.';

                    resolve(context, thisDir + '/views/collection.mnla');
                });
            });

        } else {

            db.get(collection.name).then(data => {

                context.json = JSON.stringify(data, null, 4);

                resolve(context, thisDir + '/views/collection.mnla');
            });
        }
    },

    '/admin/new/<:collection:>': function(resolve, request) {

        let collection = {
            name: request.params.collection.replace('--', '/'),
            path: request.params.collection
        },
        context = {
            collection: collection,
            className: 'admin',
            token: request.sess.token,
            css: css
        };

        fs.exists(path.join(dataPath, collection.name, '.json'), exists => {

            if (exists) {

                request.redirect('/admin/' + collection.path);

            } else {

                db.put(collection.name, {}).then(() => {

                    resolve(context, thisDir + '/views/collection.mnla');
                });
            }
        });
    },

    '/admin/new-user': function(resolve, request) {

        let context = {
            className: 'admin',
            token: request.sess.token,
            css: css
        };

        if (request.body) {

            attempt(() => {

                bcrypt.genSalt(10, (err, salt) => {

                    bcrypt.hash(request.body.password, salt, null, (err, passHash) => {
                        
                        let user = {
                            password: passHash,
                            role: request.body.role
                        };

                        db.put('users', user, request.body.email).then(success => {

                            context.saved = success;

                            resolve(context, thisDir + '/views/newuser.mnla');
                        });
                    });
                });

            }, err => {

                console.trace(err);

                context.error = 'Save failed.';

                resolve(context, thisDir + '/views/newuser.mnla');
            });

        } else {

            resolve(context, thisDir + '/views/newuser.mnla');
        }        
    },

    '/admin/delete/<:collection:>': function(resolve, request) {

        db.del(request.params.collection.replace('--', '/')).then(() => {

            request.redirect('/admin');
        });
    },

    '/login': function(resolve, request) {

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
                resolve(context, settings.loginView, headers);
            });
        }

        // If this is a post request, then let's try to log in.
        if (request.body) {

            attempt(() => {

                let user = request.body.email,
                    pass = request.body.password;

                db.get('users').then(users => {
                    // If this user exists,
                    if (users[user]) {
                        // See if the password is correct.
                        bcrypt.compare(pass, users[user].password, (err, success) => {

                            handle(err).then(() => {
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
            }, err => {

                console.trace(err);

                fail();
            });
        // This is not a post request
        } else {

            csrf.makeToken(request).then((headers, token) => {
                context.token = token;
                resolve(context, settings.loginView, headers);
            });
        }
    }, 

    '/logout': function(resolve, request) {

        request.session.end(request.cookies.id);

        resolve({
            className: 'admin', 
            loginPage: request.settings.loginPage,
            css: css
        }, settings.logoutView, { 'Set-Cookie': 'id=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT' });
    },

    '/error': function(resolve, error) {
        resolve({
            error: error,
            css: css
        });
    }

};