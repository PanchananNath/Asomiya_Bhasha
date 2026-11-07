'use strict';
/**
 * Asomiya Bhasha 2.0 — compiler driver (platform independent).
 *   source text → tokens → AST (+ imports) → checked model → C11 text
 * Works in Node.js and in the browser; file access for `আমদানি` goes
 * through the optional `loader(path, fromFile)` callback.
 */
const { tokenize } = require('./lexer');
const { parse } = require('./parser');
const { Checker } = require('./checker');
const { CGen } = require('./codegen_c');
const { LLGen, LLVMUnsupported } = require('./codegen_llvm');
const { Diagnostics, CompileError } = require('./diagnostics');
const { PRELUDE } = require('./runtime');

const VERSION = '2.1.0';
let preludeCache = null;

function parsePrelude() {
    if (!preludeCache) preludeCache = parse(tokenize(PRELUDE, '<মানক>'), '<মানক>').items;
    return JSON.parse(JSON.stringify(preludeCache, (k, v) => (typeof v === 'bigint' ? { $big: v.toString() } : v)), (k, v) => (v && v.$big !== undefined ? BigInt(v.$big) : v));
}

/**
 * Compile Asomiya source.
 *   opts.backend: 'c' (default) → result.c;  'llvm' → result.ll (and result.c is not made)
 * @returns {{ok: boolean, c?: string, ll?: string, diagnostics: Diagnostics, model?: object}}
 */
function compile(source, opts = {}) {
    const file = opts.file || '<উৎস>';
    const diag = new Diagnostics();
    diag.addSource(file, source.normalize('NFC'));
    let items;
    try {
        items = loadFile(source, file, opts, diag, new Set([file]), false);
    } catch (e) {
        if (e instanceof CompileError) { diag.error(e.message, Object.assign({ file: e.file }, e.pos)); return { ok: false, diagnostics: diag }; }
        throw e;
    }
    const checker = new Checker(diag);
    const model = checker.check(parsePrelude(), items);
    if (diag.hasErrors()) return { ok: false, diagnostics: diag };
    const backend = opts.backend || 'c';
    const out = { ok: true, diagnostics: diag, model, backend };
    try {
        if (backend === 'llvm') out.ll = new LLGen(model, { file, dir: opts.dir, debug: opts.debug }).generate();
        else if (backend === 'wasm') {
            const { WasmGen } = require('./codegen_wasm');
            const w = new WasmGen(model, { file, asciiDigits: opts.asciiDigits }).generate();
            out.wasm = w.bytes;
            out.wasmInfo = w.info;
        } else out.c = new CGen(model, { asciiNames: opts.asciiNames, asciiDigits: opts.asciiDigits, file }).generate();
    } catch (e) {
        if (e instanceof LLVMUnsupported || (e && e.isBackendLimit)) { diag.error(e.message, Object.assign({ file }, e.pos)); return { ok: false, diagnostics: diag }; }
        diag.error(`কম্পাইলাৰৰ আভ্যন্তৰীণ ত্ৰুটি (এইটো কম্পাইলাৰৰ bug; অনুগ্ৰহ কৰি GitHub-ত জনাওক): ${e.message}`, { line: 1, col: 1, file });
        if (typeof process !== 'undefined' && process.env && process.env.ASB_DEBUG) throw e;
        return { ok: false, diagnostics: diag };
    }
    return out;
}

function loadFile(source, file, opts, diag, seen, isImport) {
    const ast = parse(tokenize(source, file), file);
    const out = [];
    for (const it of ast.items) {
        if (it.kind === 'Import') {
            if (!opts.loader) throw new CompileError('এই পৰিৱেশত আমদানি (import) সমৰ্থিত নহয়', it.pos, file);
            const loaded = opts.loader(it.path, file);
            if (!loaded) throw new CompileError(`আমদানি কৰিবলগীয়া ফাইল '${it.path}' পোৱা নগ'ল`, it.pos, file);
            if (seen.has(loaded.file)) continue;
            seen.add(loaded.file);
            diag.addSource(loaded.file, loaded.text.normalize('NFC'));
            out.push(...loadFile(loaded.text, loaded.file, opts, diag, seen, true));
            continue;
        }
        if (isImport) it.fromImport = true;
        out.push(it);
    }
    return out;
}

module.exports = { compile, VERSION };
