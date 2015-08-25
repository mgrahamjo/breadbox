'use strict';

const crypto = require('crypto'),
	crash = require('./crash'),
	promise = require('./promise');

let tokens = {};

function freshToken() {

	let expires = new Date();

	return expires.setMinutes(expires.getMinutes() + 10);
}

module.exports = {
	
	makeToken: request => {
		
		let response = promise();

		if (request.session && request.session.token) {

			response.resolve(request.cookies.id, request.session.token);

		} else {

			crypto.randomBytes(32, function(err, rand) {
				
				crash.handle(err).then(() => {

				  	rand = rand.toString('hex');

				  	let mid = Math.floor(rand.length / 2),
				  		id = rand.substring(0, mid),
				  		token = rand.substring(mid);

				  	tokens[id] = token;
				  	
				  	request.session.save(id, {
		                token: token,
		                expires: freshToken()
		            });

				  	response.resolve(id, token);
			  	
				});
			});
		}

		return response;
	},

	freshToken: freshToken
};