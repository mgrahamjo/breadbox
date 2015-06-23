'use strict';

var db = require('./lib/db'),
    fs = require('fs');

module.exports = {

    '/index': function(response) {

        db.get('index').then(function(data) {

            data.className = 'index';

            db.put('index', data.count + 1, 'count').then(function(){
                response.resolve(data);
            });
        });
    },

    '/admin': function(response) {

        var collections = [];

        fs.readdir('data', function(err, files) {

            files.forEach(function(file, index) {

                collections.push(file.replace('.json', ''));

                if (index === files.length - 1) {
                    response.resolve({ collections: collections, className: 'admin' });
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

            // try {

                context.json = JSON.parse(request.body.json);

                db.put(request.params.collection, context.json).then(function() {

                    context.json = JSON.stringify(context.json, null, 4);

                    context.saved = true;

                    response.resolve(context, 'collection.html');
                });

            // } catch(err) {

            //     console.error(err);

            //     db.get(request.params.collection).then(function(data) {

            //         context.json = JSON.stringify(data, null, 4);

            //         context.error = 'Save failed, probably due to malformed JSON.';

            //         response.resolve(context, 'collection.html');
            //     });

            // }
            
            

        } else {

            db.get(request.params.collection).then(function(data) {

                context.json = JSON.stringify(data, null, 4);

                response.resolve(context, 'collection.html');
            });
        }
    }

};