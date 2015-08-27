'use strict';

var promise = require('./promise');

module.exports = {

	// Error interceptor
	handle: function handle(err) {
		var status = arguments[1] === undefined ? 500 : arguments[1];
		var headers = arguments[2] === undefined ? { 'Content-Type': 'text/html' } : arguments[2];
		var die = arguments[3] === undefined ? false : arguments[3];

		var result = promise();

		if (err) {

			console.trace(err);

			var errorData = {
				status: status,
				stack: err.stack
			};

			if (!die && global.res) {

				require('./render')(__dirname.replace('/dist', '/views/error.html'), errorData, require('./routes')['/error']).then(function (template) {

					global.res.writeHead(status, headers);

					global.res.end(template);
				});
			} else {

				throw err;
			}
		} else {

			result.resolve();
		}

		return result;
	},

	// Try/Catch interceptor
	attempt: function attempt(success, fail) {

		var result = promise();

		try {

			result.resolve(success());
		} catch (err) {

			if (fail) {

				fail(err);
			} else {

				undefined.handle(err);
			}
		}

		return result;
	}
};
