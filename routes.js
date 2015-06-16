'use strict';

var db = require('./lib/db'),
    fs = require('fs');

module.exports = {

    '/index': function(response) {

        db.get('index').then(function(data) {

            db.put('index', 'count', data.count + 1).then(function(){
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
                    response.resolve({ collections: collections });
                }
            });
        });
    },

    '/admin/{{collection}}': function(response, request) {

        db.get(request.params.collection).then(function(data) {

            response.resolve({ json: JSON.stringify(data, null, 4) });
        });
    }

};