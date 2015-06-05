'use strict';

var fs = require('fs'),
    vm = require('vm'),
    promise = require('./promise')

module.exports = {

    get: function(path) {

        var response = promise();

        fs.readFile('././data/' + path + '.json', { encoding: 'utf8' }, function(err, data) {
            
            if (err) { throw err; }
            
            response.resolve(JSON.parse(data));
        });

        return response;
    },

    // The put method first gets the freshest data, then
    // updates a specific property of the fresh data.
    put: function(path, key, value) {

        var response = promise();

        this.get(path).then(function(data) {

            vm.createContext(data);
            
            vm.runInNewContext(key + '=' + value, data);

            fs.writeFile('././data/' + path + '.json', JSON.stringify(data), function(err) {
                if (err) {
                    throw err;

                } else {
                    response.resolve('success');
                }
            });
        });

        return response;
    }

};