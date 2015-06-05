'use strict';

var read = require('fs').readFile,
    run = require('vm').runInNewContext,
    routes = require('../routes'),
    promise = require('./promise'),
    includeRegx = /{{\s*?include\s(\S*?)s*?}}/i,
    ifRegx = /{{\s*?if\s(\S*?)s*?}}([\s\S]*?){{\s*?endif\s*?}}/i,
    loopRegx = /{{\s*?for\s(\S*?)\sas\s(\S*?)\s*?}}([\s\S]*?){{\s*?endfor\s*?}}/i,
    varRegx = /{{([\s\S]*?)}}/;

function parseVars(template, context, match) {

    var value,
        raw = match[0],
        ref = match[1];

    try {
        value = run(ref, context);
    }
    catch(err) {
        console.log(err);
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
        console.log(err);
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
        console.log(err);
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

// Parsing functions that run syncronously are executed here.
function parse(template, context) {

    var match;

    if (match = ifRegx.exec(template)) {
        template = parseIfs(template, context, match);
    } 

    if (match = loopRegx.exec(template)) {
        template = parseLoops(template, context, match);
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

    var resolvedContext,
        response = promise(),
        getTemplateAndContext = promise();

    // get template. read = fs.readFile
    read(filepath, { encoding: 'utf8' }, function(err, template) {

        if (err) { throw err; }

        getTemplateAndContext.resolve({ template: template });
    });

    getContext(url, request).then(function(context) {
        getTemplateAndContext.resolve({ context: context });
    });

    // This is verbose but it allows us to initiate the calls for the template
    // and the route context at the same time rather than nesting promises.
    getTemplateAndContext.then(function(status) {

        this.template = status.template || this.template;
        this.context = status.context || this.context;

        if (this.template && this.context) {

            resolvedContext = this.context;
            // Now that we have everything we need, we can interpolate
            // the template and put together the response.
            // First, lets get any included partials so we have the full template.
            parseIncludes(this.template, function(fullTemplate) {
                response.resolve(parse(fullTemplate, resolvedContext));
            });
        }
    });

    return response;
}

module.exports = render;