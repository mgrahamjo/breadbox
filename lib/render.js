'use strict';

let read = require('fs').readFile,
    vm = require('vm'),
    promise = require('./promise'),
    htmlEscape = require('./htmlEscape'),
    appRoutes = require('./routes'),
    includeRegx = /{{\s*?include\s(\S*?)s*?}}/i,
    varRegx = /{{([\s\S]*?)}}/,
    forIn = /{{\s*?for\s*?\S*?\s*?in\s*?\S*?\s*?}}/i,
    endfor = /{{\s*?endfor\s*?}}/i,
    ifBlock = /{{\s*?if\s*?([\s\S]*?)\s*?}}/i,
    endif = /{{\s*?endif\s*?}}/i,
    response;

function run(expression, context) {
    return vm.runInNewContext(expression, context, {
        timeout: 1000
    });
}

function error(description, info) {

  console.error(description + '. ' + info);

  let errorData = {
        status: 500,
        message: description + '<br><br>' + info
      };

  getContext(errorData, appRoutes['/error']).then(function(context) {

    read(__dirname.replace('/dist', '/views/error.html'), { encoding: 'utf8' }, function(err, template) {

        response.resolve(parse(template, context), { status: errorData.status });
    });
  });
}

function regexIndex(str, regex, startpos) {
    let indexOf = str.substring(startpos || 0).search(regex);
    return (indexOf >= 0) ? (indexOf + (startpos || 0)) : indexOf;
}

function parseVars(template, context, match) {

    let value,
        raw = match[0],
        filters = match[1].split('|'),
        ref = filters.shift(0);

    filters.forEach(function(filter, i) {
        filters[i] = filter.replace(/\s/g, '');
    });

    try {
        value = run(ref, context);
        if (typeof value === 'string' && filters.indexOf('safe') === -1) {
            value = htmlEscape(value);
        }
    }
    catch(err) {

        console.error(err);

        value = '';
    }

    return parse(template.replace(raw, value), context);
}

function parseLoops(template, context, match) {

    let raw     = match[0],
        key     = match[1],
        arrName = match[2],
        html    = match[3],
        array   = [],
        output  = '',
        initKeyValue = context[key];

    try {
        array = run(arrName, context);
    }
    catch(err) {
        // array is undefined
        console.error(err);
    }

    array.forEach(function(value) {
        context[key] = value;
        output += parse(html, context);
    });

    context[key] = initKeyValue;

    return parse(template.replace(raw, output), context);
}

function parseIfs(template, context, match) {

    let raw     = match[0],
        value   = match[1],
        html    = match[2],
        doShow;

    try {
        doShow = run(value, context);
    }
    catch(err) {
        // An error here simply means value is falsy.
    }
    
    return parse(doShow ? template.replace(raw, html) : template.replace(raw, ''), context);
}

// Recursively asyncronously parses partial includes
// then calls the callback with the result
function parseIncludes(template, callback) {
    
    let match = includeRegx.exec(template),
        raw, path;

    if (match !== null) {

        raw  = match[0];
        path = match[1];

        read(__dirname + '/../views/' + path + '.html', { encoding: 'utf8' }, function(err, html) {

            if (err) { 
                error('error at read(...) in the parseIncludes function of render.js.', err);
            } else {

                parseIncludes(template.replace(raw, html), callback);
            }
        });
    } else {
        callback(template);
    }
}

// In order to support nesting, we need to build
// a regex that ignores the correct number of closing tags.
function getLoopRegx(template) {
    
    let result,

        secondHalf = template.split(forIn)[1];

    if (!secondHalf) {

        result = false;
    // If another for-in loop starts before this one is closed...
    } else if (regexIndex(secondHalf, forIn) < regexIndex(secondHalf, endfor)) {
        // use lazy matching
        result = /{{\s*?for\s*?(\S*?)\s*?in\s*?(\S*?)\s*?}}([\s\S]*?){{\s*?endfor\s*?}}/i;

    } else {
        // use greedy matching
        result = /{{\s*?for\s*?(\S*?)\s*?in\s*?(\S*?)\s*?}}([\s\S]*){{\s*?endfor\s*?}}/i;
    }
    
    return result;
}

function getIfRegx(template) {
    
    let result,

        secondHalf = template.split(ifBlock)[1];

    if (!secondHalf) {

        result = false;
    // If another if block starts before this one is closed...
    } else if (regexIndex(secondHalf, ifBlock) < regexIndex(secondHalf, endif)) {
        // use greedy matching
        result = /{{\s*?if\s*?([\s\S]*?)\s*?}}([\s\S]*){{\s*?endif\s*?}}/i;

    } else {
        // use lazy matching
        result = /{{\s*?if\s*?([\s\S]*?)\s*?}}([\s\S]*?){{\s*?endif\s*?}}/i;
    }
    
    return result;
}

// Parsing functions that run syncronously are executed here.
function parse(template, context) {

    let match, regx,

        loopFirst = regexIndex(template, forIn) < regexIndex(template, ifBlock);

    if (loopFirst) {

        regx = getLoopRegx(template);

        if (regx) {

            template = parseLoops(template, context, regx.exec(template));
        }

        regx = getIfRegx(template);

        if (regx) {

            template = parseIfs(template, context, regx.exec(template));
        }
        
    } else {

        regx = getIfRegx(template);

        if (regx) {

            template = parseIfs(template, context, regx.exec(template));
        }

        regx = getLoopRegx(template);

        if (regx) {

            template = parseLoops(template, context, regx.exec(template));
        }
    }

    match = varRegx.exec(template);

    if (match) {
        template = parseVars(template, context, match);
    }

    return template;
}

// This gets the routes object from routes.js and
// gives it a promise object to resolve as our context.
function getContext(request, controller) {

    let context = promise();

    controller(context, request);

    return context;
}

function render(filepath, request, controller) {

    response = promise();

    getContext(request, controller).then(function(context, customPath, headers) {
        
        if (customPath) {
            filepath = customPath;
        }

        // get template. read = fs.readFile
        read(filepath, { encoding: 'utf8' }, function(err, template) {

            if (err) { 
                error('error at read(...) in the render function of render.js.', err);
            } else {

                // Now that we have everything we need, we can interpolate
                // the template and put together the response.
                // First, lets get any included partials so we have the full template.
                parseIncludes(template, function(fullTemplate) {

                    let parsed = parse(fullTemplate, context);

                    if (parsed) {
                        response.resolve(parsed, headers);
                    }
                });
            }
        });
    });

    return response;
}

module.exports = render;