/*
 * grunt-json-angular-translate
 *
 *
 * Copyright (c) 2014 Shahar Talmi
 * Licensed under the MIT license.
 */

'use strict';

var multiline = require('multiline');
var jbfunc = 'js_beautify';
var jb = require('js-beautify')[jbfunc];
var toSingleQuotes = require('to-single-quotes-shahata');
var extend = require('util')._extend;

function merge(base, add) {
  var key = Object.keys(add)[0];
  if (typeof(add[key]) === 'object' && base[key]) {
    merge(base[key], add[key]);
  } else {
    base[key] = add[key];
  }
  return base;
}

function unflatten(json) {
  return Object.keys(json).reduceRight(function(prev, key) {
    return merge(prev, key.split('.').reduceRight(function (prev, curr) {
      var obj = {};
      obj[curr] = prev;
      return obj;
    }, json[key]));
  }, {});
}

function reverse(json) {
  return Object.keys(json).reduceRight(function (newObject, value) {
    newObject[value] = json[value];
    return newObject;
  }, {});
}

var template = multiline(function () {/*
(function () {
  'use strict';
<% if (initializeModule) { %>
  var module;
  try {
    module = angular.module('<%= moduleName %>');
  } catch (e) {
    module = angular.module('<%= moduleName %>', ['pascalprecht.translate']);
  }
  module.config(function ($translateProvider) {
<% } else { %>
  angular.module('<%= moduleName %>').config(function ($translateProvider) {
<% }
  for (var lang in translations) {
    var out = toSingleQuotes(JSON.stringify(translations[lang]));
    if (setLanguage) { %>
    $translateProvider.translations('<%= lang %>', <%= out %>);
  <% } else { %>
    $translateProvider.translations(<%= out %>);
  <% }
    if (preferredLanguage) { %>
    $translateProvider.preferredLanguage('<%= preferredLanguage %>');
  <% }
  } %>
  });
})();
*/});

module.exports = function (grunt) {
  grunt.registerMultiTask('jsonAngularTranslate', 'Converts angular-translate JSON files into their JS equivalent.', function () {
    var extractLanguage;
    var options = this.options({
      moduleName: 'translations',
      extractLanguage: /..(?=\.[^.]*$)/,
      setLanguage: true,
      setPreferredLanguage: true,
      createNestedKeys: true,
      initializeModule: true,
      singleFile: false
    });

    if (typeof(options.extractLanguage) === 'function') {
      extractLanguage = options.extractLanguage;
    } else {
      extractLanguage = function (filepath) {
        return filepath.match(options.extractLanguage)[0];
      };
    }

    this.files.forEach(function (file) {
      // Concat specified files.
      var language = null, translations = {}, src;
      var srcFiles = file.src.filter(function (filepath) {
        // Warn on and remove invalid source files (if nonull was set).
        if (!grunt.file.exists(filepath)) {
          grunt.log.warn('Source file "' + filepath + '" not found.');
          return false;
        } else {
          return true;
        }
      });

      if (options.singleFile) {
        srcFiles.forEach(function (path) {
          var currLanguage = extractLanguage(path);
          var processor = (options.createNestedKeys ? unflatten : reverse);
          translations[currLanguage] = processor(JSON.parse(grunt.file.read(path)));
        });
      } else {
        translations[language] = srcFiles.map(function (filepath) {
          var currLanguage = extractLanguage(filepath);
          if (language && language !== currLanguage) {
            grunt.fail.warn('Inconsistent language: ' + filepath + ' (' + currLanguage + ' !== ' + language + ')');
          }
          language = currLanguage;

          var processor = (options.createNestedKeys ? unflatten : reverse);
          return processor(JSON.parse(grunt.file.read(filepath)));
        }).reduce(extend, {});
      }

      src = grunt.template.process(template, {data: {
        // Data
        moduleName: options.moduleName,
        initializeModule: options.initializeModule,
        setLanguage: options.setLanguage,
        preferredLanguage: options.singleFile && options.setPreferredLanguage ? language : false,
        translations: translations,

        // Functions
        toSingleQuotes: toSingleQuotes,
        JSON: JSON
      }});
      src = jb(src, {'indent_size': 2, 'jslint_happy': true}) + '\n';

      grunt.file.write(file.dest, src);
      grunt.log.writeln('File ' + file.dest.cyan + ' created.');
    });
  });

};
