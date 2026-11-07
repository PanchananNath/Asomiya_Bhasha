'use strict';
/**
 * Public JavaScript API for Asomiya Bhasha 2.1.
 *
 *   const asomiya = require('asomiya-bhasha');
 *   const { ok, c, diagnostics } = asomiya.compile('লিখা "নমস্কাৰ"');
 *   asomiya.compile(src, { backend: 'llvm', debug: true }).ll   // LLVM IR text
 *   asomiya.compile(src, { backend: 'wasm' }).wasm              // WebAssembly bytes
 *   const run = asomiya.run('লিখা ২ + ৩');                        // C back end: needs cc/gcc/clang
 *   asomiya.run('লিখা ২ + ৩', { backend: 'wasm' }).stdout          // "৫\n", Node.js only
 */
const { compile, VERSION } = require('./compiler');
const { buildNative, runNative, findCC, fileLoader } = require('./native');
const { tokenize } = require('./lexer');
const { parse } = require('./parser');

module.exports = {
    VERSION,
    compile: (source, opts = {}) => compile(source, Object.assign({ loader: fileLoader }, opts)),
    build: buildNative,
    run: (source, opts = {}) => (opts.backend === 'wasm' ? require('./wasm_run').runWasm(source, opts) : runNative(source, opts)),
    runWasmFile: (file, args) => require('./wasm_run').runWasmFile(file, args),
    findCC,
    tokenize,
    parse: (source, file) => parse(tokenize(source, file), file),
};
