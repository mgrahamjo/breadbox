# Breadbox

A Node JS MVC framework that priortizes simplicity. Currently in development. 

## Hello World

```
// index.js

var breadbox = require('breadbox');

breadbox.init({
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

Run `node index` then open http://localhost:1337 in your browser.