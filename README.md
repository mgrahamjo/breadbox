# protein

A tiny Node JS MVC framework with no dependencies.

Currently templates support loops over arrays, logical if blocks, partial includes, and interpolated raw JavaScript.

Routes are defined in routes.js as properties of a simple array-like object, where each path is mapped to a controller function that asyncronously resolves the request.