# Breadbox

Breadbox is still in development. 

## Hello World

```javascript
// index.js

var breadbox = require('breadbox');

breadbox.init({
    controllers: {
        '/index': response => {
            response.resolve({ person: "World" });
        }
    }
});
```

```html
<!-- index.html -->

<h1>Hello, {{person}}!</h1>
```

Run `node index` then open http://localhost:1337 in your browser.