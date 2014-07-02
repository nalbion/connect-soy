'use strict';

/**
 * @param grunt
 * @param {string} soyPath - eg: __dirname + '/app/soy'
 * @param {string} configPath - eg: __dirname + '/test/data'
 * @param {string} closurePath - optional
 * @returns {Function}
 */
module.exports = function (grunt, soyPath, configPath, closurePath) {
	var readJSON = grunt.file.readJSON;
	var fs = require('fs');
	var vm = require('vm');
	var glob = require('glob');
	var soynode = require('soynode');
	var useClosure = !!closurePath;

	if( useClosure ) {
		require(closurePath + '/closure/goog/bootstrap/nodejs');
	}

//	glob("**/*.soy.js", {cwd: soyPath}, function (err, files) {
//		if (err) { throw err; }
//		if( files.length === 0 ) {
//if(true) {
//			console.info('There are no compile soy.js files at ' + soyPath + ', compiling templates now');
			soynode.setOptions({
				outputDir: soyPath + '/node',
				uniqueDir: false,
//				eraseTemporaryFiles: true,
				allowDynamicRecompile: true
//				useClosureStyle: useClosure
//				contextJsPaths: [
//					closurePath + '/closure/goog/base.js',
//					closurePath + '/closure/goog/bootstrap/nodejs.js'
//				]
//				, allowDynamicRecompile: true
			});
			soynode.compileTemplates(soyPath, function (err) {
				if (err) { throw err };
			});
//		} else {
////			soynode.setOptions({
//////				useClosureStyle: useClosure,
////				contextJsPaths: [
////					closurePath + '/closure/goog/base.js',
////					closurePath + '/closure/goog/bootstrap/nodejs.js'
////				]
////			});
//			soynode.loadCompiledTemplates(soyPath, function (err) {
//				if (err) { throw err; }
//				console.info('Loaded soy templates');
//			});
//		}
//	});

	function processSoyPrintCommands(body, configData) {
		return body.replace(/\{\$([^}]+)\}/, function (match, v) {
			return configData[v] || match;
		});
	}

	function processSoyTemplates(body, configData) {
		var vmContext = vm.createContext({});

		// Load the functions from soyutils.js into the vm context so they are available to the templates.
//		vm.runInNewContext(fs.readFileSync(PATH_TO_SOY_UTILS, 'utf8'), vmContext, PATH_TO_SOY_UTILS);

		return body.replace(/\{call ([\w\.]+\.soy\.[\w]+)(?: data="\$([^"]+)")?\s?\/\}/g,
			function (match, templateName, data) {
//console.info(configData);
				if( data ) {
					configData = configData[data];
				}
				return soynode.render(templateName, configData);
			}
		);
	}

	return function(req, res, next) {
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