# Breadbox

Breadbox is an MVC framework for Node.js web apps. Breadbox favors functionality over flexibility, meaning you won't have to find and install middleware to make stuff work, but in some cases you can't plug in modules to replace core functionality.

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

<h1>Hello, <<person>>!</h1>
```

Run `node index` then open http://localhost:1337 in your browser.