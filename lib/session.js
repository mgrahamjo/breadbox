'use strict';

// This is an in-memory session store.
// Not a scalable solution.

module.exports = (() => {

	let timer,
		sessions = {};

	function deleteExpiredSessions() {

		let now = new Date();

		Object.keys(sessions).forEach(id => {

			if (now > new Date(sessions[id].expires)) {

				console.log('deleting expired session ' + id);
				
				delete sessions[id];
			}
		});
	}

	return {

		set: (data) => {

			clearInterval(timer);

			timer = setInterval(deleteExpiredSessions, 12000); // check for expired sessions every 2 minutes

			sessions = data || {};

			deleteExpiredSessions();
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
})();