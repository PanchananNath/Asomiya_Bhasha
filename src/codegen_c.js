'use strict';
/**
 * Asomiya Bhasha 2.0 — C back end.
 * Translates the checked program model into one self-contained C11 file.
 * User names are prefixed with `a_` (so they never clash with C keywords
 * or library names); Assamese letters are kept as UTF-8 unless
 * `asciiNames` is set, in which case they become `_uXXXX_`.
 */
const Ty = require('./types');
const { RUNTIME_C, HEADER_SYMBOLS } = require('./runtime');

function cString(s) {
    let out = '"';
    for (const ch of s) {
        const cp = ch.codePointAt(0);
        if (ch === '"') out += '\\"';
        else if (ch === '\\') out += '\\\\';
        else if (ch === '\n') out += '\\n';
        else if (ch === '\t') out += '\\t';
        else if (ch === '\r') out += '\\r';
        else if (cp < 0x20 || cp === 0x7F) out += '\\' + cp.toString(8).padStart(3, '0');
        else if (ch === '?') out += '\\?'; // avoid accidental trigraphs
        else out += ch;
    }
    return out + '"';
}

class CGen {
    constructor(model, opts = {}) {
        this.m = model;
        this.asciiNames = !!opts.asciiNames;
        this.asciiDigits = !!opts.asciiDigits;
        this.file = opts.file || '<উৎস>';
        this.tmp = 0;
        this.lines = [];
        this.ind = 0;
    }

    // ---- names and types -------------------------------------------------
    mangle(name) {
        let out = 'a_';
        for (const ch of name) {
            const cp = ch.codePointAt(0);
            if (/[A-Za-z0-9_]/.test(ch)) out += ch;
            else if (!this.asciiNames && cp >= 0x0980 && cp <= 0x09FF) out += ch;
            else out += `_u${cp.toString(16).padStart(4, '0')}_`;
        }
        return out;
    }
    t() { return `asb_t${++this.tmp}`; }

    ctype(t, inner = '') {
        const sp = inner ? ' ' + inner : '';
        switch (t.k) {
            case 'int': return `${t.signed ? '' : 'u'}int${t.bits}_t${sp}`;
            case 'float': return (t.bits === 64 ? 'double' : 'float') + sp;
            case 'bool': return 'bool' + sp;
            case 'char': return 'char' + sp;
            case 'void': return 'void' + sp;
            case 'opaque': return t.name + sp;
            case 'null': return 'void *' + inner;
            case 'struct': case 'enum': return this.mangle(t.name) + sp;
            case 'ptr': {
                const needParens = t.to.k === 'arr' || t.to.k === 'fn';
                return this.ctype(t.to, needParens ? `(*${inner})` : `*${inner}`);
            }
            case 'arr': return this.ctype(t.of, `${inner}[${t.n}]`);
            case 'fn': {
                const ps = t.params.map(p => this.ctype(p)).join(', ');
                return this.ctype(t.ret, `${inner}(${ps || 'void'}${t.variadic ? ', ...' : ''})`);
            }
            default: throw new Error('ctype ' + t.k);
        }
    }

    // ---- output helpers --------------------------------------------------
    line(s = '') { this.lines.push(s ? '    '.repeat(this.ind) + s : ''); }

    // ---- expressions -----------------------------------------------------
    expr(e, top = false) {
        switch (e.kind) {
            case 'Int': {
                if (e.type.k === 'int' && e.type.bits === 64) return e.type.signed ? `${e.value}LL` : `${e.value}ULL`;
                return String(e.value);
            }
            case 'Float': { const s = String(e.value); return /[.eE]/.test(s) || /Infinity|NaN/.test(s) ? s : s + '.0'; }
            case 'Str': return cString(e.value);
            case 'Char': {
                if (e.cp >= 128) return String(e.cp);
                const ch = String.fromCodePoint(e.cp);
                const esc = { '\n': '\\n', '\t': '\\t', '\r': '\\r', '\0': '\\0', '\\': '\\\\', "'": "\\'" }[ch];
                if (esc) return `'${esc}'`;
                if (e.cp < 0x20 || e.cp === 0x7F) return `'\\${e.cp.toString(8).padStart(3, '0')}'`;
                return `'${ch}'`;
            }
            case 'Bool': return e.value ? 'true' : 'false';
            case 'Null': return 'NULL';
            case 'Ident': {
                const s = e.sym;
                if (s.kind === 'extern') return s.ext.cname;
                return this.mangle(e.name);
            }
            case 'Unary': {
                const o = this.expr(e.operand);
                if (e.op === 'pre++' || e.op === 'pre--') return top ? `${e.op.slice(3)}${o}` : `(${e.op.slice(3)}${o})`;
                if (e.op === 'post++' || e.op === 'post--') return top ? `${o}${e.op.slice(4)}` : `(${o}${e.op.slice(4)})`;
                return `(${e.op}${o})`;
            }
            case 'Binary': { const b = `${this.expr(e.left)} ${e.op} ${this.expr(e.right)}`; return top ? b : `(${b})`; }
            case 'Assign': {
                const s = `${this.expr(e.target)} ${e.op} ${this.expr(e.value)}`;
                return top ? s : `(${s})`;
            }
            case 'Ternary': return `(${this.expr(e.cond)} ? ${this.expr(e.then)} : ${this.expr(e.else)})`;
            case 'Call': {
                if (e.builtin === 'দৈৰ্ঘ্য') {
                    if (e.lengthConst != null) return `((int64_t)${e.lengthConst})`;
                    return `((int64_t)strlen(${this.expr(e.args[0])}))`;
                }
                const call = `${this.expr(e.callee)}(${e.args.map(a => this.expr(a)).join(', ')})`;
                if (e.externCall && e.type.k !== 'void' && !top) return `((${this.ctype(e.type)})${call})`;
                return call;
            }
            case 'Index': return `${this.expr(e.obj)}[${this.expr(e.index)}]`;
            case 'Member': return `${this.expr(e.obj)}${e.arrow ? '->' : '.'}${this.mangle(e.name)}`;
            case 'Cast': return `((${this.ctype(e.castTo)})${this.expr(e.expr)})`;
            case 'Sizeof': return `((int64_t)sizeof(${this.ctype(e.sizeOf)}))`;
            case 'New': {
                const n = e.count ? `(size_t)${this.expr(e.count)}` : '1';
                return `((${this.ctype(Ty.ptr(e.newType))})calloc(${n}, sizeof(${this.ctype(e.newType)})))`;
            }
            case 'StructLit': return `((${this.ctype(e.type)})${this.init(e.init)})`;
            default: throw new Error('expr ' + e.kind);
        }
    }

    init(e) {
        if (e.kind !== 'InitList') return this.expr(e);
        if (e.items.length === 0) return '{0}';
        if (e.type && e.type.k === 'struct') {
            return '{ ' + e.items.map(it => `.${this.mangle(it.field.name)} = ${this.init(it.value)}`).join(', ') + ' }';
        }
        return '{ ' + e.items.map(it => this.init(it.value)).join(', ') + ' }';
    }

    zero(t) { return (t.k === 'arr' || t.k === 'struct') ? '{0}' : (t.k === 'ptr' ? 'NULL' : '0'); }

    // ---- printing --------------------------------------------------------
    printValue(c, t) {
        switch (t.k) {
            case 'int':
                if (!t.signed && t.bits === 64) return this.line(`asb_rt_print_u64(${c});`);
                return this.line(`asb_rt_print_i64((long long)${c});`);
            case 'enum': return this.line(`asb_rt_print_i64((long long)${c});`);
            case 'float': return this.line(`asb_rt_print_f64((double)${c});`);
            case 'bool': return this.line(`asb_rt_print_bool(${c});`);
            case 'char': return this.line(`asb_rt_print_char(${c});`);
            case 'null': return this.line('asb_rt_print_str(NULL);');
            case 'ptr':
                if (t.to.k === 'char') return this.line(`asb_rt_print_str(${c});`);
                return this.line(`asb_rt_print_ptr((const void *)${c});`);
            case 'arr': {
                if (t.of.k === 'char') return this.line(`asb_rt_print_str(${c});`);
                const p = this.t(), i = this.t();
                this.line('{');
                this.ind++;
                this.line(`${this.ctype(Ty.ptr(t), p)} = &${c};`);
                this.line('asb_rt_puts("[");');
                this.line(`for (int64_t ${i} = 0; ${i} < ${t.n}; ${i}++) {`);
                this.ind++;
                this.line(`if (${i}) asb_rt_puts(", ");`);
                this.printValue(`(*${p})[${i}]`, t.of);
                this.ind--;
                this.line('}');
                this.line('asb_rt_puts("]");');
                this.ind--;
                this.line('}');
                return;
            }
            case 'struct': {
                const s = this.t();
                this.line('{');
                this.ind++;
                this.line(`${this.ctype(t, s)} = ${c};`);
                this.line('asb_rt_puts("{");');
                t.fields.forEach((f, k) => {
                    this.line(`asb_rt_puts(${cString((k ? ', ' : '') + f.name + ': ')});`);
                    this.printValue(`${s}.${this.mangle(f.name)}`, f.type);
                });
                this.line('asb_rt_puts("}");');
                this.ind--;
                this.line('}');
                return;
            }
            default:
                if (t.k === 'int' && t.bits === 32 && t.signed) return this.line(`asb_rt_print_i64(${c});`);
                return this.line(`asb_rt_print_ptr((const void *)${c});`);
        }
    }

    // ---- statements ------------------------------------------------------
    block(stmts) { for (const s of stmts) this.stmt(s); }

    stmt(s) {
        switch (s.kind) {
            case 'VarDecl': {
                const t = s.resolved;
                const name = s.isConst ? `const ${this.mangle(s.name)}` : this.mangle(s.name);
                const init = s.init ? this.init(s.init) : this.zero(t);
                return this.line(`${this.ctype(t, name)} = ${init};`);
            }
            case 'ExprStmt': return this.line(`${this.expr(s.expr, true)};`);
            case 'Print':
                s.args.forEach((a, k) => {
                    if (k) this.line('asb_rt_sp();');
                    if (a.type.k === 'char' && a.kind === 'Char') return this.line(`asb_rt_print_char(${this.expr(a)});`);
                    if (a.kind === 'Char' && a.cp >= 128) return this.line(`asb_rt_print_cp(${a.cp});`);
                    this.printValue(this.expr(a), a.type);
                });
                return this.line(s.newline ? 'asb_rt_nl();' : 'asb_rt_sp();');
            case 'If':
                s.branches.forEach((b, k) => {
                    this.line(`${k ? '} else if' : 'if'} (${this.expr(b.cond, true)}) {`);
                    this.ind++; this.block(b.body); this.ind--;
                });
                if (s.elseBody) { this.line('} else {'); this.ind++; this.block(s.elseBody); this.ind--; }
                return this.line('}');
            case 'While':
                this.line(`while (${this.expr(s.cond, true)}) {`);
                this.ind++; this.block(s.body); this.ind--;
                return this.line('}');
            case 'DoWhile':
                this.line('do {');
                this.ind++; this.block(s.body); this.ind--;
                return this.line(`} while (${this.expr(s.cond, true)});`);
            case 'RangeFor': {
                const t = s.varTypeResolved;
                const v = this.mangle(s.name), end = this.t();
                let decl = `${this.ctype(t, v)} = ${this.expr(s.start)}, ${end} = ${this.expr(s.end)}`;
                let cond, step;
                if (!s.step) { cond = `${v} <= ${end}`; step = `${v}++`; }
                else if (typeof s.stepConst === 'bigint') {
                    cond = s.stepConst > 0n ? `${v} <= ${end}` : `${v} >= ${end}`;
                    step = `${v} += ${this.expr(s.step)}`;
                } else {
                    const st = this.t();
                    decl += `, ${st} = ${this.expr(s.step)}`;
                    cond = `(${st} > 0 ? ${v} <= ${end} : ${v} >= ${end})`;
                    step = `${v} += ${st}`;
                }
                this.line(`for (${decl}; ${cond}; ${step}) {`);
                this.ind++; this.block(s.body); this.ind--;
                return this.line('}');
            }
            case 'CFor': {
                const wrap = s.init && s.init.length > 0;
                if (wrap) { this.line('{'); this.ind++; for (const i of s.init) this.stmt(i); }
                const cond = s.cond ? this.expr(s.cond, true) : '';
                const upd = s.update ? this.expr(s.update, true) : '';
                this.line(`for (; ${cond}; ${upd}) {`);
                this.ind++; this.block(s.body); this.ind--;
                this.line('}');
                if (wrap) { this.ind--; this.line('}'); }
                return;
            }
            case 'Switch':
                this.line(`switch (${this.expr(s.expr, true)}) {`);
                for (const c of s.cases) {
                    this.line(c.values.map(v => `case ${v.constVal}:`).join(' ') + ' {');
                    this.ind++; this.block(c.body); this.line('break;'); this.ind--;
                    this.line('}');
                }
                if (s.defaultBody) { this.line('default: {'); this.ind++; this.block(s.defaultBody); this.line('break;'); this.ind--; this.line('}'); }
                return this.line('}');
            case 'Break': return this.line('break;');
            case 'Continue': return this.line('continue;');
            case 'Return': return this.line(s.value ? `return ${this.expr(s.value, true)};` : 'return;');
            default: throw new Error('stmt ' + s.kind);
        }
    }

    // ---- program ---------------------------------------------------------
    funcHead(f) {
        const params = f.params.map(p => this.ctype(p.type, this.mangle(p.name))).join(', ') || 'void';
        return this.ctype(f.ret, `${this.mangle(f.name)}(${params})`);
    }

    globalInitStmt(d) {
        const name = this.mangle(d.name);
        const t = d.resolved;
        if (d.init.kind === 'InitList') {
            if (t.k === 'arr') return this.line(`memcpy(${name}, (${this.ctype(t)})${this.init(d.init)}, sizeof(${name}));`);
            return this.line(`${name} = (${this.ctype(t)})${this.init(d.init)};`);
        }
        return this.line(`${name} = ${this.expr(d.init, true)};`);
    }

    generate() {
        const m = this.m;
        this.line(`/* ${String(this.file).replace(/\*\//g, '* /')} — অসমীয়া ভাষা ২.০ কম্পাইলাৰে তৈয়াৰ কৰা C11 ক'ড; হাতেৰে সম্পাদনা নকৰিব */`);
        this.line(`#define ASB_ASCII_DIGITS ${this.asciiDigits ? 1 : 0}`);
        this.lines.push(...RUNTIME_C.split('\n'));
        for (const h of m.cincludes) this.line(h.startsWith('<') ? `#include ${h}` : `#include "${h}"`);
        this.line();

        const userStructs = m.structs;
        if (userStructs.length) {
            this.line('/* গঠন আৰু সংযোগ (structs and unions) */');
            for (const st of userStructs) this.line(`typedef ${st.union ? 'union' : 'struct'} ${this.mangle(st.name)} ${this.mangle(st.name)};`);
        }
        for (const en of m.enums) {
            this.line(`typedef int32_t ${this.mangle(en.name)};`);
            this.line(`enum { ${en.members.map(x => `${this.mangle(x.name)} = ${x.value}`).join(', ')} };`);
        }
        for (const st of userStructs) {
            this.line(`${st.union ? 'union' : 'struct'} ${this.mangle(st.name)} {`);
            this.ind++;
            for (const f of st.fields) this.line(`${this.ctype(f.type, this.mangle(f.name))};`);
            this.ind--;
            this.line('};');
        }

        const userExterns = m.externs.filter(e => !e.builtin && !HEADER_SYMBOLS.has(e.cname) && m.cincludes.length === 0);
        if (userExterns.length) {
            this.line();
            this.line('/* বাহিৰৰ কাজ (external C functions) */');
            for (const e of userExterns) this.line(`extern ${this.ctype(e.type, e.cname)};`);
        }

        if (m.funcs.length) {
            this.line();
            this.line('/* কাজৰ ঘোষণা (prototypes) */');
            for (const f of m.funcs) this.line(`static ${this.funcHead(f)};`);
        }

        if (m.globals.length) {
            this.line();
            this.line('/* বিশ্বব্যাপী চলক (globals) */');
            for (const d of m.globals) {
                const name = d.isConst && d.constInit ? `const ${this.mangle(d.name)}` : this.mangle(d.name);
                const init = d.init && d.constInit ? this.init(d.init) : this.zero(d.resolved);
                this.line(`static ${this.ctype(d.resolved, name)} = ${init};`);
            }
        }

        for (const f of m.funcs) {
            this.line();
            this.line(`static ${this.funcHead(f)} {`);
            this.ind++;
            this.block(f.node.body);
            this.ind--;
            this.line('}');
        }

        this.line();
        this.line('int main(int argc, char **argv) {');
        this.ind++;
        this.line('asb_rt_init(&argc, &argv);');
        for (const item of m.topOrder) {
            if (item.kind === 'global') { if (item.decl.init && !item.decl.constInit) this.globalInitStmt(item.decl); }
            else this.stmt(item.stmt);
        }
        if (m.hasMain) {
            const f = m.main;
            const call = `${this.mangle(f.name)}(${f.params.length ? 'argc, argv' : ''})`;
            if (f.ret.k === 'void') { this.line(`${call};`); this.line('return 0;'); }
            else this.line(`return ${call};`);
        } else {
            this.line('return 0;');
        }
        this.ind--;
        this.line('}');
        return this.lines.join('\n') + '\n';
    }
}

module.exports = { CGen, cString };
