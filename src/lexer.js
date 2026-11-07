'use strict';
/**
 * Asomiya Bhasha 2.0 — lexer.
 *
 * Source text is normalised to Unicode NFC first, so the precomposed
 * nukta letters ড় ঢ় য় (U+09DC/09DD/09DF) and their decomposed spellings
 * are treated identically. Assamese digits ০–৯ and ASCII digits 0–9 are
 * interchangeable in numbers. Keyword lookup also accepts the Bengali
 * র (U+09B0) for the Assamese ৰ (U+09F0) and ASCII digits inside keywords
 * (পূ32 == পূ৩২).
 */
const { CompileError } = require('./diagnostics');

const KEYWORDS = {
    // types
    'পূৰ্ণ': 'T_INT', 'পূ৮': 'T_I8', 'পূ১৬': 'T_I16', 'পূ৩২': 'T_I32', 'পূ৬৪': 'T_I64', 'দীঘল': 'T_I64',
    'ধ৮': 'T_U8', 'ধ১৬': 'T_U16', 'ধ৩২': 'T_U32', 'ধ৬৪': 'T_U64',
    'দশমিক': 'T_F64', 'সংখ্যা': 'T_F64', 'দশমিক৩২': 'T_F32',
    'আখৰ': 'T_CHAR', 'বুলিয়ান': 'T_BOOL', 'শূন্য': 'T_VOID', 'বাক্য': 'T_STR', 'ফাইল': 'T_FILE',
    // declarations
    'কাজ': 'FUNC', 'গঠন': 'STRUCT', 'সংযোগ': 'UNION', 'গণনা': 'ENUM', 'প্ৰকাৰ': 'TYPE',
    'স্থিৰ': 'CONST', 'বাহিৰৰ': 'EXTERN', 'আমদানি': 'IMPORT', 'চি_অন্তৰ্ভুক্ত': 'CINCLUDE',
    // statements
    'যদি': 'IF', 'থাকিলে': 'THEN', 'নহলে': 'ELSE', 'যেতিয়া': 'WHILE', 'কৰা': 'DO',
    'প্ৰতিবাৰ': 'FOR', 'লৈকে': 'TO', 'ক্ৰমে': 'STEP', 'ভাঙা': 'BREAK', 'আগবাঢ়া': 'CONTINUE',
    'বাছক': 'SWITCH', 'ক্ষেত্ৰ': 'CASE', 'অন্যথা': 'DEFAULT', 'শেষ': 'END', 'উভতি': 'RETURN',
    'লিখা': 'PRINT', 'দেখুওৱা': 'SHOW',
    // values and operators
    'সত্য': 'TRUE', 'মিছা': 'FALSE', 'খালি': 'NULL',
    'আৰু': 'AND', 'বা': 'OR', 'নহয়': 'NOT', 'হিচাপে': 'AS', 'আকাৰ': 'SIZEOF', 'নতুন': 'NEW',
};

const ASSAMESE_DIGIT_0 = 0x09E6;

/** Normalise a word for keyword lookup: NFC, র→ৰ, ASCII digits → Assamese digits. */
function keywordKey(word) {
    let w = word.normalize('NFC').replace(/র/g, 'ৰ');
    w = w.replace(/[0-9]/g, d => String.fromCodePoint(ASSAMESE_DIGIT_0 + Number(d)));
    return w;
}

const KEYWORD_INDEX = new Map(Object.entries(KEYWORDS).map(([k, v]) => [keywordKey(k), v]));

// Multi-character operators first (longest match wins).
const OPERATORS = [
    '<<=', '>>=', '...',
    '->', '++', '--', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<', '>>', '<=', '>=', '==', '!=', '&&', '||',
    '+', '-', '*', '/', '%', '&', '|', '^', '~', '!', '=', '<', '>', '(', ')', '[', ']', '{', '}', ',', '.', ':', '?',
];

function isDigit(cp) { return (cp >= 48 && cp <= 57) || (cp >= 0x09E6 && cp <= 0x09EF); }
function digitValue(cp) { return cp <= 57 ? cp - 48 : cp - 0x09E6; }
function isBengaliBlock(cp) { return cp >= 0x0980 && cp <= 0x09FF; }
function isIdentStart(cp) {
    return (cp >= 65 && cp <= 90) || (cp >= 97 && cp <= 122) || cp === 95 ||
        (isBengaliBlock(cp) && !(cp >= 0x09E6 && cp <= 0x09EF));
}
function isIdentPart(cp) {
    return isIdentStart(cp) || isDigit(cp) || cp === 0x200C || cp === 0x200D;
}

class Lexer {
    constructor(source, file = '<উৎস>') {
        this.src = [...source.normalize('NFC')]; // array of code points (as strings)
        this.file = file;
        this.i = 0;
        this.line = 1;
        this.col = 1;
        this.depth = 0; // (), [] and {} nesting: newlines inside are ignored
        this.tokens = [];
    }

    peek(o = 0) { return this.src[this.i + o]; }
    cp(o = 0) { const c = this.src[this.i + o]; return c === undefined ? -1 : c.codePointAt(0); }
    pos() { return { line: this.line, col: this.col, file: this.file }; }
    err(msg, pos) { throw new CompileError(msg, pos || this.pos(), this.file); }

    advance() {
        const c = this.src[this.i++];
        if (c === '\n') { this.line++; this.col = 1; } else { this.col++; }
        return c;
    }

    push(type, value, pos, extra) {
        this.tokens.push(Object.assign({ type, value, pos }, extra || {}));
    }

    tokenize() {
        while (this.i < this.src.length) {
            const c = this.peek();
            const cp = this.cp();
            const pos = this.pos();

            if (c === '\n' || c === ';' || c === '।') { // newline, semicolon, danda
                this.advance();
                if (c === ';') { this.push('semi', ';', pos); continue; }
                if (this.depth === 0) this.push('newline', '\n', pos);
                continue;
            }
            if (c === '\r' || c === ' ' || c === '\t' || c === '﻿') { this.advance(); continue; }
            if (c === '#') { while (this.i < this.src.length && this.peek() !== '\n') this.advance(); continue; }
            if (isDigit(cp)) { this.number(pos); continue; }
            if (isIdentStart(cp)) { this.word(pos); continue; }
            if (c === '"') { this.string(pos); continue; }
            if (c === "'") { this.char(pos); continue; }

            const op = OPERATORS.find(o => this.src.slice(this.i, this.i + o.length).join('') === o);
            if (op) {
                for (let k = 0; k < op.length; k++) this.advance();
                if (op === '(' || op === '[' || op === '{') this.depth++;
                if ((op === ')' || op === ']' || op === '}') && this.depth > 0) this.depth--;
                this.push('op', op, pos);
                continue;
            }
            if (cp === 0x200C || cp === 0x200D) this.err('শব্দৰ মাজৰ বাহিৰে অদৃশ্য সংযোজক (ZWJ/ZWNJ) অনুমোদিত নহয়', pos);
            this.err(`অচিনাক্ত চিহ্ন '${c}' (U+${cp.toString(16).toUpperCase().padStart(4, '0')})`, pos);
        }
        this.push('newline', '\n', this.pos());
        this.push('eof', null, this.pos());
        return this.tokens;
    }

    word(pos) {
        let w = '';
        while (this.i < this.src.length && isIdentPart(this.cp())) w += this.advance();
        const kw = KEYWORD_INDEX.get(keywordKey(w));
        if (kw) this.push('kw', kw, pos, { text: w });
        else this.push('ident', w, pos);
    }

    number(pos) {
        let text = '';
        let isFloat = false;
        const take = () => { const c = this.advance(); const cp = c.codePointAt(0); return isDigit(cp) ? String(digitValue(cp)) : c; };
        // hexadecimal / binary prefix: 0x / ০x / 0b / ০b
        if (digitValue(this.cp()) === 0 && (this.peek(1) === 'x' || this.peek(1) === 'X' || this.peek(1) === 'b' || this.peek(1) === 'B')) {
            const radix = (this.peek(1) === 'x' || this.peek(1) === 'X') ? 16 : 2;
            this.advance(); this.advance();
            let digits = '';
            while (this.i < this.src.length) {
                const c = this.peek(); const cp = this.cp();
                if (c === '_') { this.advance(); continue; }
                if (isDigit(cp)) { digits += String(digitValue(cp)); this.advance(); continue; }
                if (radix === 16 && /[a-fA-F]/.test(c)) { digits += c; this.advance(); continue; }
                break;
            }
            if (!digits) this.err('সংখ্যাৰ উপসৰ্গৰ পিছত অংক নাই', pos);
            if (radix === 2 && /[^01]/.test(digits)) this.err('দ্বিমিক সংখ্যাত কেৱল ০ আৰু ১ থাকিব পাৰে', pos);
            const value = BigInt((radix === 16 ? '0x' : '0b') + digits);
            this.push('int', value, pos, { text: (radix === 16 ? '0x' : '0b') + digits });
            return;
        }
        while (this.i < this.src.length && (isDigit(this.cp()) || this.peek() === '_')) { if (this.peek() === '_') { this.advance(); continue; } text += take(); }
        if (this.peek() === '.' && isDigit(this.cp(1))) {
            isFloat = true; text += this.advance();
            while (this.i < this.src.length && (isDigit(this.cp()) || this.peek() === '_')) { if (this.peek() === '_') { this.advance(); continue; } text += take(); }
        }
        if ((this.peek() === 'e' || this.peek() === 'E') && (isDigit(this.cp(1)) || ((this.peek(1) === '+' || this.peek(1) === '-') && isDigit(this.cp(2))))) {
            isFloat = true; text += this.advance();
            if (this.peek() === '+' || this.peek() === '-') text += this.advance();
            while (this.i < this.src.length && isDigit(this.cp())) text += take();
        }
        if (this.i < this.src.length && isIdentStart(this.cp()) && !isBengaliBlock(this.cp())) {
            this.err(`সংখ্যাৰ পিছত অপ্ৰত্যাশিত আখৰ '${this.peek()}'`, this.pos());
        }
        if (isFloat) this.push('float', Number(text), pos, { text });
        else this.push('int', BigInt(text), pos, { text });
    }

    escape(pos) {
        const c = this.advance();
        switch (c) {
            case 'n': return '\n';
            case 't': return '\t';
            case 'r': return '\r';
            case '0': return '\0';
            case '\\': return '\\';
            case '"': return '"';
            case "'": return "'";
            case 'x': {
                const h = (this.advance() || '') + (this.advance() || '');
                if (!/^[0-9a-fA-F]{2}$/.test(h)) this.err('\\x-ৰ পিছত দুটা hex অংক লাগে', pos);
                return String.fromCodePoint(parseInt(h, 16));
            }
            case 'u': {
                if (this.advance() !== '{') this.err('\\u{...} ৰূপত লিখক', pos);
                let h = '';
                while (this.peek() && this.peek() !== '}') h += this.advance();
                this.advance();
                if (!/^[0-9a-fA-F]{1,6}$/.test(h)) this.err('অবৈধ \\u{...} escape', pos);
                return String.fromCodePoint(parseInt(h, 16));
            }
            default: this.err(`অচিনাক্ত escape '\\${c}'`, pos);
        }
    }

    string(pos) {
        this.advance(); // opening quote
        let s = '';
        for (;;) {
            if (this.i >= this.src.length || this.peek() === '\n') this.err('বাক্য (string) বন্ধ কৰা হোৱা নাই', pos);
            const c = this.advance();
            if (c === '"') break;
            s += c === '\\' ? this.escape(pos) : c;
        }
        this.push('string', s, pos);
    }

    char(pos) {
        this.advance();
        let s = '';
        for (;;) {
            if (this.i >= this.src.length || this.peek() === '\n') this.err("আখৰ ('...') বন্ধ কৰা হোৱা নাই", pos);
            const c = this.advance();
            if (c === "'") break;
            s += c === '\\' ? this.escape(pos) : c;
        }
        const cps = [...s];
        if (cps.length !== 1) this.err("'...'-ৰ ভিতৰত ঠিক এটা আখৰ থাকিব লাগে; বেছি হ'লে \"...\" ব্যৱহাৰ কৰক", pos);
        this.push('char', cps[0].codePointAt(0), pos);
    }
}

function tokenize(source, file) { return new Lexer(source, file).tokenize(); }

module.exports = { Lexer, tokenize, KEYWORDS, keywordKey };
