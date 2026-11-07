'use strict';
/**
 * Asomiya Bhasha 2.1 — WebAssembly host runtime.
 *
 * Supplies everything a compiled module imports: printing (with Assamese
 * digits), line input, a malloc/free heap, a C library subset (strings,
 * ctype, math, printf family, qsort, rand), an in-memory file system, and
 * Assamese reports for run-time faults. Works in Node.js and in browsers
 * (no Node APIs are used here).
 *
 *   const host = createHost({ stdin, write, writeErr, files });
 *   const { instance } = await WebAssembly.instantiate(bytes, host.imports(info));
 *   const status = host.run(instance, ['prog', ...args]);
 */

const enc = new TextEncoder();
const dec = new TextDecoder('utf-8');
const N = x => (typeof x === 'bigint' ? Number(x) : x);
const U32 = x => N(x) >>> 0;
const I32 = x => N(x) | 0;
const BN = x => (typeof x === 'bigint' ? x : BigInt(Math.trunc(Number(x) || 0)));

class AsbExit extends Error { constructor(code) { super('exit'); this.code = code; } }
class AsbTrap extends Error { constructor(msg) { super(msg); this.asb = true; } }

const ASM_DIGITS = '০১২৩৪৫৬৭৮৯';
const toAsm = s => s.replace(/[0-9]/g, d => ASM_DIGITS[d]);
const fromAsm = s => s.replace(/[০-৯]/g, d => String(d.charCodeAt(0) - 0x09E6));

// ---- C-compatible number formatting ----------------------------------------------
function expStr(e) { const a = Math.abs(e); return (e < 0 ? '-' : '+') + (a < 10 ? '0' + a : String(a)); }
/** C %e with precision p, without sign handling of NaN/Inf. */
function fmtE(x, p, upper) {
    let s = Math.abs(x).toExponential(p);
    const [m, e] = s.split('e');
    s = m + (upper ? 'E' : 'e') + expStr(Number(e));
    return s;
}
function fmtF(x, p) {
    const ax = Math.abs(x);
    if (ax >= 1e21) return BigInt(ax).toString() + (p > 0 ? '.' + '0'.repeat(p) : '');
    return ax.toFixed(Math.min(p, 100));
}
/** C %g. */
function fmtG(x, p, upper, alt) {
    if (p === 0) p = 1;
    const ax = Math.abs(x);
    let X;
    if (ax === 0) X = 0;
    else { const t = ax.toExponential(p - 1); X = Number(t.split('e')[1]); }
    let s;
    if (p > X && X >= -4) s = fmtF(ax, p - 1 - X);
    else s = fmtE(ax, p - 1, upper);
    if (!alt) {
        if (s.includes('e') || s.includes('E')) {
            const [m, e] = s.split(/(?=[eE])/);
            s = (m.includes('.') ? m.replace(/0+$/, '').replace(/\.$/, '') : m) + e;
        } else if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, '');
    }
    return s;
}
function finite(x, upper, s) {
    if (Number.isNaN(x)) return upper ? 'NAN' : 'nan';
    if (!Number.isFinite(x)) return upper ? 'INF' : 'inf';
    return s;
}

/** All C function names the host implements (used by the compiler to reject others). */
const HOST_FUNCS = new Set();

function createHost(opts = {}) {
    let memory = null, table = null, u8 = null, dv = null, info = null;
    const view = () => {
        if (!u8 || u8.buffer !== memory.buffer) { u8 = new Uint8Array(memory.buffer); dv = new DataView(memory.buffer); }
    };
    const asciiDigits = () => !!(info && info.asciiDigits);
    const num = s => (asciiDigits() ? s : toAsm(s));

    // ---- output ----
    let outBuf = [];
    let outLen = 0;
    const write = opts.write || (() => {});
    const writeErr = opts.writeErr || write;
    let lastFlush = Date.now();
    function out(bytes) {
        outBuf.push(bytes);
        outLen += bytes.length;
        if (outLen > 65536 || (opts.flushMs && Date.now() - lastFlush > opts.flushMs)) flush();
    }
    const outStr = s => out(enc.encode(s));
    function flush() {
        if (!outLen) return;
        const all = new Uint8Array(outLen);
        let k = 0;
        for (const b of outBuf) { all.set(b, k); k += b.length; }
        outBuf = []; outLen = 0;
        lastFlush = Date.now();
        write(all);
    }

    // ---- input ----
    let inQueue = [];
    let inPos = 0;
    let inEOF = false;
    if (typeof opts.stdin === 'string') { inQueue = [...enc.encode(opts.stdin)]; inEOF = true; }
    else if (opts.stdin instanceof Uint8Array) { inQueue = [...opts.stdin]; inEOF = true; }
    function readByte() {
        while (inPos >= inQueue.length) {
            if (inEOF || typeof opts.stdin !== 'function') return -1;
            flush();
            const chunk = opts.stdin();
            if (!chunk || !chunk.length) { inEOF = true; return -1; }
            inQueue = [...chunk]; inPos = 0;
        }
        return inQueue[inPos++];
    }

    // ---- memory helpers ----
    function cstrBytes(p) {
        p = U32(p);
        view();
        let e = p;
        while (e < u8.length && u8[e] !== 0) e++;
        return u8.subarray(p, e);
    }
    const cstr = p => dec.decode(cstrBytes(p));
    function putBytes(p, bytes) { view(); u8.set(bytes, U32(p)); }
    function newCstr(bytes) {
        if (typeof bytes === 'string') bytes = enc.encode(bytes);
        const p = malloc(bytes.length + 1);
        if (!p) return 0;
        view();
        u8.set(bytes, p); u8[p + bytes.length] = 0;
        return p;
    }

    // ---- heap (size classes, power of two) ----
    let brk = 0;
    const live = new Map();     // ptr -> { cls, size }
    const freeLists = new Map(); // cls -> [ptr]
    function classOf(n) { let c = 16; while (c < n) c *= 2; return c; }
    function malloc(n) {
        n = Math.max(N(n), 1);
        if (!(n < 0x7FFFFFFF)) return 0;
        const c = classOf(n);
        const fl = freeLists.get(c);
        let p;
        if (fl && fl.length) p = fl.pop();
        else {
            p = brk;
            const need = p + c;
            if (need > memory.buffer.byteLength) {
                const pages = Math.ceil((need - memory.buffer.byteLength) / 65536) + 16;
                try { memory.grow(pages); } catch (e) { return 0; }
            }
            brk = need;
        }
        live.set(p, { cls: c, size: n });
        return p;
    }
    function free(p) {
        p = U32(p);
        if (!p) return;
        const b = live.get(p);
        if (!b) throw new AsbTrap('মুকলি()-ত ভুল সূচক: এই ঠিকনা সংৰক্ষণ()/নতুন()-ৰ পৰা পোৱা নহয় বা আগতেই মুকলি কৰা হৈছে (double free)');
        live.delete(p);
        if (!freeLists.has(b.cls)) freeLists.set(b.cls, []);
        freeLists.get(b.cls).push(p);
    }
    function calloc(n, sz) {
        const total = N(n) * N(sz);
        const p = malloc(total);
        if (p) { view(); u8.fill(0, p, p + Math.max(total, 1)); }
        return p;
    }
    function realloc(p, n) {
        p = U32(p); n = N(n);
        if (!p) return malloc(n);
        if (n === 0) { free(p); return 0; }
        const b = live.get(p);
        if (!b) throw new AsbTrap('পুনৰ_সংৰক্ষণ()-ত ভুল সূচক');
        if (classOf(n) === b.cls) { b.size = n; return p; }
        const q = malloc(n);
        if (!q) return 0;
        view();
        u8.copyWithin(q, p, p + Math.min(b.size, n));
        free(p);
        return q;
    }

    // ---- files (in memory, optionally backed by the host file system) ----
    const files = opts.files || new Map(); // path -> Uint8Array
    const handles = new Map();
    let nextHandle = 16;
    function fopen(pathP, modeP) {
        const path = cstr(pathP), mode = cstr(modeP);
        let data;
        if (mode[0] === 'r') {
            data = files.get(path) || (opts.readFile && opts.readFile(path));
            if (!data) return 0;
            data = [...data];
        } else if (mode[0] === 'w') data = [];
        else if (mode[0] === 'a') data = [...(files.get(path) || (opts.readFile && opts.readFile(path)) || [])];
        else return 0;
        const h = nextHandle++;
        handles.set(h, { path, data, pos: mode[0] === 'a' ? data.length : 0, write: mode[0] !== 'r' || mode.includes('+'), dirty: false });
        return h;
    }
    function fileOf(h) {
        const f = handles.get(U32(h));
        if (!f) throw new AsbTrap('ফাইলৰ সূচক বৈধ নহয় (খোলা নাই বা বন্ধ হৈ গৈছে)');
        return f;
    }
    function fileWrite(h, bytes) {
        const f = fileOf(h);
        for (const b of bytes) { if (f.pos < f.data.length) f.data[f.pos] = b; else f.data.push(b); f.pos++; }
        f.dirty = true;
        return bytes.length;
    }
    function fileSync(f) {
        if (!f.dirty) return;
        const bytes = Uint8Array.from(f.data);
        files.set(f.path, bytes);
        if (opts.writeFile) opts.writeFile(f.path, bytes);
        f.dirty = false;
    }
    function fclose(h) { const f = fileOf(h); fileSync(f); handles.delete(U32(h)); return 0; }
    function fileGetc(h) { const f = fileOf(h); return f.pos < f.data.length ? f.data[f.pos++] : -1; }
    function readLine(getc) {
        const bytes = [];
        let c;
        while ((c = getc()) !== -1 && c !== 10) bytes.push(c);
        if (c === -1 && bytes.length === 0) return 0;
        if (bytes.length && bytes[bytes.length - 1] === 13) bytes.pop();
        return newCstr(Uint8Array.from(bytes));
    }

    // ---- printf ----
    function format(fmtP, va, count) {
        const f = cstrBytes(fmtP);
        const outB = [];
        let slot = 0;
        const next64 = () => { view(); const v = slot < count ? dv.getBigInt64(U32(va) + 8 * slot, true) : 0n; slot++; return v; };
        const nextF = () => { view(); const v = slot < count ? dv.getFloat64(U32(va) + 8 * slot, true) : 0; slot++; return v; };
        const push = s => { for (const b of (typeof s === 'string' ? enc.encode(s) : s)) outB.push(b); };
        for (let i = 0; i < f.length; i++) {
            const ch = f[i];
            if (ch !== 37) { outB.push(ch); continue; }
            i++;
            if (f[i] === 37) { outB.push(37); continue; }
            let flags = '';
            while ('-+ #0'.includes(String.fromCharCode(f[i])) && i < f.length) flags += String.fromCharCode(f[i++]);
            let width = null, prec = null;
            if (f[i] === 42) { width = Number(BigInt.asIntN(32, next64())); i++; if (width < 0) { flags += '-'; width = -width; } }
            else { let w = ''; while (f[i] >= 48 && f[i] <= 57) w += String.fromCharCode(f[i++]); if (w) width = Number(w); }
            if (f[i] === 46) {
                i++;
                if (f[i] === 42) { prec = Number(BigInt.asIntN(32, next64())); i++; if (prec < 0) prec = null; }
                else { let p = ''; while (f[i] >= 48 && f[i] <= 57) p += String.fromCharCode(f[i++]); prec = Number(p || 0); }
            }
            let len = '';
            while (i < f.length && 'hlLqjzt'.includes(String.fromCharCode(f[i]))) len += String.fromCharCode(f[i++]);
            const conv = String.fromCharCode(f[i]);
            const long = /l|j|z|t|q|L/.test(len);
            const bits = long ? 64 : len === 'hh' ? 8 : len === 'h' ? 16 : 32;
            let body = '', sign = '', prefix = '', nonFinite = false;
            const left = flags.includes('-'), zero = flags.includes('0') && !left;
            switch (conv) {
                case 'd': case 'i': {
                    const v = BigInt.asIntN(bits, next64());
                    sign = v < 0n ? '-' : flags.includes('+') ? '+' : flags.includes(' ') ? ' ' : '';
                    body = (v < 0n ? -v : v).toString();
                    if (prec !== null) { body = body.padStart(prec, '0'); if (prec === 0 && v === 0n) body = ''; }
                    break;
                }
                case 'u': case 'x': case 'X': case 'o': {
                    const v = BigInt.asUintN(bits, next64());
                    const base = conv === 'u' ? 10 : conv === 'o' ? 8 : 16;
                    body = v.toString(base);
                    if (conv === 'X') body = body.toUpperCase();
                    if (prec !== null) { body = body.padStart(prec, '0'); if (prec === 0 && v === 0n) body = ''; }
                    if (flags.includes('#') && v !== 0n) prefix = conv === 'x' ? '0x' : conv === 'X' ? '0X' : (body[0] === '0' ? '' : '0');
                    break;
                }
                case 'c': body = String.fromCharCode(Number(BigInt.asUintN(8, next64()))); break;
                case 's': {
                    const p = Number(BigInt.asUintN(32, next64()));
                    let b = p ? cstrBytes(p) : enc.encode('(null)');
                    if (prec !== null) b = b.subarray(0, prec);
                    body = b; break;
                }
                case 'p': { const p = Number(BigInt.asUintN(32, next64())); body = p ? '0x' + p.toString(16) : '(nil)'; break; }
                case 'f': case 'F': case 'e': case 'E': case 'g': case 'G': case 'a': case 'A': {
                    const x = nextF();
                    const up = conv === conv.toUpperCase();
                    const p = prec === null ? 6 : prec;
                    sign = (x < 0 || Object.is(x, -0)) ? '-' : flags.includes('+') ? '+' : flags.includes(' ') ? ' ' : '';
                    nonFinite = !Number.isFinite(x);
                    if (nonFinite) body = finite(x, up);
                    else if (conv === 'f' || conv === 'F') { body = fmtF(x, p); if (flags.includes('#') && p === 0) body += '.'; }
                    else if (conv === 'e' || conv === 'E') body = fmtE(x, p, up);
                    else if (conv === 'g' || conv === 'G') body = fmtG(x, p, up, flags.includes('#'));
                    else body = Math.abs(x).toString(16);
                    break;
                }
                case 'n': next64(); continue;
                default: push('%' + flags + (width || '') + conv); continue;
            }
            const bodyB = typeof body === 'string' ? enc.encode(body) : body;
            const core = sign.length + prefix.length + bodyB.length;
            const padN = width !== null && width > core ? width - core : 0;
            const numeric = 'diuxXofFeEgG'.includes(conv);
            if (left) { push(sign + prefix); push(bodyB); push(' '.repeat(padN)); }
            else if (zero && numeric && !nonFinite && !(prec !== null && 'diuxXo'.includes(conv))) { push(sign + prefix); push('0'.repeat(padN)); push(bodyB); }
            else { push(' '.repeat(padN)); push(sign + prefix); push(bodyB); }
        }
        return Uint8Array.from(outB);
    }

    // ---- parsing helpers ----
    function strtoll(s, base = 10) {
        const m = /^[\s]*([+-]?)(0[xX])?([0-9a-zA-Z]*)/.exec(s);
        let b = base;
        let digits = m[3];
        if ((b === 16 || b === 0) && m[2]) b = 16;
        else if (m[2]) { digits = '0'; } // "0x" with base 10: only the 0
        if (b === 0) b = digits.startsWith('0') && digits.length > 1 ? 8 : 10;
        let v = 0n, used = 0;
        for (const c of digits) {
            const d = parseInt(c, 36);
            if (Number.isNaN(d) || d >= b) break;
            v = v * BigInt(b) + BigInt(d);
            used++;
        }
        if (!used) return { v: 0n, end: 0 };
        if (m[1] === '-') v = -v;
        if (v > 9223372036854775807n) v = 9223372036854775807n;
        if (v < -9223372036854775808n) v = -9223372036854775808n;
        return { v, end: m[0].length - (digits.length - used) };
    }
    function strtod(s) {
        const m = /^\s*([+-]?(?:(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?|inf(?:inity)?|nan))/i.exec(s);
        if (!m) return { v: 0, end: 0 };
        const t = m[1].toLowerCase();
        let v;
        if (t.endsWith('inf') || t.endsWith('infinity')) v = t.startsWith('-') ? -Infinity : Infinity;
        else if (t.endsWith('nan')) v = NaN;
        else v = parseFloat(m[1]);
        return { v, end: m[0].length };
    }
    const asciiOf = p => fromAsm(cstr(p));

    // ---- rand: glibc-compatible (TYPE_3) so programs give the same numbers as on Linux ----
    let rstate = null;
    function srand(seed) {
        seed = U32(seed) || 1;
        const r = new Int32Array(344);
        r[0] = seed | 0;
        for (let i = 1; i < 31; i++) {
            const hi = Math.trunc(r[i - 1] / 127773), lo = r[i - 1] % 127773;
            let word = 16807 * lo - 2836 * hi;
            if (word < 0) word += 2147483647;
            r[i] = word;
        }
        for (let i = 31; i < 34; i++) r[i] = r[i - 31];
        const st = [...r.slice(0, 34)];
        for (let i = 34; i < 344; i++) st.push((st[i - 31] + st[i - 3]) | 0);
        rstate = st;
    }
    function rand() {
        if (!rstate) srand(1);
        const st = rstate;
        const v = (st[st.length - 31] + st[st.length - 3]) | 0;
        st.push(v);
        if (st.length > 1000) st.splice(0, st.length - 400);
        return (v >>> 1);
    }

    const memArgs = () => { view(); return u8; };
    const cmpBytes = (a, b, n) => {
        const m = memArgs();
        for (let i = 0; n === undefined || i < n; i++) {
            const x = m[a + i], y = m[b + i];
            if (x !== y) return x < y ? -1 : 1;
            if (n === undefined && x === 0) return 0;
        }
        return 0;
    };
    const isC = (re) => (c) => (re.test(String.fromCharCode(N(c) & 0xFF)) ? 1 : 0);

    // ---- the library ----
    const L = {
        // printing used by generated code
        asb_rt_print_i64: v => outStr(num(String(BN(v)))),
        asb_rt_print_u64: v => outStr(num(String(BigInt.asUintN(64, BN(v))))),
        asb_rt_print_f64: v => {
            v = N(v);
            if (Number.isNaN(v)) return outStr('অসংখ্যা');
            if (!Number.isFinite(v)) return outStr(v > 0 ? 'অসীম' : '-অসীম');
            outStr(num((v < 0 || Object.is(v, -0) ? '-' : '') + fmtG(v, 15)));
        },
        asb_rt_print_bool: v => outStr(N(v) ? 'সত্য' : 'মিছা'),
        asb_rt_print_char: c => out(Uint8Array.of(N(c) & 0xFF)),
        asb_rt_print_cp: cp => outStr(String.fromCodePoint(N(cp))),
        asb_rt_print_str: p => (U32(p) ? out(cstrBytes(p).slice()) : outStr('খালি')),
        asb_rt_print_ptr: p => outStr(U32(p) ? '0x' + U32(p).toString(16) : 'খালি'),
        asb_rt_puts: p => out(cstrBytes(p).slice()),
        asb_rt_sp: () => out(Uint8Array.of(32)),
        asb_rt_nl: () => out(Uint8Array.of(10)),
        asb_trap: code => {
            const c = N(code);
            if (c === 1) throw new AsbTrap('খালি (null) বা অবৈধ সূচকৰ পৰা মান পঢ়া/লিখাৰ চেষ্টা (null pointer)');
            if (c === 2) throw new AsbTrap('stack শেষ হ\'ল — কাজে নিজকে বহুত বেছিবাৰ মাতিছে (অসীম পুনৰাবৃত্তি?)');
            throw new AsbTrap('চলাওঁতে ভুল ' + c);
        },
        // input & conversion
        asb_rt_read_line: () => readLine(readByte),
        asb_rt_read_line_from: h => readLine(() => fileGetc(h)),
        asb_rt_parse_i64: p => (U32(p) ? strtoll(asciiOf(p)).v : 0n),
        asb_rt_parse_f64: p => (U32(p) ? strtod(asciiOf(p)).v : 0),
        asb_rt_read_i64: () => { const p = readLine(readByte); const v = p ? strtoll(asciiOf(p)).v : 0n; if (p) free(p); return v; },
        asb_rt_read_f64: () => { const p = readLine(readByte); const v = p ? strtod(asciiOf(p)).v : 0; if (p) free(p); return v; },
        asb_rt_i64_to_str: v => newCstr(num(String(BN(v)))),
        asb_rt_strdup: p => newCstr(cstrBytes(p).slice()),
        asb_rt_concat: (a, b) => { const x = cstrBytes(a).slice(), y = cstrBytes(b).slice(); const z = new Uint8Array(x.length + y.length); z.set(x); z.set(y, x.length); return newCstr(z); },
        asb_rt_utf8_len: p => BigInt([...cstr(p)].length),
        asb_rt_time: () => BigInt(Math.floor(Date.now() / 1000)),
        asb_rt_fputs: (h, s) => fileWrite(h, cstrBytes(s)),
        // memory
        malloc, free, calloc, realloc,
        memcpy: (d, s, n) => { const m = memArgs(); m.copyWithin(U32(d), U32(s), U32(s) + N(n)); return d; },
        memmove: (d, s, n) => { const m = memArgs(); m.copyWithin(U32(d), U32(s), U32(s) + N(n)); return d; },
        memset: (d, c, n) => { memArgs().fill(N(c) & 0xFF, U32(d), U32(d) + N(n)); return d; },
        memcmp: (a, b, n) => cmpBytes(U32(a), U32(b), N(n)),
        // strings
        strlen: p => cstrBytes(p).length,
        strcmp: (a, b) => cmpBytes(U32(a), U32(b)),
        strncmp: (a, b, n) => { const m = memArgs(); a = U32(a); b = U32(b); for (let i = 0; i < N(n); i++) { if (m[a + i] !== m[b + i]) return m[a + i] < m[b + i] ? -1 : 1; if (!m[a + i]) return 0; } return 0; },
        strcpy: (d, s) => { const b = cstrBytes(s).slice(); putBytes(d, b); memArgs()[U32(d) + b.length] = 0; return d; },
        strncpy: (d, s, n) => { const b = cstrBytes(s).slice(0, N(n)); const m = memArgs(); m.fill(0, U32(d), U32(d) + N(n)); m.set(b, U32(d)); return d; },
        strcat: (d, s) => { const k = cstrBytes(d).length; const b = cstrBytes(s).slice(); putBytes(U32(d) + k, b); memArgs()[U32(d) + k + b.length] = 0; return d; },
        strncat: (d, s, n) => { const k = cstrBytes(d).length; const b = cstrBytes(s).slice(0, N(n)); putBytes(U32(d) + k, b); memArgs()[U32(d) + k + b.length] = 0; return d; },
        strchr: (s, c) => { const b = cstrBytes(s); c = N(c) & 0xFF; if (c === 0) return U32(s) + b.length; const i = b.indexOf(c); return i < 0 ? 0 : U32(s) + i; },
        strrchr: (s, c) => { const b = cstrBytes(s); c = N(c) & 0xFF; if (c === 0) return U32(s) + b.length; const i = b.lastIndexOf(c); return i < 0 ? 0 : U32(s) + i; },
        strstr: (h, n) => { const a = cstrBytes(h), b = cstrBytes(n); outer: for (let i = 0; i + b.length <= a.length; i++) { for (let j = 0; j < b.length; j++) if (a[i + j] !== b[j]) continue outer; return U32(h) + i; } return 0; },
        atoi: p => Number(BigInt.asIntN(32, strtoll(cstr(p)).v)),
        atol: p => strtoll(cstr(p)).v,
        atoll: p => strtoll(cstr(p)).v,
        atof: p => strtod(cstr(p)).v,
        strtol: (p, endp, base) => { const s = cstr(p); const r = strtoll(s, N(base)); if (U32(endp)) { view(); dv.setUint32(U32(endp), U32(p) + enc.encode(s.slice(0, r.end)).length, true); } return r.v; },
        strtod: (p, endp) => { const s = cstr(p); const r = strtod(s); if (U32(endp)) { view(); dv.setUint32(U32(endp), U32(p) + enc.encode(s.slice(0, r.end)).length, true); } return r.v; },
        // ctype
        toupper: c => { c = N(c); return c >= 97 && c <= 122 ? c - 32 : c; },
        tolower: c => { c = N(c); return c >= 65 && c <= 90 ? c + 32 : c; },
        isdigit: isC(/[0-9]/), isalpha: isC(/[A-Za-z]/), isalnum: isC(/[A-Za-z0-9]/), isspace: isC(/[ \t\n\v\f\r]/),
        isupper: isC(/[A-Z]/), islower: isC(/[a-z]/), isxdigit: isC(/[0-9A-Fa-f]/), ispunct: isC(/[!-/:-@[-`{-~]/),
        abs: x => Math.abs(N(x)) | 0, labs: x => { x = BN(x); return x < 0n ? -x : x; }, llabs: x => { x = BN(x); return x < 0n ? -x : x; },
        // process
        exit: code => { throw new AsbExit(I32(code)); },
        abort: () => { throw new AsbTrap('abort() মতা হ\'ল'); },
        rand, srand,
        time: p => { const t = BigInt(Math.floor(Date.now() / 1000)); if (U32(p)) { view(); dv.setBigInt64(U32(p), t, true); } return t; },
        clock: () => BigInt(Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) * 1000)),
        getenv: () => 0,
        system: () => -1,
        // math
        sqrt: Math.sqrt, pow: Math.pow, fabs: Math.abs, sin: Math.sin, cos: Math.cos, tan: Math.tan,
        asin: Math.asin, acos: Math.acos, atan: Math.atan, atan2: Math.atan2, exp: Math.exp, log: Math.log,
        log10: Math.log10, log2: Math.log2, floor: Math.floor, ceil: Math.ceil, trunc: Math.trunc,
        round: x => { const r = Math.trunc(x); return Math.abs(x - r) >= 0.5 ? r + Math.sign(x) : r; },
        fmod: (a, b) => a % b, hypot: Math.hypot, cbrt: Math.cbrt, sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
        fmin: Math.min, fmax: Math.max,
        // stdio
        printf: (f, va, n) => { const b = format(f, va, n); out(b); return b.length; },
        sprintf: (d, f, va, n) => { const b = format(f, va, n); putBytes(d, b); memArgs()[U32(d) + b.length] = 0; return b.length; },
        snprintf: (d, cap, f, va, n) => { const b = format(f, va, n); cap = N(cap); if (cap > 0) { const k = Math.min(b.length, cap - 1); putBytes(d, b.subarray(0, k)); memArgs()[U32(d) + k] = 0; } return b.length; },
        fprintf: (h, f, va, n) => fileWrite(h, format(f, va, n)),
        puts: p => { out(cstrBytes(p).slice()); out(Uint8Array.of(10)); return 1; },
        putchar: c => { out(Uint8Array.of(N(c) & 0xFF)); return N(c) & 0xFF; },
        getchar: () => readByte(),
        fopen, fclose,
        fputs: (s, h) => fileWrite(h, cstrBytes(s)),
        fputc: (c, h) => { fileWrite(h, [N(c) & 0xFF]); return N(c) & 0xFF; },
        fgetc: h => fileGetc(h),
        fgets: (buf, n, h) => {
            n = N(n); const bytes = [];
            let c;
            while (bytes.length < n - 1 && (c = fileGetc(h)) !== -1) { bytes.push(c); if (c === 10) break; }
            if (!bytes.length) return 0;
            putBytes(buf, Uint8Array.from(bytes)); memArgs()[U32(buf) + bytes.length] = 0;
            return buf;
        },
        fflush: h => { if (U32(h)) fileSync(fileOf(h)); else flush(); return 0; },
        // sorting with a comparison function from the program's table
        qsort: (base, n, size, cmp) => {
            base = U32(base); n = N(n); size = N(size);
            const fn = table.get(U32(cmp));
            if (!fn) throw new AsbTrap('qsort: তুলনাৰ কাজটো খালি');
            const idx = [...Array(n).keys()];
            idx.sort((a, b) => fn(base + a * size, base + b * size));
            const m = memArgs();
            const copy = m.slice(base, base + n * size);
            idx.forEach((from, to) => m.set(copy.subarray(from * size, (from + 1) * size), base + to * size));
        },
        bsearch: (key, base, n, size, cmp) => {
            const fn = table.get(U32(cmp));
            let lo = 0, hi = N(n) - 1;
            while (lo <= hi) {
                const mid = (lo + hi) >> 1;
                const p = U32(base) + mid * N(size);
                const r = fn(U32(key), p);
                if (r === 0) return p;
                if (r < 0) hi = mid - 1; else lo = mid + 1;
            }
            return 0;
        },
    };

    function imports(modInfo) {
        info = modInfo;
        const env = {};
        for (const im of modInfo.imports) {
            const f = L[im.name];
            if (!f) { env[im.field] = () => { throw new AsbTrap(`C কাজ '${im.name}' এই পৰিৱেশত নাই`); }; continue; }
            const r = im.result;
            const wrap = r === 'i64' ? v => BN(v) : r === 'i32' ? v => (typeof v === 'bigint' ? Number(BigInt.asIntN(32, v)) : (Number(v) | 0)) : r ? v => Number(v) : () => undefined;
            env[im.field] = (...a) => wrap(f(...a));
        }
        return { asb: env };
    }

    /** Run `_start`; returns { status, error? }. Output is flushed through opts.write. */
    function run(instance, argv) {
        memory = instance.exports.memory;
        table = instance.exports.table;
        brk = Math.ceil(info.heapBase / 16) * 16;
        view();
        let status = 0, error = null;
        try {
            const ptrs = argv.map(a => newCstr(a));
            const arr = malloc(4 * (ptrs.length + 1));
            view();
            ptrs.forEach((p, k) => dv.setUint32(arr + 4 * k, p, true));
            dv.setUint32(arr + 4 * ptrs.length, 0, true);
            status = instance.exports._start(ptrs.length, arr) | 0;
        } catch (e) {
            if (e instanceof AsbExit) status = e.code;
            else { error = describe(e); status = 1; }
        }
        for (const f of handles.values()) fileSync(f);
        flush();
        if (error) writeErr(enc.encode(`\nচলাওঁতে ভুল (runtime error): ${error}\n`));
        return { status, error };
    }

    return { imports, run, flush, files, names: Object.keys(L) };
}

/** Assamese explanation of a WebAssembly trap or host error. */
function describe(e) {
    if (e && e.asb) return e.message;
    const m = String(e && e.message || e);
    if (/divide by zero|division by zero/i.test(m)) return 'শূন্যৰে হৰণ কৰা হৈছে (division by zero)';
    if (/integer overflow|unrepresentable/i.test(m)) return 'পূৰ্ণ সংখ্যাৰ সীমা অতিক্ৰম কৰিলে (integer overflow)';
    if (/out of bounds|memory access/i.test(m)) return 'মেমৰিৰ বাহিৰৰ ঠিকনা ব্যৱহাৰ কৰা হৈছে (ভুল সূচক বা তালিকাৰ সীমাৰ বাহিৰত)';
    if (/call stack|Maximum call stack|too much recursion/i.test(m)) return 'stack শেষ হ\'ল — কাজে নিজকে বহুত বেছিবাৰ মাতিছে (অসীম পুনৰাবৃত্তি?)';
    if (/null function|signature mismatch|uninitialized element|table index/i.test(m)) return 'খালি বা ভুল কাজৰ সূচক মতা হৈছে';
    if (/unreachable/i.test(m)) return 'unreachable';
    return m;
}

/** Read the "asomiya" custom section of a compiled module. */
function moduleInfo(mod) {
    const secs = WebAssembly.Module.customSections(mod, 'asomiya');
    if (!secs.length) throw new Error('এইটো অসমীয়া ভাষাৰ WebAssembly module নহয়');
    return JSON.parse(dec.decode(new Uint8Array(secs[0])));
}

// Names the compiler may import (the keys of the library).
for (const k of createHost({}).names) HOST_FUNCS.add(k);

module.exports = { createHost, describe, moduleInfo, HOST_FUNCS, AsbExit, AsbTrap, fmtG };
