'use strict';

var db = require('./db'),
    promise = require('./promise');

module.exports = {

	save: function save(id, data) {

		db.put('sessions', data, id);
	},

	end: function end(id) {

		db.drop('sessions', id);
	},

	get: function get(id) {

		var session = promise();

		db.get('sessions').then(function (sessions) {

			session.resolve(sessions ? sessions[id] : null);
		});

		return session;
	}
};
