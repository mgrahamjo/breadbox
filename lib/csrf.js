'use strict';

const crypto = require('crypto'),
	promise = require('./promise');

function freshExpiration() {

	return new Date(new Date().getTime() + 600000);
}

function freshHeader(id, expires) {

	expires = expires || freshExpiration();

	return { 'Set-Cookie': 'id=' + id + '; path=/; expires=' + expires.toGMTString() };
}

module.exports = {
	
	makeToken: request => {
		
		let result = promise();

		if (request.sess && request.sess.token) {

			let freshDate = freshExpiration();
			
			if (request.sess.email) {
				request.session.save(request.cookies.id, freshDate, 'expires');
			}

			result.resolve(freshHeader(request.cookies.id, freshDate), request.sess.token);

		} else {

			crypto.randomBytes(32, (err, rand) => {
				
				global.handle(err).then(() => {

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