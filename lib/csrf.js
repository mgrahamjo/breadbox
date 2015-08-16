'use strict';

const crypto = require('crypto'),
	crash = require('./crash'),
	promise = require('./promise');

let tokens = {};

module.exports = {
	
	makeToken: session => {
		
		let response = promise();

		crypto.randomBytes(32, function(err, rand) {
			
			crash.handle(err).then(() => {

			  	rand = rand.toString('hex');

			  	let mid = Math.floor(rand.length / 2),
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