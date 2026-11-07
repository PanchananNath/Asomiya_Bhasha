'use strict';
/**
 * Asomiya Bhasha 2.1 — WebAssembly back end.
 *
 * Emits a WebAssembly binary module directly (no external tools), so the
 * compiler can build and run programs inside a browser or plain Node.js.
 *
 *  - wasm32: pointers are 4 bytes; `আকাৰ` uses this layout (types.layout(t, 4)).
 *  - Memory map: [0, 1024) is never used (null-pointer guard), then string
 *    literals and globals, then an 8 MiB shadow stack growing downwards,
 *    then the heap (managed by the host's malloc/free).
 *  - Scalar locals whose address is never taken live in wasm locals; arrays,
 *    structs and address-taken variables live in the function's stack frame.
 *  - Struct values are handled by address: passed as a pointer to a copy,
 *    returned through a hidden destination pointer.
 *  - Function pointers are indices into the module's table (0 = খালি).
 *  - Everything outside the module (printing, input, malloc, the C library
 *    subset, files) is imported from the host, see wasm_host.js. Variadic C
 *    functions receive (…fixed, va_ptr, va_count); each extra argument sits
 *    in an 8-byte slot (integers as i64, floats as f64, pointers as u32).
 *  - Runtime faults (null pointer use, stack overflow, …) call asb_trap and
 *    are reported in Assamese by the host.
 */
const Ty = require('./types');
const { T } = Ty;
const { HOST_FUNCS } = require('./wasm_host');

const PTR = 4;
const NULL_GUARD = 1024;
const STACK_SIZE = 8 * 1024 * 1024;
const VT = { i32: 0x7F, i64: 0x7E, f32: 0x7D, f64: 0x7C };

class WasmLimit extends Error {
    constructor(message, pos) { super(message); this.pos = pos; this.isBackendLimit = true; }
}

// ---- binary encoding helpers ------------------------------------------------
function uleb(n, out) {
    n = Number(n);
    do { let b = n % 128; n = Math.floor(n / 128); if (n) b |= 0x80; out.push(b); } while (n);
    return out;
}
function sleb32(n, out) {
    n |= 0;
    for (;;) {
        const b = n & 0x7F; n >>= 7;
        if ((n === 0 && !(b & 0x40)) || (n === -1 && (b & 0x40))) { out.push(b); return out; }
        out.push(b | 0x80);
    }
}
function sleb64(v, out) {
    v = BigInt.asIntN(64, BigInt(v));
    for (;;) {
        const b = Number(v & 0x7Fn); v >>= 7n;
        if ((v === 0n && !(b & 0x40)) || (v === -1n && (b & 0x40))) { out.push(b); return out; }
        out.push(b | 0x80);
    }
}
function utf8(s) {
    const out = [];
    for (const ch of s) {
        const c = ch.codePointAt(0);
        if (c < 0x80) out.push(c);
        else if (c < 0x800) out.push(0xC0 | (c >> 6), 0x80 | (c & 63));
        else if (c < 0x10000) out.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
        else out.push(0xF0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return out;
}
function nameBytes(s, out) { const b = utf8(s); uleb(b.length, out); out.push(...b); return out; }
function floatBytes(x, bits) {
    const dv = new DataView(new ArrayBuffer(bits / 8));
    if (bits === 32) dv.setFloat32(0, x, true); else dv.setFloat64(0, x, true);
    return [...new Uint8Array(dv.buffer)];
}
function section(id, body, out) { out.push(id); uleb(body.length, out); for (const b of body) out.push(b); }
function vec(items, out, enc) { uleb(items.length, out); for (const it of items) enc(it, out); return out; }

// ---- type helpers -------------------------------------------------------------
function intInfo(t) {
    switch (t.k) {
        case 'int': return { bits: t.bits, signed: t.signed };
        case 'char': return { bits: 8, signed: true };
        case 'enum': return { bits: 32, signed: true };
        case 'bool': return { bits: 1, signed: false };
        default: return null;
    }
}
const cls = t => {
    switch (t.k) {
        case 'int': case 'char': case 'enum': return 'i';
        case 'bool': return 'b';
        case 'float': return 'f';
        case 'ptr': case 'null': case 'arr': case 'fn': case 'opaque': return 'p';
        case 'struct': return 's';
        case 'void': return 'v';
        default: return 'p';
    }
};
function vt(t) {
    if (t.k === 'void') return null;
    if (t.k === 'int' && t.bits === 64) return 'i64';
    if (t.k === 'float') return t.bits === 64 ? 'f64' : 'f32';
    return 'i32';
}
const isSigned = t => { const i = intInfo(t); return i ? i.signed : false; };

const ARITH = {
    i32: { '+': 0x6A, '-': 0x6B, '*': 0x6C, '/': [0x6D, 0x6E], '%': [0x6F, 0x70], '&': 0x71, '|': 0x72, '^': 0x73, '<<': 0x74, '>>': [0x75, 0x76] },
    i64: { '+': 0x7C, '-': 0x7D, '*': 0x7E, '/': [0x7F, 0x80], '%': [0x81, 0x82], '&': 0x83, '|': 0x84, '^': 0x85, '<<': 0x86, '>>': [0x87, 0x88] },
    f32: { '+': 0x92, '-': 0x93, '*': 0x94, '/': 0x95 },
    f64: { '+': 0xA0, '-': 0xA1, '*': 0xA2, '/': 0xA3 },
};
const CMP = {
    i32: { '==': 0x46, '!=': 0x47, '<': [0x48, 0x49], '>': [0x4A, 0x4B], '<=': [0x4C, 0x4D], '>=': [0x4E, 0x4F] },
    i64: { '==': 0x51, '!=': 0x52, '<': [0x53, 0x54], '>': [0x55, 0x56], '<=': [0x57, 0x58], '>=': [0x59, 0x5A] },
    f32: { '==': 0x5B, '!=': 0x5C, '<': 0x5D, '>': 0x5E, '<=': 0x5F, '>=': 0x60 },
    f64: { '==': 0x61, '!=': 0x62, '<': 0x63, '>': 0x64, '<=': 0x65, '>=': 0x66 },
};

/** Runtime imports used directly by generated code (fixed, always first). */
const INTERNAL = [
    ['asb_rt_print_i64', ['i64'], null], ['asb_rt_print_u64', ['i64'], null], ['asb_rt_print_f64', ['f64'], null],
    ['asb_rt_print_bool', ['i32'], null], ['asb_rt_print_char', ['i32'], null], ['asb_rt_print_cp', ['i32'], null],
    ['asb_rt_print_str', ['i32'], null], ['asb_rt_print_ptr', ['i32'], null], ['asb_rt_puts', ['i32'], null],
    ['asb_rt_sp', [], null], ['asb_rt_nl', [], null], ['asb_trap', ['i32'], null],
    ['calloc', ['i32', 'i32'], 'i32'], ['strlen', ['i32'], 'i32'],
];
const TRAP = { NULL: 1, STACK: 2 };

/** Collect symbols whose address is taken with `&`. */
const SKIP = new Set(['type', 'sym', 'resolved', 'castTo', 'sizeOf', 'newType', 'field', 'varTypeResolved', 'externCall', 'typePos', 'pos', 'namePos', 'paramSyms', 'decl']);
function collectAddrTaken(node, set) {
    if (!node || typeof node !== 'object') return set;
    if (Array.isArray(node)) { for (const x of node) collectAddrTaken(x, set); return set; }
    if (node.kind === 'Unary' && node.op === '&' && node.operand.kind === 'Ident' && node.operand.sym) set.add(node.operand.sym);
    for (const k of Object.keys(node)) if (!SKIP.has(k)) collectAddrTaken(node[k], set);
    return set;
}

class WasmGen {
    constructor(model, opts = {}) {
        this.m = model;
        this.file = opts.file || '<উৎস>';
        this.asciiDigits = !!opts.asciiDigits;
        this.layoutCache = new Map();
        this.types = [];
        this.typeKey = new Map();
        this.imports = [];
        this.extImport = new Map();
        this.data = [];          // bytes from address NULL_GUARD
        this.strAddr = new Map();
        this.globalAddr = new Map();
        this.funcs = [];         // { typeIdx, locals, code }
        this.thunks = [];
        this.thunkOf = new Map();
    }
    lay(t) { return Ty.layout(t, PTR, this.layoutCache); }
    err(msg, pos) { throw new WasmLimit(`WebAssembly back end: ${msg}`, pos); }

    // ---- types and imports -------------------------------------------------------
    typeIdx(params, result) {
        const key = params.join(',') + '>' + (result || '');
        if (!this.typeKey.has(key)) { this.typeKey.set(key, this.types.length); this.types.push({ params, result }); }
        return this.typeKey.get(key);
    }
    /** Wasm signature of an Asomiya function type: struct params by pointer, struct results via a hidden first pointer. */
    lower(ft) {
        const params = [];
        const sret = ft.ret.k === 'struct';
        if (sret) params.push('i32');
        for (const p of ft.params) params.push(p.k === 'struct' ? 'i32' : vt(p));
        return { params, result: sret ? null : vt(ft.ret), sret };
    }
    addImport(name, params, result, variadic = false) {
        this.imports.push({ name, field: `${name}#${this.imports.length}`, params, result, variadic, type: this.typeIdx(params, result) });
        return this.imports.length - 1;
    }
    internal(name) { return this.internalIdx[name]; }

    // ---- static data ---------------------------------------------------------------
    dataAlloc(size, align) {
        let at = NULL_GUARD + this.data.length;
        const pad = (align - (at % align)) % align;
        for (let i = 0; i < pad; i++) this.data.push(0);
        at += pad;
        for (let i = 0; i < size; i++) this.data.push(0);
        return at;
    }
    poke(addr, bytes) { for (let i = 0; i < bytes.length; i++) this.data[addr - NULL_GUARD + i] = bytes[i]; }
    str(s) {
        if (!this.strAddr.has(s)) {
            const b = utf8(s); b.push(0);
            const a = this.dataAlloc(b.length, 1);
            this.poke(a, b);
            this.strAddr.set(s, a);
        }
        return this.strAddr.get(s);
    }
    intBytes(v, size) {
        v = BigInt.asUintN(size * 8, BigInt(v));
        const out = [];
        for (let i = 0; i < size; i++) { out.push(Number(v & 0xFFn)); v >>= 8n; }
        return out;
    }

    // ---- function-level emission ---------------------------------------------------------
    o(...b) { const c = this.f.code; for (const x of b) c.push(x); }
    i32c(n) { this.o(0x41); sleb32(Number(BigInt.asIntN(32, BigInt(n))), this.f.code); }
    i64c(n) { this.o(0x42); sleb64(n, this.f.code); }
    f64c(x) { this.o(0x44, ...floatBytes(x, 64)); }
    f32c(x) { this.o(0x43, ...floatBytes(x, 32)); }
    lget(i) { this.o(0x20); uleb(i, this.f.code); }
    lset(i) { this.o(0x21); uleb(i, this.f.code); }
    ltee(i) { this.o(0x22); uleb(i, this.f.code); }
    call(i) { this.o(0x10); uleb(i, this.f.code); }
    newLocal(t) { this.f.locals.push(t); return this.f.nparams + this.f.locals.length - 1; }
    frameAlloc(size, align) {
        const f = this.f;
        f.frame = Math.ceil(f.frame / align) * align;
        const off = f.frame;
        f.frame += Math.max(size, 1);
        return off;
    }
    pushFrame(off) { this.lget(this.f.fp); if (off) { this.i32c(off); this.o(0x6A); } }
    blk(bt = 0x40) { this.o(0x02, bt); const l = {}; this.f.labels.push(l); return l; }
    lp() { this.o(0x03, 0x40); const l = {}; this.f.labels.push(l); return l; }
    iff(bt = 0x40) { this.o(0x04, bt); const l = {}; this.f.labels.push(l); return l; }
    els() { this.o(0x05); }
    end() { this.o(0x0B); this.f.labels.pop(); }
    depth(l) { const k = this.f.labels.lastIndexOf(l); return this.f.labels.length - 1 - k; }
    brTo(l) { this.o(0x0C); uleb(this.depth(l), this.f.code); }
    brIf(l) { this.o(0x0D); uleb(this.depth(l), this.f.code); }
    bt(t) { const v = t && vt(t); return v ? VT[v] : 0x40; }

    load(t) {
        switch (t.k) {
            case 'struct': case 'arr': case 'fn': return;
            case 'bool': return this.o(0x2D, 0, 0);
            case 'char': return this.o(0x2C, 0, 0);
            case 'int':
                if (t.bits === 8) return this.o(t.signed ? 0x2C : 0x2D, 0, 0);
                if (t.bits === 16) return this.o(t.signed ? 0x2E : 0x2F, 1, 0);
                if (t.bits === 64) return this.o(0x29, 3, 0);
                return this.o(0x28, 2, 0);
            case 'float': return t.bits === 64 ? this.o(0x2B, 3, 0) : this.o(0x2A, 2, 0);
            default: return this.o(0x28, 2, 0);
        }
    }
    /** Store value (on stack, after the address). Structs and arrays: the value is a source address. */
    store(t) {
        switch (t.k) {
            case 'struct': case 'arr': this.i32c(this.lay(t).size); return this.o(0xFC, 10, 0, 0); // memory.copy
            case 'bool': case 'char': return this.o(0x3A, 0, 0);
            case 'int':
                if (t.bits === 8) return this.o(0x3A, 0, 0);
                if (t.bits === 16) return this.o(0x3B, 1, 0);
                if (t.bits === 64) return this.o(0x37, 3, 0);
                return this.o(0x36, 2, 0);
            case 'float': return t.bits === 64 ? this.o(0x39, 3, 0) : this.o(0x38, 2, 0);
            default: return this.o(0x36, 2, 0);
        }
    }
    fill0(pushAddr, size) { pushAddr(); this.i32c(0); this.i32c(size); this.o(0xFC, 11, 0); }
    /** Trap if the pointer on the stack is inside the null guard page. */
    chk() {
        const s = this.f.scratch;
        this.ltee(s); this.i32c(NULL_GUARD); this.o(0x49);
        this.iff(); this.i32c(TRAP.NULL); this.call(this.internal('asb_trap')); this.end();
        this.lget(s);
    }

    // ---- conversions -------------------------------------------------------------------------
    normalize(ti) {
        if (ti.bits === 8) { if (ti.signed) this.o(0xC0); else { this.i32c(0xFF); this.o(0x71); } }
        else if (ti.bits === 16) { if (ti.signed) this.o(0xC1); else { this.i32c(0xFFFF); this.o(0x71); } }
    }
    conv(from, to) {
        if (to.k === 'void') { if (from.k !== 'void') this.o(0x1A); return; }
        const cf = cls(from), ct = cls(to);
        const vf = vt(from);
        if (cf === 's' || ct === 's' || cf === 'v') return;
        if (ct === 'b') {
            if (cf === 'b') return;
            if (vf === 'i64') return this.o(0x50, 0x45);
            if (vf === 'f64') { this.f64c(0); return this.o(0x62); }
            if (vf === 'f32') { this.f32c(0); return this.o(0x5C); }
            return this.o(0x45, 0x45);
        }
        if (ct === 'p') { if (vf === 'i64') this.o(0xA7); return; }
        if (ct === 'i') {
            const ti = intInfo(to);
            if (cf === 'f') {
                const fsel = vf === 'f64' ? 2 : 0;
                if (ti.bits < 32) { this.o(0xFC, 0 + fsel); return this.normalize(ti); }       // i32.trunc_sat_s, then wrap
                if (ti.bits === 32 && !ti.signed) { this.o(0xFC, 4 + fsel); return this.o(0xA7); } // via i64 like C on x86
                this.o(0xFC, (ti.bits === 64 ? 4 : 0) + fsel + (ti.signed ? 0 : 1));
                return;
            }
            if (vf === 'i64') {
                if (ti.bits === 64) return;
                this.o(0xA7);
                return this.normalize(ti);
            }
            // i32 source
            if (ti.bits === 64) return this.o(cf === 'p' || !isSigned(from) ? 0xAD : 0xAC);
            if (ti.bits < 32) {
                const fi = intInfo(from);
                if (fi && fi.bits <= ti.bits && (fi.signed === ti.signed || fi.bits < ti.bits) && !(fi.signed && !ti.signed)) return;
                this.normalize(ti);
            }
            return;
        }
        if (ct === 'f') {
            const vto = vt(to);
            if (cf === 'f') {
                if (vf === vto) return;
                return this.o(vto === 'f64' ? 0xBB : 0xB6);
            }
            const s = cf === 'p' ? false : isSigned(from);
            if (vf === 'i64') return this.o(vto === 'f64' ? (s ? 0xB9 : 0xBA) : (s ? 0xB4 : 0xB5));
            return this.o(vto === 'f64' ? (s ? 0xB7 : 0xB8) : (s ? 0xB2 : 0xB3));
        }
    }
    constAs(v, t) {
        // v: bigint (integer constant) ; emit it as a constant of type t
        const c = cls(t);
        if (c === 'f') return vt(t) === 'f64' ? this.f64c(Number(v)) : this.f32c(Number(v));
        if (c === 'b') return this.i32c(v !== 0n ? 1 : 0);
        if (c === 'p') return this.i32c(BigInt.asIntN(32, v));
        const ti = intInfo(t);
        if (ti.bits === 64) return this.i64c(BigInt.asIntN(64, v));
        const n = ti.bits < 32 ? (ti.signed ? BigInt.asIntN(ti.bits, v) : BigInt.asUintN(ti.bits, v)) : BigInt.asIntN(32, v);
        return this.i32c(n);
    }
    genAs(e, t) {
        const lit = e.kind === 'Int' ? e.value : e.kind === 'Char' ? BigInt(e.cp) : e.kind === 'Bool' ? (e.value ? 1n : 0n) : null;
        if (lit !== null && (Ty.isArith(t) || t.k === 'bool')) {
            // keep C semantics: the literal first has its own type
            const ti = intInfo(e.type);
            const v = ti && ti.bits < 64 ? (ti.signed ? BigInt.asIntN(ti.bits === 1 ? 2 : ti.bits, lit) : BigInt.asUintN(ti.bits, lit)) : lit;
            return this.constAs(e.type.k === 'int' && e.type.bits === 64 && !e.type.signed ? BigInt.asUintN(64, v) : v, t);
        }
        this.gen(e);
        this.conv(e.type, t);
    }
    genBool(e) { this.genAs(e, T.bool); }

    // ---- variables ---------------------------------------------------------------------
    declLocal(sym, t) {
        let loc;
        if (t.k === 'struct' || t.k === 'arr' || this.f.addrTaken.has(sym)) {
            const L = this.lay(t);
            loc = { k: 'frame', off: this.frameAlloc(L.size, L.align) };
        } else loc = { k: 'local', idx: this.newLocal(vt(t)) };
        this.f.vars.set(sym, loc);
        return loc;
    }
    locOf(sym) {
        const l = this.f.vars.get(sym);
        if (l) return l;
        if (this.globalAddr.has(sym)) return { k: 'static', addr: this.globalAddr.get(sym) };
        throw new Error(`wasm: অজ্ঞাত চলক '${sym.name}'`);
    }
    pushLocAddr(loc) {
        if (loc.k === 'frame') return this.pushFrame(loc.off);
        if (loc.k === 'static') return this.i32c(loc.addr);
        if (loc.k === 'indirect') return this.lget(loc.idx);
        throw new Error('wasm: register variable has no address');
    }

    /** An assignable place: either a wasm local or a memory address held in a local/constant. */
    place(e) {
        if (e.kind === 'Ident' && e.sym.kind === 'var') {
            const loc = this.locOf(e.sym);
            if (loc.k === 'local') return { t: e.type, local: loc.idx };
            return { t: e.type, push: () => this.pushLocAddr(loc) };
        }
        this.genAddr(e);
        const a = this.newLocal('i32');
        this.lset(a);
        return { t: e.type, push: () => this.lget(a) };
    }
    placeLoad(p) { if (p.local !== undefined) this.lget(p.local); else { p.push(); this.load(p.t); } }

    // ---- expressions -------------------------------------------------------------------------
    funcRef(f) { return this.funcIndex.get(f); }
    tableIdxOfFunc(f) { return 1 + this.m.funcs.indexOf(f); }
    thunk(ext, pos) {
        if (this.thunkOf.has(ext)) return this.thunkOf.get(ext);
        if (ext.type.variadic) this.err(`'...' থকা C কাজ '${ext.name}'-ক মান (কাজৰ সূচক) হিচাপে ল'ব নোৱাৰি`, pos);
        const imp = this.importOf(ext, pos);
        const sig = this.lower(ext.type);
        const k = this.thunks.length;
        const code = [];
        sig.params.forEach((p, i) => { code.push(0x20); uleb(i, code); });
        code.push(0x10); uleb(imp, code);
        code.push(0x0B);
        this.thunks.push({ typeIdx: this.typeIdx(sig.params, sig.result), locals: [], body: code });
        const info = { table: 1 + this.m.funcs.length + k, index: this.imports.length + this.m.funcs.length + k };
        this.thunkOf.set(ext, info);
        return info;
    }
    importOf(ext, pos) {
        if (!this.extImport.has(ext)) {
            const ft = ext.type;
            if (ft.ret.k === 'struct' || ft.params.some(p => p.k === 'struct')) this.err(`বাহিৰৰ C কাজ '${ext.name}'-লৈ গঠন (struct) মান হিচাপে দিব নোৱাৰি`, pos);
            this.err(`C কাজ '${ext.cname}' (${ext.name}) WebAssembly-ত উপলব্ধ নহয়; --backend c বা --backend llvm ব্যৱহাৰ কৰক`, pos);
        }
        return this.extImport.get(ext);
    }

    genAddr(e) {
        switch (e.kind) {
            case 'Ident': {
                const s = e.sym;
                if (s.kind === 'var') return this.pushLocAddr(this.locOf(s));
                if (s.kind === 'func') return this.i32c(this.tableIdxOfFunc(s.func));
                if (s.kind === 'extern') return this.i32c(this.thunk(s.ext, e.pos).table);
                break;
            }
            case 'Unary':
                if (e.op === '*') { this.gen(e.operand); return this.chk(); }
                break;
            case 'Index': {
                if (e.obj.type.k === 'arr') this.genAddr(e.obj); else { this.gen(e.obj); this.chk(); }
                const sz = this.lay(e.type).size;
                this.genAs(e.index, T.i32);
                if (sz !== 1) { this.i32c(sz); this.o(0x6C); }
                this.o(0x6A);
                return;
            }
            case 'Member': {
                const st = e.arrow ? e.obj.type.to : e.obj.type;
                if (e.arrow) { this.gen(e.obj); this.chk(); } else this.genAddr(e.obj);
                const off = st.union ? 0 : this.lay(st).offsets[st.fields.indexOf(e.field)];
                if (off) { this.i32c(off); this.o(0x6A); }
                return;
            }
            default: break;
        }
        if (e.type.k === 'struct' || e.type.k === 'arr') return this.gen(e); // already an address
        // scalar rvalue: spill to the frame
        const L = this.lay(e.type);
        const off = this.frameAlloc(L.size, L.align);
        this.pushFrame(off);
        this.gen(e);
        this.store(e.type);
        this.pushFrame(off);
    }

    gen(e) {
        switch (e.kind) {
            case 'Int': return this.genAs(e, e.type);
            case 'Float': return this.f64c(e.value);
            case 'Str': return this.i32c(this.str(e.value));
            case 'Char': return this.i32c(e.cp);
            case 'Bool': return this.i32c(e.value ? 1 : 0);
            case 'Null': return this.i32c(0);
            case 'Ident': {
                const s = e.sym;
                if (s.kind === 'var') {
                    const loc = this.locOf(s);
                    if (loc.k === 'local') return this.lget(loc.idx);
                    this.pushLocAddr(loc);
                    return this.load(s.type);
                }
                if (s.kind === 'enumconst') return this.i32c(BigInt.asIntN(32, s.value));
                return this.genAddr(e); // function or extern → table index
            }
            case 'Unary': return this.unary(e, true);
            case 'Binary': return this.binary(e);
            case 'Assign': return this.assign(e, true);
            case 'Ternary': {
                this.genBool(e.cond);
                this.iff(this.bt(e.type.k === 'arr' || e.type.k === 'null' ? T.i32 : e.type));
                this.genAs(e.then, e.type);
                this.els();
                this.genAs(e.else, e.type);
                this.end();
                return;
            }
            case 'Call': return this.callExpr(e, true);
            case 'Index': case 'Member': this.genAddr(e); return this.load(e.type);
            case 'Cast': this.gen(e.expr); return this.conv(e.expr.type, e.castTo);
            case 'Sizeof': return this.i64c(BigInt(this.lay(e.sizeOf).size));
            case 'New': {
                if (e.count) this.genAs(e.count, T.i32); else this.i32c(1);
                this.i32c(this.lay(e.newType).size);
                return this.call(this.internal('calloc'));
            }
            case 'StructLit': {
                const L = this.lay(e.type);
                const off = this.frameAlloc(L.size, L.align);
                this.initInto(() => this.pushFrame(off), e.type, e.init);
                return this.pushFrame(off);
            }
            default: throw new Error('wasm expr ' + e.kind);
        }
    }

    /** Evaluate for side effects only. */
    effect(e) {
        if (e.kind === 'Assign') return this.assign(e, false);
        if (e.kind === 'Unary' && /\+\+|--/.test(e.op)) return this.unary(e, false);
        if (e.kind === 'Call') return this.callExpr(e, false);
        this.gen(e);
        if (vt(e.type) || e.type.k === 'struct' || e.type.k === 'arr' || e.type.k === 'null') this.o(0x1A);
    }

    unary(e, want) {
        const t = e.type;
        switch (e.op) {
            case '-':
                if (t.k === 'float') { this.genAs(e.operand, t); return this.o(t.bits === 64 ? 0x9A : 0x8C); }
                if (vt(t) === 'i64') this.i64c(0n); else this.i32c(0);
                this.genAs(e.operand, t);
                return this.o(vt(t) === 'i64' ? 0x7D : 0x6B);
            case '+': return this.genAs(e.operand, t);
            case '!': this.genBool(e.operand); return this.o(0x45);
            case '~':
                this.genAs(e.operand, t);
                if (vt(t) === 'i64') { this.i64c(-1n); return this.o(0x85); }
                this.i32c(-1); return this.o(0x73);
            case '*': this.genAddr(e); return this.load(t);
            case '&': return this.genAddr(e.operand);
            default: { // ++ / --
                const p = this.place(e.operand);
                const d = e.op.endsWith('++') ? 1 : -1;
                const pre = e.op.startsWith('pre');
                const v = want ? this.newLocal(vt(t)) : null;
                if (p.local === undefined) p.push();
                this.placeLoad(p);
                if (want && !pre) this.ltee(v);
                this.step(t, d);
                if (want && pre) this.ltee(v);
                if (p.local !== undefined) this.lset(p.local); else this.store(t);
                if (want) this.lget(v);
            }
        }
    }
    /** value ± 1 in type t (pointers move by one element). */
    step(t, d) {
        if (t.k === 'float') { if (t.bits === 64) { this.f64c(d); this.o(0xA0); } else { this.f32c(d); this.o(0x92); } return; }
        if (t.k === 'ptr') { this.i32c(d * this.lay(t.to).size); return this.o(0x6A); }
        if (vt(t) === 'i64') { this.i64c(BigInt(d)); return this.o(0x7C); }
        this.i32c(d); this.o(0x6A);
        if (t.k === 'bool') return this.o(0x45, 0x45);
        const ti = intInfo(t);
        if (ti && ti.bits < 32) this.normalize(ti);
    }

    arith(op, t) {
        const v = vt(t);
        const ins = ARITH[v][op];
        this.o(Array.isArray(ins) ? ins[isSigned(t) ? 0 : 1] : ins);
    }
    cmp(op, t) {
        const v = vt(t);
        const ins = CMP[v][op];
        this.o(Array.isArray(ins) ? ins[t.k === 'ptr' || !isSigned(t) ? 1 : 0] : ins);
    }

    /** Push a OP b. `pushA`/`pushB` push the operands with their own types ta/tb. */
    binop(op, pushA, ta, pushB, tb, rt) {
        const da = Ty.decay(ta), db = Ty.decay(tb);
        if ((op === '+' || op === '-') && !(Ty.isArith(ta) && Ty.isArith(tb))) {
            if (da.k === 'ptr' && Ty.isInt(tb)) {
                pushA(); pushB(); this.conv(tb, T.i32);
                const sz = this.lay(da.to).size;
                if (sz !== 1) { this.i32c(sz); this.o(0x6C); }
                return this.o(op === '+' ? 0x6A : 0x6B);
            }
            if (op === '+' && Ty.isInt(ta) && db.k === 'ptr') {
                pushA(); this.conv(ta, T.i32);
                const sz = this.lay(db.to).size;
                if (sz !== 1) { this.i32c(sz); this.o(0x6C); }
                pushB();
                return this.o(0x6A);
            }
            pushA(); pushB(); this.o(0x6B);
            const sz = this.lay(da.to).size;
            if (sz !== 1) { this.i32c(sz); this.o(0x6D); }
            return this.o(0xAC);
        }
        const ct = (op === '<<' || op === '>>') ? rt : Ty.unify(ta, tb);
        pushA(); this.conv(ta, ct);
        pushB(); this.conv(tb, ct);
        this.arith(op, ct);
    }

    binary(e) {
        const op = e.op;
        if (op === '&&' || op === '||') {
            this.genBool(e.left);
            this.iff(VT.i32);
            if (op === '&&') { this.genBool(e.right); this.els(); this.i32c(0); }
            else { this.i32c(1); this.els(); this.genBool(e.right); }
            this.end();
            return;
        }
        const lt = e.left.type, rtp = e.right.type;
        if (['==', '!=', '<', '>', '<=', '>='].includes(op)) {
            if (Ty.isArith(lt) && Ty.isArith(rtp)) {
                const ct = Ty.unify(lt, rtp);
                this.genAs(e.left, ct); this.genAs(e.right, ct);
                return this.cmp(op, ct);
            }
            this.gen(e.left); this.gen(e.right);
            return this.cmp(op, Ty.ptr(T.void));
        }
        if (Ty.isArith(lt) && Ty.isArith(rtp) && op !== '<<' && op !== '>>') {
            const ct = Ty.unify(lt, rtp);
            this.genAs(e.left, ct); this.genAs(e.right, ct);
            return this.arith(op, ct);
        }
        this.binop(op, () => this.gen(e.left), lt, () => this.gen(e.right), rtp, e.type);
    }

    assign(e, want) {
        const t = e.target.type;
        const p = this.place(e.target);
        if (e.op === '=') {
            if (t.k === 'struct') {
                p.push(); this.gen(e.value); this.store(t);
                if (want) p.push();
                return;
            }
            if (p.local !== undefined) {
                this.genAs(e.value, t);
                if (want) this.ltee(p.local); else this.lset(p.local);
                return;
            }
            p.push();
            this.genAs(e.value, t);
            if (want) { const v = this.newLocal(vt(t)); this.ltee(v); this.store(t); this.lget(v); }
            else this.store(t);
            return;
        }
        const op = e.op.slice(0, -1);
        if (p.local === undefined) p.push();
        const rt = (op === '<<' || op === '>>') ? Ty.promote(t) : null;
        this.binop(op, () => this.placeLoad(p), t, () => this.gen(e.value), e.value.type, rt);
        if (t.k !== 'ptr') this.conv(rt || Ty.unify(t, e.value.type), t);
        if (p.local !== undefined) {
            if (want) this.ltee(p.local); else this.lset(p.local);
            return;
        }
        if (want) { const v = this.newLocal(vt(t)); this.ltee(v); this.store(t); this.lget(v); }
        else this.store(t);
    }

    callExpr(e, want) {
        const ret = e.type;
        if (e.builtin === 'দৈৰ্ঘ্য') {
            if (e.lengthConst != null) this.i64c(BigInt(e.lengthConst));
            else { this.gen(e.args[0]); this.call(this.internal('strlen')); this.o(0xAD); }
            if (!want) this.o(0x1A);
            return;
        }
        const c = e.callee;
        const ft = c.type.k === 'ptr' ? c.type.to : c.type;
        const isExtern = c.kind === 'Ident' && c.sym.kind === 'extern';
        const isFunc = c.kind === 'Ident' && c.sym.kind === 'func';
        let sretOff = null;
        if (!isExtern && ft.ret.k === 'struct') {
            const L = this.lay(ft.ret);
            sretOff = this.frameAlloc(L.size, L.align);
            this.pushFrame(sretOff);
        }
        let imp = null;
        if (isExtern) imp = this.importOf(c.sym.ext, c.pos);
        e.args.forEach((a, k) => {
            if (k >= ft.params.length) return;
            const pt = ft.params[k];
            if (pt.k === 'struct') {
                const L = this.lay(pt);
                const off = this.frameAlloc(L.size, L.align);
                this.pushFrame(off); this.gen(a); this.store(pt);
                this.pushFrame(off);
            } else this.genAs(a, pt);
        });
        if (ft.variadic) {
            const extra = e.args.slice(ft.params.length);
            const off = this.frameAlloc(8 * Math.max(extra.length, 1), 8);
            extra.forEach((a, k) => {
                this.pushFrame(off + 8 * k);
                const t = Ty.decay(a.type);
                if (t.k === 'float') { this.genAs(a, T.f64); this.o(0x39, 3, 0); }
                else if (Ty.isInt(t)) { this.genAs(a, Ty.promote(t)); this.conv(Ty.promote(t), isSigned(Ty.promote(t)) ? T.i64 : T.u64); this.o(0x37, 3, 0); }
                else { this.gen(a); this.o(0xAD); this.o(0x37, 3, 0); }
            });
            this.pushFrame(off);
            this.i32c(extra.length);
        }
        if (isExtern) this.call(imp);
        else if (isFunc) this.call(this.funcRef(c.sym.func));
        else {
            this.gen(c);
            const sig = this.lower(ft);
            this.o(0x11); uleb(this.typeIdx(sig.params, sig.result), this.f.code); this.o(0x00);
        }
        if (sretOff !== null) { if (want) this.pushFrame(sretOff); return; }
        if (!want && vt(ret)) this.o(0x1A);
    }

    // ---- initialisers ----------------------------------------------------------------------
    initInto(pushAddr, t, init) {
        if (init.kind === 'InitList') {
            this.fill0(pushAddr, this.lay(t).size);
            if (t.k === 'arr') {
                const es = this.lay(t.of).size;
                init.items.forEach((it, k) => this.initInto(() => { pushAddr(); if (k) { this.i32c(k * es); this.o(0x6A); } }, t.of, it.value));
            } else {
                const L = this.lay(t);
                for (const it of init.items) {
                    const off = t.union ? 0 : L.offsets[t.fields.indexOf(it.field)];
                    this.initInto(() => { pushAddr(); if (off) { this.i32c(off); this.o(0x6A); } }, it.field.type, it.value);
                }
            }
            return;
        }
        if (t.k === 'arr' && init.kind === 'Str') {
            this.fill0(pushAddr, this.lay(t).size);
            pushAddr(); this.i32c(this.str(init.value)); this.i32c(utf8(init.value).length + 1); this.o(0xFC, 10, 0, 0);
            return;
        }
        pushAddr();
        if (t.k === 'struct' || t.k === 'arr') this.gen(init); else this.genAs(init, t);
        this.store(t);
    }

    // ---- printing --------------------------------------------------------------------------
    rtcall(name) { this.call(this.internal(name)); }
    putsLit(s) { this.i32c(this.str(s)); this.rtcall('asb_rt_puts'); }
    /** Print the value of type t; for structs/arrays the stack holds the address. */
    printTop(t) {
        switch (t.k) {
            case 'int':
                if (!t.signed && t.bits === 64) return this.rtcall('asb_rt_print_u64');
                this.conv(t, T.i64); return this.rtcall('asb_rt_print_i64');
            case 'enum': this.conv(t, T.i64); return this.rtcall('asb_rt_print_i64');
            case 'float': this.conv(t, T.f64); return this.rtcall('asb_rt_print_f64');
            case 'bool': return this.rtcall('asb_rt_print_bool');
            case 'char': return this.rtcall('asb_rt_print_char');
            case 'null': return this.rtcall('asb_rt_print_str');
            case 'ptr': return this.rtcall(t.to.k === 'char' ? 'asb_rt_print_str' : 'asb_rt_print_ptr');
            case 'arr': {
                if (t.of.k === 'char') return this.rtcall('asb_rt_print_str');
                const base = this.newLocal('i32'), i = this.newLocal('i32');
                const es = this.lay(t.of).size;
                this.lset(base);
                this.i32c(0); this.lset(i);
                this.putsLit('[');
                const B = this.blk(), L = this.lp();
                this.lget(i); this.i32c(t.n); this.o(0x4E); this.brIf(B);
                this.lget(i); this.iff(); this.putsLit(', '); this.end();
                this.lget(base); this.lget(i); if (es !== 1) { this.i32c(es); this.o(0x6C); } this.o(0x6A);
                this.load(t.of);
                this.printTop(t.of);
                this.lget(i); this.i32c(1); this.o(0x6A); this.lset(i);
                this.brTo(L);
                this.end(); this.end();
                return this.putsLit(']');
            }
            case 'struct': {
                const base = this.newLocal('i32');
                const L = this.lay(t);
                this.lset(base);
                this.putsLit('{');
                t.fields.forEach((f, k) => {
                    this.putsLit((k ? ', ' : '') + f.name + ': ');
                    this.lget(base); if (L.offsets[k]) { this.i32c(L.offsets[k]); this.o(0x6A); }
                    this.load(f.type);
                    this.printTop(f.type);
                });
                return this.putsLit('}');
            }
            default: return this.rtcall('asb_rt_print_ptr');
        }
    }
    print(s) {
        s.args.forEach((a, k) => {
            if (k) this.rtcall('asb_rt_sp');
            if (a.kind === 'Char' && a.cp >= 128) { this.i32c(a.cp); return this.rtcall('asb_rt_print_cp'); }
            this.gen(a);
            this.printTop(a.type);
        });
        this.rtcall(s.newline ? 'asb_rt_nl' : 'asb_rt_sp');
    }

    // ---- statements --------------------------------------------------------------------------
    block(stmts) { for (const s of stmts) this.stmt(s); }
    withLoop(ctx, fn) { this.f.loops.push(ctx); fn(); this.f.loops.pop(); }

    stmt(s) {
        switch (s.kind) {
            case 'VarDecl': {
                const t = s.resolved;
                const loc = this.declLocal(s.sym, t);
                if (loc.k === 'local') {
                    if (s.init) this.genAs(s.init, t); else this.constAs(0n, t);
                    return this.lset(loc.idx);
                }
                const push = () => this.pushFrame(loc.off);
                if (s.init) return this.initInto(push, t, s.init);
                if (t.k === 'arr' || t.k === 'struct') return this.fill0(push, this.lay(t).size);
                push(); this.constAs(0n, t); return this.store(t);
            }
            case 'ExprStmt': return this.effect(s.expr);
            case 'Print': return this.print(s);
            case 'If': return this.ifChain(s, 0);
            case 'While': {
                const B = this.blk(), L = this.lp();
                this.genBool(s.cond); this.o(0x45); this.brIf(B);
                this.withLoop({ brk: B, cont: L }, () => this.block(s.body));
                this.brTo(L);
                this.end(); this.end();
                return;
            }
            case 'DoWhile': {
                const B = this.blk(), L = this.lp(), C = this.blk();
                this.withLoop({ brk: B, cont: C }, () => this.block(s.body));
                this.end();
                this.genBool(s.cond); this.brIf(L);
                this.end(); this.end();
                return;
            }
            case 'RangeFor': return this.rangeFor(s);
            case 'CFor': {
                for (const i of s.init || []) this.stmt(i);
                const B = this.blk(), L = this.lp();
                if (s.cond) { this.genBool(s.cond); this.o(0x45); this.brIf(B); }
                const C = this.blk();
                this.withLoop({ brk: B, cont: C }, () => this.block(s.body));
                this.end();
                if (s.update) this.effect(s.update);
                this.brTo(L);
                this.end(); this.end();
                return;
            }
            case 'Switch': {
                const pt = Ty.promote(s.expr.type);
                const v = this.newLocal(vt(pt));
                this.genAs(s.expr, pt); this.lset(v);
                const E = this.blk();
                const D = s.defaultBody ? this.blk() : null;
                const n = s.cases.length;
                const blocks = new Array(n);
                for (let k = n - 1; k >= 0; k--) blocks[k] = this.blk();
                s.cases.forEach((c, k) => c.values.forEach(x => {
                    this.lget(v); this.constAs(x.constVal, pt); this.cmp('==', pt); this.brIf(blocks[k]);
                }));
                this.brTo(D || E);
                const loops = this.f.loops;
                const cont = loops.length ? loops[loops.length - 1].cont : null;
                this.withLoop({ brk: E, cont }, () => {
                    for (let k = 0; k < n; k++) { this.end(); this.block(s.cases[k].body); this.brTo(E); }
                    if (D) { this.end(); this.block(s.defaultBody); }
                });
                this.end();
                return;
            }
            case 'Break': return this.brTo(this.f.loops[this.f.loops.length - 1].brk);
            case 'Continue': {
                const loops = this.f.loops;
                for (let k = loops.length - 1; k >= 0; k--) if (loops[k].cont) return this.brTo(loops[k].cont);
                return;
            }
            case 'Return': {
                const r = this.f.ret;
                if (s.value) {
                    if (r.k === 'struct') { this.lget(this.f.sret); this.gen(s.value); this.store(r); }
                    else if (r.k === 'void') this.effect(s.value);
                    else { this.genAs(s.value, r); this.lset(this.f.rv); }
                }
                return this.brTo(this.f.retLabel);
            }
            default: throw new Error('wasm stmt ' + s.kind);
        }
    }
    ifChain(s, k) {
        const b = s.branches[k];
        this.genBool(b.cond);
        this.iff();
        this.block(b.body);
        if (k + 1 < s.branches.length || s.elseBody) {
            this.els();
            if (k + 1 < s.branches.length) this.ifChain(s, k + 1); else this.block(s.elseBody);
        }
        this.end();
    }
    rangeFor(s) {
        const t = s.varTypeResolved;
        const loc = this.declLocal(s.sym, t);
        const pv = { t, ...(loc.k === 'local' ? { local: loc.idx } : { push: () => this.pushFrame(loc.off) }) };
        const setVar = (emitValue) => { if (pv.local !== undefined) { emitValue(); this.lset(pv.local); } else { pv.push(); emitValue(); this.store(t); } };
        setVar(() => this.genAs(s.start, t));
        const endL = this.newLocal(vt(t));
        this.genAs(s.end, t); this.lset(endL);
        let stepL = null, dir = 1;
        if (s.step && typeof s.stepConst !== 'bigint') { stepL = this.newLocal(vt(t)); this.genAs(s.step, t); this.lset(stepL); }
        else if (s.step) dir = s.stepConst > 0n ? 1 : -1;
        const B = this.blk(), L = this.lp();
        if (stepL !== null) {
            this.placeLoad(pv); this.lget(endL); this.cmp('<=', t);
            this.placeLoad(pv); this.lget(endL); this.cmp('>=', t);
            this.lget(stepL); this.constAs(0n, t); this.cmp('>', t);
            this.o(0x1B); // select
        } else {
            this.placeLoad(pv); this.lget(endL); this.cmp(dir > 0 ? '<=' : '>=', t);
        }
        this.o(0x45); this.brIf(B);
        const C = this.blk();
        this.withLoop({ brk: B, cont: C }, () => this.block(s.body));
        this.end();
        setVar(() => {
            if (!s.step) { this.placeLoad(pv); this.step(t, 1); }
            else if (stepL !== null) { this.placeLoad(pv); this.lget(stepL); this.arith('+', t); }
            else {
                const ct = Ty.unify(t, s.step.type);
                this.placeLoad(pv); this.conv(t, ct);
                this.genAs(s.step, ct);
                this.arith('+', ct);
                this.conv(ct, t);
            }
        });
        this.brTo(L);
        this.end(); this.end();
    }

    // ---- functions ------------------------------------------------------------------------------
    beginFn(nparams, ret, body) {
        this.f = {
            nparams, locals: [], code: [], frame: 0, labels: [], loops: [], vars: new Map(), ret,
            addrTaken: collectAddrTaken(body, new Set()),
        };
        this.f.fp = this.newLocal('i32');
        this.f.scratch = this.newLocal('i32');
        this.f.rv = vt(ret) && ret.k !== 'struct' ? this.newLocal(vt(ret)) : null;
    }
    finishFn(typeIdx) {
        const f = this.f;
        const frame = Math.ceil(f.frame / 16) * 16;
        const pre = [];
        const e = (...b) => pre.push(...b);
        if (frame) {
            e(0x23); uleb(0, pre);                          // global.get $sp
            e(0x41); sleb32(frame, pre); e(0x6B);           // i32.const frame; i32.sub
            e(0x22); uleb(f.fp, pre);                       // local.tee $fp
            e(0x24); uleb(0, pre);                          // global.set $sp
            e(0x20); uleb(f.fp, pre); e(0x23); uleb(1, pre); e(0x49); // fp < stackBase ?
            e(0x04, 0x40, 0x41); sleb32(TRAP.STACK, pre); e(0x10); uleb(this.internal('asb_trap'), pre); e(0x0B);
        }
        const post = [];
        if (frame) { post.push(0x20); uleb(f.fp, post); post.push(0x41); sleb32(frame, post); post.push(0x6A, 0x24); uleb(0, post); }
        if (f.rv !== null) { post.push(0x20); uleb(f.rv, post); }
        post.push(0x0B);
        this.funcs.push({ typeIdx, locals: f.locals, body: [...pre, ...f.code, ...post] });
    }
    /** Wrap the body in the block that `উভতি` jumps out of. */
    body(fn) {
        this.f.retLabel = this.blk();
        fn();
        this.end();
    }

    func(fd) {
        const ft = Ty.fn(fd.ret, fd.params.map(p => p.type));
        const sig = this.lower(ft);
        this.beginFn(sig.params.length, fd.ret, fd.node.body);
        const f = this.f;
        let pi = 0;
        if (sig.sret) f.sret = pi++;
        this.body(() => {
            fd.params.forEach((p, k) => {
                const sym = fd.paramSyms[k];
                const idx = pi++;
                if (p.type.k === 'struct') f.vars.set(sym, { k: 'indirect', idx });
                else if (f.addrTaken.has(sym)) {
                    const L = this.lay(p.type);
                    const off = this.frameAlloc(L.size, L.align);
                    f.vars.set(sym, { k: 'frame', off });
                    this.pushFrame(off); this.lget(idx); this.store(p.type);
                } else f.vars.set(sym, { k: 'local', idx });
            });
            this.block(fd.node.body);
        });
        this.finishFn(this.typeIdx(sig.params, sig.result));
    }

    mainFn() {
        const m = this.m;
        const all = m.topOrder.map(i => (i.kind === 'stmt' ? i.stmt : null)).filter(Boolean);
        this.beginFn(2, T.i32, all);
        this.body(() => {
            for (const item of m.topOrder) {
                if (item.kind === 'global') {
                    const d = item.decl;
                    if (d.init && !d.constInit) { const a = this.globalAddr.get(d.sym); this.initInto(() => this.i32c(a), d.resolved, d.init); }
                } else this.stmt(item.stmt);
            }
            if (m.hasMain) {
                const fd = m.main;
                if (fd.params.length) { this.lget(0); this.conv(T.i32, fd.params[0].type); this.lget(1); }
                this.call(this.funcRef(fd));
                if (fd.ret.k === 'void') this.i32c(0);
                this.lset(this.f.rv);
            }
        });
        this.finishFn(this.typeIdx(['i32', 'i32'], 'i32'));
    }

    // ---- global data ------------------------------------------------------------------------------
    constInt(e) {
        switch (e.kind) {
            case 'Int': return e.value;
            case 'Char': return BigInt(e.cp);
            case 'Bool': return e.value ? 1n : 0n;
            case 'Ident': {
                const s = e.sym;
                if (s && s.kind === 'enumconst') return s.value;
                if (s && s.kind === 'var' && typeof s.constValue === 'bigint') return s.constValue;
                return null;
            }
            case 'Unary': {
                const v = this.constInt(e.operand);
                if (v === null) return null;
                return { '-': -v, '+': v, '~': ~v, '!': v === 0n ? 1n : 0n }[e.op] ?? null;
            }
            case 'Cast': return this.constInt(e.expr);
            case 'Binary': {
                const a = this.constInt(e.left), b = this.constInt(e.right);
                if (a === null || b === null) return null;
                switch (e.op) {
                    case '+': return a + b; case '-': return a - b; case '*': return a * b;
                    case '/': return b === 0n ? null : a / b; case '%': return b === 0n ? null : a % b;
                    case '<<': return a << b; case '>>': return a >> b;
                    case '&': return a & b; case '|': return a | b; case '^': return a ^ b;
                    case '==': return a === b ? 1n : 0n; case '!=': return a !== b ? 1n : 0n;
                    case '<': return a < b ? 1n : 0n; case '>': return a > b ? 1n : 0n;
                    case '<=': return a <= b ? 1n : 0n; case '>=': return a >= b ? 1n : 0n;
                    case '&&': return (a && b) ? 1n : 0n; case '||': return (a || b) ? 1n : 0n;
                    default: return null;
                }
            }
            default: return null;
        }
    }
    writeConst(addr, t, e) {
        if (!e) return;
        if (e.kind === 'InitList') {
            if (t.k === 'arr') { const es = this.lay(t.of).size; e.items.forEach((it, k) => this.writeConst(addr + k * es, t.of, it.value)); }
            else { const L = this.lay(t); for (const it of e.items) this.writeConst(addr + (t.union ? 0 : L.offsets[t.fields.indexOf(it.field)]), it.field.type, it.value); }
            return;
        }
        const size = this.lay(t).size;
        if (t.k === 'arr' && e.kind === 'Str') { this.poke(addr, utf8(e.value).slice(0, t.n)); return; }
        if (e.kind === 'Str') return this.poke(addr, this.intBytes(this.str(e.value), 4));
        if (e.kind === 'Null') return;
        if (e.kind === 'Ident' && e.sym && e.sym.kind === 'func') return this.poke(addr, this.intBytes(this.tableIdxOfFunc(e.sym.func), 4));
        if (e.kind === 'Ident' && e.sym && e.sym.kind === 'extern') return this.poke(addr, this.intBytes(this.thunk(e.sym.ext, e.pos).table, 4));
        if (t.k === 'float') {
            let x;
            if (e.kind === 'Float') x = e.value;
            else if (e.kind === 'Unary' && e.op === '-' && e.operand.kind === 'Float') x = -e.operand.value;
            else x = Number(this.constInt(e));
            return this.poke(addr, floatBytes(x, t.bits));
        }
        const c = this.constInt(e);
        if (c === null) return;
        if (t.k === 'bool') return this.poke(addr, [c !== 0n ? 1 : 0]);
        this.poke(addr, this.intBytes(c, size));
    }

    // ---- module ---------------------------------------------------------------------------------
    generate() {
        const m = this.m;
        // imports: runtime first, then every C function the program can name
        this.internalIdx = {};
        for (const [name, params, result] of INTERNAL) this.internalIdx[name] = this.addImport(name, params, result);
        for (const ext of m.externs) {
            const ft = ext.type;
            if (!HOST_FUNCS.has(ext.cname)) continue;
            if (ft.ret.k === 'struct' || ft.params.some(p => p.k === 'struct')) continue;
            const params = ft.params.map(p => vt(p));
            if (ft.variadic) params.push('i32', 'i32');
            this.extImport.set(ext, this.addImport(ext.cname, params, vt(ft.ret), ft.variadic));
        }
        this.funcIndex = new Map(m.funcs.map((f, k) => [f, this.imports.length + k]));

        // globals in static memory
        for (const d of m.globals) {
            const L = this.lay(d.resolved);
            this.globalAddr.set(d.sym, this.dataAlloc(L.size, L.align));
        }
        for (const d of m.globals) if (d.init && d.constInit) this.writeConst(this.globalAddr.get(d.sym), d.resolved, d.init);

        // string literals are added to the data area while code is emitted, so the stack base
        // (end of data) is only known afterwards; code reads it from global 1.
        for (const f of m.funcs) this.func(f);
        this.mainFn();
        // final layout
        const dataEnd = NULL_GUARD + this.data.length;
        const stackBase = Math.ceil(dataEnd / 16) * 16;
        const stackTop = stackBase + STACK_SIZE;
        const heapBase = stackTop;

        const pages = Math.ceil((heapBase + 1024 * 1024) / 65536);
        const nImp = this.imports.length;
        const allFuncs = [...this.funcs.slice(0, m.funcs.length), ...this.thunks, this.funcs[m.funcs.length]];
        const startIdx = nImp + allFuncs.length - 1;
        const out = [0x00, 0x61, 0x73, 0x6D, 0x01, 0x00, 0x00, 0x00];
        section(1, vec(this.types, [], (t, o) => { o.push(0x60); vec(t.params, o, (p, oo) => oo.push(VT[p])); vec(t.result ? [t.result] : [], o, (r, oo) => oo.push(VT[r])); }), out);
        section(2, vec(this.imports, [], (im, o) => { nameBytes('asb', o); nameBytes(im.field, o); o.push(0x00); uleb(im.type, o); }), out);
        section(3, vec(allFuncs, [], (f, o) => uleb(f.typeIdx, o)), out);
        const tableSize = 1 + m.funcs.length + this.thunks.length;
        section(4, vec([0], [], (_, o) => { o.push(0x70, 0x00); uleb(tableSize, o); }), out);
        section(5, vec([0], [], (_, o) => { o.push(0x00); uleb(pages, o); }), out);
        section(6, vec([[0x01, stackTop], [0x00, stackBase]], [], ([mut, v], o) => { o.push(VT.i32, mut, 0x41); sleb32(v, o); o.push(0x0B); }), out);
        const exps = [['memory', 2, 0], ['_start', 0, startIdx], ['table', 1, 0]];
        section(7, vec(exps, [], ([n, k, i], o) => { nameBytes(n, o); o.push(k); uleb(i, o); }), out);
        const elems = [...m.funcs.map((f, k) => nImp + k), ...this.thunks.map((t, k) => nImp + m.funcs.length + k)];
        if (elems.length) section(9, vec([0], [], (_, o) => { o.push(0x00, 0x41); sleb32(1, o); o.push(0x0B); vec(elems, o, (x, oo) => uleb(x, oo)); }), out);
        section(10, vec(allFuncs, [], (f, o) => {
            const b = [];
            const groups = [];
            for (const l of f.locals) { if (groups.length && groups[groups.length - 1][1] === l) groups[groups.length - 1][0]++; else groups.push([1, l]); }
            vec(groups, b, ([n, t], oo) => { uleb(n, oo); oo.push(VT[t]); });
            for (const x of f.body) b.push(x);
            uleb(b.length, o);
            for (const x of b) o.push(x);
        }), out);
        if (this.data.length) section(11, vec([0], [], (_, o) => { o.push(0x00, 0x41); sleb32(NULL_GUARD, o); o.push(0x0B); uleb(this.data.length, o); for (const x of this.data) o.push(x); }), out);
        const info = {
            version: 1, file: this.file, asciiDigits: this.asciiDigits, heapBase, stackBase, nullGuard: NULL_GUARD,
            imports: this.imports.map(i => ({ field: i.field, name: i.name, params: i.params, result: i.result, variadic: i.variadic })),
        };
        const custom = [];
        nameBytes('asomiya', custom);
        custom.push(...utf8(JSON.stringify(info)));
        section(0, custom, out);
        return { bytes: Uint8Array.from(out), info };
    }
}

module.exports = { WasmGen, WasmLimit, NULL_GUARD };
