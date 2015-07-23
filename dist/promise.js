'use strict';

// Returns a basic promise object.
// The resolve() method should be called with the data to fulfill the promise.
// The then() accepts a handler and then calls it with the resolved data.
module.exports = function promise() {

    return {
        isResolved: false,
        results: null,
        resolve: function resolve() {
            this.results = Array.prototype.slice.call(arguments);
            if (this.handler) {
                this.handler.apply(this, this.results);
            } else {
                this.isResolved = true;
            }
        },
        then: function then(handler) {
            if (typeof handler === 'function') {
                if (this.isResolved) {
                    handler.apply(this, this.results);
                } else {
                    this.handler = handler;
                }
            } else {
                console.error('You must pass a function to promise.then');
            }
        }
    };
};
