'use strict';
/**
 * Asomiya Bhasha 2.0 — semantic analysis.
 * Resolves names and types, checks every expression and statement, and
 * builds the program model consumed by the C code generator.
 * Each checked expression node gets `.type`; identifiers get `.sym`.
 */
const Ty = require('./types');
const { T } = Ty;

class Scope {
    constructor(parent, kind) { this.parent = parent; this.kind = kind; this.map = new Map(); }
    lookup(name) { for (let s = this; s; s = s.parent) { const v = s.map.get(name); if (v) return v; } return null; }
    own(name) { return this.map.get(name) || null; }
}

function editDistance(a, b) {
    a = [...a]; b = [...b];
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    return d[a.length][b.length];
}

const SIDE_EFFECT_KINDS = new Set(['Assign', 'Call']);
/** UTF-8 byte length without Node's Buffer (the checker also runs in browsers). */
const utf8Len = s => { let n = 0; for (const ch of s) { const c = ch.codePointAt(0); n += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4; } return n; };
const asDigits = v => String(v).replace(/[0-9]/g, x => String.fromCodePoint(0x09E6 + Number(x)));

class Checker {
    constructor(diag) {
        this.diag = diag;
        this.global = new Scope(null, 'global');
        this.structs = [];
        this.enums = [];
        this.funcs = [];
        this.externs = [];
        this.globals = [];
        this.script = [];
        this.topOrder = [];
        this.cincludes = [];
        this.fn = null; // function being checked
        this.loopDepth = 0;
        this.switchDepth = 0;
        this.hasMain = false;
    }

    error(msg, pos) { this.diag.error(msg, pos); }
    warn(msg, pos) { this.diag.warning(msg, pos); }

    // ---- declarations ------------------------------------------------------
    declare(scope, sym, pos) {
        const prev = scope.own(sym.name);
        if (prev) {
            const where = prev.builtin ? 'অন্তৰ্নিৰ্মিত (built-in) নাম' : (prev.pos ? `${prev.pos.line} নং শাৰীত আগতেই ঘোষণা কৰা হৈছে` : 'আগতেই আছে');
            this.error(`'${sym.name}' এই পৰিসৰত ${where}`, pos);
            return false;
        }
        sym.pos = sym.pos || pos;
        scope.map.set(sym.name, sym);
        return true;
    }

    /** Check a whole program. `prelude` items are built-in declarations. */
    check(preludeItems, items) {
        const all = [...preludeItems.map(i => Object.assign(i, { builtin: true })), ...items];
        this.global.map.set('দৈৰ্ঘ্য', { kind: 'builtin', name: 'দৈৰ্ঘ্য', builtin: true });

        // pass 1: type names
        for (const it of all) {
            if (it.kind === 'Struct') {
                const st = { k: 'struct', name: it.name, union: it.union, fields: null, decl: it, builtin: !!it.builtin };
                if (this.declare(this.global, { kind: 'type', name: it.name, type: st, builtin: it.builtin }, it.pos)) this.structs.push(st);
            } else if (it.kind === 'Enum') {
                const en = { k: 'enum', name: it.name, members: [], decl: it };
                if (this.declare(this.global, { kind: 'type', name: it.name, type: en, builtin: it.builtin }, it.pos)) this.enums.push(en);
            } else if (it.kind === 'TypeAlias') {
                this.declare(this.global, { kind: 'type', name: it.name, alias: it.type, type: null, builtin: it.builtin }, it.pos);
            }
        }
        // pass 2: struct fields, enum members, function signatures
        for (const it of all) {
            if (it.kind === 'Struct') this.defineStruct(it);
            else if (it.kind === 'Enum') this.defineEnum(it);
            else if (it.kind === 'TypeAlias') this.resolveAlias(this.global.own(it.name));
        }
        this.checkStructCycles();
        for (const it of all) {
            if (it.kind === 'Func') this.declareFunc(it);
            else if (it.kind === 'Extern') this.declareExtern(it);
            else if (it.kind === 'CInclude') this.cincludes.push(it.header);
        }
        const mainSym = this.global.own('মূল');
        this.hasMain = !!(mainSym && mainSym.kind === 'func');

        // pass 3: globals and script statements in source order, then function bodies
        for (const it of all) {
            if (it.kind === 'VarDecl') { this.checkGlobalVar(it); this.topOrder.push({ kind: 'global', decl: it }); }
            else if (!['Struct', 'Enum', 'TypeAlias', 'Func', 'Extern', 'CInclude', 'Import'].includes(it.kind)) {
                if (this.hasMain) { this.error("'মূল' কাজ থাকিলে শীৰ্ষ স্তৰত কেৱল ঘোষণা থাকিব পাৰে; এই বিবৃতি 'মূল'-ৰ ভিতৰলৈ নিয়ক", it.pos); continue; }
                if (it.fromImport) { this.error('আমদানি কৰা ফাইলত কেৱল ঘোষণা থাকিব পাৰে', it.pos); continue; }
                this.fn = { name: '<script>', ret: T.i32, retInferred: false, isScript: true };
                this.checkStmt(it, this.global);
                this.fn = null;
                this.script.push(it);
                this.topOrder.push({ kind: 'stmt', stmt: it });
            }
        }
        for (const f of this.funcs) this.checkFuncBody(f);
        if (this.hasMain) this.checkMainSignature(mainSym.func);

        return {
            structs: this.orderStructs(), enums: this.enums, funcs: this.funcs, externs: this.externs,
            globals: this.globals, script: this.script, topOrder: this.topOrder, cincludes: this.cincludes, hasMain: this.hasMain,
            main: this.hasMain ? mainSym.func : null,
        };
    }

    defineStruct(it) {
        const sym = this.global.own(it.name);
        if (!sym || sym.type.decl !== it) return;
        const st = sym.type;
        const seen = new Set();
        st.fields = [];
        for (const f of it.fields) {
            const ft = this.resolveType(f.type, this.global, { allowIncompleteStruct: true });
            if (seen.has(f.name)) this.error(`'${f.name}' ক্ষেত্ৰ '${it.name}'-ত দুবাৰ আছে`, f.pos);
            seen.add(f.name);
            if (ft.k === 'void') this.error("ক্ষেত্ৰৰ প্ৰকাৰ 'শূন্য' হ'ব নোৱাৰে", f.pos);
            if (ft.k === 'arr' && ft.n === null) this.error('গঠনৰ ক্ষেত্ৰত তালিকাৰ আকাৰ দিব লাগিব', f.pos);
            st.fields.push({ name: f.name, type: ft, pos: f.pos });
        }
        if (st.fields.length === 0) this.error(`'${it.name}'-ত অন্ততঃ এটা ক্ষেত্ৰ থাকিব লাগিব`, it.pos);
    }

    checkStructCycles() {
        const state = new Map();
        const visit = (st, path) => {
            if (state.get(st) === 2) return;
            if (state.get(st) === 1) { this.error(`'${st.name}' নিজকেই মান হিচাপে ধাৰণ কৰে (${path.join(' → ')}); সূচক (*) ব্যৱহাৰ কৰক`, st.decl.pos); return; }
            state.set(st, 1);
            for (const f of st.fields || []) for (const dep of this.byValueStructs(f.type)) visit(dep, [...path, dep.name]);
            state.set(st, 2);
        };
        for (const st of this.structs) visit(st, [st.name]);
    }

    byValueStructs(t) {
        if (t.k === 'struct') return [t];
        if (t.k === 'arr') return this.byValueStructs(t.of);
        return [];
    }

    orderStructs() {
        const out = [], done = new Set();
        const visit = st => {
            if (done.has(st)) return;
            done.add(st);
            for (const f of st.fields || []) for (const dep of this.byValueStructs(f.type)) visit(dep);
            out.push(st);
        };
        this.structs.forEach(visit);
        return out;
    }

    defineEnum(it) {
        const sym = this.global.own(it.name);
        if (!sym || sym.type.decl !== it) return;
        const en = sym.type;
        let next = 0n;
        for (const m of it.items) {
            let v = next;
            if (m.value) {
                this.checkExpr(m.value, this.global);
                const c = this.constValue(m.value);
                if (typeof c !== 'bigint') this.error('গণনাৰ মান এটা স্থিৰ পূৰ্ণ সংখ্যা হ\'ব লাগিব', m.value.pos);
                else v = c;
            }
            en.members.push({ name: m.name, value: v });
            this.declare(this.global, { kind: 'enumconst', name: m.name, type: en, value: v, builtin: it.builtin }, m.pos);
            next = v + 1n;
        }
    }

    resolveAlias(sym) {
        if (!sym || sym.kind !== 'type' || !sym.alias) return sym && sym.type;
        if (sym.type) return sym.type;
        if (sym.resolving) { this.error(`'${sym.name}' প্ৰকাৰটো নিজৰ ওপৰত নিৰ্ভৰশীল`, sym.pos); return T.err; }
        sym.resolving = true;
        sym.type = this.resolveType(sym.alias, this.global, { allowIncompleteStruct: true });
        sym.resolving = false;
        return sym.type;
    }

    resolveType(node, scope, opts = {}) {
        switch (node.kind) {
            case 'TPrim': return Ty.PRIM[node.prim];
            case 'TPtr': {
                const to = this.resolveType(node.to, scope, { allowIncompleteStruct: true });
                return Ty.ptr(to);
            }
            case 'TFn': {
                const params = node.params.map(p => Ty.decay(this.resolveType(p, scope, { allowIncompleteStruct: true })));
                const ret = node.ret ? this.resolveType(node.ret, scope, { allowIncompleteStruct: true }) : T.void;
                return Ty.fn(ret, params, false);
            }
            case 'TArr': {
                const of = this.resolveType(node.of, scope, opts);
                if (of.k === 'void') this.error("'শূন্য'-ৰ তালিকা হ'ব নোৱাৰে", node.pos);
                if (of.k === 'arr' && of.n === null) this.error('বহুমাত্ৰিক তালিকাত প্ৰথমটোৰ বাহিৰে সকলো আকাৰ দিব লাগিব', node.pos);
                let n = null;
                if (node.size) {
                    this.checkExpr(node.size, scope);
                    const c = this.constValue(node.size);
                    if (typeof c !== 'bigint') this.error('তালিকাৰ আকাৰ এটা স্থিৰ পূৰ্ণ সংখ্যা হ\'ব লাগিব (যেনে ১০ বা স্থিৰ চলক)', node.size.pos);
                    else if (c <= 0n) this.error('তালিকাৰ আকাৰ ধনাত্মক হ\'ব লাগিব', node.size.pos);
                    else n = Number(c);
                    if (typeof c === 'bigint' && c > 0n) n = Number(c);
                    else n = n || 1;
                }
                return Ty.arr(of, n);
            }
            case 'TName': {
                const sym = scope.lookup(node.name);
                if (!sym) { this.error(`অচিনাক্ত প্ৰকাৰ '${node.name}'${this.suggest(node.name, scope, true)}`, node.pos); return T.err; }
                if (sym.kind !== 'type') { this.error(`'${node.name}' এটা প্ৰকাৰ নহয়`, node.pos); return T.err; }
                const t = sym.alias ? this.resolveAlias(sym) : sym.type;
                if (t.k === 'struct' && !t.fields && !opts.allowIncompleteStruct) this.error(`'${t.name}' গঠনটো সম্পূৰ্ণ হোৱা নাই`, node.pos);
                return t;
            }
            default: throw new Error('unknown type node ' + node.kind);
        }
    }

    declareFunc(it) {
        const params = it.params.map(p => ({ name: p.name, type: Ty.decay(this.resolveType(p.type, this.global, { allowIncompleteStruct: true })), pos: p.pos }));
        const ret = it.ret ? this.resolveType(it.ret, this.global, { allowIncompleteStruct: true }) : null;
        if (ret && ret.k === 'arr') this.error('কাজে তালিকা ঘূৰাই দিব নোৱাৰে; সূচক (*) বা গঠন ব্যৱহাৰ কৰক', it.ret.pos);
        const f = { name: it.name, params, ret, retInferred: !it.ret, node: it, state: 'unchecked', builtin: !!it.builtin };
        if (this.declare(this.global, { kind: 'func', name: it.name, func: f, builtin: it.builtin }, it.pos)) this.funcs.push(f);
    }

    declareExtern(it) {
        const params = it.params.map(p => Ty.decay(this.resolveType(p.type, this.global, { allowIncompleteStruct: true })));
        const ret = it.ret ? this.resolveType(it.ret, this.global, { allowIncompleteStruct: true }) : T.void;
        const e = { name: it.name, cname: it.cname, type: Ty.fn(ret, params, it.variadic), builtin: !!it.builtin, node: it };
        if (this.declare(this.global, { kind: 'extern', name: it.name, ext: e, type: e.type, builtin: it.builtin }, it.pos)) this.externs.push(e);
    }

    funcType(f) { return Ty.fn(f.ret || T.void, f.params.map(p => p.type), false); }

    checkMainSignature(f) {
        const ok0 = f.params.length === 0;
        const ok2 = f.params.length === 2 && Ty.isInt(f.params[0].type) && Ty.eq(f.params[1].type, Ty.ptr(T.str));
        if (!ok0 && !ok2) this.error("'মূল'-ৰ পেৰামিটাৰ নাথাকিব বা (পূৰ্ণ সংখ্যা, বাক্য* তালিকা) হ'ব লাগিব", f.node.pos);
        const r = f.ret || T.void;
        if (!(r.k === 'void' || (r.k === 'int' && r.bits === 32 && r.signed))) this.error("'মূল'-এ পূৰ্ণ বা শূন্য ঘূৰাই দিব লাগিব", f.node.pos);
    }

    checkFuncBody(f) {
        if (f.state !== 'unchecked') return;
        f.state = 'checking';
        const savedFn = this.fn, savedLoop = this.loopDepth, savedSwitch = this.switchDepth;
        this.fn = f; this.loopDepth = 0; this.switchDepth = 0;
        const scope = new Scope(this.global, 'function');
        f.paramSyms = [];
        for (const p of f.params) {
            if (p.type.k === 'void') this.error("পেৰামিটাৰৰ প্ৰকাৰ 'শূন্য' হ'ব নোৱাৰে", p.pos);
            const sym = { kind: 'var', name: p.name, type: p.type, isParam: true };
            f.paramSyms.push(sym);
            this.declare(scope, sym, p.pos);
        }
        this.checkBlock(f.node.body, scope, true);
        if (!f.ret) f.ret = T.void;
        if (f.ret.k !== 'void' && !this.alwaysReturns(f.node.body)) {
            this.warn(`'${f.name}' কাজৰ সকলো পথে মান ঘূৰাই নিদিয়ে`, f.node.pos);
        }
        f.state = 'done';
        this.fn = savedFn; this.loopDepth = savedLoop; this.switchDepth = savedSwitch;
    }

    findUnion(t, seen = new Set()) {
        if (t.k === 'arr') return this.findUnion(t.of, seen);
        if (t.k !== 'struct' || seen.has(t)) return null;
        if (t.union) return t;
        seen.add(t);
        for (const f of t.fields || []) { const u = this.findUnion(f.type, seen); if (u) return u; }
        return null;
    }

    alwaysReturns(stmts) {
        for (const s of stmts) {
            if (s.kind === 'Return') return true;
            if (s.kind === 'If' && s.elseBody && s.branches.every(b => this.alwaysReturns(b.body)) && this.alwaysReturns(s.elseBody)) return true;
            if (s.kind === 'While' && s.cond.kind === 'Bool' && s.cond.value && !this.containsBreak(s.body)) return true;
            if (s.kind === 'ExprStmt' && s.expr.kind === 'Call' && s.expr.callee.kind === 'Ident' && s.expr.callee.name === 'প্ৰস্থান') return true;
        }
        return false;
    }

    containsBreak(stmts) {
        return stmts.some(s => s.kind === 'Break' || (s.kind === 'If' && (s.branches.some(b => this.containsBreak(b.body)) || (s.elseBody && this.containsBreak(s.elseBody)))));
    }

    checkGlobalVar(d) {
        if (d.fromImport && d.init && !this.isConstInit(d.init)) { /* allowed: initialised at program start */ }
        this.checkVarDecl(d, this.global, true);
    }

    // ---- statements --------------------------------------------------------
    checkBlock(stmts, parent, sameScope) {
        const scope = sameScope ? parent : new Scope(parent, 'block');
        for (const s of stmts) this.checkStmt(s, scope);
    }

    checkVarDecl(d, scope, isGlobal) {
        let t = this.resolveType(d.type, scope);
        if (t.k === 'void') { this.error("চলকৰ প্ৰকাৰ 'শূন্য' হ'ব নোৱাৰে (শূন্য* হ'লে হ'ব)", d.typePos || d.pos); t = T.i32; }
        if (t.k === 'arr' && t.n === null) {
            if (d.init && d.init.kind === 'InitList' && d.init.array) t = Ty.arr(t.of, Math.max(d.init.items.length, 1));
            else if (d.init && d.init.kind === 'Str' && t.of.k === 'char') t = Ty.arr(t.of, utf8Len(d.init.value) + 1);
            else this.error('আকাৰ নিদিয়া তালিকাৰ বাবে [..] আৰম্ভণি মান লাগে', d.pos);
            if (t.n === null) t = Ty.arr(t.of, 1);
        }
        d.resolved = t;
        if (d.init) this.checkInit(d.init, t, scope, d.name);
        else if (d.isConst) this.error(`স্থিৰ '${d.name}'-ক ঘোষণাৰ সময়তে মান দিব লাগিব`, d.pos);
        const sym = { kind: 'var', name: d.name, type: t, isConst: d.isConst, global: isGlobal, decl: d };
        if (d.isConst && d.init && d.init.kind !== 'InitList' && Ty.isInt(t)) {
            const c = this.constValue(d.init);
            if (typeof c === 'bigint') sym.constValue = c;
        }
        d.sym = sym;
        this.declare(scope, sym, d.pos);
        if (isGlobal) {
            d.constInit = !d.init || this.isConstInit(d.init);
            if (d.isConst && !d.constInit) this.error(`বিশ্বব্যাপী স্থিৰ '${d.name}'-ৰ মান ক'ড চলাৰ আগতেই জনা হ'ব লাগিব (স্থিৰ মান দিয়ক)`, d.init.pos);
            this.globals.push(d);
        }
    }

    isConstInit(e) {
        if (e.kind === 'InitList') return e.items.every(i => this.isConstInit(i.value));
        if (e.kind === 'Str' || e.kind === 'Null' || e.kind === 'Float') return true;
        if (e.kind === 'Unary' && e.op === '-' && e.operand.kind === 'Float') return true;
        if (e.kind === 'Ident' && e.sym && (e.sym.kind === 'func' || e.sym.kind === 'extern')) return true;
        return this.constValue(e) !== null;
    }

    checkInit(init, t, scope, what) {
        if (Ty.isErr(t)) { if (init.kind !== 'InitList') this.checkExpr(init, scope); return; }
        if (init.kind === 'InitList') {
            if (t.k === 'arr') {
                if (!init.array) this.error(`তালিকাৰ আৰম্ভণি মান [..] ৰূপত লিখক`, init.pos);
                if (init.items.length > t.n) this.error(`'${what}'-ৰ আকাৰ ${asDigits(t.n)}, কিন্তু ${asDigits(init.items.length)}টা মান দিয়া হৈছে`, init.pos);
                init.items.forEach((it, k) => this.checkInit(it.value, t.of, scope, `${what}[${asDigits(k)}]`));
            } else if (t.k === 'struct') {
                if (init.array) this.error(`গঠনৰ আৰম্ভণি মান {..} ৰূপত লিখক`, init.pos);
                this.checkStructInit(init, t, scope);
            } else {
                this.error(`'${Ty.name(t)}' প্ৰকাৰক তালিকা-ৰূপৰ মান দিব নোৱাৰি`, init.pos);
            }
            init.type = t;
            return;
        }
        if (t.k === 'arr' && t.of.k === 'char' && init.kind === 'Str') {
            this.checkExpr(init, scope);
            if (utf8Len(init.value) + 1 > t.n) this.error(`বাক্যটো '${what}'-ত নধৰে (${asDigits(utf8Len(init.value) + 1)} বাইট লাগে)`, init.pos);
            return;
        }
        if (t.k === 'arr') { this.error('তালিকাক কেৱল [..] আৰম্ভণি মান দিব পাৰি', init.pos); this.checkExpr(init, scope); return; }
        this.checkExpr(init, scope);
        this.assignable(init, t, `'${what}'-ত`);
    }

    checkStructInit(init, st, scope) {
        if (!st.fields) { this.error(`'${st.name}' সম্পূৰ্ণ হোৱা নাই`, init.pos); return; }
        const named = init.items.some(i => i.name);
        if (named && init.items.some(i => !i.name)) this.error('নাম থকা আৰু নথকা মান একেলগে দিব নোৱাৰি', init.pos);
        if (st.union && init.items.length > 1) this.error('সংযোগক এটাহে মান দিব পাৰি', init.pos);
        if (!named && init.items.length > st.fields.length) this.error(`'${st.name}'-ত ${asDigits(st.fields.length)}টা ক্ষেত্ৰহে আছে`, init.pos);
        init.items.forEach((it, k) => {
            const f = named ? st.fields.find(x => x.name === it.name) : st.fields[k];
            if (!f) { this.error(`'${st.name}'-ত '${it.name}' নামৰ ক্ষেত্ৰ নাই`, init.pos); this.checkExpr(it.value, scope); return; }
            it.field = f;
            this.checkInit(it.value, f.type, scope, `${st.name}.${f.name}`);
        });
    }

    checkStmt(s, scope) {
        switch (s.kind) {
            case 'VarDecl': return this.checkVarDecl(s, scope, scope === this.global);
            case 'ExprStmt': {
                this.checkExpr(s.expr, scope);
                const e = s.expr;
                const effect = SIDE_EFFECT_KINDS.has(e.kind) || (e.kind === 'Unary' && /\+\+|--/.test(e.op));
                if (!effect) this.error('এই বিবৃতিৰ কোনো প্ৰভাৱ নাই (মান গণনা কৰা হৈছে কিন্তু ব্যৱহাৰ কৰা হোৱা নাই)', s.pos);
                return;
            }
            case 'Print':
                for (const a of s.args) {
                    const t = this.checkExpr(a, scope);
                    if (t.k === 'void') this.error("'শূন্য' মান লিখিব নোৱাৰি", a.pos);
                    if (t.k === 'fn') this.error('কাজ নিজেই লিখিব নোৱাৰি; ইয়াক মাতক: নাম(...)', a.pos);
                    const u = this.findUnion(t);
                    if (u) this.error(`সংযোগ '${u.name}' গোটেইটো লিখিব নোৱাৰি; ইয়াৰ এটা ক্ষেত্ৰ লিখক`, a.pos);
                }
                return;
            case 'If':
                for (const b of s.branches) { this.checkCond(b.cond, scope); this.checkBlock(b.body, scope); }
                if (s.elseBody) this.checkBlock(s.elseBody, scope);
                return;
            case 'While':
                this.checkCond(s.cond, scope);
                this.loopDepth++; this.checkBlock(s.body, scope); this.loopDepth--;
                return;
            case 'DoWhile':
                this.loopDepth++; this.checkBlock(s.body, scope); this.loopDepth--;
                this.checkCond(s.cond, scope);
                return;
            case 'RangeFor': {
                const inner = new Scope(scope, 'for');
                const ts = this.checkExpr(s.start, scope);
                const te = this.checkExpr(s.end, scope);
                let vt;
                if (s.varType) vt = this.resolveType(s.varType, scope);
                else vt = (Ty.isArith(ts) && Ty.isArith(te)) ? Ty.unify(ts, te) : T.i32;
                if (!Ty.isArith(vt)) this.error('প্ৰতিবাৰৰ চলক সংখ্যা হ\'ব লাগিব', s.namePos);
                this.assignable(s.start, vt, 'আৰম্ভণিত');
                this.assignable(s.end, vt, 'শেষ মানত');
                if (s.step) {
                    const st = this.checkExpr(s.step, scope);
                    if (!Ty.isArith(st)) this.error('ক্ৰমে-ৰ মান সংখ্যা হ\'ব লাগিব', s.step.pos);
                    const c = this.constValue(s.step);
                    if (c !== null && Number(c) === 0) this.error("ক্ৰমে ০ হ'লে loop কেতিয়াও শেষ নহয়", s.step.pos);
                    s.stepConst = c;
                }
                s.varTypeResolved = vt;
                s.sym = { kind: 'var', name: s.name, type: vt };
                this.declare(inner, s.sym, s.namePos);
                this.loopDepth++; this.checkBlock(s.body, inner); this.loopDepth--;
                return;
            }
            case 'CFor': {
                const inner = new Scope(scope, 'for');
                if (s.init) for (const i of s.init) this.checkStmt(i, inner);
                if (s.cond) this.checkCond(s.cond, inner);
                if (s.update) this.checkExpr(s.update, inner);
                this.loopDepth++; this.checkBlock(s.body, inner); this.loopDepth--;
                return;
            }
            case 'Switch': {
                const t = this.checkExpr(s.expr, scope);
                if (!Ty.isInt(t)) this.error('বাছকৰ মান পূৰ্ণ সংখ্যা, আখৰ বা গণনা হ\'ব লাগিব', s.expr.pos);
                const seen = new Map();
                this.switchDepth++;
                for (const c of s.cases) {
                    for (const v of c.values) {
                        this.checkExpr(v, scope);
                        const cv = this.constValue(v);
                        if (typeof cv !== 'bigint') { this.error('ক্ষেত্ৰৰ মান স্থিৰ পূৰ্ণ সংখ্যা হ\'ব লাগিব', v.pos); continue; }
                        if (seen.has(cv)) this.error(`ক্ষেত্ৰ ${asDigits(cv)} দুবাৰ আছে`, v.pos);
                        seen.set(cv, true);
                        v.constVal = cv;
                    }
                    this.checkBlock(c.body, scope);
                }
                if (s.defaultBody) this.checkBlock(s.defaultBody, scope);
                this.switchDepth--;
                return;
            }
            case 'Break':
                if (this.loopDepth === 0 && this.switchDepth === 0) this.error("'ভাঙা' কেৱল loop বা বাছকৰ ভিতৰত ব্যৱহাৰ কৰিব পাৰি", s.pos);
                return;
            case 'Continue':
                if (this.loopDepth === 0) this.error("'আগবাঢ়া' কেৱল loop-ৰ ভিতৰত ব্যৱহাৰ কৰিব পাৰি", s.pos);
                return;
            case 'Return': return this.checkReturn(s, scope);
            default: throw new Error('unknown statement ' + s.kind);
        }
    }

    checkReturn(s, scope) {
        const f = this.fn;
        if (f.isScript) {
            this.error("'উভতি' কেৱল কাজৰ ভিতৰত ব্যৱহাৰ কৰিব পাৰি; প্ৰ'গ্ৰাম বন্ধ কৰিবলৈ প্ৰস্থান(০) লিখক", s.pos);
            if (s.value) this.checkExpr(s.value, scope);
            return;
        }
        if (s.value) {
            let t = this.checkExpr(s.value, scope);
            if (f.retInferred && !f.ret) {
                if (t.k === 'null') { this.error(`'${f.name}'-ৰ ফেৰত প্ৰকাৰ বুজিব পৰা নগ'ল; '-> প্ৰকাৰ' লিখক`, s.pos); t = Ty.ptr(T.void); }
                if (t.k === 'arr') { this.error('কাজে তালিকা ঘূৰাই দিব নোৱাৰে', s.pos); t = Ty.decay(t); }
                if (t.k === 'void') { this.error("'শূন্য' মান ঘূৰাই দিব নোৱাৰি", s.pos); }
                f.ret = t;
                return;
            }
            const ret = f.ret || T.void;
            if (ret.k === 'void') { this.error(`'${f.name}'-এ একো ঘূৰাই নিদিয়ে, গতিকে 'উভতি'-ৰ পিছত মান দিব নোৱাৰি`, s.value.pos); return; }
            this.assignable(s.value, ret, 'ফেৰত মানত');
        } else {
            if (f.retInferred && !f.ret) { f.ret = T.void; return; }
            if (f.ret && f.ret.k !== 'void') this.error(`'${f.name}'-এ '${Ty.name(f.ret)}' ঘূৰাই দিব লাগে`, s.pos);
        }
    }

    checkCond(e, scope) {
        const t = this.checkExpr(e, scope);
        if (!Ty.isScalar(t) && !Ty.isErr(t)) this.error(`চৰ্তটো সত্য/মিছা হ'ব পৰা মান হ'ব লাগিব, কিন্তু ইয়াৰ প্ৰকাৰ '${Ty.name(t)}'`, e.pos);
        if (e.kind === 'Assign' && e.op === '=') this.warn("চৰ্তৰ ভিতৰত '=' আছে; তুলনাৰ বাবে '==' লিখক", e.pos);
    }

    // ---- conversions -------------------------------------------------------
    assignable(e, to, ctx) {
        const from = e.type;
        if (!from || !to || Ty.isErr(from) || Ty.isErr(to)) return true;
        const bad = (why) => { this.error(`${ctx} '${Ty.name(from)}' মান '${Ty.name(to)}'-লৈ দিব নোৱাৰি${why ? ' — ' + why : ''}`, e.pos); return false; };
        if (Ty.eq(from, to)) return true;
        if (to.k === 'void') return bad();
        if (Ty.isArith(to) && Ty.isArith(from)) {
            if (Ty.isInt(to) && Ty.isFloat(from)) return bad("দশমিকৰ পৰা পূৰ্ণলৈ নিবলৈ 'হিচাপে' লিখক, যেনে x হিচাপে পূৰ্ণ");
            const c = this.constValue(e);
            if (typeof c === 'bigint' && Ty.isInt(to) && to.k !== 'bool') {
                const [lo, hi] = Ty.intRange(to);
                if (c < lo || c > hi) this.error(`${ctx} মান ${asDigits(c)} '${Ty.name(to)}'-ৰ সীমাৰ (${asDigits(lo)} … ${asDigits(hi)}) বাহিৰত`, e.pos);
            }
            return true;
        }
        if (to.k === 'ptr') {
            if (from.k === 'null') return true;
            const f = Ty.decay(from);
            if (f.k === 'ptr') {
                if (to.to.k === 'void' || f.to.k === 'void' || Ty.eq(to.to, f.to)) return true;
                return bad("বেলেগ প্ৰকাৰৰ সূচক; প্ৰয়োজন হ'লে 'হিচাপে' লিখক");
            }
            if (from.k === 'fn' && to.to.k === 'fn' && Ty.eq(from, to.to)) return true;
            if (from.k === 'fn') return bad('কাজৰ পেৰামিটাৰ বা ফেৰত প্ৰকাৰ নিমিলে');
            if (Ty.isInt(from)) return bad("পূৰ্ণ সংখ্যাক সূচকলৈ নিবলৈ 'হিচাপে' লিখক");
            return bad();
        }
        if (to.k === 'bool' && Ty.isPtr(from)) return true;
        return bad();
    }

    // ---- constant evaluation -----------------------------------------------
    constValue(e) {
        switch (e.kind) {
            case 'Int': return e.value;
            case 'Char': return BigInt(e.cp);
            case 'Bool': return e.value ? 1n : 0n;
            case 'Ident': {
                const s = e.sym;
                if (s && s.kind === 'enumconst') return s.value;
                if (s && s.kind === 'var' && s.isConst && typeof s.constValue === 'bigint') return s.constValue;
                return null;
            }
            case 'Unary': {
                const v = this.constValue(e.operand);
                if (typeof v !== 'bigint') return null;
                if (e.op === '-') return -v;
                if (e.op === '+') return v;
                if (e.op === '~') return ~v;
                if (e.op === '!') return v === 0n ? 1n : 0n;
                return null;
            }
            case 'Cast': {
                const v = this.constValue(e.expr);
                if (typeof v === 'bigint' && e.castTo && Ty.isInt(e.castTo)) return v;
                return null;
            }
            case 'Binary': {
                const a = this.constValue(e.left), b = this.constValue(e.right);
                if (typeof a !== 'bigint' || typeof b !== 'bigint') return null;
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

    // ---- expressions -------------------------------------------------------
    suggest(name, scope, typesOnly) {
        let best = null, bestD = Infinity;
        for (let s = scope; s; s = s.parent) for (const [k, v] of s.map) {
            if (typesOnly && v.kind !== 'type') continue;
            const d = editDistance(name, k);
            if (d < bestD) { bestD = d; best = k; }
        }
        const len = [...name].length;
        return best && len >= 3 && bestD <= Math.max(1, Math.floor(len / 3)) ? ` — আপুনি '${best}' বুজাইছিল নেকি?` : '';
    }

    lvalue(e, what) {
        const ok = (e.kind === 'Ident' && e.sym && e.sym.kind === 'var') || (e.kind === 'Unary' && e.op === '*') || e.kind === 'Index' || e.kind === 'Member';
        if (!ok) { this.error(`${what} এটা চলক, তালিকাৰ উপাদান, ক্ষেত্ৰ বা *সূচক হ'ব লাগিব`, e.pos); return false; }
        if (e.kind === 'Ident' && e.sym.isConst) { this.error(`'${e.name}' স্থিৰ; ইয়াৰ মান সলনি কৰিব নোৱাৰি`, e.pos); return false; }
        if (e.type && e.type.k === 'arr') { this.error('গোটেই তালিকা একেলগে নতুন মান দিব নোৱাৰি; উপাদানবোৰ এটা এটাকৈ দিয়ক বা প্ৰতিলিপি() ব্যৱহাৰ কৰক', e.pos); return false; }
        return true;
    }

    checkExpr(e, scope) {
        const t = this.exprType(e, scope);
        e.type = t;
        return t;
    }

    exprType(e, scope) {
        switch (e.kind) {
            case 'Int': {
                const v = e.value;
                if (v <= 2147483647n) return T.i32;
                if (v <= 9223372036854775807n) return T.i64;
                if (v <= 18446744073709551615n) return T.u64;
                this.error('সংখ্যাটো ৬৪-বিট সীমাৰ বাহিৰত', e.pos);
                return T.u64;
            }
            case 'Float': return T.f64;
            case 'Str': return T.str;
            case 'Char': return e.cp < 128 ? T.char : T.i32;
            case 'Bool': return T.bool;
            case 'Null': return T.null;
            case 'Ident': {
                const s = scope.lookup(e.name);
                if (!s) { this.error(`অপৰিভাষিত নাম '${e.name}'${this.suggest(e.name, scope)}`, e.pos); return T.err; }
                e.sym = s;
                if (s.kind === 'type') { this.error(`'${e.name}' এটা প্ৰকাৰ, মান নহয়`, e.pos); return T.err; }
                if (s.kind === 'var') return s.type;
                if (s.kind === 'enumconst') return s.type;
                if (s.kind === 'func') return this.funcType(this.ensureSignature(s.func, e.pos));
                if (s.kind === 'extern') return s.type;
                if (s.kind === 'builtin') { this.error(`'${e.name}' কেৱল মাতিব পাৰি: ${e.name}(...)`, e.pos); return T.err; }
                return T.i32;
            }
            case 'Unary': return this.unaryType(e, scope);
            case 'Binary': return this.binaryType(e, scope);
            case 'Assign': {
                const lt = this.checkExpr(e.target, scope);
                this.checkExpr(e.value, scope);
                if (!this.lvalue(e.target, "'='-ৰ বাওঁফাল")) return lt;
                if (e.op === '=') { this.assignable(e.value, lt, e.target.kind === 'Ident' ? `'${e.target.name}'-ত` : 'বাওঁফালৰ চলকত'); return lt; }
                const op = e.op.slice(0, -1);
                const rt = this.binaryResult(op, lt, e.value.type, e);
                if (rt) {
                    if (Ty.isInt(lt) && Ty.isFloat(rt)) this.error(`'${Ty.name(lt)}' চলকত দশমিক ফল ৰাখিব নোৱাৰি; 'হিচাপে' ব্যৱহাৰ কৰক`, e.pos);
                }
                return lt;
            }
            case 'Ternary': {
                this.checkCond(e.cond, scope);
                const a = this.checkExpr(e.then, scope), b = this.checkExpr(e.else, scope);
                if (Ty.isArith(a) && Ty.isArith(b)) return Ty.unify(a, b);
                if (Ty.eq(a, b)) return a;
                if (a.k === 'null' && Ty.isPtr(Ty.decay(b))) return Ty.decay(b);
                if (b.k === 'null' && Ty.isPtr(Ty.decay(a))) return Ty.decay(a);
                const da = Ty.decay(a), db = Ty.decay(b);
                if (da.k === 'ptr' && db.k === 'ptr' && Ty.eq(da, db)) return da;
                this.error(`'?:'-ৰ দুয়োটা ফালৰ প্ৰকাৰ মিলিব লাগিব ('${Ty.name(a)}' আৰু '${Ty.name(b)}')`, e.pos);
                return a;
            }
            case 'Call': return this.callType(e, scope);
            case 'Index': {
                const ot = this.checkExpr(e.obj, scope);
                const it = this.checkExpr(e.index, scope);
                if (!Ty.isInt(it)) this.error(`সূচী (index) পূৰ্ণ সংখ্যা হ'ব লাগিব, কিন্তু ইয়াৰ প্ৰকাৰ '${Ty.name(it)}'`, e.index.pos);
                if (ot.k === 'arr') {
                    const c = this.constValue(e.index);
                    if (typeof c === 'bigint' && (c < 0n || c >= BigInt(ot.n))) this.error(`সূচী ${asDigits(c)} তালিকাৰ সীমাৰ (০ … ${asDigits(ot.n - 1)}) বাহিৰত`, e.index.pos);
                    return ot.of;
                }
                if (ot.k === 'ptr' && ot.to.k !== 'void' && ot.to.k !== 'fn') return ot.to;
                this.error(`'${Ty.name(ot)}' প্ৰকাৰৰ মানত [..] ব্যৱহাৰ কৰিব নোৱাৰি`, e.pos);
                return T.err;
            }
            case 'Member': {
                const ot = this.checkExpr(e.obj, scope);
                let st = ot;
                if (e.arrow) {
                    if (ot.k !== 'ptr' || ot.to.k !== 'struct') {
                        if (ot.k === 'struct') this.error(`'${Ty.name(ot)}' সূচক নহয়; '->'-ৰ সলনি '.' লিখক`, e.pos);
                        else this.error(`'->' কেৱল গঠনৰ সূচকত ব্যৱহাৰ কৰিব পাৰি`, e.pos);
                        return T.err;
                    }
                    st = ot.to;
                } else if (ot.k !== 'struct') {
                    if (ot.k === 'ptr' && ot.to.k === 'struct') this.error(`'${Ty.name(ot)}' এটা সূচক; '.'-ৰ সলনি '->' লিখক`, e.pos);
                    else this.error(`'${Ty.name(ot)}' প্ৰকাৰৰ কোনো ক্ষেত্ৰ (field) নাই`, e.pos);
                    return T.err;
                }
                if (!st.fields) { this.error(`'${st.name}' সম্পূৰ্ণ হোৱা নাই`, e.pos); return T.err; }
                const f = st.fields.find(x => x.name === e.name);
                if (!f) {
                    const near = st.fields.map(x => x.name).sort((a, b) => editDistance(a, e.name) - editDistance(b, e.name))[0];
                    this.error(`'${st.name}'-ত '${e.name}' নামৰ ক্ষেত্ৰ নাই${near ? ` — আছে: ${st.fields.map(x => x.name).join(', ')}` : ''}`, e.pos);
                    return T.err;
                }
                e.field = f;
                return f.type;
            }
            case 'Cast': {
                const from = this.checkExpr(e.expr, scope);
                const to = this.resolveType(e.target, scope);
                e.castTo = to;
                const f = Ty.decay(from);
                const ok = (Ty.isArith(f) && Ty.isArith(to)) || (Ty.isPtr(f) && to.k === 'ptr') ||
                    (Ty.isPtr(f) && Ty.isInt(to)) || (Ty.isInt(f) && to.k === 'ptr') || to.k === 'void' || Ty.eq(f, to) ||
                    (from.k === 'fn' && to.k === 'ptr');
                if (!ok) this.error(`'${Ty.name(from)}'-ক '${Ty.name(to)}'-লৈ ৰূপান্তৰ কৰিব নোৱাৰি`, e.pos);
                return to;
            }
            case 'Sizeof': {
                if (e.of && e.of.kind === 'TName') {
                    const s = scope.lookup(e.of.name);
                    if (s && s.kind !== 'type') { e.expr = { kind: 'Ident', name: e.of.name, pos: e.of.pos }; e.of = null; }
                }
                if (e.of) { e.sizeOf = this.resolveType(e.of, scope); }
                else { e.sizeOf = this.checkExpr(e.expr, scope); }
                if (e.sizeOf.k === 'void' || e.sizeOf.k === 'fn') this.error("এই প্ৰকাৰৰ আকাৰ নাই", e.pos);
                return T.i64;
            }
            case 'New': {
                const t = this.resolveType(e.of, scope);
                e.newType = t;
                if (t.k === 'void') this.error("'শূন্য'-ৰ বাবে নতুন() কৰিব নোৱাৰি", e.pos);
                if (e.count) {
                    const ct = this.checkExpr(e.count, scope);
                    if (!Ty.isInt(ct)) this.error('নতুন()-ৰ সংখ্যাটো পূৰ্ণ সংখ্যা হ\'ব লাগিব', e.count.pos);
                }
                return Ty.ptr(t);
            }
            case 'StructLit': {
                const s = scope.lookup(e.typeName);
                if (!s || s.kind !== 'type') { this.error(`অচিনাক্ত গঠন '${e.typeName}'${this.suggest(e.typeName, scope, true)}`, e.pos); return T.err; }
                const t = s.alias ? this.resolveAlias(s) : s.type;
                if (t.k !== 'struct') { this.error(`'${e.typeName}' গঠন নহয়`, e.pos); return T.err; }
                this.checkStructInit(e.init, t, scope);
                e.init.type = t;
                return t;
            }
            case 'InitList':
                this.error('[..] বা {..} মান কেৱল ঘোষণাৰ আৰম্ভণি মান হিচাপে দিব পাৰি', e.pos);
                return T.err;
            default: throw new Error('unknown expression ' + e.kind);
        }
    }

    ensureSignature(f, pos) {
        if (f.ret) return f;
        if (f.state === 'unchecked') this.checkFuncBody(f);
        if (!f.ret) {
            this.error(`'${f.name}'-ৰ ফেৰত প্ৰকাৰ এতিয়াও জনা নাই; কাজৰ শিৰোনামত '-> প্ৰকাৰ' লিখক`, pos);
            f.ret = T.i32;
        }
        return f;
    }

    unaryType(e, scope) {
        const t = this.checkExpr(e.operand, scope);
        if (Ty.isErr(t)) return T.err;
        switch (e.op) {
            case '-': case '+':
                if (!Ty.isArith(t)) { this.error(`'${e.op}' কেৱল সংখ্যাত ব্যৱহাৰ কৰিব পাৰি, '${Ty.name(t)}'-ত নহয়`, e.pos); return T.err; }
                return Ty.isFloat(t) ? t : Ty.promote(t);
            case '!':
                if (!Ty.isScalar(t)) this.error(`'নহয়/!' '${Ty.name(t)}'-ত ব্যৱহাৰ কৰিব নোৱাৰি`, e.pos);
                return T.bool;
            case '~':
                if (!Ty.isInt(t)) { this.error("'~' কেৱল পূৰ্ণ সংখ্যাত ব্যৱহাৰ কৰিব পাৰি", e.pos); return T.err; }
                return Ty.promote(t);
            case '*': {
                const d = Ty.decay(t);
                if (d.k !== 'ptr') { this.error(`'*' কেৱল সূচকত ব্যৱহাৰ কৰিব পাৰি, কিন্তু ইয়াৰ প্ৰকাৰ '${Ty.name(t)}'`, e.pos); return T.err; }
                if (d.to.k === 'void') { this.error("'শূন্য*' সূচকৰ মান পঢ়িব নোৱাৰি; প্ৰথমে 'হিচাপে' লিখি প্ৰকাৰ দিয়ক", e.pos); return T.err; }
                return d.to;
            }
            case '&': {
                const ok = (e.operand.kind === 'Ident' && e.operand.sym && (e.operand.sym.kind === 'var' || e.operand.sym.kind === 'func')) ||
                    (e.operand.kind === 'Unary' && e.operand.op === '*') || e.operand.kind === 'Index' || e.operand.kind === 'Member';
                if (!ok) { this.error("'&' কেৱল চলক, উপাদান বা ক্ষেত্ৰৰ ঠিকনা ল'ব পাৰে", e.pos); return Ty.ptr(t); }
                if (t.k === 'fn') return Ty.ptr(t);
                return Ty.ptr(t);
            }
            default: { // ++ / -- (pre/post)
                this.lvalue(e.operand, `'${e.op.replace(/pre|post/, '')}'-ৰ মান`);
                if (!(Ty.isArith(t) || t.k === 'ptr')) this.error(`'${Ty.name(t)}'-ত '${e.op.replace(/pre|post/, '')}' ব্যৱহাৰ কৰিব নোৱাৰি`, e.pos);
                return t;
            }
        }
    }

    binaryType(e, scope) {
        const a = this.checkExpr(e.left, scope);
        const b = this.checkExpr(e.right, scope);
        if (Ty.isErr(a) || Ty.isErr(b)) return T.err;
        const t = this.binaryResult(e.op, a, b, e);
        if ((e.op === '==' || e.op === '!=') && Ty.isStr(Ty.decay(a)) && Ty.isStr(Ty.decay(b))) {
            this.warn("দুটা বাক্যৰ '==' তুলনাই ঠিকনা তুলনা কৰে; লিখা মিলাবলৈ তুলনা(ক, খ) == ০ ব্যৱহাৰ কৰক", e.pos);
        }
        if ((e.op === '/' || e.op === '%') && this.constValue(e.right) === 0n) this.error('শূন্যৰে হৰণ কৰিব নোৱাৰি', e.right.pos);
        return t || T.err;
    }

    binaryResult(op, a, b, e) {
        const da = Ty.decay(a), db = Ty.decay(b);
        const fail = () => { this.error(`'${op}' '${Ty.name(a)}' আৰু '${Ty.name(b)}'-ৰ মাজত ব্যৱহাৰ কৰিব নোৱাৰি`, e.pos); return null; };
        switch (op) {
            case '+': case '-':
                if (Ty.isArith(a) && Ty.isArith(b)) return Ty.unify(a, b);
                if (op === '+' && e.left && e.right && (e.left.kind === 'Str' || e.right.kind === 'Str')) {
                    this.error("বাক্য '+' দি জোৰা নাযায়; লিখা ক, খ বা যোগ_বাক্য(ক, খ) ব্যৱহাৰ কৰক", e.pos);
                    return T.err;
                }
                if (da.k === 'ptr' && Ty.isInt(b) && da.to.k !== 'void') return da;
                if (op === '+' && Ty.isInt(a) && db.k === 'ptr' && db.to.k !== 'void') return db;
                if (op === '-' && da.k === 'ptr' && db.k === 'ptr' && Ty.eq(da, db)) return T.i64;
                if (op === '+' && (Ty.isStr(da) || Ty.isStr(db))) { this.error("বাক্য '+' দি জোৰা নাযায়; লিখা ক, খ বা যোগ_বাক্য(ক, খ) ব্যৱহাৰ কৰক", e.pos); return null; }
                return fail();
            case '*': case '/':
                if (Ty.isArith(a) && Ty.isArith(b)) return Ty.unify(a, b);
                return fail();
            case '%':
                if (Ty.isInt(a) && Ty.isInt(b)) return Ty.unify(a, b);
                if (Ty.isArith(a) && Ty.isArith(b)) { this.error("'%' কেৱল পূৰ্ণ সংখ্যাত চলে", e.pos); return null; }
                return fail();
            case '<<': case '>>':
                if (Ty.isInt(a) && Ty.isInt(b)) return Ty.promote(a);
                return fail();
            case '&': case '|': case '^':
                if (Ty.isInt(a) && Ty.isInt(b)) return Ty.unify(a, b);
                return fail();
            case '<': case '>': case '<=': case '>=': case '==': case '!=':
                if (Ty.isArith(a) && Ty.isArith(b)) return T.bool;
                if (Ty.isPtr(da) && Ty.isPtr(db)) return T.bool;
                return fail();
            case '&&': case '||':
                if (Ty.isScalar(a) && Ty.isScalar(b)) return T.bool;
                return fail();
            default: return fail();
        }
    }

    callType(e, scope) {
        const c = e.callee;
        if (c.kind === 'Ident') {
            const s = scope.lookup(c.name);
            if (s && s.kind === 'builtin') return this.builtinCall(e, s, scope);
        }
        const ct = this.checkExpr(c, scope);
        let ft = ct;
        if (ft.k === 'ptr' && ft.to.k === 'fn') ft = ft.to;
        if (ft.k === 'err') { e.args.forEach(a => this.checkExpr(a, scope)); return T.err; }
        if (ft.k !== 'fn') {
            e.args.forEach(a => this.checkExpr(a, scope));
            if (c.kind === 'Ident' && c.sym && c.sym.kind !== 'type') this.error(`'${c.name}' কাজ নহয়; ইয়াৰ প্ৰকাৰ '${Ty.name(ct)}'`, c.pos);
            else if (!(c.kind === 'Ident' && c.sym)) this.error(`'${Ty.name(ct)}' প্ৰকাৰৰ মান কাজ নহয়, গতিকে ইয়াক মাতিব নোৱাৰি`, e.pos);
            return T.err;
        }
        const nm = c.kind === 'Ident' ? `'${c.name}'` : 'কাজটো';
        const np = ft.params.length;
        if (e.args.length < np || (!ft.variadic && e.args.length > np)) {
            this.error(`${nm}-এ ${asDigits(np)}টা আৰ্গুমেণ্ট লয়${ft.variadic ? ' (বা তাতকৈ বেছি)' : ''}, কিন্তু ${asDigits(e.args.length)}টা দিয়া হৈছে`, e.pos);
        }
        e.args.forEach((a, k) => {
            this.checkExpr(a, scope);
            if (k < np) this.assignable(a, ft.params[k], `${nm}-ৰ ${asDigits(k + 1)} নং আৰ্গুমেণ্টত`);
            else if (a.type.k === 'struct' || a.type.k === 'void') this.error('এই প্ৰকাৰৰ মান অতিৰিক্ত আৰ্গুমেণ্ট হিচাপে দিব নোৱাৰি', a.pos);
        });
        if (c.kind === 'Ident' && c.sym && c.sym.kind === 'extern') e.externCall = c.sym.ext;
        return ft.ret;
    }

    builtinCall(e, s, scope) {
        e.builtin = s.name;
        if (s.name === 'দৈৰ্ঘ্য') {
            if (e.args.length !== 1) { this.error("দৈৰ্ঘ্য()-এ এটা আৰ্গুমেণ্ট লয়", e.pos); e.args.forEach(a => this.checkExpr(a, scope)); return T.i64; }
            const t = this.checkExpr(e.args[0], scope);
            if (t.k === 'arr' && t.of.k !== 'char') { e.lengthConst = t.n; return T.i64; }
            if (t.k === 'arr') return T.i64; // আখৰ[] → লিখাৰ দৈৰ্ঘ্য (strlen)
            if (Ty.isStr(t)) return T.i64;
            this.error(`দৈৰ্ঘ্য() তালিকা বা বাক্যৰ বাবেহে, '${Ty.name(t)}'-ৰ বাবে নহয়`, e.args[0].pos);
            return T.i64;
        }
        throw new Error('unknown builtin ' + s.name);
    }
}

module.exports = { Checker, Scope };
