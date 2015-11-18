'use strict';

var callback = undefined;

function handle(err) {
  var status = arguments[1] === undefined ? 500 : arguments[1];
  var headers = arguments[2] === undefined ? { 'Content-Type': 'text/html' } : arguments[2];
  var die = arguments[3] === undefined ? false : arguments[3];

  return new Promise(function (resolve) {

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

  return new Promise(function (resolve) {

    try {

      resolve(success());
    } catch (err) {

      if (fail) {

        fail(err);
      } else {

        handle(err);
      }
    }
  });
}

module.exports = function (fn) {
  callback = fn;
  return {
    handle: handle,
    attempt: attempt
  };
};
