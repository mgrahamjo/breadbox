'use strict';

const crypto = require('crypto'),
	crash = require('./crash'),
	promise = require('./promise');

function freshExpiration() {

	let expires = new Date();

	return new Date(expires.setMinutes(expires.getMinutes() + (global.settings.sessionLength / 60000)));
}

function freshHeader(id, expires) {

	expires = expires || freshExpiration();

	return { 'Set-Cookie': 'id=' + id + '; path=/; expires=' + expires.toGMTString() };
}

module.exports = {
	
	makeToken: request => {
		
		let result = promise();

		if (request.sess && request.sess.token) {

			result.resolve(freshHeader(request.cookies.id), request.sess.token);

		} else {

			crypto.randomBytes(32, (err, rand) => {
				
				crash.handle(err).then(() => {

				  	rand = rand.toString('hex');

				  	let mid = Math.floor(rand.length / 2),
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