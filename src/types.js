'use strict';
/**
 * Asomiya Bhasha 2.0 — type representations and conversion rules.
 * See docs/spec.md section 4 for the normative description.
 */

const int = (bits, signed) => Object.freeze({ k: 'int', bits, signed });
const T = {
    i8: int(8, true), i16: int(16, true), i32: int(32, true), i64: int(64, true),
    u8: int(8, false), u16: int(16, false), u32: int(32, false), u64: int(64, false),
    f32: Object.freeze({ k: 'float', bits: 32 }), f64: Object.freeze({ k: 'float', bits: 64 }),
    bool: Object.freeze({ k: 'bool' }), char: Object.freeze({ k: 'char' }), void: Object.freeze({ k: 'void' }),
    file: Object.freeze({ k: 'opaque', name: 'FILE', aname: 'ফাইল' }),
    null: Object.freeze({ k: 'null' }),
    err: Object.freeze({ k: 'err' }), // result of an expression that already produced an error
};

const PRIM = {
    T_INT: T.i32, T_I8: T.i8, T_I16: T.i16, T_I32: T.i32, T_I64: T.i64,
    T_U8: T.u8, T_U16: T.u16, T_U32: T.u32, T_U64: T.u64,
    T_F64: T.f64, T_F32: T.f32, T_CHAR: T.char, T_BOOL: T.bool, T_VOID: T.void, T_FILE: T.file,
};

const ptr = to => ({ k: 'ptr', to });
const arr = (of, n) => ({ k: 'arr', of, n });
const fn = (ret, params, variadic = false) => ({ k: 'fn', ret, params, variadic });
T.str = ptr(T.char);
PRIM.T_STR = T.str;

function eq(a, b) {
    if (a === b) return true;
    if (a && b && (a.k === 'err' || b.k === 'err')) return true;
    if (!a || !b || a.k !== b.k) return false;
    switch (a.k) {
        case 'int': return a.bits === b.bits && a.signed === b.signed;
        case 'float': return a.bits === b.bits;
        case 'ptr': return eq(a.to, b.to);
        case 'arr': return a.n === b.n && eq(a.of, b.of);
        case 'fn': return eq(a.ret, b.ret) && a.variadic === b.variadic && a.params.length === b.params.length && a.params.every((p, i) => eq(p, b.params[i]));
        case 'struct': case 'enum': return a === b;
        case 'opaque': return a.name === b.name;
        default: return true; // bool, char, void, null
    }
}

const isInt = t => t.k === 'int' || t.k === 'char' || t.k === 'bool' || t.k === 'enum' || t.k === 'err';
const isFloat = t => t.k === 'float';
const isArith = t => isInt(t) || isFloat(t);
const isPtr = t => t.k === 'ptr' || t.k === 'null';
const isScalar = t => isArith(t) || isPtr(t) || t.k === 'arr';
const isErr = t => !!t && t.k === 'err';
const isStr = t => t.k === 'ptr' && t.to.k === 'char';
const isFnPtr = t => t.k === 'ptr' && t.to.k === 'fn';
const decay = t => (t.k === 'arr' ? ptr(t.of) : t);

/** Integer promotion: types narrower than 32 bits (and bool, char, enum) become পূ৩২. */
function promote(t) {
    if (t.k === 'err') return t;
    if (t.k === 'char' || t.k === 'bool' || t.k === 'enum') return T.i32;
    if (t.k === 'int' && t.bits < 32) return T.i32;
    return t;
}

/** Usual arithmetic conversions, as in C. */
function unify(a, b) {
    if (a.k === 'err' || b.k === 'err') return T.err;
    if (isFloat(a) || isFloat(b)) {
        const bits = Math.max(isFloat(a) ? a.bits : 0, isFloat(b) ? b.bits : 0);
        return bits === 64 ? T.f64 : T.f32;
    }
    a = promote(a); b = promote(b);
    if (a.bits === b.bits) return int(a.bits, a.signed && b.signed);
    return a.bits > b.bits ? a : b;
}

function intRange(t) {
    if (t.k === 'char') return [-128n, 127n];
    if (t.k === 'bool') return [0n, 1n];
    if (t.k === 'enum') t = T.i32;
    if (t.signed) return [-(1n << BigInt(t.bits - 1)), (1n << BigInt(t.bits - 1)) - 1n];
    return [0n, (1n << BigInt(t.bits)) - 1n];
}

/** Assamese display name used in diagnostics. */
function name(t) {
    if (!t) return '?';
    switch (t.k) {
        case 'int': {
            if (t.signed && t.bits === 32) return 'পূৰ্ণ';
            const d = String(t.bits).replace(/[0-9]/g, x => String.fromCodePoint(0x09E6 + Number(x)));
            return (t.signed ? 'পূ' : 'ধ') + d;
        }
        case 'float': return t.bits === 64 ? 'দশমিক' : 'দশমিক৩২';
        case 'bool': return 'বুলিয়ান';
        case 'char': return 'আখৰ';
        case 'void': return 'শূন্য';
        case 'null': return 'খালি';
        case 'opaque': return t.aname;
        case 'ptr':
            if (t.to.k === 'char') return 'বাক্য';
            if (t.to.k === 'fn') return `কাজ(${t.to.params.map(name).join(', ')})${t.to.ret.k === 'void' ? '' : ' -> ' + name(t.to.ret)}`;
            return name(t.to) + '*';
        case 'arr': return `${name(t.of)}[${String(t.n).replace(/[0-9]/g, x => String.fromCodePoint(0x09E6 + Number(x)))}]`;
        case 'fn': return `কাজ(${t.params.map(name).join(', ')}) -> ${name(t.ret)}`;
        case 'struct': return t.name;
        case 'enum': return t.name;
        case 'err': return '?';
        default: return t.k;
    }
}

module.exports = { T, PRIM, ptr, arr, fn, eq, isErr, isInt, isFloat, isArith, isPtr, isScalar, isStr, isFnPtr, decay, promote, unify, intRange, name };
