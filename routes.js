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
        
        function getProperties(data, properties, path) {

            Object.keys(data).forEach(function(key) {
                if (data.hasOwnProperty(key)) {
                    if (typeof data[key] !== 'object') {
                        properties.push({
                            key: path ? path + '.' + key : key,
                            value: data[key]
                        })
                    } else {
                        getProperties(data[key], properties, path ? path + '.' + key : key);
                    }
                }
            });
        }

        var collections = [];

        fs.readdir('data', function(err, files) {

            files.forEach(function(file, index) {

                db.get(file.replace('.json', '')).then(function(data) {

                    var collection = {
                        name: file,
                        properties: []
                    };

                    getProperties(data, collection.properties);

                    collections.push(collection);

                    if (index === files.length - 1) {
                        response.resolve({ collections: collections });
                    }
                });
            });
        });
    }

};