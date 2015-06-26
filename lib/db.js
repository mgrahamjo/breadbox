'use strict';

var fs = require('fs'),
    vm = require('vm'),
    promise = require('./promise'),
    htmlEscape = require('./htmlEscape'),
    modelPath = __dirname.replace('/node_modules/breadbox/lib', '/models/');

function escape(data) {
    for (var key in data) {
        if (data.hasOwnProperty(key)) {
            if (typeof data[key] === 'string') {
                data[key] = htmlEscape(data[key]);
            } else if (typeof data[key] === 'object') {
                escape(data[key]);
            }
        }
    }
}

function save(path, data, response) {

    escape(data);

    fs.writeFile(modelPath + path + '.json', JSON.stringify(data), function(err) {
        if (err) {
            throw err;

        } else {
            response.resolve('success');
        }
    });
}

module.exports = {

    get: function(path) {

        var response = promise();

        fs.readFile(modelPath + path + '.json', { encoding: 'utf8' }, function(err, data) {
            
            if (err) { throw err; }
            
            response.resolve(JSON.parse(data));
        });

        return response;
    },

    // If a key is provided, the put method first gets the freshest data
    // before updating that key. Otherwise it updates the whole collection.
    put: function(path, value, key) {

        var response = promise();

        if (key) {

            this.get(path).then(function(data) {

                vm.createContext(data);
                
                vm.runInNewContext(key + '=' + value, data);

                save(path, data, response);
            });

        } else {

            save(path, value, response);
        }

        return response;
    }

};