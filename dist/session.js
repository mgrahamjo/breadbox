'use strict';

// This is an in-memory session store.
// Not a scalable solution.

module.exports = (function () {

	var timer = undefined,
	    sessions = {};

	function deleteExpiredSessions() {

		var now = new Date();

		Object.keys(sessions).forEach(function (id) {

			console.log(now + ' > ' + sessions[id].expires + ' = ' + (now > sessions[id].expires));

			if (now > new Date(sessions[id].expires)) {

				console.log('deleting expired session ' + id);

				delete sessions[id];
			}
		});
	}

	return {

		set: function set(data) {

			clearInterval(timer);

			timer = setInterval(deleteExpiredSessions, global.settings.sessionLength);

			sessions = data || {};

			deleteExpiredSessions();
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
})();
