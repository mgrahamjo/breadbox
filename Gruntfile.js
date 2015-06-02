'use strict';

module.exports = function(grunt) {

  var jsFiles = ['Gruntfile.js', 'index.js', 'routes.js'];

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

    watch: {
      files: jsFiles,
      tasks: ['jshint:all']
    },

  });

  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-watch');

  grunt.registerTask('default', ['jshint:all']);

};