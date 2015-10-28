'use strict';

const promise   = require('./promise');

function handle(err, status = 500, headers = {'Content-Type': 'text/html'}, die = false) {

  let result = promise();

  if (err) {

    console.trace(err);

    let errorData = {
      status: status,
      stack: err.stack || err
    };

    if (!die && global.res) {

      require('./render')(__dirname.replace('/dist', '/views/error.html'), errorData, require('./routes')['/error']).then(template => {

        global.res.writeHead(status, headers);
        
        global.res.end(template);

      });

    } else {
      
      process.exit(1);
    }
  } else {

    result.resolve();
  }

  return result;
}

function attempt(success, fail) {

  let result = promise();

  try {

    result.resolve(success());

  } catch(err) {

    if (fail) {

      fail(err);

    } else {

      handle(err);
    }
  }

  return result;
}

module.exports = {
	handle: handle,
	attempt: attempt
};
