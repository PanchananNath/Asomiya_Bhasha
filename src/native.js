'use strict';
/**
 * Node.js helpers that turn generated C into a native executable with the
 * system C compiler (cc, gcc or clang) and run it.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { compile } = require('./compiler');
const { runtimeLibrary } = require('./runtime');

const probeCache = new Map();

/**
 * Check that a C compiler exists AND can build a program that uses the
 * standard headers. (On Windows, a bare LLVM clang without Visual Studio or
 * MinGW reports a version but has no <stdio.h>.)
 */
function probeCC(cc) {
    if (probeCache.has(cc)) return probeCache.get(cc);
    let res;
    const v = spawnSync(cc, ['--version'], { encoding: 'utf8' });
    if (v.error || v.status !== 0) {
        res = { ok: false, missing: true };
    } else {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'asomiya-probe-'));
        const src = path.join(dir, 'probe.c');
        const exe = path.join(dir, process.platform === 'win32' ? 'probe.exe' : 'probe');
        fs.writeFileSync(src, '#include <stdio.h>\n#include <stdlib.h>\n#include <stdint.h>\n#include <math.h>\nint main(void) { puts("ok"); return 0; }\n');
        const r = spawnSync(cc, ['-std=c11', '-o', exe, src, '-lm'], { encoding: 'utf8' });
        const firstLine = String(r.stderr || r.stdout || (r.error && r.error.message) || '').split('\n').map(l => l.trim()).find(Boolean) || 'build failed';
        res = r.status === 0 ? { ok: true } : { ok: false, missing: false, reason: firstLine };
        removeDir(dir);
    }
    probeCache.set(cc, res);
    return res;
}

/** Return the first usable C compiler, or null. `findCC.problems` lists unusable ones found. */
/** Remove a temporary directory; on Windows the just-finished .exe can stay locked for a moment. */
function removeDir(dir) {
    try { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); } catch (e) { /* leave it for the OS temp cleaner */ }
}

function findCC(preferred) {
    const candidates = [...new Set([preferred, process.env.CC, 'cc', 'gcc', 'clang'].filter(Boolean))];
    findCC.problems = [];
    for (const cc of candidates) {
        const p = probeCC(cc);
        if (p.ok) return cc;
        if (!p.missing) findCC.problems.push(`${cc}: ${p.reason}`);
    }
    return null;
}

function noCCMessage() {
    const lines = ["ব্যৱহাৰযোগ্য C কম্পাইলাৰ পোৱা নগ'ল (usable C compiler not found)."];
    if (findCC.problems && findCC.problems.length) {
        lines.push('এইবোৰ পোৱা গ\'ল, কিন্তু C লাইব্ৰেৰীৰ header নাই বা build বিফল হ\'ল:');
        for (const p of findCC.problems) lines.push('  ' + p);
    }
    if (process.platform === 'win32') {
        lines.push('Windows: MSYS2 (https://www.msys2.org) ইনষ্টল কৰি "MSYS2 UCRT64"-ত চলাওক:');
        lines.push('  pacman -S --needed mingw-w64-ucrt-x86_64-gcc');
        lines.push('  তাৰ পিছত C:\\msys64\\ucrt64\\bin PATH-ত যোগ কৰি terminal নতুনকৈ খোলক।');
    } else {
        lines.push('Ubuntu/Debian: sudo apt install build-essential   ·   macOS: xcode-select --install');
    }
    return lines.join('\n');
}

/** C compiler's target triple (so clang emits objects the C compiler can link). */
const tripleCache = new Map();
function ccTriple(cc) {
    if (!tripleCache.has(cc)) {
        const r = spawnSync(cc, ['-dumpmachine'], { encoding: 'utf8' });
        tripleCache.set(cc, r.status === 0 ? String(r.stdout).trim().split('\n')[0] : '');
    }
    return tripleCache.get(cc);
}

/** clang that can turn LLVM IR (.ll) into an object file for `triple`. */
const clangCache = new Map();
function probeClang(clang, triple) {
    const key = clang + '|' + triple;
    if (clangCache.has(key)) return clangCache.get(key);
    let res;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'asomiya-probe-'));
    try {
        const ll = path.join(dir, 'probe.ll');
        fs.writeFileSync(ll, 'define i32 @asb_probe(ptr %p) {\n  %v = load i32, ptr %p\n  ret i32 %v\n}\n');
        const args = ['-c', ll, '-o', path.join(dir, 'probe.o')];
        if (triple) args.unshift('-target', triple);
        const r = spawnSync(clang, args, { encoding: 'utf8' });
        if (r.error) res = { ok: false, missing: true };
        else if (r.status !== 0) res = { ok: false, reason: String(r.stderr || r.stdout).split('\n').map(l => l.trim()).find(Boolean) || 'failed' };
        else res = { ok: true };
    } finally { removeDir(dir); }
    clangCache.set(key, res);
    return res;
}
function findClang(preferred, triple) {
    const names = [preferred, process.env.ASB_CLANG, 'clang', ...[22, 21, 20, 19, 18, 17, 16, 15].map(v => `clang-${v}`)];
    findClang.problems = [];
    for (const c of [...new Set(names.filter(Boolean))]) {
        const p = probeClang(c, triple);
        if (p.ok) return c;
        if (!p.missing) findClang.problems.push(`${c}: ${p.reason}`);
    }
    return null;
}
function noClangMessage() {
    const lines = ["LLVM back end-ৰ বাবে clang (LLVM ১৫ বা নতুন) পোৱা নগ'ল (clang not found)."];
    for (const p of findClang.problems || []) lines.push('  ' + p);
    if (process.platform === 'win32') lines.push('Windows (MSYS2 UCRT64): pacman -S --needed mingw-w64-ucrt-x86_64-clang   বা https://github.com/llvm/llvm-project/releases');
    else lines.push('Ubuntu/Debian: sudo apt install clang   ·   macOS: xcode-select --install');
    lines.push('অথবা --backend c (মূল back end) ব্যৱহাৰ কৰক।');
    return lines.join('\n');
}

function fileLoader(importPath, fromFile) {
    const base = fromFile && !fromFile.startsWith('<') ? path.dirname(fromFile) : process.cwd();
    const full = path.resolve(base, importPath);
    if (!fs.existsSync(full)) return null;
    return { file: path.relative(process.cwd(), full) || full, text: fs.readFileSync(full, 'utf8') };
}

/**
 * Compile Asomiya source to a native executable.
 * @returns {{ok, diagnostics, c, exe?, ccOutput?}}
 */
function buildNative(source, opts = {}) {
    if (opts.backend === 'llvm') return buildLLVM(source, opts);
    const res = compile(source, Object.assign({ loader: fileLoader }, opts, { backend: 'c' }));
    if (!res.ok) return res;
    const cc = findCC(opts.cc);
    if (!cc) return Object.assign(res, { ok: false, ccError: noCCMessage() });
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'asomiya-'));
    const cFile = opts.cOut || path.join(dir, 'program.c');
    fs.writeFileSync(cFile, res.c);
    const exe = opts.out || path.join(dir, process.platform === 'win32' ? 'program.exe' : 'program');
    const args = ['-std=c11', `-O${opts.opt == null ? 2 : opts.opt}`, '-o', exe, cFile, '-lm'];
    if (opts.debug) args.unshift('-g');
    const r = spawnSync(cc, args, { encoding: 'utf8' });
    if (r.status !== 0) return Object.assign(res, { ok: false, ccError: `C কম্পাইলাৰ (${cc}) বিফল হ'ল:\n${r.stderr || r.stdout}` });
    return Object.assign(res, { exe, cFile, cc, dir });
}

/**
 * LLVM path: Asomiya → LLVM IR → (clang -c) object → link with the runtime
 * using the C compiler. Using the C compiler's own target triple keeps the
 * object compatible (e.g. MinGW on Windows).
 */
function buildLLVM(source, opts) {
    const res = compile(source, Object.assign({ loader: fileLoader, dir: process.cwd() }, opts, { backend: 'llvm' }));
    if (!res.ok) return res;
    const cc = findCC(opts.cc);
    if (!cc) return Object.assign(res, { ok: false, ccError: noCCMessage() });
    const triple = ccTriple(cc);
    const clang = findClang(opts.clang, triple);
    if (!clang) return Object.assign(res, { ok: false, ccError: noClangMessage() });
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'asomiya-'));
    const llFile = opts.llOut || path.join(dir, 'program.ll');
    fs.writeFileSync(llFile, res.ll);
    const rtFile = path.join(dir, 'asb_runtime.c');
    fs.writeFileSync(rtFile, runtimeLibrary({ asciiDigits: opts.asciiDigits }));
    const obj = path.join(dir, 'program.o');
    const opt = `-O${opts.opt == null ? 2 : opts.opt}`;
    const cargs = ['-c', opt, '-Wno-override-module', llFile, '-o', obj];
    if (triple) cargs.unshift('-target', triple);
    if (triple && !/windows|mingw|cygwin|darwin|apple/i.test(triple)) cargs.push('-fPIE');
    let r = spawnSync(clang, cargs, { encoding: 'utf8' });
    if (r.status !== 0) return Object.assign(res, { ok: false, ccError: `clang (${clang}) LLVM IR compile কৰিব নোৱাৰিলে:\n${r.stderr || r.stdout || (r.error && r.error.message)}` });
    const exe = opts.out || path.join(dir, process.platform === 'win32' ? 'program.exe' : 'program');
    const largs = ['-std=c11', opt, '-o', exe, obj, rtFile, '-lm'];
    if (opts.debug) largs.unshift('-g');
    r = spawnSync(cc, largs, { encoding: 'utf8' });
    if (r.status !== 0) return Object.assign(res, { ok: false, ccError: `link (${cc}) বিফল হ'ল:\n${r.stderr || r.stdout}` });
    return Object.assign(res, { exe, llFile, cc, clang, triple, dir });
}

function runNative(source, opts = {}) {
    const b = buildNative(source, opts);
    if (!b.ok) return b;
    const r = spawnSync(b.exe, opts.args || [], { encoding: 'utf8', input: opts.input, stdio: opts.inherit ? 'inherit' : 'pipe', timeout: opts.timeout || 0 });
    if (!opts.keep && b.dir) removeDir(b.dir);
    return Object.assign(b, { status: r.status, stdout: r.stdout, stderr: r.stderr, signal: r.signal });
}

module.exports = { buildNative, runNative, findCC, probeCC, noCCMessage, fileLoader, findClang, noClangMessage, ccTriple };
