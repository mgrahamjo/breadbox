'use strict';

const crypto = require('crypto'),
	crash = require('./crash'),
	promise = require('./promise');

function freshHeader(id) {

	let expires = new Date();

	expires = new Date(expires.setMinutes(expires.getMinutes() + (global.settings.sessionLength / 60000))).toGMTString();

	return { 'Set-Cookie': 'id=' + id + '; path=/; expires=' + expires };
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
				  		token = rand.substring(mid);
				  	
				  	request.session.save(id, {
		                token: token
		            });

				  	result.resolve(freshHeader(id), token);
			  	
				});
			});
		}

		return result;
	}
};