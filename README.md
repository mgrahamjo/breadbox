# Breadbox

Breadbox is an MVC framework for Node.js web apps. Unlike Express, Breadbox is an attempt to cover all the requirements of a simple website with one small dependency. It provides a great way to get up and running with a data store, user authentication, a template engine, POST request processing, and an admin interface all with just one `npm install`. 

[Read the docs](http://mikej.codes/breadbox).

## Hello World

```javascript
// index.js

const breadbox = require('breadbox');

breadbox({
    controllers: {
        '/index': resolve => {
            resolve({ person: "World" });
        }
    }
});
```

```html
<!-- index.html -->

<h1>Hello, <:person:>!</h1>
```

Run `node index` then open http://localhost:1337 in your browser.