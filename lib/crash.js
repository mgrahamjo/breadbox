'use strict';

let callback;

function handle(err, status = 500, headers = {'Content-Type': 'text/html'}, die = false) {

  return new Promise(resolve => {

    if (err) {

      if (!die && callback) {

        callback(err, status, headers);

      } else {
        
        console.trace(err);
        process.exit(1);
      }
    } else {

      resolve();
    }
  });
}

function attempt(success, fail) {

  return new Promise(resolve => {

    try {

      resolve(success());

    } catch(err) {

      if (fail) {

        fail(err);

      } else {

        handle(err);
      }
    }
  });
}

module.exports = fn => {
  callback = fn;
  return {
  	handle: handle,
  	attempt: attempt
  };
};
