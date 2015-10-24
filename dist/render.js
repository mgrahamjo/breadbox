'use strict';

var read = require('fs').readFile,
    vm = require('vm'),
    path = require('path'),
    promise = require('./promise'),
    crash = require('./crash'),
    htmlEscape = require('./htmlEscape'),
    includeRegx = /{{\s*?include\s(\S*?)\s*?}}/i,
    varRegx = /{{([\s\S]*?)}}/,
    forIn = /{{\s*?for\s*?\S*?\s*?in\s*?\S*?\s*?}}/i,
    endfor = /{{\s*?endfor\s*?}}/i,
    ifBlock = /{{\s*?if\s*?[\s\S]*?\s*?}}/i,
    endif = /{{\s*?endif\s*?}}/i,
    elseBlock = /{{\s*?else\s*?}}/i,
    basePath = path.join(__dirname, '../../../');

function run(expression, context) {
    return vm.runInNewContext(expression, context, {
        timeout: 1000
    });
}

function parseVars(template, context, match) {

    var value = undefined,
        raw = match[0],
        filters = match[1].split('|'),
        ref = filters.shift(0);

    filters.forEach(function (filter, i) {
        filters[i] = filter.replace(/\s/g, '');
    });

    if (filters.indexOf('skip') !== -1) {

        value = '&lcub;&lcub;' + ref + '&rcub;&rcub;';
    } else {

        try {
            value = run(ref, context);
            if (typeof value === 'string') {
                if (filters.indexOf('safe') !== -1) {
                    value = htmlEscape.reverse(value);
                } else {
                    value = htmlEscape(value);
                }
            } else if (value === undefined) {
                value = '';
            }
        } catch (err) {

            value = '';
        }
    }

    return parse(template.replace(raw, value), context);
}

function parseLoops(template, context, match) {

    var raw = match[0],
        index = match[1],
        arrName = match[2],
        html = match[3],
        list = [],
        output = '',

    //initKeyValue = context[index],
    key = undefined;

    try {
        list = run(arrName, context);
    } catch (err) {
        // array is undefined
        console.error(err);
    }

    if (index.indexOf('.') > -1) {
        var keys = index.split('.');
        index = keys[0];
        key = keys[1];
    }

    if (list) {
        Object.keys(list).forEach(function (value) {
            if (key) {
                context[index] = value;
                context[key] = list[value];
            } else {
                context[index] = list[value];
            }
            output += parse(html, context);
        });
    }

    //context[key] = initKeyValue;

    return parse(template.replace(raw, output), context);
}

function parseIfs(template, context, match) {

    var raw = match[0],
        expression = match[1].trim(),
        html = match[2],
        doShow = undefined,
        negate = undefined;

    if (expression.indexOf('not ') === 0) {
        negate = true;
        expression = expression.substring(3).trim();
    }

    html = html.split(elseBlock);

    try {
        doShow = run(expression, context);
    } catch (err) {}

    if (negate) {
        doShow = !doShow;
    }

    if (doShow) {
        html = html[0];
    } else if (html[1]) {
        html = html[1];
    } else {
        html = '';
    }

    return parse(template.replace(raw, html), context);
}

// Recursively asyncronously parses partial includes
// then calls the callback with the result
function parseIncludes(template, admin, callback) {

    var match = includeRegx.exec(template),
        raw = undefined,
        path = undefined,
        viewPath = undefined;

    if (match !== null) {

        raw = match[0];
        path = match[1];

        viewPath = admin ? __dirname + '/../views/' : basePath + 'views/';

        read(viewPath + path + '.html', { encoding: 'utf8' }, function (err, html) {

            crash.handle(err).then(function () {

                parseIncludes(template.replace(raw, html), admin, callback);
            });
        });
    } else {
        callback(template);
    }
}

// In order to support nesting, we need to build
// a regex that ignores the correct number of closing tags.
function getLoopRegx(template) {

    var result = undefined,
        secondHalf = template.split(forIn)[1];

    if (!secondHalf) {

        result = false;
        // If another for-in loop starts before this one is closed...
    } else if (secondHalf.search(forIn) < secondHalf.search(endfor)) {
        // use lazy matching
        result = /{{\s*?for\s*?(\S*?)\s*?in\s*?(\S*?)\s*?}}([\s\S]*?){{\s*?endfor\s*?}}/i;
    } else {
        // use greedy matching
        result = /{{\s*?for\s*?(\S*?)\s*?in\s*?(\S*?)\s*?}}([\s\S]*){{\s*?endfor\s*?}}/i;
    }

    return result;
}

function getIfRegx(template) {

    var result = undefined,
        match = ifBlock.exec(template);

    if (match) {

        var secondHalf = template.substring(template.search(ifBlock) + match[0].length);

        // If another if block starts before this one is closed...
        if (secondHalf.search(ifBlock) < secondHalf.search(endif)) {
            // use greedy matching
            result = /{{\s*?if\s*?([\s\S]*?)\s*?}}([\s\S]*){{\s*?endif\s*?}}/i;
        } else {
            // use lazy matching
            result = /{{\s*?if\s*?([\s\S]*?)\s*?}}([\s\S]*?){{\s*?endif\s*?}}/i;
        }
    }

    return result;
}

// Parsing functions that run syncronously are executed here.
function parse(template, context) {

    var match = undefined,
        regx = undefined,
        loopFirst = template.search(forIn) < template.search(ifBlock);

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

    var context = promise();

    controller(context, request);

    return context;
}

function render(filepath, request, controller) {

    var response = promise();

    getContext(request, controller).then(function (context, customPath, headers) {

        if (customPath) {
            if (customPath.indexOf('views/') === 0 || customPath.indexOf('/views/') === 0) {
                customPath = path.normalize(basePath + '/' + customPath);
            } else if (customPath.indexOf(basePath) !== 0) {
                customPath = path.normalize(basePath + 'views/' + customPath);
            }
            filepath = customPath;
        }

        // get template. read = fs.readFile
        read(filepath, { encoding: 'utf8' }, function (err, template) {

            crash.handle(err).then(function () {

                var admin = false;
                // Figure out whether this is a breadbox view or a custom view.
                if (filepath.indexOf(basePath + 'views/') === -1) {
                    admin = true;
                }
                // Now that we have everything we need, we can interpolate
                // the template and put together the response.
                // First, lets get any included partials so we have the full template.
                parseIncludes(template, admin, function (fullTemplate) {

                    var parsed = parse(fullTemplate, context);

                    if (parsed) {
                        response.resolve(parsed, headers);
                    }
                });
            });
        });
    });

    return response;
}

module.exports = render;
