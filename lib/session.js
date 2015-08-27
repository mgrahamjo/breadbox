'use strict';

// This is an in-memory session store.
// Not a scalable solution.

module.exports = (() => {

	let timer,
		sessions = {};

	function deleteExpiredSessions() {

		let now = new Date();

		Object.keys(sessions).forEach(id => {

			console.log(now + ' > ' + sessions[id].expires + ' = ' + (now > sessions[id].expires));

			if (now > new Date(sessions[id].expires)) {

				console.log('deleting expired session ' + id);
				
				delete sessions[id];
			}
		});
	}

	return {

		set: (data) => {

			clearInterval(timer);

			timer = setInterval(deleteExpiredSessions, global.settings.sessionLength);

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