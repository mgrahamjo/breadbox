# Breadbox

Breadbox is an MVC framework for Node.js web apps. Breadbox favors functionality over flexibility, meaning that it makes choices for you about how to fulfill common requirements.

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