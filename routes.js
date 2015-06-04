'use strict';

var db = require('./lib/db');

module.exports = {

    '/index': function(response) {

        db.get('index').then(function(data) {

            db.put('index', 'count', data.count + 1).then(function(){
                response.resolve(data);
            });
        });
    }

};