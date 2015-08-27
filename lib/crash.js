'use strict';

const promise   = require('./promise');

module.exports = {

	// Error interceptor
	handle: (err, status = 500, headers = {'Content-Type': 'text/html'}, die = false) => {

	  let result = promise();

	  if (err) {

	    console.trace(err);

	    let errorData = {
	      status: status,
	      stack: err.stack
	    };

	    if (!die && global.res) {

	      require('./render')(__dirname.replace('/dist', '/views/error.html'), errorData, require('./routes')['/error']).then(template => {

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
	attempt: (success, fail) => {

	  let result = promise();

	  try {

	    result.resolve(success());

	  } catch(err) {

	    if (fail) {

	      fail(err);

	    } else {

	      this.handle(err);
	    }
	  }

	  return result;
	}
};