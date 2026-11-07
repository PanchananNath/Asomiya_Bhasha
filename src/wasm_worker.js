'use strict';
/**
 * Web Worker that runs a compiled Asomiya WebAssembly module
 * (bundled to public/worker.js). Messages:
 *   in : { wasm: ArrayBuffer, stdin: string, args: string[] }
 *   out: { type: 'out' | 'err', text } … then { type: 'done', status, error, ms }
 */
const { createHost, moduleInfo } = require('./wasm_host');

const decOut = new TextDecoder('utf-8');
const decErr = new TextDecoder('utf-8');

self.onmessage = async (ev) => {
    const { wasm, stdin, args } = ev.data;
    const t0 = performance.now();
    try {
        const mod = await WebAssembly.compile(wasm);
        const info = moduleInfo(mod);
        const host = createHost({
            stdin: stdin || '',
            flushMs: 40,
            write: b => self.postMessage({ type: 'out', text: decOut.decode(b, { stream: true }) }),
            writeErr: b => self.postMessage({ type: 'err', text: decErr.decode(b, { stream: true }) }),
        });
        const inst = await WebAssembly.instantiate(mod, host.imports(info));
        const r = host.run(inst, ['playground', ...(args || [])]);
        self.postMessage({ type: 'out', text: decOut.decode() });
        self.postMessage({ type: 'done', status: r.status, error: r.error, ms: performance.now() - t0 });
    } catch (e) {
        self.postMessage({ type: 'done', status: 1, error: String(e && e.message || e), ms: performance.now() - t0 });
    }
};
