'use strict';

module.exports = function() {

	let sessions = {};

	return {

		save: function(id, data) {

			sessions[id] = data;
		},

		end: function(id) {

			sessions[id] = undefined;
		},

		get: function(id) {

			return sessions[id];
		}
	};
};