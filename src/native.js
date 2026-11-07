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
    const res = compile(source, Object.assign({ loader: fileLoader }, opts));
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

function runNative(source, opts = {}) {
    const b = buildNative(source, opts);
    if (!b.ok) return b;
    const r = spawnSync(b.exe, opts.args || [], { encoding: 'utf8', input: opts.input, stdio: opts.inherit ? 'inherit' : 'pipe', timeout: opts.timeout || 0 });
    if (!opts.keep && b.dir) removeDir(b.dir);
    return Object.assign(b, { status: r.status, stdout: r.stdout, stderr: r.stderr, signal: r.signal });
}

module.exports = { buildNative, runNative, findCC, probeCC, noCCMessage, fileLoader };
