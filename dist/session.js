'use strict';

// This is an in-memory session store.

var sessions = {};

function checkExpiredSessions() {

	var expires = undefined,
	    now = new Date();

	Object.keys(sessions).forEach(function (id) {

		expires = sessions[id].expires;

		if (!expires || new Date(expires) < now) {
			console.log('dropping expired session ' + id);
			delete sessions[id];
		}
	});
}

// Check for expired sessions every minute.
setInterval(checkExpiredSessions, 60000);

module.exports = {

	set: function set(data) {

		sessions = data || {};

		checkExpiredSessions();
	},

	save: function save(id, data, key) {

		if (key) {
			sessions[id][key] = data;
		} else {
			sessions[id] = data;
		}
	},

	end: function end(id) {

		delete sessions[id];
	},

	get: function get(id) {

		return sessions[id];
	},

	all: function all() {

		return sessions;
	}
};
