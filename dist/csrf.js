'use strict';

var crypto = require('crypto'),
    crash = require('./crash'),
    promise = require('./promise');

var tokens = {};

module.exports = {

	makeToken: function makeToken(session) {

		var response = promise();

		crypto.randomBytes(32, function (err, rand) {

			crash.handle(err).then(function () {

				rand = rand.toString('hex');

				var mid = Math.floor(rand.length / 2),
				    id = rand.substring(0, mid),
				    token = rand.substring(mid);

				tokens[id] = token;

				session.save(id, {
					token: token
				});

				response.resolve(id, token);
			});
		});

		return response;
	}
};
