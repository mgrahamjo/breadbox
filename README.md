# protein
A tiny Node JS MVC framework with no dependencies.

Currently templates support loops over arrays, logical if blocks, and interpolated raw JavaScript, which enables partial includes via require().

Routes are defined in routes.js as properties of a simple array-like object with a relative path as the key and a context object - similar to $scope in AngularJS - as the value.