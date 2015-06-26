'use strict';

var db = require('./lib/db'),
    fs = require('fs');

module.exports = {

    '/admin': function(response) {

        var collections = [];

        fs.readdir(__dirname.replace('/node_modules/breadbox', '/models'), function(err, files) {

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

                    response.resolve(context, '../node_modules/breadbox/views/collection.html');
                });

            } catch(err) {

                console.error(err);

                db.get(request.params.collection).then(function(data) {

                    context.json = JSON.stringify(data, null, 4);

                    context.error = 'Save failed, probably due to malformed JSON.';

                    response.resolve(context, '../node_modules/breadbox/views/collection.html');
                });

            }

        } else {

            db.get(request.params.collection).then(function(data) {

                context.json = JSON.stringify(data, null, 4);

                response.resolve(context, '../node_modules/breadbox/views/collection.html');
            });
        }
    }

};