'use strict';

// This is an in-memory session store.
// Not a scalable solution.

module.exports = (() => {

	let sessions = {};

	return {

		set: data => {

			sessions = data || {};
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