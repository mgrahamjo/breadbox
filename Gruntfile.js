'use strict';

module.exports = function(grunt) {

  const jsFiles = ['data/*.js', 'lib/*.js', '*.js'];

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
          'dist/session.js': 'lib/session.js',
          'dist/routes.js': 'routes.js',
          'dist/csrf.js': 'lib/csrf.js'
        }
      }
    },

    watch: {
      files: jsFiles,
      tasks: ['babel', 'jshint:all']
    }

  });

  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-babel');

  grunt.registerTask('default', ['babel', 'jshint:all']);


};