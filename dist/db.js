'use strict';

var promise = require('./promise'),
    fs = require('fs'),
    vm = require('vm'),
    htmlEscape = require('./htmlEscape'),
    path = require('path'),
    crash = require('./crash'),
    parentDir = path.join(__dirname, '../..').split('/').pop(),
    modelPath = __dirname.replace(parentDir + '/breadbox/dist', 'models/');

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

    fs.writeFile(modelPath + path + '.json', JSON.stringify(data), function (err) {

        crash.handle(err).then(function () {
            response.resolve(data);
        });
    });
}

function get(path, internal) {

    console.log('DB: get ' + path + (internal ? ' (internal)' : ''));

    var response = promise();

    path = modelPath + path.replace(/\.json$/, '') + '.json';

    fs.exists(path, function (exists) {

        if (exists) {

            fs.readFile(path, { encoding: 'utf8' }, function (err, data) {

                if (data) {

                    crash.handle(err).then(function () {

                        crash.attempt(function () {
                            response.resolve(JSON.parse(data));
                        });
                    });
                } else {

                    response.resolve();
                }
            });
        } else {

            response.resolve();
        }
    });

    return response;
}

// If a key is provided, the put method first gets the freshest data
// before updating that key. Otherwise it updates the whole collection.
function put(path, value, key) {

    var response = promise();

    path = path.replace(/\.json$/, '');

    console.log(key ? 'DB: put ' + value + ' in ' + path + ' at key ' + key : 'DB: put ' + value + ' in ' + path);

    if (key) {

        fs.exists(modelPath + path + '.json', function (exists) {

            if (exists) {

                get(path, true).then(function (data) {

                    if (data) {

                        vm.createContext(data);

                        vm.runInNewContext(key + '=' + JSON.stringify(value), data);
                    } else {

                        data = {};
                        data[key] = value;
                    }

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

    var response = promise();

    path = path.replace(/\.json$/, '');

    console.log(key ? 'DB: drop ' + path + '; key ' + key : 'DB: drop all - ' + path);

    fs.exists(modelPath + path + '.json', function (exists) {

        if (exists) {

            if (key) {

                get(path, true).then(function (data) {

                    vm.createContext(data);

                    vm.runInNewContext('delete ' + key, data);

                    save(path, data, response);
                });
            } else {

                fs.unlink(modelPath + path + '.json', function (err) {

                    crash.handle(err).then(function () {
                        response.resolve();
                    });
                });
            }
        } else {
            response.resolve();
        }
    });

    return response;
}

module.exports = {

    get: get,

    put: put,

    drop: drop

};
