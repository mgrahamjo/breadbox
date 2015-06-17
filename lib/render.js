'use strict';

var read = require('fs').readFile,
    run = require('vm').runInNewContext,
    routes = require('../routes'),
    promise = require('./promise'),
    includeRegx = /{{\s*?include\s(\S*?)s*?}}/i,
    varRegx = /{{([\s\S]*?)}}/,
    forAs = /{{\s*?for\s*?\S*?\s*?as\s*?\S*?\s*?}}/i,
    endfor = /{{\s*?endfor\s*?}}/i,
    ifBlock = /{{\s*?if\s*?([\s\S]*?)\s*?}}/i,
    endif = /{{\s*?endif\s*?}}/i;

function regexIndex(str, regex, startpos) {
    var indexOf = str.substring(startpos || 0).search(regex);
    return (indexOf >= 0) ? (indexOf + (startpos || 0)) : indexOf;
}

function parseVars(template, context, match) {

    var value,
        raw = match[0],
        ref = match[1];

    try {
        value = run(ref, context);
    }
    catch(err) {
        console.error('error at parseVars: ' + err);
        value = '';
    }

    return parse(template.replace(raw, value), context);
}

function parseLoops(template, context, match) {

    var raw     = match[0],
        array   = [],
        key     = match[2],
        html    = match[3],
        output  = '',
        initKeyValue = context[key];

    try {
        array = run(match[1], context);
    }
    catch(err) {
        console.error('error at parseLoops: ' + err);
    }

    array.forEach(function(value) {
        context[key] = value;
        output += parse(html, context);
    });

    context[key] = initKeyValue;

    return parse(template.replace(raw, output), context);
}

function parseIfs(template, context, match) {

    var raw     = match[0],
        value   = match[1],
        html    = match[2],
        doShow;

    try {
        doShow = run(value, context);
    }
    catch(err) {
        console.error('error at parseIfs:' + err);
    }
    
    return parse(doShow ? template.replace(raw, html) : template.replace(raw, ''), context);
}

// Recursively asyncronously parses partial includes
// then calls the callback with the result
function parseIncludes(template, callback) {
    
    var match = includeRegx.exec(template),
        raw, path;

    if (match !== null) {

        raw  = match[0];
        path = match[1];

        read('././views/partials/' + path + '.html', { encoding: 'utf8' }, function(err, html) {

            if (err) { throw err; }

            parseIncludes(template.replace(raw, html), callback);

        });
    } else {
        callback(template);
    }
}

// In order to support nesting, we need to build
// a regex that ignores the correct number of closing tags.
function getLoopRegx(template) {
    //{{\s*?for\s*?\S*?\s*?as\s*?\S*?\s*?}}([\s\S]*){{\s*?endfor\s*?}}
    var result,

        secondHalf = template.split(forAs)[1];

    if (!secondHalf) {

        result = false;
    // If another for-as loop starts before this one is closed...
    } else if (regexIndex(secondHalf, forAs) < regexIndex(secondHalf, endfor)) {
        // use lazy matching
        result = /{{\s*?for\s*?(\S*?)\s*?as\s*?(\S*?)\s*?}}([\s\S]*?){{\s*?endfor\s*?}}/i;

    } else {
        // use greedy matching
        result = /{{\s*?for\s*?(\S*?)\s*?as\s*?(\S*?)\s*?}}([\s\S]*){{\s*?endfor\s*?}}/i;
    }
    
    return result;
}

function getIfRegx(template) {
    ///{{\s*?if\s*?([\s\S]*?)s*?}}([\s\S]*){{\s*?endif\s*?}}/i
    var result,

        secondHalf = template.split(ifBlock)[1];

    if (!secondHalf) {

        result = false;
    // If another for-as loop starts before this one is closed...
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

    var match, regx,

        loopFirst = regexIndex(template, forAs) < regexIndex(template, ifBlock);

    if (loopFirst) {

        if (regx = getLoopRegx(template)) {

            template = parseLoops(template, context, regx.exec(template));
        }

        if (regx = getIfRegx(template)) {

            template = parseIfs(template, context, regx.exec(template));
        }
        
    } else {

        if (regx = getIfRegx(template)) {

            template = parseIfs(template, context, regx.exec(template));
        }

        if (regx = getLoopRegx(template)) {

            template = parseLoops(template, context, regx.exec(template));
        }
    }

    if (match = varRegx.exec(template)) {
        template = parseVars(template, context, match);
    }

    return template;
}

// This gets the routes object from routes.js and
// gives it a promise object to resolve as our context.
function getContext(url, request) {

    var context = promise();

    routes[url](context, request);

    return context;
}

function render(url, filepath, request) {

    var response = promise();

    getContext(url, request).then(function(context) {
        
        if (typeof context[1] === 'string') {
            filepath = __dirname.replace('/lib', '/views/') + context[1];
            context  = context[0];
        }

        // get template. read = fs.readFile
        read(filepath, { encoding: 'utf8' }, function(err, template) {

            if (err) { throw err; }

            // Now that we have everything we need, we can interpolate
            // the template and put together the response.
            // First, lets get any included partials so we have the full template.
            parseIncludes(template, function(fullTemplate) {
                response.resolve(parse(fullTemplate, context));
            });
        });
    });

    return response;
}

module.exports = render;