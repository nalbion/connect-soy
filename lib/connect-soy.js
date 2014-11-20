'use strict';

/**
 * @param grunt
 * @param {string|Array.<string>} soyPath - eg: __dirname + '/app/soy'
 * 			If an array is provided, the first string will be taken as the source dir,
 * 			and the others will be added to the VM context
 * @param {string} configPath - eg: __dirname + '/test/data'
 * @param {string} closurePath - optional
 * @returns {Function}
 */
module.exports = function (grunt, soyPath, configPath, closurePath) {
	var readJSON = grunt.file.readJSON;
	var fs = require('fs');
	var vm = require('vm');
	var glob = require('glob');
	var soynode;
	var useClosure = !!closurePath;

	if( useClosure ) {
		require(closurePath + '/closure/goog/bootstrap/nodejs');
	}

	function init() {
		if( soynode ) { return; }
		soynode = require('soynode');

		var outputDir, inputDir;
		if( soyPath.constructor == Array ) {
			inputDir = soyPath[0];
		} else {
			inputDir = soyPath;
		}
		// Write the compiled templates to a node-specific directory because we don't use goog/base.js
		// (no goog.provides()/requires())
		outputDir = inputDir + '/node';
		grunt.log.debug('connect-soy: pre-compiling Soy templates to', outputDir);

		soynode.setOptions({
			outputDir: outputDir,
			uniqueDir: false,
			allowDynamicRecompile: true
		});

		if( soyPath.constructor == Array ) {
			for( var i = 0; i < soyPath.length; i++ ) {
				compileTemplates(soyPath[i]);
			}
		} else {
			compileTemplates(inputDir);
		}
	}

	function compileTemplates(inputDir) {
		grunt.log.debug('compiling Soy templates in', inputDir);
		soynode.compileTemplates(inputDir, function (err) {
			if (err) {
				grunt.log.error('connect-soy failed to compile templates in', inputDir);
				throw err;
			}
		});
	}

	function processSoyPrintCommands(body, configData) {
		return body.replace(/\{\$([^}]+)\}/, function (match, v) {
			return configData[v] || match;
		});
	}

	function processSoyTemplates(body, configData) {
//		var vmContext = vm.createContext({});
//		// Load the functions from soyutils.js into the vm context so they are available to the templates.
//		vm.runInNewContext(fs.readFileSync(PATH_TO_SOY_UTILS, 'utf8'), vmContext, PATH_TO_SOY_UTILS);

		return body.replace(/\{call ([\w\.]+\.soy\.[\w]+)(?: data="\$([^"]+)")?\s?\/\}/g,
			function (match, templateName, data) {
				if( data ) {
					configData = configData[data];
				}
				grunt.log.debug('Rendering Soy template ' + templateName);
				return soynode.render(templateName, configData);
			}
		);
	}

	return function(req, res, next) {
		init();

		var url = require('url').parse(req.url);

//		var filepath = url.parse(req.url).pathname;
//		filepath = filepath.slice(-1) === '/' ? filepath + 'index.html' : filepath;
//		if( path.extname( url.pathname ) === '.html' ) {
		if( url.pathname.match(/\.html$/) ) {
			// For html files where the "?test=" parameter has been specified
			// look up the appropriate config file
			var dataFileName = req.query.test || '123';
//			if( undefined !== req.query.test ) {
			var file = configPath + '/' + dataFileName + '.json';
			fs.exists(file, function(exists) {
				var configData = exists ? readJSON(file) : {};

				var write = res.write;
				res.write = function (string, encoding) {
					var body = string instanceof Buffer ? string.toString() : string;
					body = processSoyPrintCommands(body, configData);
					body = processSoyTemplates(body, configData);

					if (!this.headerSent) {
						this.setHeader('content-length', Buffer.byteLength(body));
//					this._implicitHeader();
					}

					write.call(this, body, encoding);
				};
			});
//			}
		}

		next();
	};
};