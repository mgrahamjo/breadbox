'use strict';

var crypto = require('crypto'),
    promise = require('./promise');

function freshExpiration() {

	return new Date(new Date().getTime() + 600000);
}

function freshHeader(id, expires) {

	expires = expires || freshExpiration();

	return { 'Set-Cookie': 'id=' + id + '; path=/; expires=' + expires.toGMTString() };
}

module.exports = {

	makeToken: function makeToken(request) {

		var result = promise();

		if (request.sess && request.sess.token) {

			var freshDate = freshExpiration();

			if (request.sess.email) {
				request.session.save(request.cookies.id, freshDate, 'expires');
			}

			result.resolve(freshHeader(request.cookies.id, freshDate), request.sess.token);
		} else {

			crypto.randomBytes(32, function (err, rand) {

				global.handle(err).then(function () {

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
