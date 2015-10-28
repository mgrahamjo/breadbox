'use strict';

var promise = require('./promise');

function handle(err) {
  var status = arguments[1] === undefined ? 500 : arguments[1];
  var headers = arguments[2] === undefined ? { 'Content-Type': 'text/html' } : arguments[2];
  var die = arguments[3] === undefined ? false : arguments[3];

  var result = promise();

  if (err) {

    console.trace(err);

    var errorData = {
      status: status,
      stack: err.stack || err
    };

    if (!die && global.res) {

      require('./render')(__dirname.replace('/dist', '/views/error.html'), errorData, require('./routes')['/error']).then(function (template) {

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

  var result = promise();

  try {

    result.resolve(success());
  } catch (err) {

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
