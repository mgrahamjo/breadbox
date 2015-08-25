'use strict';

// This is an in-memory session store.
// Not a scalable solution.

module.exports = (function () {

	var sessions = {};

	return {

		set: function set(data) {

			sessions = data || {};
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
