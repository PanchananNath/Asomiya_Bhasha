#!/usr/bin/env node
'use strict';
/**
 * asomiya — command-line driver for Asomiya Bhasha 2.0.
 */
const fs = require('fs');
const path = require('path');
const { compile, VERSION } = require('./compiler');
const { buildNative, runNative, fileLoader, findCC, noCCMessage, findClang, ccTriple } = require('./native');

const HELP = `অসমীয়া ভাষা ${VERSION} — অসমীয়া লিপিৰ systems programming language

ব্যৱহাৰ (usage):
  asomiya <ফাইল.asb> [-- args…]        compile কৰি চলোৱা (run-ৰ দৰে)
  asomiya run <ফাইল.asb> [-- args…]    compile কৰি চলোৱা
  asomiya build <ফাইল.asb> [-o নাম]    native executable তৈয়াৰ কৰা
  asomiya c <ফাইল.asb> [-o নাম.c]      তৈয়াৰ হোৱা C ক'ড দেখুওৱা বা সাঁচি ৰখা
  asomiya ll <ফাইল.asb> [-o নাম.ll]    তৈয়াৰ হোৱা LLVM IR দেখুওৱা বা সাঁচি ৰখা (-g: DWARF)
  asomiya wasm <ফাইল.asb> [-o নাম.wasm] WebAssembly module তৈয়াৰ কৰা
  asomiya check <ফাইল.asb>             কেৱল ভুল পৰীক্ষা কৰা
  asomiya -e "<ক'ড>"                   command line-ৰ ক'ড চলোৱা

বিকল্প (options):
  --backend <c|llvm|wasm>
                      ক'ড তৈয়াৰ কৰা পথ (মূল: c). llvm-ৰ বাবে clang লাগে;
                      wasm-এ Node.js-তে চলে (C কম্পাইলাৰ নালাগে)
  --cc <compiler>     C কম্পাইলাৰ (মূল: cc, gcc বা clang)
  --clang <clang>     LLVM IR compile কৰিবলৈ clang (মূল: clang)
  --ascii-digits      লিখা-ই সংখ্যা 0-9 ৰূপত লিখিব (মূল: ০-৯)
  --ascii-names       C ক'ডত অসমীয়া নাম _uXXXX_ ৰূপত লিখা
  -O0 … -O3           optimisation স্তৰ (মূল: -O2)
  -g                  debugger-ৰ বাবে তথ্য ৰখা
  --version, --help

উদাহৰণ:
  asomiya examples/hello.asb
  asomiya build examples/linked_list.asb -o তালিকা
  asomiya build --backend llvm -g examples/structs.asb    (gdb/lldb-ৰ বাবে)
  asomiya run --backend wasm examples/loops.asb
`;

function parseArgs(argv) {
    const o = { cmd: null, file: null, out: null, cc: null, clang: null, backend: 'c', opt: 2, asciiDigits: false, asciiNames: false, debug: false, code: null, args: [] };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--') { o.args = argv.slice(i + 1); break; }
        if (a === '-h' || a === '--help') o.cmd = 'help';
        else if (a === '-v' || a === '--version') o.cmd = 'version';
        else if (a === '-o') o.out = argv[++i];
        else if (a === '--cc') o.cc = argv[++i];
        else if (a === '--clang') o.clang = argv[++i];
        else if (a === '--backend') {
            o.backend = argv[++i];
            if (!['c', 'llvm', 'wasm'].includes(o.backend)) { console.error(`অচিনাক্ত back end: ${o.backend} (c, llvm বা wasm)`); process.exit(2); }
        }
        else if (/^-O[0-3s]$/.test(a)) o.opt = a.slice(2);
        else if (a === '-g') o.debug = true;
        else if (a === '--ascii-digits') o.asciiDigits = true;
        else if (a === '--ascii-names') o.asciiNames = true;
        else if (a === '-e') { o.code = argv[++i]; o.cmd = o.cmd || 'run'; }
        else if (!o.cmd && ['run', 'build', 'c', 'll', 'wasm', 'check'].includes(a)) o.cmd = a;
        else if (a.startsWith('-')) { console.error(`অচিনাক্ত বিকল্প: ${a}`); process.exit(2); }
        else if (!o.file) o.file = a;
        else o.args.push(a);
    }
    if (!o.cmd) o.cmd = o.file ? 'run' : 'help';
    return o;
}

function readSource(o) {
    if (o.code != null) return { text: o.code, file: '<-e>' };
    if (!o.file) { console.error('ফাইলৰ নাম দিয়া নাই। asomiya --help চাওক।'); process.exit(2); }
    if (!fs.existsSync(o.file)) { console.error(`ফাইল পোৱা নগ'ল: ${o.file}`); process.exit(2); }
    return { text: fs.readFileSync(o.file, 'utf8'), file: o.file };
}

function report(res) {
    if (res.diagnostics && res.diagnostics.items.length) console.error(res.diagnostics.formatAll());
    if (res.ccError) console.error(res.ccError);
}

function main() {
    const o = parseArgs(process.argv.slice(2));
    if (o.cmd === 'help') { console.log(HELP); return 0; }
    if (o.cmd === 'version') {
        const cc = findCC(o.cc);
        const clang = cc ? findClang(o.clang, ccTriple(cc)) : null;
        console.log(`অসমীয়া ভাষা ${VERSION} (C compiler: ${cc || 'পোৱা নগ\'ল'}; LLVM: ${clang || 'পোৱা নগ\'ল'}; WebAssembly: Node.js ${process.versions.node})`);
        if (!cc) console.log(noCCMessage());
        return 0;
    }
    const src = readSource(o);
    const opts = { file: src.file, cc: o.cc, clang: o.clang, backend: o.backend, opt: o.opt, debug: o.debug, asciiDigits: o.asciiDigits, asciiNames: o.asciiNames };

    if (o.cmd === 'll' || o.cmd === 'wasm') {
        const res = compile(src.text, Object.assign({ loader: fileLoader, dir: process.cwd() }, opts, { backend: o.cmd === 'll' ? 'llvm' : 'wasm' }));
        report(res);
        if (!res.ok) return 1;
        if (o.cmd === 'll') {
            if (o.out) { fs.writeFileSync(o.out, res.ll); console.error(`✓ LLVM IR সাঁচি থোৱা হ'ল: ${o.out}`); }
            else process.stdout.write(res.ll);
            return 0;
        }
        const out = o.out || (o.file ? path.basename(o.file).replace(/\.(asb|asm)$/i, '') : 'program') + '.wasm';
        fs.writeFileSync(out, res.wasm);
        console.error(`✓ WebAssembly module: ${out} (${res.wasm.length} bytes) — চলাবলৈ: asomiya run --backend wasm ${src.file}`);
        return 0;
    }
    if (o.backend === 'wasm' && o.cmd === 'build') {
        console.error("WebAssembly-ৰ বাবে 'asomiya wasm <ফাইল>' ব্যৱহাৰ কৰক");
        return 2;
    }
    if (o.backend === 'wasm' && o.cmd === 'run') {
        const { runWasm } = require('./wasm_run');
        const res = runWasm(src.text, Object.assign({}, opts, { args: o.args, inherit: true }));
        report(res);
        if (!res.ok) return 1;
        return res.status == null ? 1 : res.status;
    }

    if (o.cmd === 'check' || o.cmd === 'c') {
        const res = compile(src.text, Object.assign({ loader: fileLoader }, opts));
        report(res);
        if (!res.ok) return 1;
        if (o.cmd === 'check') { console.log(`✓ ${src.file}: কোনো ভুল নাই`); return 0; }
        if (o.out) { fs.writeFileSync(o.out, res.c); console.error(`✓ C ক'ড সাঁচি থোৱা হ'ল: ${o.out}`); }
        else process.stdout.write(res.c);
        return 0;
    }
    if (o.cmd === 'build') {
        const out = o.out || (o.file ? path.basename(o.file).replace(/\.(asb|asm)$/i, '') : 'program');
        const res = buildNative(src.text, Object.assign({}, opts, { out: path.resolve(out) }));
        report(res);
        if (!res.ok) return 1;
        console.error(`✓ তৈয়াৰ হ'ল: ${out}  (${res.clang ? `LLVM: ${res.clang} + ${res.cc}` : res.cc})`);
        return 0;
    }
    // run
    const res = runNative(src.text, Object.assign({}, opts, { args: o.args, inherit: true }));
    report(res);
    if (!res.ok) return 1;
    if (res.signal) { console.error(`প্ৰ'গ্ৰামটো ${res.signal} সংকেতত বন্ধ হ'ল`); return 1; }
    return res.status == null ? 1 : res.status;
}

process.exitCode = main();
