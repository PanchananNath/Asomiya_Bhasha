'use strict';
/**
 * Asomiya Bhasha 2.0 — parser.
 * Recursive descent for declarations and statements, precedence climbing
 * for expressions. Produces a plain-object AST; every node carries `pos`.
 * The grammar is specified in docs/spec.md (section 3).
 */
const { CompileError } = require('./diagnostics');
const { KEYWORDS } = require('./lexer');

const KW_TEXT = Object.fromEntries(Object.entries(KEYWORDS).map(([k, v]) => [v, k]));
KW_TEXT.T_INT = 'পূৰ্ণ'; KW_TEXT.T_F64 = 'দশমিক'; KW_TEXT.T_I64 = 'পূ৬৪';

const TYPE_KEYWORDS = new Set(['T_INT', 'T_I8', 'T_I16', 'T_I32', 'T_I64', 'T_U8', 'T_U16', 'T_U32', 'T_U64',
    'T_F64', 'T_F32', 'T_CHAR', 'T_BOOL', 'T_VOID', 'T_STR', 'T_FILE']);

const BINARY_PREC = {
    '||': 1, '&&': 2, '|': 3, '^': 4, '&': 5, '==': 6, '!=': 6,
    '<': 7, '>': 7, '<=': 7, '>=': 7, '<<': 8, '>>': 8, '+': 9, '-': 9, '*': 10, '/': 10, '%': 10,
};
const ASSIGN_OPS = new Set(['=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<=', '>>=']);

function describe(tok) {
    switch (tok.type) {
        case 'kw': return `'${tok.text || KW_TEXT[tok.value]}'`;
        case 'ident': return `নাম '${tok.value}'`;
        case 'int': case 'float': return `সংখ্যা ${tok.text}`;
        case 'string': return 'বাক্য (string)';
        case 'char': return 'আখৰ';
        case 'op': return `'${tok.value}'`;
        case 'newline': return 'শাৰীৰ শেষ';
        case 'semi': return "';'";
        case 'eof': return 'ফাইলৰ শেষ';
        default: return tok.type;
    }
}

class Backtrack extends Error {}

class Parser {
    constructor(tokens, file = '<উৎস>') {
        this.toks = tokens;
        this.i = 0;
        this.file = file;
    }

    // ---- token helpers ---------------------------------------------------
    get cur() { return this.toks[this.i]; }
    peek(o = 1) { return this.toks[Math.min(this.i + o, this.toks.length - 1)]; }
    next() { const t = this.toks[this.i]; if (this.i < this.toks.length - 1) this.i++; return t; }
    isOp(v, t = this.cur) { return t.type === 'op' && t.value === v; }
    isKw(v, t = this.cur) { return t.type === 'kw' && t.value === v; }
    isEnd(t = this.cur) { return t.type === 'newline' || t.type === 'semi' || t.type === 'eof'; }
    acceptOp(v) { if (this.isOp(v)) { return this.next(); } return null; }
    acceptKw(v) { if (this.isKw(v)) { return this.next(); } return null; }
    err(msg, tok = this.cur) { throw new CompileError(msg, tok.pos, this.file); }
    expectOp(v) { if (!this.isOp(v)) this.err(`'${v}' প্ৰত্যাশিত, কিন্তু ${describe(this.cur)} পোৱা গ'ল`); return this.next(); }
    expectKw(v, ctx) { if (!this.isKw(v)) this.err(`'${KW_TEXT[v]}' প্ৰত্যাশিত${ctx ? ` (${ctx})` : ''}, কিন্তু ${describe(this.cur)} পোৱা গ'ল`); return this.next(); }
    expectIdent(what = 'নাম') {
        if (this.cur.type !== 'ident') this.err(`${what} প্ৰত্যাশিত, কিন্তু ${describe(this.cur)} পোৱা গ'ল`);
        return this.next();
    }
    skipNewlines() { while (this.cur.type === 'newline' || this.cur.type === 'semi') this.next(); }
    endStatement() {
        if (this.cur.type === 'eof') return;
        if (this.cur.type !== 'newline' && this.cur.type !== 'semi') this.err(`বিবৃতিৰ শেষত শাৰী সলনি হ'ব লাগিছিল, কিন্তু ${describe(this.cur)} পোৱা গ'ল`);
        this.next();
    }

    // ---- program ---------------------------------------------------------
    parseProgram() {
        const items = [];
        this.skipNewlines();
        while (this.cur.type !== 'eof') {
            items.push(...this.parseTopLevel());
            this.skipNewlines();
        }
        return { kind: 'Program', items, file: this.file };
    }

    parseTopLevel() {
        const t = this.cur;
        if (this.isKw('IMPORT')) {
            this.next();
            if (this.cur.type !== 'string') this.err('আমদানিৰ পিছত ফাইলৰ নাম "..." ৰূপত লিখক');
            const path = this.next().value; this.endStatement();
            return [{ kind: 'Import', path, pos: t.pos }];
        }
        if (this.isKw('CINCLUDE')) {
            this.next();
            if (this.cur.type !== 'string') this.err('চি_অন্তৰ্ভুক্তৰ পিছত header-ৰ নাম "..." ৰূপত লিখক');
            const header = this.next().value; this.endStatement();
            return [{ kind: 'CInclude', header, pos: t.pos }];
        }
        if (this.isKw('FUNC') && this.peek().type === 'ident') return [this.parseFunction()];
        if (this.isKw('EXTERN')) return [this.parseExtern()];
        if (this.isKw('STRUCT') || this.isKw('UNION')) return [this.parseStruct()];
        if (this.isKw('ENUM')) return [this.parseEnum()];
        if (this.isKw('TYPE')) {
            this.next();
            const name = this.expectIdent('প্ৰকাৰৰ নাম');
            this.expectOp('=');
            const type = this.parseType();
            this.endStatement();
            return [{ kind: 'TypeAlias', name: name.value, type, pos: t.pos }];
        }
        return this.parseStatement(true);
    }

    parseParams(allowVariadic, allowUnnamed) {
        const params = [];
        let variadic = false;
        this.expectOp('(');
        if (!this.isOp(')')) {
            for (;;) {
                if (this.isOp('...')) {
                    if (!allowVariadic) this.err("'...' কেৱল বাহিৰৰ কাজত ব্যৱহাৰ কৰিব পাৰি");
                    this.next(); variadic = true; break;
                }
                const pos = this.cur.pos;
                const type = this.parseType();
                let name = null;
                if (this.cur.type === 'ident') name = this.next().value;
                else if (!allowUnnamed) this.err(`পেৰামিটাৰৰ নাম প্ৰত্যাশিত, কিন্তু ${describe(this.cur)} পোৱা গ'ল`);
                params.push({ type, name, pos });
                if (!this.acceptOp(',')) break;
            }
        }
        this.expectOp(')');
        return { params, variadic };
    }

    parseFunction() {
        const t = this.expectKw('FUNC');
        const name = this.expectIdent('কাজৰ নাম');
        const { params } = this.parseParams(false, false);
        let ret = null;
        if (this.acceptOp('->')) ret = this.parseType();
        this.endStatement();
        const body = this.parseBlock(['END'], t);
        this.expectKw('END', `'${name.value}' কাজ বন্ধ কৰিবলৈ`);
        this.endStatement();
        return { kind: 'Func', name: name.value, params, ret, body, pos: name.pos };
    }

    parseExtern() {
        const t = this.expectKw('EXTERN');
        this.expectKw('FUNC', 'বাহিৰৰ কাজ');
        const name = this.expectIdent('কাজৰ নাম');
        const { params, variadic } = this.parseParams(true, true);
        let ret = null;
        if (this.acceptOp('->')) ret = this.parseType();
        let cname = name.value;
        if (this.acceptOp('=')) {
            if (this.cur.type !== 'string') this.err('C-ৰ নাম "..." ৰূপত লিখক');
            cname = this.next().value;
        }
        this.endStatement();
        return { kind: 'Extern', name: name.value, params, variadic, ret, cname, pos: t.pos };
    }

    parseStruct() {
        const t = this.next();
        const isUnion = t.value === 'UNION';
        const name = this.expectIdent(isUnion ? 'সংযোগৰ নাম' : 'গঠনৰ নাম');
        this.endStatement();
        const fields = [];
        this.skipNewlines();
        while (!this.isKw('END')) {
            if (this.cur.type === 'eof') this.err(`'${name.value}' বন্ধ কৰিবলৈ 'শেষ' নাই`, t);
            const type = this.parseType();
            do {
                const f = this.expectIdent('ক্ষেত্ৰৰ (field) নাম');
                fields.push({ type, name: f.value, pos: f.pos });
            } while (this.acceptOp(','));
            this.endStatement();
            this.skipNewlines();
        }
        this.next();
        this.endStatement();
        return { kind: 'Struct', name: name.value, fields, union: isUnion, pos: name.pos };
    }

    parseEnum() {
        const t = this.next();
        const name = this.expectIdent('গণনাৰ নাম');
        this.endStatement();
        const items = [];
        this.skipNewlines();
        while (!this.isKw('END')) {
            if (this.cur.type === 'eof') this.err(`'${name.value}' বন্ধ কৰিবলৈ 'শেষ' নাই`, t);
            const it = this.expectIdent('গণনাৰ সদস্যৰ নাম');
            let value = null;
            if (this.acceptOp('=')) value = this.parseExpr();
            items.push({ name: it.value, value, pos: it.pos });
            if (!this.acceptOp(',')) this.endStatement();
            this.skipNewlines();
        }
        this.next();
        this.endStatement();
        return { kind: 'Enum', name: name.value, items, pos: name.pos };
    }

    // ---- types -----------------------------------------------------------
    startsType(t = this.cur) {
        return (t.type === 'kw' && (TYPE_KEYWORDS.has(t.value) || t.value === 'FUNC'));
    }

    parseType() {
        const t = this.cur;
        let type;
        if (t.type === 'kw' && TYPE_KEYWORDS.has(t.value)) {
            this.next();
            type = { kind: 'TPrim', prim: t.value, pos: t.pos };
        } else if (this.isKw('FUNC')) {
            this.next();
            this.expectOp('(');
            const params = [];
            if (!this.isOp(')')) {
                do { params.push(this.parseType()); if (this.cur.type === 'ident') this.next(); } while (this.acceptOp(','));
            }
            this.expectOp(')');
            let ret = null;
            if (this.acceptOp('->')) ret = this.parseType();
            type = { kind: 'TPtr', to: { kind: 'TFn', params, ret, pos: t.pos }, pos: t.pos };
        } else if (t.type === 'ident') {
            this.next();
            type = { kind: 'TName', name: t.value, pos: t.pos };
        } else {
            this.err(`প্ৰকাৰ (type) প্ৰত্যাশিত, কিন্তু ${describe(t)} পোৱা গ'ল`);
        }
        for (;;) {
            if (this.isOp('*')) { const p = this.next(); type = { kind: 'TPtr', to: type, pos: p.pos }; continue; }
            if (this.isOp('[')) {
                const dims = [];
                while (this.isOp('[')) {
                    const b = this.next();
                    const size = this.isOp(']') ? null : this.parseExpr();
                    this.expectOp(']');
                    dims.push({ size, pos: b.pos });
                }
                for (let k = dims.length - 1; k >= 0; k--) type = { kind: 'TArr', of: type, size: dims[k].size, pos: dims[k].pos };
                continue;
            }
            break;
        }
        return type;
    }

    /** Try to parse `type name`; on failure restore position and return null. */
    tryDeclHead() {
        const save = this.i;
        if (!(this.cur.type === 'ident' || this.startsType())) return null;
        const isKwType = this.startsType();
        try {
            const type = this.parseType();
            if (this.cur.type === 'ident') {
                const after = this.peek();
                if (isKwType || (after.type === 'op' && (after.value === '=' || after.value === ',')) || this.isEnd(after)) {
                    return type;
                }
            }
            if (isKwType) this.err(`চলকৰ নাম প্ৰত্যাশিত, কিন্তু ${describe(this.cur)} পোৱা গ'ল`);
        } catch (e) {
            if (isKwType) throw e;
        }
        this.i = save;
        return null;
    }

    // ---- statements ------------------------------------------------------
    parseBlock(terminators, opener) {
        const body = [];
        for (;;) {
            this.skipNewlines();
            if (this.cur.type === 'kw' && terminators.includes(this.cur.value)) return body;
            if (this.cur.type === 'eof') {
                const need = terminators.map(x => `'${KW_TEXT[x]}'`).join(' বা ');
                this.err(`${describe(opener)}-ৰ block বন্ধ কৰিবলৈ ${need} নাই`, opener);
            }
            if (this.isKw('FUNC') && this.peek().type === 'ident') this.err('কাজৰ ভিতৰত আন কাজ ঘোষণা কৰিব নোৱাৰি');
            if (this.isKw('STRUCT') || this.isKw('UNION') || this.isKw('ENUM') || this.isKw('TYPE') || this.isKw('EXTERN') || this.isKw('IMPORT')) {
                this.err(`${describe(this.cur)} কেৱল ফাইলৰ শীৰ্ষ স্তৰত ঘোষণা কৰিব পাৰি`);
            }
            body.push(...this.parseStatement(false));
        }
    }

    parseVarDecl(isConst, type, startPos) {
        const decls = [];
        do {
            const name = this.expectIdent('চলকৰ নাম');
            let init = null;
            if (this.acceptOp('=')) init = this.parseInitializer();
            decls.push({ kind: 'VarDecl', type, isConst, name: name.value, init, pos: name.pos, typePos: startPos });
        } while (this.acceptOp(','));
        return decls;
    }

    parseInitializer() {
        if (this.isOp('[')) {
            const b = this.next();
            const items = [];
            while (!this.isOp(']')) {
                items.push({ name: null, value: this.parseInitializer() });
                if (!this.acceptOp(',')) break;
            }
            this.expectOp(']');
            return { kind: 'InitList', items, array: true, pos: b.pos };
        }
        if (this.isOp('{')) return this.parseBraceInit();
        return this.parseExpr();
    }

    parseBraceInit() {
        const b = this.expectOp('{');
        const items = [];
        while (!this.isOp('}')) {
            let name = null;
            if (this.cur.type === 'ident' && this.isOp(':', this.peek())) { name = this.next().value; this.next(); }
            items.push({ name, value: this.parseInitializer() });
            if (!this.acceptOp(',')) break;
        }
        this.expectOp('}');
        return { kind: 'InitList', items, array: false, pos: b.pos };
    }

    parseStatement(topLevel) {
        const t = this.cur;
        let out;
        switch (t.type === 'kw' ? t.value : null) {
            case 'CONST': {
                this.next();
                const type = this.parseType();
                out = this.parseVarDecl(true, type, t.pos);
                break;
            }
            case 'IF': out = [this.parseIf()]; return out;
            case 'WHILE': {
                this.next();
                const cond = this.parseExpr();
                this.endStatement();
                const body = this.parseBlock(['END'], t);
                this.next(); this.endStatement();
                return [{ kind: 'While', cond, body, pos: t.pos }];
            }
            case 'DO': {
                this.next(); this.endStatement();
                const body = this.parseBlock(['END'], t);
                this.next();
                this.expectKw('WHILE', "কৰা ... শেষ যেতিয়া চৰ্ত");
                const cond = this.parseExpr();
                this.endStatement();
                return [{ kind: 'DoWhile', cond, body, pos: t.pos }];
            }
            case 'FOR': return [this.parseFor()];
            case 'SWITCH': return [this.parseSwitch()];
            case 'BREAK': this.next(); out = [{ kind: 'Break', pos: t.pos }]; break;
            case 'CONTINUE': this.next(); out = [{ kind: 'Continue', pos: t.pos }]; break;
            case 'RETURN': {
                this.next();
                const value = this.isEnd() ? null : this.parseExpr();
                out = [{ kind: 'Return', value, pos: t.pos }];
                break;
            }
            case 'PRINT': case 'SHOW': {
                this.next();
                const args = [];
                if (!this.isEnd()) { do { args.push(this.parseExpr()); } while (this.acceptOp(',')); }
                out = [{ kind: 'Print', args, newline: t.value === 'PRINT', pos: t.pos }];
                break;
            }
            case 'END': case 'ELSE': case 'CASE': case 'DEFAULT': case 'THEN': case 'TO': case 'STEP':
                this.err(`অপ্ৰত্যাশিত ${describe(t)}${t.value === 'END' ? ' — ইয়াৰ আগত কোনো block খোলা হোৱা নাই' : ''}`);
                break;
            default: {
                const type = this.tryDeclHead();
                if (type) out = this.parseVarDecl(false, type, t.pos);
                else out = [{ kind: 'ExprStmt', expr: this.parseExpr(), pos: t.pos }];
            }
        }
        this.endStatement();
        if (topLevel) out.forEach(s => { s.topLevel = true; });
        return out;
    }

    parseIf() {
        const t = this.expectKw('IF');
        const branches = [];
        let elseBody = null;
        let cond = this.parseExpr();
        this.expectKw('THEN', 'যদি ... থাকিলে');
        this.endStatement();
        let body = this.parseBlock(['ELSE', 'END'], t);
        branches.push({ cond, body });
        while (this.isKw('ELSE')) {
            const e = this.next();
            if (this.acceptKw('IF')) {
                cond = this.parseExpr();
                this.expectKw('THEN', 'নহলে যদি ... থাকিলে');
                this.endStatement();
                body = this.parseBlock(['ELSE', 'END'], e);
                branches.push({ cond, body });
            } else {
                this.endStatement();
                elseBody = this.parseBlock(['END'], e);
                break;
            }
        }
        this.expectKw('END', 'যদি বন্ধ কৰিবলৈ');
        this.endStatement();
        return { kind: 'If', branches, elseBody, pos: t.pos };
    }

    parseFor() {
        const t = this.expectKw('FOR');
        if (this.isOp('(')) {
            this.next();
            let init = null, cond = null, update = null;
            if (!(this.cur.type === 'semi')) {
                const type = this.tryDeclHead();
                init = type ? this.parseVarDecl(false, type, this.cur.pos) : [{ kind: 'ExprStmt', expr: this.parseExpr(), pos: this.cur.pos }];
            }
            if (this.cur.type !== 'semi') this.err("C-ধৰণৰ প্ৰতিবাৰত ';' প্ৰত্যাশিত");
            this.next();
            if (this.cur.type !== 'semi') cond = this.parseExpr();
            if (this.cur.type !== 'semi') this.err("C-ধৰণৰ প্ৰতিবাৰত দ্বিতীয় ';' প্ৰত্যাশিত");
            this.next();
            if (!this.isOp(')')) update = this.parseExpr();
            this.expectOp(')');
            this.endStatement();
            const body = this.parseBlock(['END'], t);
            this.next(); this.endStatement();
            return { kind: 'CFor', init, cond, update, body, pos: t.pos };
        }
        let varType = null;
        if (this.startsType() || (this.cur.type === 'ident' && this.peek().type === 'ident')) varType = this.parseType();
        const name = this.expectIdent('loop চলকৰ নাম');
        this.expectOp('=');
        const start = this.parseExpr();
        this.expectKw('TO', 'প্ৰতিবাৰ i = আৰম্ভ লৈকে শেষ');
        const end = this.parseExpr();
        let step = null;
        if (this.acceptKw('STEP')) step = this.parseExpr();
        this.endStatement();
        const body = this.parseBlock(['END'], t);
        this.next(); this.endStatement();
        return { kind: 'RangeFor', varType, name: name.value, start, end, step, body, pos: t.pos, namePos: name.pos };
    }

    parseSwitch() {
        const t = this.expectKw('SWITCH');
        const expr = this.parseExpr();
        this.endStatement();
        const cases = [];
        let defaultBody = null;
        this.skipNewlines();
        while (!this.isKw('END')) {
            if (this.isKw('CASE')) {
                const c = this.next();
                const values = [];
                do { values.push(this.parseExpr()); } while (this.acceptOp(','));
                this.acceptOp(':');
                this.endStatement();
                const body = this.parseBlock(['CASE', 'DEFAULT', 'END'], c);
                cases.push({ values, body, pos: c.pos });
            } else if (this.isKw('DEFAULT')) {
                const d = this.next();
                if (defaultBody) this.err("এটা বাছকত এবাৰহে 'অন্যথা' থাকিব পাৰে", d);
                this.acceptOp(':');
                this.endStatement();
                defaultBody = this.parseBlock(['CASE', 'DEFAULT', 'END'], d);
            } else if (this.cur.type === 'eof') {
                this.err("বাছক বন্ধ কৰিবলৈ 'শেষ' নাই", t);
            } else {
                this.err(`বাছকৰ ভিতৰত 'ক্ষেত্ৰ' বা 'অন্যথা' প্ৰত্যাশিত, কিন্তু ${describe(this.cur)} পোৱা গ'ল`);
            }
            this.skipNewlines();
        }
        this.next(); this.endStatement();
        return { kind: 'Switch', expr, cases, defaultBody, pos: t.pos };
    }

    // ---- expressions -----------------------------------------------------
    parseExpr() { return this.parseAssign(); }

    parseAssign() {
        const left = this.parseTernary();
        if (this.cur.type === 'op' && ASSIGN_OPS.has(this.cur.value)) {
            const op = this.next();
            const value = this.parseAssign();
            return { kind: 'Assign', op: op.value, target: left, value, pos: op.pos };
        }
        return left;
    }

    parseTernary() {
        const cond = this.parseBinary(1);
        if (this.isOp('?')) {
            const q = this.next();
            const a = this.parseExpr();
            this.expectOp(':');
            const b = this.parseTernary();
            return { kind: 'Ternary', cond, then: a, else: b, pos: q.pos };
        }
        return cond;
    }

    binaryOp() {
        const t = this.cur;
        if (t.type === 'op' && BINARY_PREC[t.value]) return t.value;
        if (this.isKw('AND')) return '&&';
        if (this.isKw('OR')) return '||';
        return null;
    }

    parseBinary(minPrec) {
        let left = this.parseCast();
        for (;;) {
            const op = this.binaryOp();
            if (!op || BINARY_PREC[op] < minPrec) return left;
            const t = this.next();
            const right = this.parseBinary(BINARY_PREC[op] + 1);
            left = { kind: 'Binary', op, left, right, pos: t.pos };
        }
    }

    parseCast() {
        let e = this.parseUnary();
        while (this.isKw('AS')) {
            const t = this.next();
            const type = this.parseType();
            e = { kind: 'Cast', expr: e, target: type, pos: t.pos };
        }
        return e;
    }

    parseUnary() {
        const t = this.cur;
        if (t.type === 'op' && ['-', '+', '!', '~', '*', '&'].includes(t.value)) {
            this.next();
            return { kind: 'Unary', op: t.value, operand: this.parseUnary(), pos: t.pos };
        }
        if (t.type === 'op' && (t.value === '++' || t.value === '--')) {
            this.next();
            return { kind: 'Unary', op: 'pre' + t.value, operand: this.parseUnary(), pos: t.pos };
        }
        if (this.isKw('NOT')) { this.next(); return { kind: 'Unary', op: '!', operand: this.parseUnary(), pos: t.pos }; }
        if (this.isKw('SIZEOF')) {
            this.next();
            this.expectOp('(');
            const save = this.i;
            try {
                const type = this.parseType();
                if (this.isOp(')')) { this.next(); return { kind: 'Sizeof', of: type, expr: null, pos: t.pos }; }
            } catch (e) { /* not a type */ }
            this.i = save;
            const expr = this.parseExpr();
            this.expectOp(')');
            return { kind: 'Sizeof', of: null, expr, pos: t.pos };
        }
        return this.parsePostfix(this.parsePrimary());
    }

    parsePostfix(e) {
        for (;;) {
            const t = this.cur;
            if (this.isOp('(')) {
                this.next();
                const args = [];
                if (!this.isOp(')')) { do { args.push(this.parseExpr()); } while (this.acceptOp(',')); }
                this.expectOp(')');
                e = { kind: 'Call', callee: e, args, pos: t.pos };
            } else if (this.isOp('[')) {
                this.next();
                const index = this.parseExpr();
                this.expectOp(']');
                e = { kind: 'Index', obj: e, index, pos: t.pos };
            } else if (this.isOp('.') || this.isOp('->')) {
                this.next();
                const name = this.expectIdent('ক্ষেত্ৰৰ (field) নাম');
                e = { kind: 'Member', obj: e, name: name.value, arrow: t.value === '->', pos: name.pos };
            } else if (this.isOp('++') || this.isOp('--')) {
                this.next();
                e = { kind: 'Unary', op: 'post' + t.value, operand: e, pos: t.pos };
            } else {
                return e;
            }
        }
    }

    parsePrimary() {
        const t = this.cur;
        switch (t.type) {
            case 'int': this.next(); return { kind: 'Int', value: t.value, text: t.text, pos: t.pos };
            case 'float': this.next(); return { kind: 'Float', value: t.value, text: t.text, pos: t.pos };
            case 'char': this.next(); return { kind: 'Char', cp: t.value, pos: t.pos };
            case 'string': {
                let s = this.next().value;
                while (this.cur.type === 'string') s += this.next().value; // "ক" "খ" joins
                return { kind: 'Str', value: s, pos: t.pos };
            }
            case 'ident': {
                this.next();
                if (this.isOp('{')) {
                    const init = this.parseBraceInit();
                    return { kind: 'StructLit', typeName: t.value, init, pos: t.pos };
                }
                return { kind: 'Ident', name: t.value, pos: t.pos };
            }
            case 'kw':
                if (t.value === 'TRUE' || t.value === 'FALSE') { this.next(); return { kind: 'Bool', value: t.value === 'TRUE', pos: t.pos }; }
                if (t.value === 'NULL') { this.next(); return { kind: 'Null', pos: t.pos }; }
                if (t.value === 'NEW') {
                    this.next();
                    this.expectOp('(');
                    const type = this.parseType();
                    let count = null;
                    if (this.acceptOp(',')) count = this.parseExpr();
                    this.expectOp(')');
                    return { kind: 'New', of: type, count, pos: t.pos };
                }
                break;
            case 'op':
                if (t.value === '(') {
                    this.next();
                    const e = this.parseExpr();
                    this.expectOp(')');
                    return e;
                }
                if (t.value === '[') this.err('তালিকা-ৰূপৰ মান [..] কেৱল চলক ঘোষণাৰ আৰম্ভণি মান হিচাপে দিব পাৰি');
                break;
            default: break;
        }
        this.err(`অভিব্যক্তি (expression) প্ৰত্যাশিত, কিন্তু ${describe(t)} পোৱা গ'ল`);
    }
}

function parse(tokens, file) { return new Parser(tokens, file).parseProgram(); }

module.exports = { Parser, parse, KW_TEXT, describe };
