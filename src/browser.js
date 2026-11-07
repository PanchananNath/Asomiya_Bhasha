'use strict';
/**
 * Browser entry point, bundled by esbuild into public/runtime.js as the
 * global `AsomiyaRuntime`. The playground compiles programs to WebAssembly
 * here and runs them in a Web Worker (public/worker.js); it can also show
 * the generated C and LLVM IR.
 */
const { compile, VERSION } = require('./compiler');
const samples = require('../examples/catalog');

function summary(res) {
    return {
        success: res.ok,
        diagnostics: res.diagnostics.formatAll(),
        errors: res.diagnostics.errors.length,
        warnings: res.diagnostics.warnings.length,
    };
}

/** Asomiya → C or LLVM IR text (target: 'c' | 'llvm'). */
function translate(code, opts = {}) {
    const backend = opts.target === 'llvm' ? 'llvm' : 'c';
    const res = compile(code, { file: 'playground.asb', backend, asciiDigits: !!opts.asciiDigits, asciiNames: !!opts.asciiNames, debug: !!opts.debug });
    const out = summary(res);
    out.c = res.ok && backend === 'c' ? res.c : '';
    out.ll = res.ok && backend === 'llvm' ? res.ll : '';
    out.text = out.c || out.ll;
    return out;
}

/** Asomiya → WebAssembly module bytes (run them with worker.js). */
function compileWasm(code, opts = {}) {
    const res = compile(code, { file: 'playground.asb', backend: 'wasm', asciiDigits: !!opts.asciiDigits });
    const out = summary(res);
    out.wasm = res.ok ? res.wasm : null;
    return out;
}

module.exports = { translate, compileWasm, VERSION, samples, categories: samples.CATEGORIES };
