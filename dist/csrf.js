'use strict';

var crypto = require('crypto'),
    crash = require('./crash'),
    promise = require('./promise');

var tokens = {};

function freshExpiration() {

	var expires = new Date();

	return expires.setMinutes(expires.getMinutes() + global.settings.sessionLength / 60000);
}

module.exports = {

	makeToken: function makeToken(request) {

		var result = promise();

		if (request.sess && request.sess.token) {

			result.resolve(request.cookies.id, request.sess.token);
		} else {

			crypto.randomBytes(32, function (err, rand) {

				crash.handle(err).then(function () {

					rand = rand.toString('hex');

					var mid = Math.floor(rand.length / 2),
					    id = rand.substring(0, mid),
					    token = rand.substring(mid);

					tokens[id] = token;

					request.session.save(id, {
						token: token,
						expires: freshExpiration()
					});

					result.resolve(id, token);
				});
			});
		}

		return result;
	},

	freshExpiration: freshExpiration
};
