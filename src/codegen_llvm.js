'use strict';
/**
 * Asomiya Bhasha 2.1 — LLVM IR back end.
 *
 * Lowers the checked program model to textual LLVM IR (opaque pointers,
 * LLVM 15 or newer). Every local lives in an `alloca` in the entry block, so
 * the IR is simple to read and `-O1`+ turns it into SSA registers.
 * With `debug: true` the module carries DWARF metadata: one DISubprogram per
 * function, a DILocation on every instruction, and variable records with
 * their Assamese names, so gdb/lldb step through the .asb source.
 *
 * The small C runtime (src/runtime.js) is compiled separately and linked
 * in; see native.js. Memory layout follows the C ABI of the 64-bit target
 * (types.layout with 8-byte pointers).
 */
const Ty = require('./types');
const { T } = Ty;

const PTR = 8;

class LLVMUnsupported extends Error {
    constructor(message, pos) { super(message); this.pos = pos; }
}

/** Bytes of a JS string as UTF-8. */
function utf8(s) {
    const out = [];
    for (const ch of s) {
        let c = ch.codePointAt(0);
        if (c < 0x80) out.push(c);
        else if (c < 0x800) out.push(0xC0 | (c >> 6), 0x80 | (c & 63));
        else if (c < 0x10000) out.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
        else out.push(0xF0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return out;
}

/** LLVM quoted-string body for a byte array (printable ASCII kept, others \XX). */
function llBytes(bytes) {
    let s = '';
    for (const b of bytes) {
        if (b >= 0x20 && b < 0x7F && b !== 0x22 && b !== 0x5C) s += String.fromCharCode(b);
        else s += '\\' + b.toString(16).toUpperCase().padStart(2, '0');
    }
    return s;
}
const llStr = s => `"${llBytes(utf8(String(s)))}"`;

/** Exact LLVM spelling of a double (hex IEEE bits). */
function fhex(x, bits = 64) {
    const v = bits === 32 ? Math.fround(x) : x;
    const dv = new DataView(new ArrayBuffer(8));
    dv.setFloat64(0, v);
    let h = '';
    for (let i = 0; i < 8; i++) h += dv.getUint8(i).toString(16).toUpperCase().padStart(2, '0');
    return '0x' + h;
}

const isIntLit = v => typeof v === 'string' && /^-?\d+$/.test(v);

/** Integer facts used by conversions: width and signedness. */
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
        case 'ptr': case 'null': case 'arr': case 'fn': return 'p';
        case 'struct': return 's';
        case 'void': return 'v';
        default: return 'o';
    }
};

class LLGen {
    constructor(model, opts = {}) {
        this.m = model;
        this.file = opts.file || '<উৎস>';
        this.dir = opts.dir || '.';
        this.debug = !!opts.debug;
        this.n = 0;
        this.top = [];          // type definitions
        this.strs = new Map();  // string constant text -> name
        this.strDefs = [];
        this.globalsOut = [];
        this.decls = new Map(); // external name -> declare line
        this.fnsOut = [];
        this.structName = new Map();
        this.layoutCache = new Map();
        // metadata
        this.md = [];
        this.mdKey = new Map();
        this.diTypes = new Map();
        this.diFiles = new Map();
        this.locCache = new Map();
    }

    // ---- names --------------------------------------------------------------
    mangle(name) {
        let out = 'a_';
        for (const ch of name) {
            const cp = ch.codePointAt(0);
            out += /[A-Za-z0-9_]/.test(ch) ? ch : `_u${cp.toString(16).padStart(4, '0')}_`;
        }
        return out;
    }
    gname(name) { return '@' + this.mangle(name); }
    ext(cname) { return /^[A-Za-z_.$][A-Za-z0-9_.$]*$/.test(cname) ? '@' + cname : '@' + llStr(cname); }
    lay(t) { return Ty.layout(t, PTR, this.layoutCache); }

    // ---- types --------------------------------------------------------------
    regTy(t) {
        switch (t.k) {
            case 'int': return `i${t.bits}`;
            case 'char': return 'i8';
            case 'bool': return 'i1';
            case 'enum': return 'i32';
            case 'float': return t.bits === 64 ? 'double' : 'float';
            case 'ptr': case 'null': case 'fn': case 'arr': return 'ptr';
            case 'struct': return this.structTy(t);
            case 'void': return 'void';
            default: return 'i8';
        }
    }
    memTy(t) {
        if (t.k === 'bool') return 'i8';
        if (t.k === 'arr') return `[${t.n} x ${this.memTy(t.of)}]`;
        return this.regTy(t);
    }
    structTy(st) {
        if (!this.structName.has(st)) this.structName.set(st, `%st.${this.structName.size}`);
        return this.structName.get(st);
    }
    /** For a union, the member that gives the LLVM type its alignment. */
    unionRep(st) {
        let best = st.fields[0];
        for (const f of st.fields) {
            const a = this.lay(f.type), b = this.lay(best.type);
            if (a.align > b.align || (a.align === b.align && a.size > b.size)) best = f;
        }
        return best;
    }
    defineStructs() {
        for (const st of this.m.structs) {
            const name = this.structTy(st);
            let body;
            if (st.union) {
                const rep = this.unionRep(st);
                const pad = this.lay(st).size - this.lay(rep.type).size;
                body = `{ ${this.memTy(rep.type)}${pad > 0 ? `, [${pad} x i8]` : ''} }`;
            } else {
                body = `{ ${st.fields.map(f => this.memTy(f.type)).join(', ')} }`;
            }
            this.top.push(`${name} = type ${body} ; ${st.union ? 'সংযোগ' : 'গঠন'} ${st.name.replace(/[\r\n]/g, '')}`);
        }
    }
    attr(t) {
        if (t.k === 'bool') return ' zeroext';
        if (t.k === 'char') return ' signext';
        if (t.k === 'int' && t.bits < 32) return t.signed ? ' signext' : ' zeroext';
        return '';
    }
    fnSig(ft) {
        const ps = ft.params.map(p => this.regTy(p));
        if (ft.variadic) ps.push('...');
        return `${this.regTy(ft.ret)} (${ps.join(', ')})`;
    }
    zeroOf(t) {
        switch (cls(t)) {
            case 'i': return '0';
            case 'b': return 'false';
            case 'f': return fhex(0);
            case 'p': return 'null';
            default: return 'zeroinitializer';
        }
    }

    // ---- module-level helpers -----------------------------------------------
    str(s) {
        if (this.strs.has(s)) return this.strs.get(s);
        const bytes = utf8(s);
        bytes.push(0);
        const name = `@.str.${this.strs.size}`;
        this.strs.set(s, name);
        this.strDefs.push(`${name} = private unnamed_addr constant [${bytes.length} x i8] c"${llBytes(bytes)}", align 1`);
        return name;
    }
    declare(name, line) { if (!this.decls.has(name)) this.decls.set(name, line); }
    rt(name, ret, params) {
        this.declare('@' + name, `declare ${ret} @${name}(${params})`);
        return '@' + name;
    }
    useExtern(ext, pos) {
        const ft = ext.type;
        if (ft.ret.k === 'struct' || ft.params.some(p => p.k === 'struct')) {
            throw new LLVMUnsupported(`LLVM back end: বাহিৰৰ C কাজ '${ext.name}'-লৈ গঠন (struct) মান হিচাপে দিব বা ল'ব নোৱাৰি; সূচক (*) ব্যৱহাৰ কৰক বা --backend c লওক`, pos || ext.node.pos);
        }
        const name = this.ext(ext.cname);
        this.declare(name, `declare${this.attr(ft.ret)} ${this.regTy(ft.ret)} ${name}(${[...ft.params.map(p => this.regTy(p) + this.attr(p)), ...(ft.variadic ? ['...'] : [])].join(', ')})`);
        return name;
    }

    // ---- metadata (DWARF) -----------------------------------------------------
    mdAdd(s, dedupe = true) {
        if (dedupe && this.mdKey.has(s)) return this.mdKey.get(s);
        const id = `!${this.md.length}`;
        this.md.push(s);
        if (dedupe) this.mdKey.set(s, id);
        return id;
    }
    mdReserve() { this.md.push(null); return `!${this.md.length - 1}`; }
    mdSet(id, s) { this.md[Number(id.slice(1))] = s; }
    diFile(file) {
        file = file || this.file;
        if (!this.diFiles.has(file)) this.diFiles.set(file, this.mdAdd(`!DIFile(filename: ${llStr(file)}, directory: ${llStr(this.dir)})`));
        return this.diFiles.get(file);
    }
    diType(t) {
        if (t.k === 'void' || t.k === 'null') return 'null';
        const key = this.typeKey(t);
        if (this.diTypes.has(key)) return this.diTypes.get(key);
        const basic = (name, bits, enc) => this.mdAdd(`!DIBasicType(name: ${llStr(name)}, size: ${bits}, encoding: ${enc})`);
        let id;
        switch (t.k) {
            case 'int': id = basic(Ty.name(t), t.bits, t.signed ? 'DW_ATE_signed' : 'DW_ATE_unsigned'); break;
            case 'char': id = basic('আখৰ', 8, 'DW_ATE_signed_char'); break;
            case 'bool': id = basic('বুলিয়ান', 8, 'DW_ATE_boolean'); break;
            case 'float': id = basic(Ty.name(t), t.bits, 'DW_ATE_float'); break;
            case 'opaque': id = this.mdAdd(`!DICompositeType(tag: DW_TAG_structure_type, name: ${llStr(t.name)}, flags: DIFlagFwdDecl)`); break;
            case 'enum': {
                id = this.mdReserve();
                this.diTypes.set(key, id);
                const els = t.members.map(m => this.mdAdd(`!DIEnumerator(name: ${llStr(m.name)}, value: ${BigInt.asIntN(32, m.value)})`));
                this.mdSet(id, `!DICompositeType(tag: DW_TAG_enumeration_type, name: ${llStr(t.name)}, file: ${this.diFile(t.decl && t.decl.pos && t.decl.pos.file)}, line: ${(t.decl && t.decl.pos && t.decl.pos.line) || 0}, baseType: ${this.diType(T.i32)}, size: 32, elements: !{${els.join(', ')}})`);
                return id;
            }
            case 'ptr': case 'fn': {
                id = this.mdReserve();
                this.diTypes.set(key, id);
                if (t.k === 'fn') {
                    this.mdSet(id, `!DISubroutineType(types: !{${[this.diType(t.ret), ...t.params.map(p => this.diType(p))].join(', ')}})`);
                } else {
                    this.mdSet(id, `!DIDerivedType(tag: DW_TAG_pointer_type, baseType: ${this.diType(t.to)}, size: 64)`);
                }
                return id;
            }
            case 'arr': {
                const sub = this.mdAdd(`!DISubrange(count: ${t.n})`);
                id = this.mdAdd(`!DICompositeType(tag: DW_TAG_array_type, baseType: ${this.diType(t.of)}, size: ${this.lay(t).size * 8}, elements: !{${sub}})`);
                break;
            }
            case 'struct': {
                id = this.mdReserve();
                this.diTypes.set(key, id);
                const L = this.lay(t);
                const pos = (t.decl && t.decl.pos) || {};
                const file = this.diFile(pos.file);
                const mem = (t.fields || []).map((f, k) => this.mdAdd(`!DIDerivedType(tag: DW_TAG_member, name: ${llStr(f.name)}, scope: ${id}, file: ${file}, line: ${(f.pos && f.pos.line) || 0}, baseType: ${this.diType(f.type)}, size: ${this.lay(f.type).size * 8}, offset: ${L.offsets[k] * 8})`));
                this.mdSet(id, `distinct !DICompositeType(tag: ${t.union ? 'DW_TAG_union_type' : 'DW_TAG_structure_type'}, name: ${llStr(t.name)}, file: ${file}, line: ${pos.line || 0}, size: ${L.size * 8}, align: ${L.align * 8}, elements: !{${mem.join(', ')}})`);
                return id;
            }
            default: id = basic('?', 8, 'DW_ATE_unsigned');
        }
        this.diTypes.set(key, id);
        return id;
    }
    typeKey(t) {
        switch (t.k) {
            case 'int': return `i${t.bits}${t.signed ? 's' : 'u'}`;
            case 'float': return `f${t.bits}`;
            case 'ptr': return `p(${this.typeKey(t.to)})`;
            case 'arr': return `a${t.n}(${this.typeKey(t.of)})`;
            case 'fn': return `f(${this.typeKey(t.ret)};${t.params.map(p => this.typeKey(p)).join(',')}${t.variadic ? ';...' : ''})`;
            case 'struct': case 'enum': {
                if (!this.typeIds) this.typeIds = new Map();
                if (!this.typeIds.has(t)) this.typeIds.set(t, this.typeIds.size);
                return `S${this.typeIds.get(t)}`;
            }
            case 'opaque': return `o${t.name}`;
            default: return t.k;
        }
    }
    setLoc(pos) {
        if (!this.debug || !this.sp || !pos) return;
        const k = `${pos.line}:${pos.col}:${this.sp}`;
        if (!this.locCache.has(k)) this.locCache.set(k, this.mdAdd(`!DILocation(line: ${pos.line}, column: ${pos.col || 0}, scope: ${this.sp})`));
        this.loc = this.locCache.get(k);
    }
    dbgVar(name, t, addr, pos, argNo) {
        if (!this.debug || !this.sp) return;
        this.need('llvm.dbg.declare', 'declare void @llvm.dbg.declare(metadata, metadata, metadata)');
        const v = this.mdAdd(`!DILocalVariable(name: ${llStr(name)}${argNo ? `, arg: ${argNo}` : ''}, scope: ${this.sp}, file: ${this.spFile}, line: ${(pos && pos.line) || 0}, type: ${this.diType(t)})`, false);
        this.setLoc(pos);
        this.emit(`call void @llvm.dbg.declare(metadata ptr ${addr}, metadata ${v}, metadata !DIExpression())`);
    }
    need(key, line) { this.declare('@' + key, line); }

    // ---- function body builder -------------------------------------------------
    tmp() { return `%t${++this.n}`; }
    label() { return `L${++this.n}`; }
    emit(s) {
        if (this.term) { const l = `D${++this.n}`; this.body.push(`${l}:`); this.cur = l; this.term = false; }
        this.body.push(`  ${s}${this.debug && this.loc ? `, !dbg ${this.loc}` : ''}`);
    }
    op(s) { const t = this.tmp(); this.emit(`${t} = ${s}`); return t; }
    br(l) { this.emit(`br label %${l}`); this.term = true; }
    cbr(c, a, b) { this.emit(`br i1 ${c}, label %${a}, label %${b}`); this.term = true; }
    place(l) {
        if (!this.term) this.br(l);
        this.body.push(`${l}:`);
        this.cur = l;
        this.term = false;
    }
    alloca(t, name) {
        const a = `%v${++this.n}${name ? '.' + name.replace(/[^A-Za-z0-9_]/g, '') : ''}`;
        this.allocas.push(`  ${a} = alloca ${this.memTy(t)}, align ${this.lay(t).align}`);
        return a;
    }

    load(t, addr) {
        if (t.k === 'arr' || t.k === 'fn') return addr;
        if (t.k === 'bool') { const b = this.op(`load i8, ptr ${addr}, align 1`); return this.op(`trunc i8 ${b} to i1`); }
        return this.op(`load ${this.regTy(t)}, ptr ${addr}, align ${this.lay(t).align}`);
    }
    store(t, v, addr) {
        if (t.k === 'bool') { v = this.conv(v, T.bool, T.u8); this.emit(`store i8 ${v}, ptr ${addr}, align 1`); return; }
        if (t.k === 'arr') { this.memcpy(addr, v, this.lay(t).size); return; }
        this.emit(`store ${this.regTy(t)} ${v}, ptr ${addr}, align ${this.lay(t).align}`);
    }
    memset0(addr, size) {
        this.need('llvm.memset.p0.i64', 'declare void @llvm.memset.p0.i64(ptr, i8, i64, i1)');
        this.emit(`call void @llvm.memset.p0.i64(ptr ${addr}, i8 0, i64 ${size}, i1 false)`);
    }
    memcpy(dst, src, size) {
        this.need('llvm.memcpy.p0.p0.i64', 'declare void @llvm.memcpy.p0.p0.i64(ptr, ptr, i64, i1)');
        this.emit(`call void @llvm.memcpy.p0.p0.i64(ptr ${dst}, ptr ${src}, i64 ${size}, i1 false)`);
    }

    // ---- conversions -----------------------------------------------------------
    conv(v, from, to) {
        if (to.k === 'void') return null;
        const cf = cls(from), ct = cls(to);
        if (cf === 's' || ct === 's' || cf === 'v') return v;
        if (ct === 'p') {
            if (cf === 'p') return v;
            if (cf === 'b' || cf === 'i') {
                const fi = intInfo(from);
                if (fi.bits < 64) v = this.op(`${fi.signed ? 'sext' : 'zext'} i${fi.bits} ${v} to i64`);
                else if (fi.bits > 64) v = this.op(`trunc i${fi.bits} ${v} to i64`);
                return this.op(`inttoptr i64 ${v} to ptr`);
            }
            return v;
        }
        if (ct === 'b') {
            if (cf === 'b') return v;
            if (cf === 'i') {
                if (isIntLit(v)) return BigInt(v) !== 0n ? 'true' : 'false';
                return this.op(`icmp ne i${intInfo(from).bits} ${v}, 0`);
            }
            if (cf === 'f') return this.op(`fcmp une ${this.regTy(from)} ${v}, ${fhex(0)}`);
            if (cf === 'p') return v === 'null' ? 'false' : this.op(`icmp ne ptr ${v}, null`);
            return v;
        }
        if (ct === 'i') {
            const ti = intInfo(to);
            if (cf === 'i' || cf === 'b') {
                const fi = intInfo(from);
                if (isIntLit(v) || v === 'true' || v === 'false') {
                    let x = v === 'true' ? 1n : v === 'false' ? 0n : BigInt(v);
                    x = fi.signed ? BigInt.asIntN(fi.bits, x) : BigInt.asUintN(fi.bits, x);
                    return BigInt.asIntN(ti.bits, x).toString();
                }
                if (fi.bits === ti.bits) return v;
                if (fi.bits > ti.bits) return this.op(`trunc i${fi.bits} ${v} to i${ti.bits}`);
                return this.op(`${fi.signed ? 'sext' : 'zext'} i${fi.bits} ${v} to i${ti.bits}`);
            }
            if (cf === 'f') {
                // like C compilers on x86/ARM: narrow targets go through a wider signed conversion,
                // so out-of-range values wrap instead of becoming poison
                if (ti.bits < 32 || (ti.bits === 32 && !ti.signed)) {
                    const w = ti.bits < 32 ? 32 : 64;
                    const x = this.op(`fptosi ${this.regTy(from)} ${v} to i${w}`);
                    return this.op(`trunc i${w} ${x} to i${ti.bits}`);
                }
                return this.op(`${ti.signed ? 'fptosi' : 'fptoui'} ${this.regTy(from)} ${v} to i${ti.bits}`);
            }
            if (cf === 'p') return v === 'null' ? '0' : this.op(`ptrtoint ptr ${v} to i${ti.bits}`);
            return v;
        }
        if (ct === 'f') {
            const tt = this.regTy(to);
            if (cf === 'i' || cf === 'b') {
                const fi = intInfo(from);
                if (isIntLit(v)) {
                    let x = BigInt(v);
                    x = fi.signed ? BigInt.asIntN(fi.bits, x) : BigInt.asUintN(fi.bits, x);
                    return fhex(Number(x), to.bits);
                }
                return this.op(`${fi.signed ? 'sitofp' : 'uitofp'} i${fi.bits} ${v} to ${tt}`);
            }
            if (cf === 'f') {
                if (from.bits === to.bits) return v;
                return this.op(`${from.bits < to.bits ? 'fpext' : 'fptrunc'} ${this.regTy(from)} ${v} to ${tt}`);
            }
            return v;
        }
        return v;
    }
    toBool(e) { return this.conv(this.val(e), e.type, T.bool); }
    /** Value of `e` converted to type `t`. */
    valAs(e, t) { return this.conv(this.val(e), e.type, t); }

    // ---- expressions -------------------------------------------------------------
    isLvalue(e) {
        return (e.kind === 'Ident' && e.sym && (e.sym.kind === 'var')) || (e.kind === 'Unary' && e.op === '*') || e.kind === 'Index' || e.kind === 'Member';
    }
    /** Address of an lvalue (or of a temporary copy of an rvalue). */
    addr(e) {
        switch (e.kind) {
            case 'Ident': {
                const s = e.sym;
                if (s.kind === 'var') return this.varAddr(s);
                if (s.kind === 'func') return this.gname(s.func.name);
                if (s.kind === 'extern') return this.useExtern(s.ext, e.pos);
                break;
            }
            case 'Unary':
                if (e.op === '*') return this.val(e.operand);
                break;
            case 'Index': {
                const ot = e.obj.type;
                const base = ot.k === 'arr' ? this.addr(e.obj) : this.val(e.obj);
                const idx = this.valAs(e.index, T.i64);
                return this.op(`getelementptr ${this.memTy(e.type)}, ptr ${base}, i64 ${idx}`);
            }
            case 'Member': {
                const base = e.arrow ? this.val(e.obj) : this.addr(e.obj);
                const st = e.arrow ? e.obj.type.to : e.obj.type;
                if (st.union) return base;
                const k = st.fields.indexOf(e.field);
                return this.op(`getelementptr ${this.structTy(st)}, ptr ${base}, i32 0, i32 ${k}`);
            }
            default: break;
        }
        // rvalue: materialise
        const a = this.alloca(e.type);
        this.store(e.type, this.val(e), a);
        return a;
    }
    varAddr(s) {
        if (this.locals.has(s)) return this.locals.get(s);
        if (s.global) return this.gname(s.name);
        throw new Error(`LLVM: অজ্ঞাত চলক '${s.name}'`);
    }

    val(e) {
        switch (e.kind) {
            case 'Int': return BigInt.asIntN(this.m && intInfo(e.type) ? intInfo(e.type).bits : 64, e.value).toString();
            case 'Float': return fhex(e.value);
            case 'Str': return this.str(e.value);
            case 'Char': return String(e.cp);
            case 'Bool': return e.value ? 'true' : 'false';
            case 'Null': return 'null';
            case 'Ident': {
                const s = e.sym;
                if (s.kind === 'var') return this.load(s.type, this.varAddr(s));
                if (s.kind === 'enumconst') return BigInt.asIntN(32, s.value).toString();
                if (s.kind === 'func') return this.gname(s.func.name);
                if (s.kind === 'extern') return this.useExtern(s.ext, e.pos);
                throw new Error('ident ' + s.kind);
            }
            case 'Unary': return this.unary(e);
            case 'Binary': return this.binary(e);
            case 'Assign': return this.assign(e);
            case 'Ternary': {
                const c = this.toBool(e.cond);
                const lt = this.label(), le = this.label(), lm = this.label();
                this.cbr(c, lt, le);
                this.place(lt);
                const a = this.valAs(e.then, e.type);
                const ba = this.cur;
                this.br(lm);
                this.place(le);
                const b = this.valAs(e.else, e.type);
                const bb = this.cur;
                this.br(lm);
                this.place(lm);
                if (e.type.k === 'void') return null;
                return this.op(`phi ${this.regTy(e.type)} [ ${a}, %${ba} ], [ ${b}, %${bb} ]`);
            }
            case 'Call': return this.call(e);
            case 'Index': case 'Member': return this.load(e.type, this.addr(e));
            case 'Cast': {
                const v = this.val(e.expr);
                return this.conv(v, e.expr.type, e.castTo);
            }
            case 'Sizeof': return String(this.lay(e.sizeOf).size);
            case 'New': {
                const n = e.count ? this.valAs(e.count, T.i64) : '1';
                const calloc = this.rt('calloc', 'ptr', 'i64, i64');
                return this.op(`call ptr ${calloc}(i64 ${n}, i64 ${this.lay(e.newType).size})`);
            }
            case 'StructLit': {
                const a = this.alloca(e.type);
                this.initInto(a, e.type, e.init);
                return this.load(e.type, a);
            }
            default: throw new Error('expr ' + e.kind);
        }
    }

    unary(e) {
        const t = e.type;
        switch (e.op) {
            case '-': {
                if (t.k === 'float') return this.op(`fneg ${this.regTy(t)} ${this.valAs(e.operand, t)}`);
                const v = this.valAs(e.operand, t);
                if (isIntLit(v)) return BigInt.asIntN(t.bits, -BigInt(v)).toString();
                return this.op(`sub ${this.regTy(t)} 0, ${v}`);
            }
            case '+': return this.valAs(e.operand, t);
            case '!': return this.op(`xor i1 ${this.toBool(e.operand)}, true`);
            case '~': return this.op(`xor ${this.regTy(t)} ${this.valAs(e.operand, t)}, -1`);
            case '*': {
                const p = this.val(e.operand);
                return this.load(t, p);
            }
            case '&': return this.addr(e.operand);
            default: { // ++ / --
                const a = this.addr(e.operand);
                const old = this.load(t, a);
                const nv = this.step(old, t, e.op.endsWith('++') ? 1 : -1);
                this.store(t, nv, a);
                return e.op.startsWith('pre') ? nv : old;
            }
        }
    }
    /** old ± 1 in type t (pointers move by one element). */
    step(v, t, d) {
        if (t.k === 'float') return this.op(`fadd ${this.regTy(t)} ${v}, ${fhex(d, t.bits)}`);
        if (t.k === 'ptr') return this.op(`getelementptr ${this.memTy(t.to)}, ptr ${v}, i64 ${d}`);
        if (t.k === 'bool') {
            const w = this.op(`add i32 ${this.conv(v, T.bool, T.i32)}, ${d}`);
            return this.conv(w, T.i32, T.bool);
        }
        return this.op(`add ${this.regTy(t)} ${v}, ${d}`);
    }

    arith(op, a, b, t) {
        const ty = this.regTy(t);
        if (t.k === 'float') {
            const ins = { '+': 'fadd', '-': 'fsub', '*': 'fmul', '/': 'fdiv', '%': 'frem' }[op];
            return this.op(`${ins} ${ty} ${a}, ${b}`);
        }
        const s = intInfo(t).signed;
        const ins = {
            '+': 'add', '-': 'sub', '*': 'mul', '/': s ? 'sdiv' : 'udiv', '%': s ? 'srem' : 'urem',
            '&': 'and', '|': 'or', '^': 'xor', '<<': 'shl', '>>': s ? 'ashr' : 'lshr',
        }[op];
        return this.op(`${ins} ${ty} ${a}, ${b}`);
    }
    cmp(op, a, b, t) {
        if (t.k === 'float') {
            const p = { '==': 'oeq', '!=': 'une', '<': 'olt', '>': 'ogt', '<=': 'ole', '>=': 'oge' }[op];
            return this.op(`fcmp ${p} ${this.regTy(t)} ${a}, ${b}`);
        }
        const s = t.k === 'ptr' ? false : intInfo(t).signed;
        const p = { '==': 'eq', '!=': 'ne', '<': s ? 'slt' : 'ult', '>': s ? 'sgt' : 'ugt', '<=': s ? 'sle' : 'ule', '>=': s ? 'sge' : 'uge' }[op];
        return this.op(`icmp ${p} ${t.k === 'ptr' ? 'ptr' : this.regTy(t)} ${a}, ${b}`);
    }
    ptrAdd(base, elemT, idx, idxT, neg) {
        let i = this.conv(idx, idxT, T.i64);
        if (neg) i = isIntLit(i) ? (-BigInt(i)).toString() : this.op(`sub i64 0, ${i}`);
        return this.op(`getelementptr ${this.memTy(elemT)}, ptr ${base}, i64 ${i}`);
    }
    /** a OP b where a:ta, b:tb are already evaluated values (used by Binary and compound assignment). */
    binop(op, a, ta, b, tb, rt) {
        const da = Ty.decay(ta), db = Ty.decay(tb);
        if ((op === '+' || op === '-') && !(Ty.isArith(ta) && Ty.isArith(tb))) {
            if (da.k === 'ptr' && Ty.isInt(tb)) return this.ptrAdd(a, da.to, b, tb, op === '-');
            if (op === '+' && Ty.isInt(ta) && db.k === 'ptr') return this.ptrAdd(b, db.to, a, ta, false);
            // pointer difference
            const x = this.op(`ptrtoint ptr ${a} to i64`), y = this.op(`ptrtoint ptr ${b} to i64`);
            const d = this.op(`sub i64 ${x}, ${y}`);
            const sz = this.lay(da.to).size;
            return sz === 1 ? d : this.op(`sdiv exact i64 ${d}, ${sz}`);
        }
        if (op === '<<' || op === '>>') {
            return this.arith(op, this.conv(a, ta, rt), this.conv(b, tb, rt), rt);
        }
        const ct = Ty.unify(ta, tb);
        return this.arith(op, this.conv(a, ta, ct), this.conv(b, tb, ct), ct);
    }

    binary(e) {
        const op = e.op;
        if (op === '&&' || op === '||') {
            const a = this.toBool(e.left);
            const from = this.cur;
            const lr = this.label(), lm = this.label();
            if (op === '&&') this.cbr(a, lr, lm); else this.cbr(a, lm, lr);
            this.place(lr);
            const b = this.toBool(e.right);
            const fromR = this.cur;
            this.br(lm);
            this.place(lm);
            return this.op(`phi i1 [ ${op === '&&' ? 'false' : 'true'}, %${from} ], [ ${b}, %${fromR} ]`);
        }
        const lt = e.left.type, rtp = e.right.type;
        if (['==', '!=', '<', '>', '<=', '>='].includes(op)) {
            if (Ty.isArith(lt) && Ty.isArith(rtp)) {
                const ct = Ty.unify(lt, rtp);
                const a = this.valAs(e.left, ct), b = this.valAs(e.right, ct);
                return this.cmp(op, a, b, ct);
            }
            const a = this.val(e.left), b = this.val(e.right);
            return this.cmp(op, a, b, Ty.ptr(T.void));
        }
        const a = this.val(e.left), b = this.val(e.right);
        return this.binop(op, a, lt, b, rtp, e.type);
    }

    assign(e) {
        const t = e.target.type;
        if (e.op === '=') {
            const a = this.addr(e.target);
            const v = this.valAs(e.value, t);
            this.store(t, v, a);
            return v;
        }
        const op = e.op.slice(0, -1);
        const a = this.addr(e.target);
        const old = this.load(t, a);
        const rhs = this.val(e.value);
        let rt = (op === '<<' || op === '>>') ? Ty.promote(t) : null;
        let r = this.binop(op, old, t, rhs, e.value.type, rt);
        if (t.k !== 'ptr') {
            const ct = rt || Ty.unify(t, e.value.type);
            r = this.conv(r, ct, t);
        }
        this.store(t, r, a);
        return r;
    }

    call(e) {
        if (e.builtin === 'দৈৰ্ঘ্য') {
            if (e.lengthConst != null) return String(e.lengthConst);
            const p = this.val(e.args[0]);
            const strlen = this.rt('strlen', 'i64', 'ptr');
            return this.op(`call i64 ${strlen}(ptr ${p})`);
        }
        const c = e.callee;
        let ft = c.type.k === 'ptr' ? c.type.to : c.type;
        let callee;
        if (c.kind === 'Ident' && c.sym.kind === 'func') callee = this.gname(c.sym.func.name);
        else if (c.kind === 'Ident' && c.sym.kind === 'extern') callee = this.useExtern(c.sym.ext, c.pos);
        else callee = this.val(c);
        const args = e.args.map((a, k) => {
            if (k < ft.params.length) {
                const pt = ft.params[k];
                return `${this.regTy(pt)}${this.attr(pt)} ${this.valAs(a, pt)}`;
            }
            // default argument promotions for `...`
            let pt = Ty.decay(a.type);
            if (pt.k === 'float') pt = T.f64;
            else if (Ty.isInt(pt)) pt = Ty.promote(pt);
            else if (pt.k === 'null' || pt.k === 'fn') pt = Ty.ptr(T.void);
            return `${this.regTy(pt)} ${this.valAs(a, pt)}`;
        });
        this.setLoc(e.pos);
        const r = ft.ret;
        const head = ft.variadic ? this.fnSig(ft) : this.regTy(r);
        const text = `call${this.attr(r)} ${head} ${callee}(${args.join(', ')})`;
        if (r.k === 'void') { this.emit(text); return null; }
        return this.op(text);
    }

    // ---- initialisers ------------------------------------------------------------
    initInto(addr, t, init) {
        if (init.kind === 'InitList') {
            this.memset0(addr, this.lay(t).size);
            if (t.k === 'arr') {
                init.items.forEach((it, k) => {
                    const p = this.op(`getelementptr ${this.memTy(t.of)}, ptr ${addr}, i64 ${k}`);
                    this.initInto(p, t.of, it.value);
                });
            } else {
                for (const it of init.items) {
                    const p = t.union ? addr : this.op(`getelementptr ${this.structTy(t)}, ptr ${addr}, i32 0, i32 ${t.fields.indexOf(it.field)}`);
                    this.initInto(p, it.field.type, it.value);
                }
            }
            return;
        }
        if (t.k === 'arr' && init.kind === 'Str') {
            this.memset0(addr, this.lay(t).size);
            this.memcpy(addr, this.str(init.value), utf8(init.value).length + 1);
            return;
        }
        this.store(t, this.valAs(init, t), addr);
    }

    // ---- printing ----------------------------------------------------------------
    puts(s) { this.emit(`call void ${this.rt('asb_rt_puts', 'void', 'ptr')}(ptr ${this.str(s)})`); }
    printOne(t, v, isAddr) {
        const call = (fn, ty, val, a = '') => this.emit(`call void ${this.rt(fn, 'void', ty + a)}(${ty}${a} ${val})`);
        const get = () => (isAddr ? this.load(t, v) : v);
        switch (t.k) {
            case 'int':
                if (!t.signed && t.bits === 64) return call('asb_rt_print_u64', 'i64', get());
                return call('asb_rt_print_i64', 'i64', this.conv(get(), t, T.i64));
            case 'enum': return call('asb_rt_print_i64', 'i64', this.conv(get(), t, T.i64));
            case 'float': return call('asb_rt_print_f64', 'double', this.conv(get(), t, T.f64));
            case 'bool': return call('asb_rt_print_bool', 'i1', get(), ' zeroext');
            case 'char': return call('asb_rt_print_char', 'i8', get(), ' signext');
            case 'null': return call('asb_rt_print_str', 'ptr', 'null');
            case 'ptr':
                return call(t.to.k === 'char' ? 'asb_rt_print_str' : 'asb_rt_print_ptr', 'ptr', get());
            case 'arr': {
                if (t.of.k === 'char') return call('asb_rt_print_str', 'ptr', v);
                const i = this.alloca(T.i64);
                this.emit(`store i64 0, ptr ${i}, align 8`);
                this.puts('[');
                const lh = this.label(), lb = this.label(), lsep = this.label(), lel = this.label(), le = this.label();
                this.place(lh);
                const iv = this.op(`load i64, ptr ${i}, align 8`);
                this.cbr(this.op(`icmp slt i64 ${iv}, ${t.n}`), lb, le);
                this.place(lb);
                this.cbr(this.op(`icmp ne i64 ${iv}, 0`), lsep, lel);
                this.place(lsep);
                this.puts(', ');
                this.place(lel);
                const p = this.op(`getelementptr ${this.memTy(t.of)}, ptr ${v}, i64 ${iv}`);
                this.printOne(t.of, p, true);
                this.emit(`store i64 ${this.op(`add i64 ${iv}, 1`)}, ptr ${i}, align 8`);
                this.br(lh);
                this.place(le);
                this.puts(']');
                return;
            }
            case 'struct': {
                let a = v;
                if (!isAddr) { a = this.alloca(t); this.store(t, v, a); }
                this.puts('{');
                t.fields.forEach((f, k) => {
                    this.puts((k ? ', ' : '') + f.name + ': ');
                    const p = this.op(`getelementptr ${this.structTy(t)}, ptr ${a}, i32 0, i32 ${k}`);
                    this.printOne(f.type, p, true);
                });
                this.puts('}');
                return;
            }
            default: return call('asb_rt_print_ptr', 'ptr', get());
        }
    }
    print(s) {
        s.args.forEach((a, k) => {
            if (k) this.emit(`call void ${this.rt('asb_rt_sp', 'void', '')}()`);
            if (a.kind === 'Char' && a.cp >= 128) {
                return this.emit(`call void ${this.rt('asb_rt_print_cp', 'void', 'i32')}(i32 ${a.cp})`);
            }
            const t = a.type;
            if (t.k === 'struct' || t.k === 'arr') return this.printOne(t, this.addr(a), true);
            this.printOne(t, this.val(a), false);
        });
        const end = s.newline ? 'asb_rt_nl' : 'asb_rt_sp';
        this.emit(`call void ${this.rt(end, 'void', '')}()`);
    }

    // ---- statements ----------------------------------------------------------------
    block(stmts) { for (const s of stmts) this.stmt(s); }
    loop(brk, cont, fn) { this.loops.push({ brk, cont }); fn(); this.loops.pop(); }

    localVar(sym, t, pos) {
        const a = this.alloca(t, '');
        this.locals.set(sym, a);
        this.dbgVar(sym.name, t, a, pos);
        return a;
    }

    stmt(s) {
        this.setLoc(s.pos);
        switch (s.kind) {
            case 'VarDecl': {
                const t = s.resolved;
                const a = this.localVar(s.sym, t, s.pos);
                this.setLoc(s.pos);
                if (s.init) this.initInto(a, t, s.init);
                else if (t.k === 'arr' || t.k === 'struct') this.memset0(a, this.lay(t).size);
                else this.store(t, this.zeroOf(t), a);
                return;
            }
            case 'ExprStmt': this.val(s.expr); return;
            case 'Print': this.print(s); return;
            case 'If': {
                const end = this.label();
                for (const b of s.branches) {
                    const lt = this.label(), ln = this.label();
                    this.setLoc(b.cond.pos || s.pos);
                    this.cbr(this.toBool(b.cond), lt, ln);
                    this.place(lt);
                    this.block(b.body);
                    this.br(end);
                    this.place(ln);
                }
                if (s.elseBody) this.block(s.elseBody);
                this.place(end);
                return;
            }
            case 'While': {
                const lc = this.label(), lb = this.label(), le = this.label();
                this.place(lc);
                this.setLoc(s.pos);
                this.cbr(this.toBool(s.cond), lb, le);
                this.place(lb);
                this.loop(le, lc, () => this.block(s.body));
                this.br(lc);
                this.place(le);
                return;
            }
            case 'DoWhile': {
                const lb = this.label(), lc = this.label(), le = this.label();
                this.place(lb);
                this.loop(le, lc, () => this.block(s.body));
                this.place(lc);
                this.setLoc(s.cond.pos || s.pos);
                this.cbr(this.toBool(s.cond), lb, le);
                this.place(le);
                return;
            }
            case 'RangeFor': return this.rangeFor(s);
            case 'CFor': {
                for (const i of s.init || []) this.stmt(i);
                const lc = this.label(), lb = this.label(), ls = this.label(), le = this.label();
                this.place(lc);
                this.setLoc(s.pos);
                if (s.cond) this.cbr(this.toBool(s.cond), lb, le); else this.br(lb);
                this.place(lb);
                this.loop(le, ls, () => this.block(s.body));
                this.place(ls);
                this.setLoc(s.pos);
                if (s.update) this.val(s.update);
                this.br(lc);
                this.place(le);
                return;
            }
            case 'Switch': {
                const pt = Ty.promote(s.expr.type);
                const v = this.valAs(s.expr, pt);
                const ty = this.regTy(pt);
                const le = this.label(), ld = s.defaultBody ? this.label() : le;
                const labels = s.cases.map(() => this.label());
                const used = new Set();
                const arms = [];
                s.cases.forEach((c, k) => c.values.forEach(x => {
                    const cv = BigInt.asIntN(intInfo(pt).bits, x.constVal).toString();
                    if (used.has(cv)) return;
                    used.add(cv);
                    arms.push(`${ty} ${cv}, label %${labels[k]}`);
                }));
                this.emit(`switch ${ty} ${v}, label %${ld} [ ${arms.join(' ')} ]`);
                this.term = true;
                const cont = this.loops.length ? this.loops[this.loops.length - 1].cont : null;
                this.loops.push({ brk: le, cont });
                s.cases.forEach((c, k) => { this.place(labels[k]); this.block(c.body); this.br(le); });
                if (s.defaultBody) { this.place(ld); this.block(s.defaultBody); this.br(le); }
                this.loops.pop();
                this.place(le);
                return;
            }
            case 'Break': this.br(this.loops[this.loops.length - 1].brk); return;
            case 'Continue': {
                for (let k = this.loops.length - 1; k >= 0; k--) if (this.loops[k].cont) { this.br(this.loops[k].cont); return; }
                return;
            }
            case 'Return': {
                const r = this.fnRet;
                if (s.value && r.k !== 'void') {
                    const v = this.valAs(s.value, r);
                    this.setLoc(s.pos);
                    this.emit(`ret ${this.regTy(r)} ${v}`);
                } else {
                    if (s.value) this.val(s.value);
                    this.emit(r.k === 'void' ? 'ret void' : `ret ${this.regTy(r)} ${this.zeroOf(r)}`);
                }
                this.term = true;
                return;
            }
            default: throw new Error('stmt ' + s.kind);
        }
    }

    rangeFor(s) {
        const t = s.varTypeResolved;
        const v = this.localVar(s.sym, t, s.namePos || s.pos);
        this.setLoc(s.pos);
        this.store(t, this.valAs(s.start, t), v);
        const endA = this.alloca(t);
        this.store(t, this.valAs(s.end, t), endA);
        let stepA = null, dir = 1;
        if (s.step && typeof s.stepConst !== 'bigint') {
            stepA = this.alloca(t);
            this.store(t, this.valAs(s.step, t), stepA);
        } else if (s.step) dir = s.stepConst > 0n ? 1 : -1;
        const lc = this.label(), lb = this.label(), ls = this.label(), le = this.label();
        this.place(lc);
        this.setLoc(s.pos);
        const cur = this.load(t, v), end = this.load(t, endA);
        let c;
        if (stepA) {
            const st = this.load(t, stepA);
            const pos = this.cmp('>', st, this.zeroOf(t), t);
            const up = this.cmp('<=', cur, end, t), down = this.cmp('>=', cur, end, t);
            c = this.op(`select i1 ${pos}, i1 ${up}, i1 ${down}`);
        } else {
            c = this.cmp(dir > 0 ? '<=' : '>=', cur, end, t);
        }
        this.cbr(c, lb, le);
        this.place(lb);
        this.loop(le, ls, () => this.block(s.body));
        this.place(ls);
        this.setLoc(s.pos);
        const now = this.load(t, v);
        let next;
        if (!s.step) next = this.step(now, t, 1);
        else if (stepA) next = this.arith('+', now, this.load(t, stepA), t);
        else {
            const ct = Ty.unify(t, s.step.type);
            const sv = this.valAs(s.step, ct);
            next = this.conv(this.arith('+', this.conv(now, t, ct), sv, ct), ct, t);
        }
        this.store(t, next, v);
        this.br(lc);
        this.place(le);
    }

    // ---- functions -------------------------------------------------------------------
    beginFn(name, pos, ft, linkage) {
        this.body = [];
        this.allocas = [];
        this.locals = new Map();
        this.loops = [];
        this.term = false;
        this.cur = 'entry';
        this.loc = null;
        this.sp = null;
        if (this.debug) {
            const file = this.diFile(pos && pos.file);
            this.spFile = file;
            const ty = this.mdAdd(`!DISubroutineType(types: !{${[this.diType(ft.ret), ...ft.params.map(p => this.diType(p))].join(', ')}})`);
            this.sp = this.mdAdd(`distinct !DISubprogram(name: ${llStr(name)}, scope: ${file}, file: ${file}, line: ${(pos && pos.line) || 1}, type: ${ty}, scopeLine: ${(pos && pos.line) || 1}, spFlags: DISPFlagDefinition${linkage === 'main' ? '' : ' | DISPFlagLocalToUnit'}, unit: ${this.cu})`, false);
            this.setLoc(pos || { line: 1, col: 1 });
        }
    }
    endFn(header, retT) {
        if (!this.term) {
            this.emit(retT.k === 'void' ? 'ret void' : `ret ${this.regTy(retT)} ${this.zeroOf(retT)}`);
        }
        const out = [`${header}${this.sp ? ` !dbg ${this.sp}` : ''} {`, 'entry:', ...this.allocas, ...this.body, '}'];
        this.fnsOut.push(out.join('\n'));
    }

    func(f) {
        const ft = Ty.fn(f.ret, f.params.map(p => p.type));
        const name = this.gname(f.name);
        this.beginFn(f.name, f.node.pos, ft, name.slice(1));
        this.fnRet = f.ret;
        const params = f.params.map((p, k) => `${this.regTy(p.type)}${this.attr(p.type)} %p${k}`);
        // parameter spills carry no line, so debuggers put the breakpoint after them (prologue_end)
        this.loc = null;
        const spills = f.params.map((p, k) => {
            const a = this.alloca(p.type, '');
            this.locals.set(f.paramSyms[k], a);
            this.store(p.type, `%p${k}`, a);
            return a;
        });
        if (this.debug) f.params.forEach((p, k) => this.dbgVar(p.name, p.type, spills[k], p.pos || f.node.pos, k + 1));
        this.block(f.node.body);
        this.endFn(`define internal${this.attr(f.ret)} ${this.regTy(f.ret)} ${name}(${params.join(', ')})`, f.ret);
    }

    // ---- global constant initialisers ---------------------------------------------------
    hasUnionInit(t, e) {
        if (!e || e.kind !== 'InitList') return false;
        if (t.k === 'struct' && t.union) return true;
        if (t.k === 'arr') return e.items.some(it => this.hasUnionInit(t.of, it.value));
        return e.items.some(it => it.field && this.hasUnionInit(it.field.type, it.value));
    }
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
    /** Constant initialiser text (without the type) for memory type of t. */
    constInit(t, e) {
        if (!e) return 'zeroinitializer';
        if (e.kind === 'InitList') {
            if (t.k === 'arr') {
                const et = this.memTy(t.of);
                const items = [];
                for (let k = 0; k < t.n; k++) items.push(`${et} ${k < e.items.length ? this.constInit(t.of, e.items[k].value) : 'zeroinitializer'}`);
                return `[${items.join(', ')}]`;
            }
            const vals = t.fields.map(f => {
                const it = e.items.find(x => x.field === f);
                return `${this.memTy(f.type)} ${it ? this.constInit(f.type, it.value) : 'zeroinitializer'}`;
            });
            return `{ ${vals.join(', ')} }`;
        }
        if (t.k === 'arr' && e.kind === 'Str') {
            const b = utf8(e.value);
            while (b.length < t.n) b.push(0);
            return `c"${llBytes(b.slice(0, t.n))}"`;
        }
        if (e.kind === 'Str') return this.str(e.value);
        if (e.kind === 'Null') return 'null';
        if (e.kind === 'Ident' && e.sym && e.sym.kind === 'func') return this.gname(e.sym.func.name);
        if (e.kind === 'Ident' && e.sym && e.sym.kind === 'extern') return this.useExtern(e.sym.ext, e.pos);
        if (t.k === 'float') {
            if (e.kind === 'Float') return fhex(e.value, t.bits);
            if (e.kind === 'Unary' && e.op === '-' && e.operand.kind === 'Float') return fhex(-e.operand.value, t.bits);
            const c = this.constInt(e);
            return fhex(Number(c), t.bits);
        }
        const c = this.constInt(e);
        if (c === null) return 'zeroinitializer';
        if (t.k === 'bool') return c !== 0n ? '1' : '0';
        if (t.k === 'ptr') return c === 0n ? 'null' : `inttoptr (i64 ${BigInt.asIntN(64, c)} to ptr)`;
        return BigInt.asIntN(intInfo(t).bits, c).toString();
    }

    globalVar(d) {
        const t = d.resolved;
        const runtime = !!d.init && (!d.constInit || this.hasUnionInit(t, d.init));
        d.llRuntimeInit = runtime;
        const init = runtime || !d.init ? 'zeroinitializer' : this.constInit(t, d.init);
        let dbg = '';
        if (this.debug) {
            const pos = d.pos || {};
            const gv = this.mdAdd(`distinct !DIGlobalVariable(name: ${llStr(d.name)}, scope: ${this.cu}, file: ${this.diFile(pos.file)}, line: ${pos.line || 0}, type: ${this.diType(t)}, isLocal: true, isDefinition: true)`, false);
            const gve = this.mdAdd(`!DIGlobalVariableExpression(var: ${gv}, expr: !DIExpression())`, false);
            this.dbgGlobals.push(gve);
            dbg = `, !dbg ${gve}`;
        }
        this.globalsOut.push(`${this.gname(d.name)} = internal global ${this.memTy(t)} ${init}, align ${this.lay(t).align}${dbg}`);
    }

    mainFn() {
        const m = this.m;
        const ft = Ty.fn(T.i32, [T.i32, Ty.ptr(T.str)]);
        this.beginFn('main', m.hasMain ? m.main.node.pos : { line: 1, col: 1, file: this.file }, ft, 'main');
        this.fnRet = T.i32;
        const ac = this.alloca(T.i32, 'argc'), av = this.alloca(Ty.ptr(T.str), 'argv');
        this.emit(`store i32 %argc, ptr ${ac}, align 4`);
        this.emit(`store ptr %argv, ptr ${av}, align 8`);
        this.emit(`call void ${this.rt('asb_rt_init', 'void', 'ptr, ptr')}(ptr ${ac}, ptr ${av})`);
        // constant-looking initialisers that still need code (unions)
        for (const item of m.topOrder) {
            if (item.kind === 'global') {
                const d = item.decl;
                if (d.llRuntimeInit) { this.setLoc(d.pos); this.initInto(this.gname(d.name), d.resolved, d.init); }
            } else this.stmt(item.stmt);
        }
        if (m.hasMain) {
            const f = m.main;
            this.setLoc(f.node.pos);
            const args = [];
            if (f.params.length) {
                const a0 = this.op(`load i32, ptr ${ac}, align 4`);
                args.push(`${this.regTy(f.params[0].type)}${this.attr(f.params[0].type)} ${this.conv(a0, T.i32, f.params[0].type)}`);
                args.push(`ptr ${this.op(`load ptr, ptr ${av}, align 8`)}`);
            }
            const callee = this.gname(f.name);
            if (f.ret.k === 'void') { this.emit(`call void ${callee}(${args.join(', ')})`); this.emit('ret i32 0'); }
            else { const r = this.op(`call i32 ${callee}(${args.join(', ')})`); this.emit(`ret i32 ${r}`); }
            this.term = true;
        } else {
            this.emit('ret i32 0');
            this.term = true;
        }
        this.endFn('define i32 @main(i32 %argc, ptr %argv)', T.i32);
    }

    generate() {
        const m = this.m;
        this.dbgGlobals = [];
        if (this.debug) {
            this.cu = this.mdReserve();
        }
        this.defineStructs();
        for (const d of m.globals) this.globalVar(d);
        for (const f of m.funcs) this.func(f);
        this.mainFn();

        const out = [];
        out.push(`; ${String(this.file).replace(/[\r\n]/g, ' ')} — অসমীয়া ভাষা কম্পাইলাৰে তৈয়াৰ কৰা LLVM IR; হাতেৰে সম্পাদনা নকৰিব`);
        out.push(`source_filename = ${llStr(this.file)}`);
        out.push('');
        out.push(...this.top);
        if (this.top.length) out.push('');
        out.push(...this.strDefs);
        if (this.strDefs.length) out.push('');
        out.push(...this.globalsOut);
        if (this.globalsOut.length) out.push('');
        out.push(this.fnsOut.join('\n\n'));
        out.push('');
        out.push(...this.decls.values());
        if (this.debug) {
            this.mdSet(this.cu, `distinct !DICompileUnit(language: DW_LANG_C99, file: ${this.diFile(this.file)}, producer: "Asomiya Bhasha (LLVM back end)", isOptimized: false, runtimeVersion: 0, emissionKind: FullDebug, globals: !{${this.dbgGlobals.join(', ')}})`);
            const f1 = this.mdAdd('!{i32 7, !"Dwarf Version", i32 4}');
            const f2 = this.mdAdd('!{i32 2, !"Debug Info Version", i32 3}');
            out.push('');
            out.push(`!llvm.dbg.cu = !{${this.cu}}`);
            out.push(`!llvm.module.flags = !{${f1}, ${f2}}`);
            this.md.forEach((s, k) => out.push(`!${k} = ${s}`));
        }
        return out.join('\n') + '\n';
    }
}

module.exports = { LLGen, LLVMUnsupported, fhex, llStr };
