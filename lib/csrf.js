'use strict';

const crypto = require('crypto'),
	crash = require('./crash'),
	promise = require('./promise');

let tokens = {};

function freshExpiration() {

	let expires = new Date();

	return expires.setMinutes(expires.getMinutes() + (global.settings.sessionLength / 60000));
}

module.exports = {
	
	makeToken: request => {
		
		let result = promise();

		if (request.sess && request.sess.token) {

			result.resolve(request.cookies.id, request.sess.token);

		} else {

			crypto.randomBytes(32, (err, rand) => {
				
				crash.handle(err).then(() => {

				  	rand = rand.toString('hex');

				  	let mid = Math.floor(rand.length / 2),
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