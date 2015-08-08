'use strict';

const promise   = require('./promise');

module.exports = {

	// Error interceptor
	handle: (err, status = 500, die = false) => {

	  let result = promise();

	  if (err) {

	    console.error(err);

	    let errorData = {
	      status: status,
	      message: err
	    };

	    if (!die && global.res) {

	      require('./render')(__dirname.replace('/dist', '/views/error.html'), errorData, require('./routes')['/error']).then(template => {

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
	attempt: (success, fail) => {

	  let result = promise();

	  try {

	    success();
	    result.resolve();

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