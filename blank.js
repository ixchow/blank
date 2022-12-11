#!/usr/bin/env node
/*
 * The "blank" templating system.
 *
 * includeSync runs a template, with a local context that (at least) contains a write function:
 *   includeSync('file._', {write:(x) => { console.log(x); }, other:"something"});
 *
 * templates look like:
 *   whatever whatever %{ code(); }% and so on %{ moreCode(); }%.
 *
 * which is transformed into:
 *   'use strict'; write('whatever whatever '); code(); write(' and so on '); moreCode(); write('.');
 *
 * (basically, everything from }% to %{ is enclosed in a call to write)
 *
 * Templates can always call "include('header._')" to include another file; includes are relative to the calling file.
 *
 * include does the same thing but reads templates asynchronously and takes a third argument for a callback to invoke upon completion or error.
 *
 * Invoke from the command line to run a self-contained template:
 *    node blank.js template._
 *
 */

'use strict';

const fs = require('fs');
const path = require('path');

function includeSync(filepath, dict, options) {
	if (typeof(dict) !== "object" || typeof(dict.write) !== "function") {
		throw "dict must be an object including a 'write' function.";
	}
	const template = fs.readFileSync(filepath, {encoding:'utf8'});
	const dirname = path.posix.dirname(path.resolve(filepath));
	let startDelim = '%{';
	let endDelim = '}%';
	if (typeof options === 'object' && 'startDelim' in options) startDelim = options.startDelim;
	if (typeof options === 'object' && 'endDelim' in options) endDelim = options.endDelim;
	const run = makeRun(template, false, startDelim, endDelim);

	//build template namespace from dict + 'include' perhaps:
	let FunctionArgs = [];
	let funcArgs = [];
	for (let n in dict) {
		FunctionArgs.push(n);
		funcArgs.push(dict[n]);
	}
	if (!('require' in dict)) {
		FunctionArgs.push('require');
		funcArgs.push(function (path){
			if (path.startsWith('./')) {
				path = dirname + path.substr(1);
			}
			if (path.startsWith('../')) {
				path = dirname + "/" + path;
			}
			return require(path);
		});
	}
	if (!('include' in dict)) {
		FunctionArgs.push('include');
		funcArgs.push(function (path2, dict2){
			//make includes relative to current file:
			if (!path.posix.isAbsolute(path2)) {
				path2 = dirname + '/' + path2;
			}
			//TODO: fine-grained merging:
			let merged = {};
			Object.assign(merged, dict);
			if (typeof(dict2) !== 'undefined') {
				Object.assign(merged, dict2);
			}
			includeSync(path2, merged);
		});
	}
	FunctionArgs.push(run);
	let func = Reflect.construct(Function, FunctionArgs);
	func.apply(func, funcArgs);
}

//based on http://2ality.com/2017/05/util-promisify.html

const util = require('util');

const readFileAsync = util.promisify(fs.readFile);

//from MDN: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/AsyncFunction
// (because AsyncFunction is not a global object)
const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;

async function include(filepath, dict, callback) {
	try {
		if (typeof(dict) !== "object" || typeof(dict.write) !== "function") {
			throw new Error("dict must be an object including a 'write' function.");
		}
		const template = await readFileAsync(filepath, {encoding:'utf8'});
		const dirname = path.posix.dirname(path.resolve(filepath));
		let startDelim = '%{';
		let endDelim = '}%';
		//if (typeof options === 'object' && 'startDelim' in options) startDelim = options.startDelim;
		//if (typeof options === 'object' && 'endDelim' in options) endDelim = options.endDelim;
		const run = makeRun(template, true, startDelim, endDelim);

		//build template namespace from dict + 'include' perhaps:
		let AsyncFunctionArgs = [];
		let funcArgs = [];
		for (let n in dict) {
			AsyncFunctionArgs.push(n);
			funcArgs.push(dict[n]);
		}
		if (!('require' in dict)) {
			AsyncFunctionArgs.push('require');
			funcArgs.push(function (path){
				console.log("custom require");
				if (path.startsWith('./')) {
					path = dirname + path.substr(1);
				}
				if (path.startsWith('../')) {
					path = dirname + "/" + path;
				}
				return require(path);
			});
		}
		if (!('include' in dict)) {
			AsyncFunctionArgs.push('include');
			funcArgs.push(function (path2, dict2){
				//make includes relative to current file:
				if (!path.posix.isAbsolute(path2)) {
					path2 = dirname + '/' + path2;
				}
				//TODO: fine-grained merging:
				let merged = {};
				Object.assign(merged, dict);
				if (typeof(dict2) !== 'undefined') {
					Object.assign(merged, dict2);
				}
				return new Promise( (resolve, reject) => {
					include(path2, merged, (err) => {
						if (err) {
							reject(err);
						} else {
							resolve();
						}
					});
				});
			});
		}
		AsyncFunctionArgs.push(run);
		//console.log("-- RUN[" + filepath + "] --\n" + run + "\n -- END[" + filepath + "] --");
		let func = Reflect.construct(AsyncFunction, AsyncFunctionArgs);
		await func.apply(func, funcArgs);
	} catch (err) {
		callback(err);
		return;
	}
	callback();
}

function makeRun(template, asyncMode, startDelim = '%{', endDelim = '}%') {
	let inWrite = true;
	let run = "";
	run += "'use strict'; write('";
	for (let i = 0; i < template.length; ++i) {
		if (inWrite) {
			if (template.substr(i,2) === startDelim) {
				run += "');";
				inWrite = false;
				++i;
			} else if (template[i] === '\r') {
				run += '\\r';
			} else if (template[i] === '\n') {
				run += "\\n\\\n";
			} else if (template[i] === '\\' || template[i] === '\'') {
				run += '\\' + template[i];
			} else {
				run += template[i];
			}
		} else {
			//ugly hack to make include play well in an async way:
			if (asyncMode && template.substr(i,8) === 'include(') {
				run += "await include(";
				i += 7;
			} else if (template.substr(i,2) === endDelim) {
				run += "write('";
				inWrite = true;
				++i;
			} else {
				run += template[i];
			}
		}
	}
	if (!inWrite) throw new Error("File '" + path + "' has an un-paired %{");
	run += "');";
	return run;
}


module.exports = {
	includeSync:includeSync,
	include:include
};


//Handle direct (command-line) invocation:
if (require.main === module) {
	
	if (process.argv.length !== 4) {
		console.error("Usage:\n\tnode blank.js <template._> <output.file>");
		process.exit(1);
	}
	const infile = process.argv[2];
	const outfile = process.argv[3];

	const output = [];

	function write(x) {
		output.push(x.toString());
	}
	console.log("Running template from '" + infile + "'...");

	includeSync(infile, {write:write});

	console.log("Writing output to '" + outfile + "'...");

	fs.writeFileSync(outfile, output.join(''), {encoding:'utf8'});

	console.log("Done.");
}
