'use strict';

const db = require('./db'),
	promise = require('./promise');

module.exports = {

	save: function(id, data) {

		db.put('sessions', data, id);
	},

	end: function(id) {

		db.drop('sessions', id);
	},

	get: function(id) {

		let session = promise();

		db.get('sessions').then(function(sessions) {

			session.resolve(sessions ? sessions[id] : null);
		});

		return session;
	}
};