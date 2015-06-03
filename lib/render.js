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

        template = template.replace(raw, run(value, context));

        match = regx.exec(template);
    }

    return template;
}

function parseLoops(template, context) {

    // {{for (array) as (key)}} (<template>{{key}}</template>) {{endfor}}
    var loopRegx = /{{\s*?for\s(\S*?)\sas\s(\S*?)\s*?}}([\s\S]*?){{\s*?endfor\s*?}}/i,

        match = loopRegx.exec(template),

        raw, array, key, html, output;
        
    while (match !== null) {

        output = '';

        raw     = match[0];
        array   = run(match[1], context);
        key     = match[2];
        html    = match[3];

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

        raw, value, html;

    while (match !== null) {

        raw     = match[0];
        value   = match[1];
        html    = match[2];

        if (run(value, context)) {
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

function render(url, filepath) {

    var response = promise();

    read(filepath, { encoding: 'utf8' }, function(err, data) {

        if (err) {
            throw err;
        }
        
        response.resolve(parse(data, routes[url]));
    });

    return response;
}

module.exports = render;