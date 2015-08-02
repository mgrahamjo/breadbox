'use strict';

const db = require('./db'),
    fs = require('fs'),
    bcrypt = require('bcrypt-nodejs'),
    path = require('path'),
    thisDir = path.join(__dirname, '..'),
    parentDir = path.join(__dirname, '../../..');

function encode(str) {
    return new Buffer(str).toString('base64').replace('=', '');
}

module.exports = {

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
                            userRole: request.session.get(request.cookies.id).role
                        });
                    }
                });
            }
        });
    },

    '/admin/{{collection}}': function(response, request) {

        let context = {
            collection: request.params.collection,
            className: 'admin'
        };

        if (request.body) {

            try {

                context.json = JSON.parse(request.body.json);

                db.put(request.params.collection, context.json).then(() => {

                    context.json = JSON.stringify(context.json, null, 4);

                    context.saved = true;

                    response.resolve(context, thisDir + '/views/collection.html');
                });

            } catch(err) {

                console.error(err);

                db.get(request.params.collection).then(data => {

                    context.json = JSON.stringify(data, null, 4);

                    context.error = 'Save failed, probably due to malformed JSON.';

                    response.resolve(context, thisDir + '/views/collection.html');
                });
            }

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
            className: 'admin'
        };

        fs.exists(parentDir + '/models/' + request.params.collection + '.json', exists => {

            if (exists) {

                request.redirect(302, {
                    'Content-Type': 'text/html; charset=UTF-8',
                    'Location': '/admin/' + request.params.collection
                });

            } else {

                db.put(request.params.collection, {}).then(() => {

                    response.resolve(context, thisDir + '/views/collection.html');
                });
            }
        });
    },

    '/admin/new-user': function(response, request) {

        let context = {
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

                        db.put('users', user, request.body.name).then(success => {

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

        db.drop(request.params.collection).then(() => {

            request.redirect(302, {
                'Content-Type': 'text/html; charset=UTF-8',
                'Location': '/admin'
            });
        });
    },

    '/login': function(response, request) {

        let context = { className: 'admin' };

        if (request.body) {

            context.from = request.body.from;

            try {

                let user = request.body.username,
                    pass = request.body.password;

                db.get('users').then(users => {

                    if (users[user]) {

                        bcrypt.compare(pass, users[user].password, (err, success) => {

                            if (success) {

                                let id = encode(user);

                                request.session.save(id, {
                                    name: user,
                                    role: users[user].role
                                });
                            
                                request.redirect(302, {
                                    'Set-Cookie': 'id=' + id,
                                    'Content-Type': 'text/html; charset=UTF-8',
                                    'Location': request.body.from
                                });
                            
                            } else {
                                context.failed = true;
                            }
                        });
                    } else {
                        context.failed = true;
                    }
                });

            } catch(err) {

                console.error(err);

                context.failed = true;
            }

        } else {

            context.from = request.query.from || '/admin';
        }
        
        response.resolve(context);
    }, 

    '/logout': function(response, request) {

        request.session.end(request.cookies.id);

        response.resolve({
            className: 'admin', 
            loginPage: request.settings.loginPage
        }, undefined, {'Set-Cookie': 'id=', 'expires': 'Thu, 01 Jan 1970 00:00:00 GMT' });
    },

    '/error': function(response, error) {

        response.resolve({ error: error });
    }

};