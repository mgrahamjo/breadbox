'use strict';

// This is an in-memory session store.
// Not a scalable solution.

let sessions = {};

function checkExpiredSessions() {

	let expires,
		now = new Date();

	Object.keys(sessions).forEach(id => {

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

	set: (data) => {

		sessions = data || {};

		checkExpiredSessions();
	},

	save: (id, data, key) => {

		if (key) {
			sessions[id][key] = data;
		} else {
			sessions[id] = data;
		}
	},

	end: id => {

		delete sessions[id];
	},

	get: id => {

		return sessions[id];
	},

	all: () => {

		return sessions;
	}
};