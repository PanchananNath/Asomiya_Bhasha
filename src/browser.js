'use strict';
/**
 * Browser entry point, bundled by esbuild into public/runtime.js as the
 * global `AsomiyaRuntime`. Browsers have no C compiler, so the playground
 * translates Asomiya to C and reports errors; native execution needs the CLI.
 */
const { compile, VERSION } = require('./compiler');
const samples = require('../examples/catalog');

function translate(code, opts = {}) {
    const res = compile(code, { file: 'playground.asb', asciiDigits: !!opts.asciiDigits, asciiNames: !!opts.asciiNames });
    return {
        success: res.ok,
        c: res.ok ? res.c : '',
        diagnostics: res.diagnostics.formatAll(),
        errors: res.diagnostics.errors.length,
        warnings: res.diagnostics.warnings.length,
    };
}

module.exports = { translate, VERSION, samples, categories: samples.CATEGORIES };
