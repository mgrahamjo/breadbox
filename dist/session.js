'use strict';

module.exports = function () {

	var sessions = {};

	return {

		save: function save(id, data) {

			sessions[id] = data;
		},

		end: function end(id) {

			sessions[id] = undefined;
		},

		get: function get(id) {

			return sessions[id];
		}
	};
};
