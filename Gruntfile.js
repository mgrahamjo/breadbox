'use strict';

module.exports = function(grunt) {

  var jsFiles = ['data/*.js', 'lib/*.js'];

  grunt.initConfig({

    jshint: {
      all: {
        files: {
          src: jsFiles
        },
        options: {
          jshintrc: true
        }
      }
    },

    'babel': {
      dist: {
        files: {
          'dist/app.js': 'lib/app.js',
          'dist/db.js': 'lib/db.js',
          'dist/htmlEscape.js': 'lib/htmlEscape.js',
          'dist/promise.js': 'lib/promise.js',
          'dist/render.js': 'lib/render.js'
        }
      }
    },

    watch: {
      files: jsFiles,
      tasks: ['babel', 'jshint:all']
    },

  });

  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-babel');

  grunt.registerTask('default', ['babel', 'jshint:all']);


};