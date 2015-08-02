'use strict';

const fs = require('fs'),
    vm = require('vm'),
    promise = require('./promise'),
    htmlEscape = require('./htmlEscape'),
    path = require('path'),
    parentDir = path.join(__dirname, '../..').split('/').pop(),
    modelPath = __dirname.replace(parentDir + '/breadbox/dist', 'models/');

function escape(data) {
    for (let key in data) {
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

    fs.writeFile(modelPath + path + '.json', JSON.stringify(data), err => {
        if (err) {
            throw err;

        } else {
            response.resolve(data);
        }
    });
}

function get(path, internal) {

    console.log('DB: get ' + path + (internal ? ' (internal)' : ''));
        
    let response = promise();
    
    path = modelPath + path + '.json';

    fs.exists(path, exists => {

        if (exists) {

            fs.readFile(path, { encoding: 'utf8' }, (err, data) => {
                console.log(data);
                if (err) { throw err; }

                try {
                
                    response.resolve(JSON.parse(data));

                } catch (err) {

                    throw err;
                }
            });
        } else {

            response.resolve(undefined);
        }
    });

    return response;
}

// If a key is provided, the put method first gets the freshest data
// before updating that key. Otherwise it updates the whole collection.
function put(path, value, key) {

    let response = promise();

    console.log('DB: put ' + value + ' in ' + path + ' at key ' + key);

    if (key) {

        fs.exists(modelPath + path + '.json', exists => {

            if (exists) {

                get(path, true).then(data => {

                    vm.createContext(data);
                    
                    vm.runInNewContext(key + '=' + JSON.stringify(value), data);

                    save(path, data, response);
                });

            } else {

                save(path, value, response);
            }
        });

    } else {

        save(path, value, response);
    }

    return response;
}

// deletes the collection, or, if key is provided,
// deletes that property from the collection
function drop(path, key) {

    let response = promise();

    console.log('DB: drop ' + path + '; key ' + key);

    if (key) {

        fs.exists(modelPath + path + '.json', exists => {

            if (exists) {

                get(path, true).then(data => {

                    vm.createContext(data);

                    vm.runInNewContext('delete ' + key, data);

                    save(path, data, response);
                });
            }
        });

    } else {

        fs.unlink(modelPath + path + '.json', err => {

            response.resolve(err);
        });
    }

    return response;
}

module.exports = {

    get: get,

    put: put,

    drop: drop

};