# protein

A tiny Node JS MVC framework, currently in development. 

## Templates

Templates go in the `views/` folder.

### Includes

`{{include <filename>}}` includes a partial view with the given filename ('.html' extension is assumed). 

`{{include partials/head}}` would include the content from `/views/partials/head.html`.

### Loops

`{{for <array> as <key>}}...{{endfor}}` renders the contained content once for each item in the given array. Within that content, `{{<key>}}` will be replaced with the corresponding value in the array.

### If Blocks

`{{if <variable>}}...{{endif}}` renders the contained content only if the given variable is evaluated as truthy.

### Variables

`{{<variable>}}` will be replaced with the value of the corresponding variable.

## Routes

Routes allow you to do three things:
* define URLs
* map those URLs to templates and contexts
* define URL parameters

### Defining URLs

Routes.js defines an array-like object. On this object, each key is a URL, and each value is a function. 

```
module.exports = {

    '/index': function(response, request) {

    	var context = {
    		items: ['apples', 'oranges', 'bananas']
    	};

        response.resolve(context);
    }
};

```

The function is passed response and request arguments. To send a response, resolve it with a context object.

### Mapping a URL to a template with a context object

If you don't specify a template, Protein will look for a template that matches the name of the route. In the example above, it would look for `views/index.html`. 

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
{{for items as fruit}}
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
module.exports = {

    '/posts/{{id}}': function(response, request) {

    	var context = {
    		post: request.params.id
    	};

        response.resolve(context);
    }
};

```

The parameter will be available as a property of request.params. 

Note that in this example we did not pass a template path to the response. Protein is smart enough to know not to look for `views/posts/{{id}}.html`, and will try rendering `views/posts.html` instead.

## Accessing data

Protein ships with an extremely lightweight file-based data access layer. Feel free to use any database engine instead.

The Protein DB has two methods: get and put. Both of them return promise objects that will be resolved after execution.

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

A common issue with JSON-based storage is that you could get an object, someone else could modify one part of it, you could modify another part of it, and when you save, the other person's change is overwritten. Protein avoids this by allowing you to specify a specific property of the object that should be modified when saving data.

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