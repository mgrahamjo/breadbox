'use strict';

var read = require('fs').readFile,
    run = require('vm').runInNewContext,
    routes = require('../routes'),
    promise = require('./promise');

function interpolate(template, context) {

    var regx = /{{([\s\S]*?)}}/,

        match = regx.exec(template),

        raw, value;

    while (match !== null) {

        raw     = match[0];
        value   = match[1];

        try {
            template = template.replace(raw, run(value, context));
        }
        catch(err) {
            console.log(err);
            template = template.replace(raw, '');
        }

        match = regx.exec(template);
    }

    return template;
}

function parseLoops(template, context) {

    // {{for (array) as (key)}} (<template>{{key}}</template>) {{endfor}}
    var loopRegx = /{{\s*?for\s(\S*?)\sas\s(\S*?)\s*?}}([\s\S]*?){{\s*?endfor\s*?}}/i,

        match = loopRegx.exec(template),

        array = [],

        raw, key, html, output;
        
    while (match !== null) {

        output = '';

        raw     = match[0];
        key     = match[2];
        html    = match[3];

        try {
            array   = run(match[1], context);
        }
        catch(err) {
            console.log(err);
        }

        array.forEach(function(value) {
            context[key] = value;
            output += parse(html, context);
        });

        template = template.replace(raw, output);

        match = loopRegx.exec(template);
    }

    return template;
}

function parseIfs(template, context) {

    // {{if (var)}} (<template>) {{endif}}
    var ifRegx = /{{\s*?if\s(\S*?)s*?}}([\s\S]*?){{\s*?endif\s*?}}/i,

        match = ifRegx.exec(template),

        raw, value, html, doShow;

    while (match !== null) {

        raw     = match[0];
        value   = match[1];
        html    = match[2];

        try {
            doShow = run(value, context);
        }
        catch(err) {
            console.log(err);
        }

        if (doShow) {
            template = template.replace(raw, parse(html, context));
        } else {
            template = template.replace(raw, '');
        }

        match = ifRegx.exec(template);
    }

    return template;
}

function parse(template, context) {

    return interpolate(
                parseLoops(
                    parseIfs(template, context),
                context),
            context);
}

// This takes the routes object from routes.js and
// gives it a promise object to resolve as our context.
function getContext(url, request) {

    var context = promise();

    routes[url](context, request);

    return context;
}

function render(url, filepath, request) {

    var response = promise(),
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
            // Now that we have everything we need, we can interpolate
            // the template and put together the response.
            response.resolve(parse(this.template, this.context));
        }
    });

    return response;
}

module.exports = render;