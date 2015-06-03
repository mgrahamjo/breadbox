// Returns a basic promise object.
// The resolve() method should be called with the data to fulfill the promise.
// The then() accepts a handler and then calls it with the resolved data.
module.exports = function promise() {
    return {
        isResolved: false,
        result: null,
        resolve: function(result) {
            if (this.handler) {
                this.handler(result);
            } else {
                this.result = result;
                this.isResolved = true;
            }
        },
        then: function(handler) {
            if (typeof handler === 'function') {
                if (this.isResolved) {
                    handler(this.result);
                } else {
                    this.handler = handler;
                }
            } else {
                console.error('You must pass a function to promise.then');
            }
        }
    }
}