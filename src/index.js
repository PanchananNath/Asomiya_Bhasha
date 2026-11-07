'use strict';
/**
 * Public JavaScript API for Asomiya Bhasha 2.0.
 *
 *   const asomiya = require('asomiya-bhasha');
 *   const { ok, c, diagnostics } = asomiya.compile('লিখা "নমস্কাৰ"');
 *   const run = asomiya.run('লিখা ২ + ৩');   // needs cc/gcc/clang
 *   console.log(run.stdout);                  // "৫\n"
 */
const { compile, VERSION } = require('./compiler');
const { buildNative, runNative, findCC, fileLoader } = require('./native');
const { tokenize } = require('./lexer');
const { parse } = require('./parser');

module.exports = {
    VERSION,
    compile: (source, opts = {}) => compile(source, Object.assign({ loader: fileLoader }, opts)),
    build: buildNative,
    run: runNative,
    findCC,
    tokenize,
    parse: (source, file) => parse(tokenize(source, file), file),
};
