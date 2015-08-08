'use strict';

var promise = require('./promise');

module.exports = {

	// Error interceptor
	handle: function handle(err) {
		var status = arguments[1] === undefined ? 500 : arguments[1];
		var die = arguments[2] === undefined ? false : arguments[2];

		var result = promise();

		if (err) {

			console.error(err);

			var errorData = {
				status: status,
				message: err
			};

			if (!die && global.res) {

				require('./render')(__dirname.replace('/dist', '/views/error.html'), errorData, require('./routes')['/error']).then(function (template) {

					global.res.writeHead(status, {
						'Content-Type': 'text/html'
					});

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

			success();
			result.resolve();
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
