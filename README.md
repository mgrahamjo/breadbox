# Breadbox

A Node JS MVC framework that priortizes simplicity. Currently in development. 

## Hello World

```
// index.js

var breadbox = require('breadbox');

breadbox({
    controllers: {
        '/index': function(response) {
            response.resolve({ person: "World" });
        }
    }
});
```

```
<!-- index.html -->

<h1>Hello, {{person}}!</h1>
```

Run `node index.js` then open http://localhost:1337 in your browser.

## Options

The breadbox function accepts a configuration object with a few optional properties:
* `controllers`: an object on which keys are route paths and values are functions. More details below.
* `loginPage`: the relative URL of the page where users can log in. Defaults to '/login'.
* `logoutPage`: the relative URL of the page that logs users out. Defaults to '/logout'.
* `port`: the port on which the app should run. Defaults to 1337.

## Templates

Templates go in the `views/` folder.

### Includes

`{{include <filename>}}` includes a partial view with the given filename ('.html' extension is assumed). 

`{{include partials/head}}` would include the content from `/views/partials/head.html`.

### Loops

`{{for <key> in <array>}}...{{endfor}}` renders the contained content once for each item in the given array. Within that content, `{{<key>}}` will be replaced with the corresponding value in the array.

### If Blocks

`{{if <variable>}}...{{endif}}` renders the contained content only if the given variable is evaluated as truthy.

### Variables

`{{<variable> || <expression>}}` will be replaced with the result of evaluating the given expression or variable using the context provided by the controller.

Variables are automatically HTML escaped. To bypass this security measure, use `{{<variable> | safe }}`.

## Controllers

Controllers allow you to do a number things:
* define URLs
* map those URLs to templates and contexts
* define URL parameters
* identify routes that require authentication
* add headers to your responses
* access request & session data

### Defining URLs

The keys on the controllers object you pass to the breadbox function will be used to match requested URLs to your controller functions. The root URL, '/', is matched to the '/index' controller key. '.html' extensions are ignored. 

```
var controllers = {
    '/index': require('controllers/index'),
    '/about-me': require('controllers/about-me')
};

breadbox({
    controllers: controllers
});

```

The function is passed response and request arguments. To send a response, resolve it with a context object.

### Mapping a URL to a template with a context object

If you don't specify a template, Breadbox will look for a template that matches the name of the route. In the example above, it would look for `views/index.html`. 

To specify a template other than the default, pass the template path (relative to the views folder) as the second argument when you resolve the response.

For example:

```
module.exports = {

    '/index': function(response, request) {

    	var context = {
    		items: ['apples', 'oranges', 'bananas']
    	};

        response.resolve(context, 'fruits.html');
    }
};

```

Now, the context could be used in fruits.html like this:

```
<ul>
{{for fruit in items}}
	<li>{{fruit}}</li>
{{endfor}}
</ul>
```

Which would render the following HTML:
```
<ul>
	<li>apples</li>
	<li>oranges</li>
	<li>bananas</li>
</ul>
```

### Defining URL parameters

Sometimes you don't know exactly what the URL will look like when you want to render a certain template. Consider a blog in which each post resides at the URL `/posts/<id>`.

In this case, you need to use a placeholder in the route, with the expectation that it will map to a blog post ID. 

```
var controllers = {

    '/posts/{{id}}': function(response, request) {

    	var context = {
    		post: request.params.id
    	};

        response.resolve(context);
    }
};

```

The parameter will be available as a property of request.params. 

Note that in this example we did not pass a template path to the response. Breadbox is smart enough to know not to look for `views/posts/{{id}}.html`, and will try rendering `views/posts.html` instead.

## Accessing data

Breadbox ships with an extremely lightweight file-based data access layer. Feel free to use any database engine instead.

The Breadbox DB has two methods: get and put. Both of them return promise objects that will be resolved after execution.

### Getting data

Data is stored as JSON files in the `data/` folder. The path to a JSON file (relative to `data/`) is the key with which it can be accessed. To get an object, require lib/db.js and call `db.get(<key>)`.

```
var db = require('./lib/db');

module.exports = {

    '/posts/{{id}}': function(response, request) {

    	var post = 'posts/' + request.params.id;

    	db.get(post).then(function(data) {

	    	var context = {
	    		post: data
	    	};

	        response.resolve(context);

        });
    }
};

```

### Saving data

A common issue with JSON-based storage is that you could get an object, someone else could modify one part of it, you could modify another part of it, and when you save, the other person's change is overwritten. Breadbox avoids this by allowing you to specify a specific property of the object that should be modified when saving data.

To update a property with a new value, call `db.put(<path>, <value>, <property>)` where `<path>` is the path to the JSON file relative to `data/`, `<value>` is the new value to save, and `<property>` is a string representation of the specific object property you want to update.

If no `<property>` is specified, the entire object will be replaced with `<value>`.

To demonstrate, lets define a route that updates a view count each time it is accessed.

```
var db = require('./lib/db');

module.exports = {

    '/posts/{{id}}': function(response, request) {

    	var count, postPath = 'posts/' + request.params.id;

    	db.get(postPath).then(function(post) {

    		count = post.counts.views;

	    	db.put(postPath, count + 1, 'counts.views').then(function() {

		        response.resolve({ post: post });

	    	});
	    });
    }
};

```