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

                db.get(file.replace('.json', '')).then(function(data) {

                    collections.push(JSON.stringify(data, null, 4));

                    if (index === files.length - 1) {
                        response.resolve({ collections: collections, show: true });
                    }
                });
            });
        });
    }

};