'use strict';
/**
 * Node.js runner for the WebAssembly back end.
 *   runWasm(source, opts)  — compile and run (like native.runNative).
 *   runWasmFile(path, argv) — run a .wasm made by `asomiya wasm`.
 * Without `inherit`, the program runs in a child Node process so that a
 * timeout can stop endless loops; files the program opens are real files.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { compile } = require('./compiler');
const { fileLoader } = require('./native');
const { createHost, moduleInfo } = require('./wasm_host');

function nodeStdin() {
    const buf = Buffer.alloc(65536);
    return () => {
        for (;;) {
            try {
                const n = fs.readSync(0, buf, 0, buf.length, null);
                return n > 0 ? Uint8Array.from(buf.subarray(0, n)) : null;
            } catch (e) {
                if (e.code === 'EAGAIN') { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20); continue; }
                if (e.code === 'EOF') return null;
                throw e;
            }
        }
    };
}

/** Run module bytes in this process with the real stdin/stdout and file system. */
function runBytes(bytes, argv) {
    const mod = new WebAssembly.Module(bytes);
    const info = moduleInfo(mod);
    const host = createHost({
        stdin: nodeStdin(),
        write: b => fs.writeSync(1, b),
        writeErr: b => fs.writeSync(2, b),
        readFile: p => { try { return new Uint8Array(fs.readFileSync(p)); } catch (e) { return null; } },
        writeFile: (p, b) => { try { fs.writeFileSync(p, b); } catch (e) { /* ignore */ } },
    });
    const inst = new WebAssembly.Instance(mod, host.imports(info));
    return host.run(inst, argv);
}

function runWasmFile(file, args = []) {
    return runBytes(new Uint8Array(fs.readFileSync(file)), [file, ...args]);
}

function runWasm(source, opts = {}) {
    const res = compile(source, Object.assign({ loader: fileLoader }, opts, { backend: 'wasm' }));
    if (!res.ok) return res;
    const prog = opts.file || 'program';
    if (opts.inherit) {
        const r = runBytes(res.wasm, [prog, ...(opts.args || [])]);
        return Object.assign(res, { status: r.status, runtimeError: r.error });
    }
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'asomiya-wasm-'));
    const wasmFile = path.join(dir, 'program.wasm');
    fs.writeFileSync(wasmFile, res.wasm);
    const r = spawnSync(process.execPath, [path.join(__dirname, 'wasm_child.js'), wasmFile, prog, JSON.stringify(opts.args || [])], {
        input: opts.input || '', encoding: 'utf8', timeout: opts.timeout || 0, maxBuffer: 64 * 1024 * 1024,
    });
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* ignore */ }
    return Object.assign(res, { status: r.status, stdout: r.stdout, stderr: r.stderr, signal: r.signal });
}

module.exports = { runWasm, runWasmFile, runBytes };
