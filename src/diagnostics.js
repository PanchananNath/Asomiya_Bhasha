'use strict';
/**
 * Diagnostics for the Asomiya Bhasha compiler.
 * Every error carries a source position and is rendered with the
 * offending line and a caret, e.g.
 *
 *   যোগ.asb:3:9: ত্ৰুটি: অপৰিভাষিত নাম 'ক'
 *     3 |     লিখা ক + ১
 *       |          ^
 */

class CompileError extends Error {
    constructor(message, pos, file) {
        super(message);
        this.name = 'CompileError';
        this.pos = pos || { line: 1, col: 1 };
        this.file = file || (pos && pos.file) || '<উৎস>';
        this.severity = 'error';
    }
}

class Diagnostics {
    constructor() {
        this.items = [];
        this.sources = new Map(); // file -> source text
    }

    addSource(file, text) {
        this.sources.set(file, text);
    }

    error(message, pos) {
        this.items.push({ severity: 'error', message, pos: pos || { line: 1, col: 1, file: '<উৎস>' } });
    }

    warning(message, pos) {
        this.items.push({ severity: 'warning', message, pos: pos || { line: 1, col: 1, file: '<উৎস>' } });
    }

    get errors() { return this.items.filter(d => d.severity === 'error'); }
    get warnings() { return this.items.filter(d => d.severity === 'warning'); }
    hasErrors() { return this.errors.length > 0; }

    format(d) {
        const file = (d.pos && d.pos.file) || '<উৎস>';
        const line = (d.pos && d.pos.line) || 1;
        const col = (d.pos && d.pos.col) || 1;
        const label = d.severity === 'error' ? 'ত্ৰুটি' : 'সতৰ্কবাণী';
        let out = `${file}:${line}:${col}: ${label}: ${d.message}`;
        const src = this.sources.get(file);
        if (src !== undefined) {
            const text = src.split('\n')[line - 1];
            if (text !== undefined) {
                const num = String(line);
                const gutter = ' '.repeat(num.length);
                const caretPad = [...text].slice(0, col - 1).map(ch => (ch === '\t' ? '\t' : ' ')).join('');
                out += `\n  ${num} | ${text}\n  ${gutter} | ${caretPad}^`;
            }
        }
        return out;
    }

    formatAll() {
        return this.items.map(d => this.format(d)).join('\n');
    }
}

module.exports = { CompileError, Diagnostics };
