'use strict';

var crypto = require('crypto'),
    crash = require('./crash'),
    promise = require('./promise');

function freshExpiration() {

	var expires = new Date();

	return new Date(expires.setMinutes(expires.getMinutes() + global.settings.sessionLength / 60000));
}

function freshHeader(id, expires) {

	expires = expires || freshExpiration();

	return { 'Set-Cookie': 'id=' + id + '; path=/; expires=' + expires.toGMTString() };
}

module.exports = {

	makeToken: function makeToken(request) {

		var result = promise();

		if (request.sess && request.sess.token) {

			result.resolve(freshHeader(request.cookies.id), request.sess.token);
		} else {

			crypto.randomBytes(32, function (err, rand) {

				crash.handle(err).then(function () {

					rand = rand.toString('hex');

					var mid = Math.floor(rand.length / 2),
					    id = rand.substring(0, mid),
					    token = rand.substring(mid),
					    expires = freshExpiration();

					request.session.save(id, {
						token: token,
						expires: expires
					});

					result.resolve(freshHeader(id, expires), token);
				});
			});
		}

		return result;
	}
};
