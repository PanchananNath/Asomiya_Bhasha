#!/usr/bin/env bash
# =====================================================================
#  অসমীয়া ভাষা ২.০ (Asomiya Bhasha 2.0) — Stage 1 install script
#  Replaces the v1 interpreter with the C-level compiler (Asomiya → C → native).
#
#  HOW TO USE: open a terminal in the root of your Asomiya_Bhasha clone
#  (the folder that contains package.json) and paste this whole block
#  into bash or zsh,
#  or save it as install_v2.sh and run:  bash install_v2.sh
#
#  Needs: Node.js 16+, npm, and a C compiler (gcc or clang).
#  It writes/updates 57 files, removes 7 obsolete v1 files,
#  runs npm install, builds the playground bundle and runs the tests.
# =====================================================================
# Disable '!' history expansion so pasted code containing '!' is not altered.
[ -n "${ZSH_VERSION:-}" ] && setopt nobanghist; set +H 2>/dev/null || true
(
set -euo pipefail

if [ ! -f package.json ] || ! grep -q '"name": "asomiya-bhasha"' package.json; then
    echo "✗ এই script-টো Asomiya_Bhasha repository-ৰ root folder-ত চলাওক (package.json থকা folder)."
    echo "  (Run this from the root of your Asomiya_Bhasha clone.)"
    exit 1
fi

if command -v git >/dev/null 2>&1 && [ -n "$(git status --porcelain 2>/dev/null)" ]; then
    echo "⚠ Uncommitted changes found. They will be overwritten where files overlap."
    echo "  Press Ctrl+C within 5 seconds to stop (tip: git stash first)."
    sleep 5
fi

echo "→ Removing v1 files…"
rm -f "examples/conditions.asm"
rm -f "examples/functions.asm"
rm -f "examples/hello.asm"
rm -f "examples/math.asm"
rm -f "programs/first.asm"
rm -f "src/ast.js"
rm -f "src/interpreter.js"

echo "→ Writing v2 files…"
mkdir -p "docs" "examples" "examples/lib" "programs" "public" "src" "tests" "tests/expected"

cat > "CHANGELOG.md" <<'__ASOMIYA_BHASHA_EOF__'
# Changelog

## 2.0.0 — compiled, C-level language

Asomiya Bhasha is now a statically typed language compiled to native code through C. The v1 interpreter, REPL and `.asm` file extension are replaced.

### Added
- Compiler pipeline: lexer → parser → type checker → C11 code generator → gcc / clang.
- Integer types `পূ৮ পূ১৬ পূ৩২ পূ৬৪`, unsigned `ধ৮ ধ১৬ ধ৩২ ধ৬৪`, `দশমিক৩২`, `আখৰ`, `শূন্য`, `ফাইল`.
- Pointers (`T*`, `&`, `*`, `->`, pointer arithmetic), fixed-size and multi-dimensional arrays, `গঠন` (struct), `সংযোগ` (union), `গণনা` (enum), `প্ৰকাৰ` (type alias), function pointers.
- Heap memory: `নতুন(T, n)`, `মুকলি`, `সংৰক্ষণ`, `পুনৰ_সংৰক্ষণ`, `প্ৰতিলিপি`, `ভৰোৱা`.
- Statements: `বাছক / ক্ষেত্ৰ / অন্যথা`, `কৰা … শেষ যেতিয়া`, C-style `প্ৰতিবাৰ (…; …; …)`, `ক্ৰমে` step, `ভাঙা`, `আগবাঢ়া`, `দেখুওৱা`.
- Operators: `%`, bitwise operators, compound assignment, `++`/`--`, `?:`, `হিচাপে` (cast), `আকাৰ` (sizeof); `আৰু`/`বা` now short-circuit.
- `কাজ মূল` entry point with command-line arguments and exit status; `প্ৰস্থান`.
- Modules (`আমদানি`), C interoperability (`বাহিৰৰ কাজ`, `চি_অন্তৰ্ভুক্ত`), standard library for strings, maths, files, input and random numbers.
- Assamese diagnostics with line, column, caret and name suggestions; warnings.
- `docs/spec.md`: full language specification with EBNF grammar.
- 193-check test suite that builds and runs every program with gcc and clang.

### Fixed (defects found in v1.0.0)
- D1: an else-if chain inside a loop or function swallowed the enclosing `শেষ`.
- D2: a function called as a statement dropped its name.
- D3: type keywords shared token types with literals.
- D4: error positions were wrong (line always 1, absolute columns).
- D5: keywords typed with precomposed ড় ঢ় য় did not match (source is now NFC-normalised).
- D6: missing `শেষ` and stray tokens were silently accepted.
- D7: identifiers could not contain ASCII digits (`a1`).
- D8: declared types were not enforced after declaration.
- D9: chained indexing `m[i][j]` did not parse.
- D10: the range-loop variable leaked into the enclosing scope.
- Playground: the `aboutLink` handler threw on page load, and the GitHub link showed "coming soon".

### Changed — porting v1 programs
| v1 | v2 |
| --- | --- |
| files `*.asm` | files `*.asb` |
| `সংখ্যা x = ৫` (number) | still works (`সংখ্যা` = `দশমিক`); use `পূৰ্ণ` for whole numbers |
| `তালিকা ল = [১, ২]` | `পূৰ্ণ[] ল = [১, ২]` |
| `লিখা "ফল: " + x` | `লিখা "ফল:", x` |
| `কাজ যোগ(a, b)` | `কাজ যোগ(পূৰ্ণ a, পূৰ্ণ b) -> পূৰ্ণ` |
| `node src/cli.js --repl` | removed; use `node src/cli.js -e '…'` |
| playground runs programs | playground checks and shows the generated C; run with the CLI |
| numbers printed as `5` | printed as `৫` (`--ascii-digits` for `5`) |
__ASOMIYA_BHASHA_EOF__

cat > "README.md" <<'__ASOMIYA_BHASHA_EOF__'
# অসমীয়া ভাষা (Asomiya Bhasha) 2.0


<img width="254" height="254" alt="logo" src="https://github.com/user-attachments/assets/53ece51a-409f-49f7-9a58-40ef8b11c380" />

অসমীয়া লিপিত লিখা, **C-ৰ সমান ক্ষমতাৰ** এটা statically typed, compiled programming language। কম্পাইলাৰে অসমীয়া ক'ডক C11-লৈ ৰূপান্তৰ কৰে আৰু gcc বা clang-এ তাৰ পৰা native executable তৈয়াৰ কৰে।

**Developed by:** Er Panchanan Nath  
**Open source project by:** Er Panchanan Nath  
**Original copyright:** Er Panchanan Nath

```asb
গঠন নোড
    পূৰ্ণ মান
    নোড* পিছৰ
শেষ

নোড* তালিকা = খালি
প্ৰতিবাৰ i = ১ লৈকে ৫
    নোড* ন = নতুন(নোড)
    ন->মান = i * i
    ন->পিছৰ = তালিকা
    তালিকা = ন
শেষ

যেতিয়া তালিকা != খালি
    দেখুওৱা তালিকা->মান
    নোড* পিছৰ = তালিকা->পিছৰ
    মুকলি(তালিকা)
    তালিকা = পিছৰ
শেষ
লিখা
```

```text
$ node src/cli.js list.asb
২৫ ১৬ ৯ ৪ ১
```

## What it is

**Asomiya Bhasha 2.0** is a systems programming language whose keywords, identifiers and numerals are Assamese. It has the capabilities of C — fixed-size integer types, floating point, pointers and pointer arithmetic, manual heap memory, arrays, structs, unions, enums, function pointers, separate modules and direct calls into any C library — with a few safety and teaching improvements: every variable starts at zero, implicit float-to-integer conversion is an error, `লিখা` prints numbers in Assamese digits, and all compiler messages are in Assamese with the offending line and a caret.

The compiler is written in JavaScript (Node.js 16+). Its pipeline is:

**source → lexer → parser → AST → type checker → C11 code generator → gcc / clang → native executable**

Version 1 was a tree-walking interpreter for a small dynamically typed language. Version 2 replaces it; see [CHANGELOG.md](CHANGELOG.md) for what changed and how to port v1 programs.

## বৈশিষ্ট্য (features)

| বিষয় | অসমীয়া ভাষা ২.০ |
| --- | --- |
| পূৰ্ণ সংখ্যা | `পূৰ্ণ` (৩২-বিট), `পূ৮ পূ১৬ পূ৩২ পূ৬৪`, চিহ্নহীন `ধ৮ ধ১৬ ধ৩২ ধ৬৪` |
| অন্যান্য প্ৰকাৰ | `দশমিক` (double), `দশমিক৩২`, `আখৰ`, `বুলিয়ান`, `বাক্য`, `শূন্য`, `ফাইল` |
| গঠিত প্ৰকাৰ | সূচক `T*`, তালিকা `T[n]`, `গঠন`, `সংযোগ`, `গণনা`, `প্ৰকাৰ` (উপনাম), কাজৰ সূচক `কাজ(T) -> R` |
| নিয়ন্ত্ৰণ | `যদি … থাকিলে / নহলে যদি / নহলে / শেষ`, `বাছক / ক্ষেত্ৰ / অন্যথা`, `যেতিয়া`, `প্ৰতিবাৰ … লৈকে … ক্ৰমে`, C-ধৰণৰ `প্ৰতিবাৰ (…; …; …)`, `কৰা … শেষ যেতিয়া`, `ভাঙা`, `আগবাঢ়া` |
| অপাৰেটৰ | C-ৰ সকলো: `+ - * / %`, `& \| ^ ~ << >>`, `== != < > <= >=`, `আৰু বা নহয়` (`&& \|\| !`), `?:`, `= += -= …`, `++ --`, `& *`, `. ->`, `হিচাপে` (cast), `আকাৰ` (sizeof) |
| স্মৃতি | `নতুন(T)`, `নতুন(T, n)`, `মুকলি(p)`, `সংৰক্ষণ`, `পুনৰ_সংৰক্ষণ`, `প্ৰতিলিপি`, `ভৰোৱা` |
| মডিউল আৰু C | `আমদানি "ফাইল.asb"`, `বাহিৰৰ কাজ … = "c_name"`, `চি_অন্তৰ্ভুক্ত "<header.h>"` |
| আউটপুট | `লিখা` (অসমীয়া অংক, নতুন শাৰী), `দেখুওৱা` (একে শাৰী), `ছপা` (C-ৰ printf) |
| প্ৰৱেশ বিন্দু | শীৰ্ষ স্তৰৰ বিবৃতিৰে script, বা `কাজ মূল(পূৰ্ণ n, বাক্য* আৰ্গ) -> পূৰ্ণ` |

The full language definition — lexical rules, EBNF grammar, type system, conversions, semantics, the standard library and every diagnostic — is in **[docs/spec.md](docs/spec.md)**. A shorter tutorial is in [docs/syntax.md](docs/syntax.md).

## প্ৰয়োজনীয়তা (requirements)

- Node.js 16 বা তাৰ পিছৰ
- এটা C11 কম্পাইলাৰ: gcc 9+ বা clang 10+ (`cc` হিচাপে বা `--cc` দি)
  - Ubuntu/Debian: `sudo apt install build-essential`
  - macOS: `xcode-select --install`
  - Windows: WSL বা MSYS2-ৰ gcc
- Source files UTF-8-ত save কৰিব লাগে

## Installation

```bash
git clone https://github.com/PanchananNath/Asomiya_Bhasha.git
cd Asomiya_Bhasha
npm install
npm test
```

macOS/Linux-ত `./setup.sh`-এ এই সকলোবোৰ পৰীক্ষা কৰি কৰে আৰু ইচ্ছা কৰিলে `npm link`-ৰে `asomiya` command install কৰে।

## Quick start

```bash
node src/cli.js examples/hello.asb                 # compile কৰি চলোৱা
node src/cli.js build examples/linked_list.asb     # native executable: ./linked_list
node src/cli.js c examples/structs.asb             # তৈয়াৰ হোৱা C ক'ড চোৱা
node src/cli.js check myprog.asb                   # কেৱল ভুল পৰীক্ষা
node src/cli.js -e 'লিখা "ফল:", ২ + ৩ * ৪'          # এশাৰীৰ প্ৰ'গ্ৰাম
node src/cli.js examples/main_args.asb -- ক খ      # আৰ্গুমেণ্ট দি চলোৱা
```

Options: `--cc gcc|clang`, `-O0`…`-O3`, `-g`, `--ascii-digits` (print 0–9 instead of ০–৯), `--ascii-names` (C output uses `_uXXXX_` names). `npm link`-ৰ পিছত `node src/cli.js`-ৰ সলনি `asomiya` লিখিব পাৰি।

A compile error looks like this:

```text
$ node src/cli.js -e $'পূৰ্ণ যোগফল = ০\nযোগফল = যোগফল + "১"'
<-e>:2:15: ত্ৰুটি: বাক্য '+' দি জোৰা নাযায়; লিখা ক, খ বা যোগ_বাক্য(ক, খ) ব্যৱহাৰ কৰক
  2 | যোগফল = যোগফল + "১"
    |               ^
```

## Playground

```bash
npm run web          # http://localhost:8080
```

A browser has no C compiler, so the playground uses the same compiler to **check your program and show the generated C**. For the 100 built-in samples it also shows the output a native run prints. To run programs, use the CLI.

## JavaScript API

```js
const asomiya = require('./src/index');
const { ok, c, diagnostics } = asomiya.compile('লিখা "নমস্কাৰ"');   // C text
const run = asomiya.run('লিখা ২ + ৩', { input: '' });                // needs gcc/clang
console.log(run.stdout);                                                // "৫\n"
```

## Tests

```bash
npm test               # 193 checks: language features, diagnostics, examples, 100 samples
npm run test:clang     # the same with clang
npm run test:quick     # skip the 100-sample sweep
```

Every check compiles the program, builds it with the C compiler and compares the exact output. The generated C compiles without warnings under `gcc` and `clang` with `-Wall -Wextra -pedantic`.

## Project structure

| Path | Purpose |
| --- | --- |
| [src/lexer.js](src/lexer.js) | Source text → tokens (NFC normalisation, Assamese digits, keywords) |
| [src/parser.js](src/parser.js) | Tokens → AST (recursive descent + precedence climbing) |
| [src/types.js](src/types.js) | Type representation and conversion rules |
| [src/checker.js](src/checker.js) | Name resolution, type checking, Assamese diagnostics |
| [src/codegen_c.js](src/codegen_c.js) | Checked AST → C11 |
| [src/runtime.js](src/runtime.js) | Embedded C runtime and the standard library prelude |
| [src/compiler.js](src/compiler.js) | Compiler driver (works in Node.js and browsers) |
| [src/native.js](src/native.js) | Invokes gcc/clang and runs the executable |
| [src/cli.js](src/cli.js) | `asomiya` command-line tool |
| [src/index.js](src/index.js) | JavaScript API |
| [src/browser.js](src/browser.js) | Playground bundle entry point |
| [examples/](examples) | 14 example programs and the 100-sample catalogue |
| [tests/](tests) | Test suite and golden outputs |
| [docs/spec.md](docs/spec.md) | Language specification and grammar |
| [docs/syntax.md](docs/syntax.md) | Tutorial-style guide |
| [docs/roadmap.md](docs/roadmap.md) | Stage 2 (LLVM) and Stage 3 (MLIR) plans |
| [public/](public) | Browser playground |

<img width="5828" height="7291" alt="diagram" src="https://github.com/user-attachments/assets/a17c88c7-d675-42db-acc9-782b1e00743c" />

*The diagram above shows the version 1 interpreter architecture.*

## License

MIT. Copyright (c) Er Panchanan Nath.
__ASOMIYA_BHASHA_EOF__

cat > "docs/roadmap.md" <<'__ASOMIYA_BHASHA_EOF__'
# Roadmap

Asomiya Bhasha is being built in three compiler stages. Each stage keeps the same front end (lexer, parser, type checker in `src/`) and adds a new back end, so programs written today keep working.

| Stage | Back end | Status | What it adds |
| --- | --- | --- | --- |
| 1 | C11 → gcc / clang | **done (v2.0)** | Native executables, C-level language, full C library access |
| 2 | LLVM IR | planned | Direct LLVM code generation, DWARF debug info, WebAssembly target so the playground can run programs in the browser |
| 3 | MLIR dialect | planned | An `asomiya` MLIR dialect lowered through `scf`/`arith`/`memref`/`func` to LLVM; a platform for language-level analysis and optimisation research |

## Stage 2 — LLVM IR back end

1. Lower the checked AST to LLVM IR text (`.ll`) with one function per Asomiya function; locals as `alloca`, structs as named LLVM struct types, `লিখা` as calls into a small runtime compiled once from `src/runtime.js`.
2. Emit DWARF line information from AST positions, so gdb and lldb show Assamese source lines.
3. Add `--target wasm32-wasi` and ship a prebuilt WebAssembly runtime; the playground then compiles to Wasm in a worker and runs programs in the browser.
4. Compare speed against Stage 1 (`clang -O2` on the generated C) on the 100 samples and a benchmark set.

## Stage 3 — MLIR dialect

1. Define an `asomiya` dialect with operations for the language's constructs (range loops, `লিখা`, `নতুন`/`মুকলি`) and types mapping to `builtin` and `llvm` types.
2. Lower progressively: `asomiya` → `scf` + `arith` + `memref` + `func` → `llvm`.
3. Use the dialect for analyses that are awkward at the C level: loop bounds from `প্ৰতিবাৰ … লৈকে`, heap-lifetime checks for `নতুন`/`মুকলি`, and teaching-oriented diagnostics.

## Language additions under consideration

- An optional `--safe` mode with run-time array bounds checks, null checks and division-by-zero checks reported in Assamese.
- Bit-fields, `static` locals and `goto`, for complete C coverage.
- Generic containers (a growable list) in the standard library.
- A language server (LSP) for editor support, and a formatter.
- Self-hosting: writing the compiler in Asomiya Bhasha itself.
__ASOMIYA_BHASHA_EOF__

cat > "docs/spec.md" <<'__ASOMIYA_BHASHA_EOF__'
# Asomiya Bhasha 2.0 — Language Specification

**অসমীয়া ভাষা ২.০ — ভাষাৰ নিৰ্দিষ্টকৰণ**

Version 2.0.0 · Reference implementation: the compiler in `src/` of [PanchananNath/Asomiya_Bhasha](https://github.com/PanchananNath/Asomiya_Bhasha)

This document defines the language: its characters and tokens, its grammar, its types and conversions, what each declaration, statement and expression means, the standard library, and the diagnostics the compiler produces. Where this document and the reference compiler disagree, that is a bug in one of them and should be reported.

Assamese terms appear with an English gloss on first use. Code examples are in Assamese; numbers in examples use Assamese digits, but ASCII digits are always accepted too.

---

## Contents

1. [Overview](#1-overview)
2. [Lexical structure](#2-lexical-structure)
3. [Grammar](#3-grammar)
4. [Types](#4-types)
5. [Declarations, scope and program structure](#5-declarations-scope-and-program-structure)
6. [Statements](#6-statements)
7. [Expressions](#7-expressions)
8. [Output formatting](#8-output-formatting)
9. [Standard library](#9-standard-library)
10. [Translation to C](#10-translation-to-c)
11. [Diagnostics](#11-diagnostics)
12. [Undefined behaviour and differences from C](#12-undefined-behaviour-and-differences-from-c)

---

## 1. Overview

Asomiya Bhasha 2.0 is a statically typed, compiled, imperative language with the expressive power of C11. A program is one or more UTF-8 source files (extension `.asb`). The compiler checks the whole program, translates it to a single C11 translation unit, and a C compiler (gcc or clang) produces a native executable.

Design rules that differ from C are deliberate and few:

- every variable without an initialiser starts at zero (`০`, `০.০`, `মিছা`, `খালি`);
- converting a floating-point value to an integer requires an explicit `হিচাপে` cast;
- a statement that computes a value and discards it (`x + ১`) is an error;
- `লিখা` prints numbers with Assamese digits and Booleans as `সত্য` / `মিছা`;
- blocks are closed by the keyword `শেষ`, not braces, and indentation is not significant;
- a program may be a script (top-level statements) or define the entry point `মূল`.

---

## 2. Lexical structure

### 2.1 Source text

Source files are UTF-8. Before tokenising, the compiler normalises the whole text to **Unicode NFC**. Because U+09DC ড়, U+09DD ঢ় and U+09DF য় are composition exclusions, NFC turns them into their decomposed forms (base letter + nukta U+09BC), so a keyword typed either way matches. A byte-order mark is ignored.

### 2.2 Line structure and separators

A **statement terminator** is a newline, a semicolon `;`, or the danda `।` (U+0964). Several terminators in a row are allowed.

Newlines are ignored while inside `( … )`, `[ … ]` or `{ … }`, so long argument lists and initialisers can span lines. Semicolons are never ignored; inside parentheses they separate the three parts of a C-style `প্ৰতিবাৰ`.

Spaces and tabs separate tokens and are otherwise insignificant. Indentation carries no meaning; blocks end with `শেষ`.

### 2.3 Comments

`#` starts a comment that runs to the end of the line.

```asb
লিখা "ক"   # এইটো মন্তব্য
```

### 2.4 Identifiers

```ebnf
identifier   = ident_start { ident_part } ;
ident_start  = "A"…"Z" | "a"…"z" | "_" | bengali_block_letter ;
ident_part   = ident_start | ascii_digit | assamese_digit | ZWNJ | ZWJ ;
bengali_block_letter = any code point U+0980…U+09FF except U+09E6…U+09EF ;
```

Identifiers may mix Assamese letters, Latin letters, digits and underscores (`ছাত্ৰ_১`, `total2`, `a1`). They cannot start with a digit. Zero-width joiner and non-joiner (U+200D, U+200C) are allowed inside an identifier. Identifiers are case-sensitive and compared after NFC normalisation. A word that matches a keyword (§2.5) is a keyword, not an identifier.

### 2.5 Keywords

Keyword matching is done after NFC, after replacing Bengali র (U+09B0) with Assamese ৰ (U+09F0), and after converting ASCII digits to Assamese digits. So `প্রতিবাৰ` = `প্ৰতিবাৰ` and `পূ32` = `পূ৩২`.

| Keyword | Gloss | Category | C equivalent |
| --- | --- | --- | --- |
| `পূৰ্ণ` | integer | type | `int32_t` |
| `পূ৮` `পূ১৬` `পূ৩২` `পূ৬৪` | signed n-bit integer | type | `int8_t` … `int64_t` |
| `দীঘল` | long | type | `int64_t` |
| `ধ৮` `ধ১৬` `ধ৩২` `ধ৬৪` | unsigned (ধনাত্মক) n-bit integer | type | `uint8_t` … `uint64_t` |
| `দশমিক`, `সংখ্যা` | decimal / number | type | `double` |
| `দশমিক৩২` | 32-bit decimal | type | `float` |
| `আখৰ` | character | type | `char` |
| `বুলিয়ান` | Boolean | type | `bool` |
| `শূন্য` | void | type | `void` |
| `বাক্য` | sentence (string) | type | `char *` |
| `ফাইল` | file | type | `FILE` |
| `কাজ` | work (function) | declaration, type | function |
| `গঠন` | structure | declaration | `struct` |
| `সংযোগ` | union | declaration | `union` |
| `গণনা` | enumeration | declaration | `enum` |
| `প্ৰকাৰ` | type (alias) | declaration | `typedef` |
| `স্থিৰ` | constant | qualifier | `const` |
| `বাহিৰৰ` | external | declaration | `extern` |
| `আমদানি` | import | declaration | — |
| `চি_অন্তৰ্ভুক্ত` | C include | declaration | `#include` |
| `যদি` … `থাকিলে` | if … then | statement | `if` |
| `নহলে` | otherwise | statement | `else` |
| `যেতিয়া` | while | statement | `while` |
| `কৰা` | do | statement | `do` |
| `প্ৰতিবাৰ` | each time | statement | `for` |
| `লৈকে` | up to | statement | — |
| `ক্ৰমে` | in steps of | statement | — |
| `ভাঙা` | break | statement | `break` |
| `আগবাঢ়া` | go ahead | statement | `continue` |
| `বাছক` | choose | statement | `switch` |
| `ক্ষেত্ৰ` | case | statement | `case` |
| `অন্যথা` | otherwise | statement | `default` |
| `উভতি` | return | statement | `return` |
| `শেষ` | end | block terminator | `}` |
| `লিখা` | write | statement | (§8) |
| `দেখুওৱা` | show | statement | (§8) |
| `সত্য` `মিছা` | true, false | literal | `true` `false` |
| `খালি` | empty | literal | `NULL` |
| `আৰু` `বা` `নহয়` | and, or, not | operator | `&&` `\|\|` `!` |
| `হিচাপে` | as | operator | cast |
| `আকাৰ` | size | operator | `sizeof` |
| `নতুন` | new | operator | `calloc` |

### 2.6 Literals

**Integer literals.** A sequence of decimal digits, ASCII `0–9` or Assamese `০–৯`, which may be mixed (`২1` is 21). Underscores between digits are ignored (`১_০০০_০০০`). The prefixes `0x` / `০x` (hexadecimal, digits and `a–f`) and `0b` / `০b` (binary) are supported. A literal has type `পূৰ্ণ` if its value fits in 32 signed bits, otherwise `পূ৬৪`, otherwise `ধ৬৪`; a larger value is an error. A minus sign is a unary operator, not part of the literal.

**Floating literals.** Digits, a `.`, digits, and an optional exponent `e±digits` (`৩.১৪`, `1.5e-3`). Both sides of the point need a digit. Type `দশমিক`.

**String literals.** Text in double quotes, on one line. Adjacent string literals are joined (`"ক" "খ"` is `"কখ"`). Type `বাক্য`. Escapes:

| Escape | Meaning |
| --- | --- |
| `\n` `\t` `\r` `\0` | newline, tab, carriage return, NUL |
| `\\` `\"` `\'` | backslash and quotes |
| `\xHH` | the code point with that hexadecimal value (0–FF) |
| `\u{H…}` | any Unicode code point, 1–6 hex digits |

**Character literals.** Exactly one code point in single quotes, after escapes. An ASCII character (`'A'`, `'\n'`) has type `আখৰ`. Any other code point (`'ক'`) has type `পূৰ্ণ` and the value of the Unicode code point; `লিখা 'ক'` prints the character.

**Boolean and null literals.** `সত্য`, `মিছা`, `খালি`.

### 2.7 Operators and punctuation

```
<<=  >>=  ...  ->  ++  --  +=  -=  *=  /=  %=  &=  |=  ^=  <<  >>  <=  >=  ==  !=  &&  ||
+  -  *  /  %  &  |  ^  ~  !  =  <  >  (  )  [  ]  {  }  ,  .  :  ?
```

The longest matching operator is taken. Any other character outside strings and comments is an error (`অচিনাক্ত চিহ্ন`).

---

## 3. Grammar

The grammar is written in EBNF: `{ x }` is zero or more, `[ x ]` is optional, `|` separates alternatives, terminals are in quotes. `NL` is a statement terminator (§2.2), `IDENT`, `INT`, `FLOAT`, `STRING` and `CHAR` are tokens from §2. Blank lines (`{ NL }`) may appear between any two statements or declarations and are omitted below for readability.

### 3.1 Program and declarations

```ebnf
program        = { top_level } EOF ;
top_level      = import | c_include | function | extern_func | struct_decl
               | enum_decl | type_alias | statement ;

import         = "আমদানি" STRING NL ;
c_include      = "চি_অন্তৰ্ভুক্ত" STRING NL ;

function       = "কাজ" IDENT "(" [ param { "," param } ] ")" [ "->" type ] NL
                   block "শেষ" NL ;
param          = type IDENT ;

extern_func    = "বাহিৰৰ" "কাজ" IDENT "(" [ ext_params ] ")" [ "->" type ]
                   [ "=" STRING ] NL ;
ext_params     = ext_param { "," ext_param } [ "," "..." ] | "..." ;
ext_param      = type [ IDENT ] ;

struct_decl    = ( "গঠন" | "সংযোগ" ) IDENT NL { field NL } "শেষ" NL ;
field          = type IDENT { "," IDENT } ;

enum_decl      = "গণনা" IDENT NL { enum_item ( "," | NL ) } "শেষ" NL ;
enum_item      = IDENT [ "=" expression ] ;

type_alias     = "প্ৰকাৰ" IDENT "=" type NL ;
```

### 3.2 Types

```ebnf
type           = base_type { "*" | dims } ;
base_type      = prim_type | IDENT | func_type ;
prim_type      = "পূৰ্ণ" | "পূ৮" | "পূ১৬" | "পূ৩২" | "পূ৬৪" | "দীঘল"
               | "ধ৮" | "ধ১৬" | "ধ৩২" | "ধ৬৪"
               | "দশমিক" | "সংখ্যা" | "দশমিক৩২"
               | "আখৰ" | "বুলিয়ান" | "শূন্য" | "বাক্য" | "ফাইল" ;
func_type      = "কাজ" "(" [ type [ IDENT ] { "," type [ IDENT ] } ] ")" [ "->" type ] ;
dims           = "[" [ expression ] "]" { "[" [ expression ] "]" } ;
```

Type suffixes are read left to right. `*` makes a pointer to the type so far. A group of consecutive dimensions `[a][b]` makes an array of `a` elements, each an array of `b` elements of the type so far; so `পূৰ্ণ[২][৩]` is two rows of three, indexed `m[r][c]` exactly as in C.

| Written | Meaning |
| --- | --- |
| `পূৰ্ণ*` | pointer to integer |
| `পূৰ্ণ[১০]` | array of 10 integers |
| `পূৰ্ণ*[৪]` | array of 4 pointers to integer |
| `পূৰ্ণ[৪]*` | pointer to an array of 4 integers |
| `বাক্য*` | pointer to string (`char **`) |
| `কাজ(পূৰ্ণ, পূৰ্ণ) -> পূৰ্ণ` | pointer to a function taking two integers and returning one |
| `কাজ(বাক্য)` | pointer to a function returning nothing |

### 3.3 Statements

```ebnf
block          = { statement } ;
statement      = var_decl NL | if_stmt | while_stmt | do_stmt | for_stmt | switch_stmt
               | "ভাঙা" NL | "আগবাঢ়া" NL | "উভতি" [ expression ] NL
               | ( "লিখা" | "দেখুওৱা" ) [ expression { "," expression } ] NL
               | expression NL ;

var_decl       = [ "স্থিৰ" ] type declarator { "," declarator } ;
declarator     = IDENT [ "=" initializer ] ;
initializer    = expression
               | "[" [ initializer { "," initializer } [ "," ] ] "]"
               | brace_init ;
brace_init     = "{" [ field_init { "," field_init } [ "," ] ] "}" ;
field_init     = [ IDENT ":" ] initializer ;

if_stmt        = "যদি" expression "থাকিলে" NL block
                 { "নহলে" "যদি" expression "থাকিলে" NL block }
                 [ "নহলে" NL block ]
                 "শেষ" NL ;
while_stmt     = "যেতিয়া" expression NL block "শেষ" NL ;
do_stmt        = "কৰা" NL block "শেষ" "যেতিয়া" expression NL ;
for_stmt       = "প্ৰতিবাৰ" ( range_for | c_for ) ;
range_for      = [ type ] IDENT "=" expression "লৈকে" expression
                 [ "ক্ৰমে" expression ] NL block "শেষ" NL ;
c_for          = "(" [ var_decl | expression ] ";" [ expression ] ";" [ expression ] ")" NL
                 block "শেষ" NL ;
switch_stmt    = "বাছক" expression NL
                 { "ক্ষেত্ৰ" expression { "," expression } [ ":" ] NL block }
                 [ "অন্যথা" [ ":" ] NL block ]
                 "শেষ" NL ;
```

A whole `যদি … নহলে যদি … নহলে …` chain is closed by **one** `শেষ`.

A line that begins with an identifier is a declaration when it has the shape `type IDENT` followed by `=`, `,` or the end of the statement (for example `বিন্দু p`, `বিন্দু* q = খালি`, `পূৰ্ণ[৩] ক`). Otherwise it is an expression statement (`x = ৫`, `ক(৫)`, `ক[i] = ০`, `i++`).

### 3.4 Expressions

```ebnf
expression     = assignment ;
assignment     = conditional [ assign_op assignment ] ;
assign_op      = "=" | "+=" | "-=" | "*=" | "/=" | "%=" | "&=" | "|=" | "^=" | "<<=" | ">>=" ;
conditional    = binary(1) [ "?" expression ":" conditional ] ;
binary(p)      = cast { binop(q) binary(q + 1) }        (* q ≥ p, left associative *)
cast           = unary { "হিচাপে" type } ;
unary          = ( "-" | "+" | "!" | "নহয়" | "~" | "*" | "&" | "++" | "--" ) unary
               | "আকাৰ" "(" ( type | expression ) ")"
               | postfix ;
postfix        = primary { "(" [ expression { "," expression } ] ")"
                         | "[" expression "]"
                         | ( "." | "->" ) IDENT
                         | "++" | "--" } ;
primary        = INT | FLOAT | STRING { STRING } | CHAR | "সত্য" | "মিছা" | "খালি"
               | IDENT [ brace_init ]
               | "নতুন" "(" type [ "," expression ] ")"
               | "(" expression ")" ;
```

### 3.5 Operator precedence

From tightest to loosest binding:

| Level | Operators | Associativity |
| --- | --- | --- |
| postfix | `()` `[]` `.` `->` `x++` `x--` | left |
| unary | `-` `+` `!`/`নহয়` `~` `*` `&` `++x` `--x` `আকাৰ` | right |
| cast | `হিচাপে` | left |
| 10 | `*` `/` `%` | left |
| 9 | `+` `-` | left |
| 8 | `<<` `>>` | left |
| 7 | `<` `>` `<=` `>=` | left |
| 6 | `==` `!=` | left |
| 5 | `&` | left |
| 4 | `^` | left |
| 3 | `\|` | left |
| 2 | `&&` / `আৰু` | left |
| 1 | `\|\|` / `বা` | left |
| conditional | `? :` | right |
| assignment | `=` `+=` … | right |

`হিচাপে` binds tighter than multiplication: `৭ হিচাপে দশমিক / ২` is `(৭ হিচাপে দশমিক) / ২` = 3.5. In a cast type, a following `*` is read as part of the type, so write `(x হিচাপে পূৰ্ণ) * ২` to multiply. `নহয়` is the same operator as `!` and binds as tightly: `নহয় (১ == ২)` needs the parentheses.

---

## 4. Types

### 4.1 Primitive types

| Keyword | Kind | Size | Range / values | Printed by `লিখা` as |
| --- | --- | --- | --- | --- |
| `পূ৮` | signed integer | 1 byte | −128 … 127 | Assamese digits |
| `পূ১৬` | signed integer | 2 | −32 768 … 32 767 | Assamese digits |
| `পূৰ্ণ`, `পূ৩২` | signed integer | 4 | −2 147 483 648 … 2 147 483 647 | Assamese digits |
| `পূ৬৪`, `দীঘল` | signed integer | 8 | −9.22 × 10¹⁸ … 9.22 × 10¹⁸ | Assamese digits |
| `ধ৮` | unsigned integer | 1 | 0 … 255 | Assamese digits |
| `ধ১৬` | unsigned integer | 2 | 0 … 65 535 | Assamese digits |
| `ধ৩২` | unsigned integer | 4 | 0 … 4 294 967 295 | Assamese digits |
| `ধ৬৪` | unsigned integer | 8 | 0 … 18 446 744 073 709 551 615 | Assamese digits |
| `দশমিক`, `সংখ্যা` | IEEE-754 binary64 | 8 | ≈ ±1.8 × 10³⁰⁸, 15–17 significant digits | up to 15 significant digits |
| `দশমিক৩২` | IEEE-754 binary32 | 4 | ≈ ±3.4 × 10³⁸ | converted to `দশমিক`, then as above |
| `আখৰ` | character (byte) | 1 | one byte; ASCII or one UTF-8 byte | the character |
| `বুলিয়ান` | Boolean | 1 | `সত্য`, `মিছা` | `সত্য` / `মিছা` |
| `শূন্য` | no value | — | — | not printable |
| `ফাইল` | opaque C `FILE` | — | used only as `ফাইল*` | address |

`বাক্য` is a name for `আখৰ*`: a pointer to the first byte of a NUL-terminated UTF-8 string. Assamese text uses three bytes per letter, so `দৈৰ্ঘ্য("অসম")` is 9.

### 4.2 Derived types

- **Pointer** `T*` holds the address of a `T`. `শূন্য*` is a generic pointer. The null pointer is `খালি`.
- **Array** `T[n]` holds `n` consecutive elements; `n` must be a positive integer constant expression (§7.10). In a declaration with an initialiser the size may be omitted (`পূৰ্ণ[] ক = [১, ২]`). In expressions an array converts to a pointer to its first element, except as the operand of `&`, `আকাৰ`, `দৈৰ্ঘ্য` and `লিখা`.
- **Structure** `গঠন` groups named fields; **union** `সংযোগ` overlays them in the same storage. A structure may contain a pointer to itself but not itself by value.
- **Enumeration** `গণনা` declares integer constants and a type that behaves as `পূৰ্ণ`. Members start at 0 and count up by one; `= expr` sets a value and the count continues from it.
- **Function pointer** `কাজ(T…) -> R`. A function name used as a value has function type and converts to a pointer to it.
- **Alias** `প্ৰকাৰ নাম = type` gives an existing type a new name. It does not create a distinct type.

### 4.3 Integer promotion and the usual arithmetic conversions

Before arithmetic, `আখৰ`, `বুলিয়ান`, enumeration types and integers narrower than 32 bits are promoted to `পূৰ্ণ`. For a binary operator on two arithmetic operands:

1. If either is floating, the result is `দশমিক` if either is `দশমিক`, else `দশমিক৩২`.
2. Otherwise, after promotion, if both have the same width the result has that width and is unsigned if either operand is unsigned.
3. Otherwise the result has the type of the wider operand.

These are C's rules for the 32- and 64-bit cases.

### 4.4 Implicit conversions (assignment, initialisation, arguments, return)

A value of type `S` may be stored into a place of type `D` without a cast when:

| D | S | Notes |
| --- | --- | --- |
| any | the same type | — |
| integer, `আখৰ`, `বুলিয়ান`, enum | integer, `আখৰ`, `বুলিয়ান`, enum | an integer **constant** outside D's range is an error |
| floating | any arithmetic type | — |
| integer type | floating | **error**: write `x হিচাপে পূৰ্ণ` |
| `T*` | `T*`, `T[n]` (array decay), `খালি` | — |
| `T*` | `U*` where T or U is `শূন্য` | as in C |
| `T*` | `U*` with T ≠ U | **error**: use `হিচাপে` |
| function pointer | a function with exactly the same parameter and return types | — |
| `বুলিয়ান` | pointer | true when not `খালি` |
| struct / union | the same struct / union | copied by value |
| array | — | arrays cannot be assigned; copy element by element or use `প্ৰতিলিপি` |

### 4.5 Explicit conversion: `হিচাপে`

`expr হিচাপে T` converts between any two arithmetic types (floating to integer truncates toward zero), between pointer types, between pointers and integers, from a function to a function pointer, and to `শূন্য` (discarding the value). Converting a struct, union or array is an error.

---

## 5. Declarations, scope and program structure

### 5.1 Variables

```asb
গঠন বিন্দু
    পূৰ্ণ x, y
শেষ
গঠন ছাত্ৰ
    বাক্য নাম
    পূৰ্ণ নম্বৰ
শেষ

পূৰ্ণ গণক                      # starts at ০
দশমিক পাই = ৩.১৪১৫৯
পূৰ্ণ x = ১, y = x + ১         # several declarators share the type
স্থিৰ পূৰ্ণ সৰ্বোচ্চ = ১০০        # cannot be assigned again
পূৰ্ণ[] মান = [৫, ২, ৯]          # size 3 inferred
আখৰ[৩২] নাম = "অসম"           # a modifiable string buffer
বিন্দু p = {x: ১, y: ২}         # named fields
বিন্দু q = {৩, ৪}               # positional fields
ছাত্ৰ[] শ্ৰেণী = [{"ৰিমা", ৮৮}, {"ৰাহুল", ৭২}]
```

A variable without an initialiser is zero. A `স্থিৰ` variable must be initialised. Array initialisers use `[ … ]`, structure initialisers `{ … }`; they may nest. Missing trailing elements or fields are zero. A string literal may initialise an `আখৰ` array if it fits including the terminating NUL.

### 5.2 Scope

Names live in nested scopes: the global scope, then one scope per function, and a new scope for every block (`যদি` branch, loop body, `বাছক` case, the header of a `প্ৰতিবাৰ`). A name is visible from its declaration to the end of its scope. Declaring the same name twice in one scope is an error; a declaration in an inner scope hides an outer one.

Types, functions, global variables and enumeration constants share the global namespace. The built-in names of §9 are global too and cannot be redeclared at global level.

Functions, structures, unions, enumerations and aliases may be used before their declaration in the file. Function bodies may use any global variable; top-level statements may use only global variables declared above them.

### 5.3 Functions

```asb
কাজ যোগ(পূৰ্ণ a, পূৰ্ণ b) -> পূৰ্ণ
    উভতি a + b
শেষ
```

Parameters are passed by value; structures are copied, arrays are passed as pointers to their first element (a parameter written `পূৰ্ণ[৩] ক` has type `পূৰ্ণ*`). Functions may be recursive and mutually recursive.

**Return type inference.** If `-> type` is omitted, the return type is the type of the expression in the first `উভতি expr` reached while checking the body in source order; with no such statement it is `শূন্য`. A recursive call checked before the first `উভতি expr` is an error asking for an explicit `-> type`. A function with a non-`শূন্য` return type whose body can end without `উভতি` produces a warning.

### 5.4 Program structure and entry point

A program runs in one of two modes:

- **Script mode** (no function named `মূল`): top-level statements run in source order when the program starts. Top-level variable declarations are global variables; a non-constant initialiser runs at the point where the declaration appears.
- **Main mode** (a function `মূল` is declared): only declarations may appear at top level. Non-constant global initialisers run in source order before `মূল` is called. `মূল` takes no parameters or `(পূৰ্ণ n, বাক্য* আৰ্গুমেণ্ট)` — the argument count and the arguments, with `আৰ্গুমেণ্ট[০]` the program name — and returns `পূৰ্ণ` (the process exit status) or `শূন্য` (exit status 0).

In both modes `প্ৰস্থান(n)` ends the program immediately with status `n`.

### 5.5 Modules: `আমদানি`

`আমদানি "path.asb"` includes the declarations of another file. The path is relative to the importing file. Each file is included at most once, however many times it is imported, so circular imports are harmless. An imported file may contain only declarations, including global variables; top-level statements in it are an error.

### 5.6 C interoperability

```asb
বাহিৰৰ কাজ puts(বাক্য) -> পূৰ্ণ                     # C function of the same name
বাহিৰৰ কাজ ঘনমূল(দশমিক) -> দশমিক = "cbrt"            # Assamese name for a C function
বাহিৰৰ কাজ ভুল_লিখা(ফাইল*, বাক্য, ...) -> পূৰ্ণ = "fprintf"   # variadic
চি_অন্তৰ্ভুক্ত "<ctype.h>"                            # emit #include in the generated C
বাহিৰৰ কাজ ডাঙৰ_আখৰ(পূৰ্ণ) -> পূৰ্ণ = "toupper"       # declared by <ctype.h>

puts("C-ৰ puts")
লিখা ঘনমূল(২৭.০), ডাঙৰ_আখৰ('a') হিচাপে আখৰ
```

`বাহিৰৰ কাজ` declares a C function. The string after `=` is its C name; without it the Asomiya name is used. Parameter names are optional. `...` makes the function variadic; extra arguments are checked only for not being structs. If the program has no `চি_অন্তৰ্ভুক্ত` and the function is not declared by the standard C headers the runtime includes, the compiler emits an `extern` prototype; otherwise the header supplies it. Libraries other than the C standard library and `libm` must be linked by building the generated C yourself (`asomiya c prog.asb -o prog.c`, then `cc prog.c -lfoo`).

---

## 6. Statements

**Expression statement.** Evaluates the expression for its effect. It must be an assignment, a call, or `++` / `--`; anything else is an error (`এই বিবৃতিৰ কোনো প্ৰভাৱ নাই`).

**`যদি`.** Evaluates each condition in turn and runs the first block whose condition is true; otherwise the `নহলে` block, if any. A condition may have any scalar type (number, `আখৰ`, `বুলিয়ান`, pointer, array): zero and `খালি` are false. Writing `=` as a condition produces a warning.

**`যেতিয়া`.** Repeats the block while the condition is true, testing before each pass.

**`কৰা … শেষ যেতিয়া c`.** Runs the block, then repeats it while `c` is true.

**Range `প্ৰতিবাৰ`.** `প্ৰতিবাৰ i = a লৈকে b ক্ৰমে s` declares a **new** variable `i`, local to the loop, and runs the block for `i = a, a+s, a+2s, …` while `i ≤ b` (if `s > 0`) or `i ≥ b` (if `s < 0`). The bound `b` and step `s` are evaluated once, before the first pass. The default step is 1, so `প্ৰতিবাৰ i = ৫ লৈকে ১` runs zero times; count down with `ক্ৰমে -১`. The variable's type is the given type, or the usual arithmetic conversion of the types of `a` and `b` (so floating ranges are allowed). A constant step of 0 is an error.

**C-style `প্ৰতিবাৰ`.** `প্ৰতিবাৰ (init; cond; update)` behaves exactly like C's `for`. Variables declared in `init` are local to the loop.

**`বাছক`.** Evaluates an integer, `আখৰ` or enumeration expression and runs the block of the matching `ক্ষেত্ৰ`, or `অন্যথা` if none matches. Case values must be distinct integer constants. Control **never falls through** from one case to the next.

**`ভাঙা`.** Leaves the innermost enclosing loop or `বাছক`. Inside a `বাছক` that is inside a loop, it leaves the `বাছক`, as in C.

**`আগবাঢ়া`.** Skips to the next pass of the innermost loop (for a C-style loop, to its update expression).

**`উভতি`.** Returns from the function, with a value if the function's type is not `শূন্য`. `উভতি` outside a function is an error; use `প্ৰস্থান`.

**`লিখা` / `দেখুওৱা`.** Print their arguments; see §8.

---

## 7. Expressions

### 7.1 Evaluation order

`আৰু` / `&&`, `বা` / `||` and `? :` evaluate their left operand first and evaluate the right operand only when needed (short-circuit). The order in which the operands of other operators and the arguments of a call are evaluated is unspecified, as in C.

### 7.2 Arithmetic

`+ - * /` apply the usual arithmetic conversions. Integer division truncates toward zero (`-৭ / ২` is `-৩`); `%` gives the remainder with the sign of the dividend (`-৭ % ৩` is `-১`) and requires integer operands. Division by a constant zero is a compile-time error; division by zero at run time and signed overflow are undefined behaviour (§12).

### 7.3 Bitwise operators

`& | ^ ~ << >>` require integer operands. Shifts have the promoted type of the left operand.

### 7.4 Comparison and logic

`== != < > <= >=` compare two arithmetic values, or two pointers (or a pointer and `খালি`), and produce `বুলিয়ান`. Comparing two `বাক্য` with `==` compares addresses and produces a warning; use `তুলনা(ক, খ) == ০`. `আৰু`, `বা`, `নহয়` accept any scalar operands and produce `বুলিয়ান`.

### 7.5 Pointers

`&x` gives the address of a variable, array element, field or function. `*p` reads or writes the value a pointer points to; dereferencing `শূন্য*` is an error. `p + n` and `p - n` move by `n` elements; `p - q` between pointers of the same type gives the element distance as `পূ৬৪`. `p[i]` means `*(p + i)`. `p->f` means `(*p).f`. Using `.` on a pointer, or `->` on a non-pointer, is an error that suggests the right operator.

### 7.6 Strings

`বাক্য` values cannot be joined with `+`; adding a string literal to anything is an error. Use `লিখা ক, খ` to print several values, or `যোগ_বাক্য(ক, খ)` to build a new heap string.

### 7.7 Assignment

`x = v` stores `v` into `x` (§4.4) and has the stored value, so `a = b = ৫` works. `x op= v` is `x = x op v` with `x` evaluated once. The left side must be a variable, array element, field or `*pointer`; it may not be a `স্থিৰ` variable or a whole array.

### 7.8 `আকাৰ`, `দৈৰ্ঘ্য`, `নতুন`

- `আকাৰ(T)` or `আকাৰ(expr)` gives the size in bytes, as `পূ৬৪`. The expression is not evaluated.
- `দৈৰ্ঘ্য(x)` gives, as `পূ৬৪`: for an array other than `আখৰ[]`, its number of elements (a constant); for `বাক্য` or `আখৰ[]`, the number of bytes before the terminating NUL.
- `নতুন(T)` allocates one zero-filled `T` on the heap and returns `T*`; `নতুন(T, n)` allocates `n` of them. Free the memory with `মুকলি(p)`. On failure the result is `খালি`.

### 7.9 Structure literals

`নাম{…}` creates a temporary structure value: `বিন্দু{৭, ৮}.y`, `উভতি বিন্দু{x: ০, y: ০}`.

### 7.10 Constant expressions

Integer constant expressions are needed for array sizes, enumeration values and case labels. They are built from integer, character and Boolean literals, enumeration constants, `স্থিৰ` integer variables with constant initialisers, unary `- + ~ !`, the binary arithmetic, bitwise, comparison and logical operators, and casts to integer types. Global variables are statically initialised when their initialiser is a constant expression, a floating literal, a string literal, `খালি`, a function name, or a `[…]` / `{…}` list of these.

---

## 8. Output formatting

`লিখা a, b, …` prints each argument, separated by one space, followed by a newline. `লিখা` with no arguments prints an empty line. `দেখুওৱা a, b, …` is the same but ends with a space instead of a newline, so repeated calls build one line.

| Type | Printed as |
| --- | --- |
| integers, enumerations | decimal with Assamese digits: `-১২৩` |
| `দশমিক`, `দশমিক৩২` | C `%.15g` with Assamese digits: `০.৩`, `৩.১৪১৫৯`, `১e+২০`; NaN as `অসংখ্যা`, infinity as `অসীম` / `-অসীম` |
| `বুলিয়ান` | `সত্য` or `মিছা` |
| `আখৰ` | the byte itself |
| non-ASCII character literal | the character (`লিখা 'ক'` → `ক`) |
| `বাক্য`, `আখৰ[]` | the text; a `খালি` string prints `খালি` |
| other pointers | the address in hexadecimal, or `খালি` |
| other arrays | `[১, ২, ৩]`, nested for multi-dimensional arrays |
| structures | `{x: ১, y: ২}` with field names, nested |
| unions, `শূন্য`, functions | compile-time error |

The `--ascii-digits` compiler option prints ASCII digits `0–9` instead. `ছপা(format, …)` is C's `printf`, unaffected by this table: it prints whatever the format string says, with ASCII digits.

---

## 9. Standard library

All of these are declared automatically. They are ordinary C or runtime functions.

### 9.1 Input and conversion

| Function | Type | Meaning | C |
| --- | --- | --- | --- |
| `পঢ়া()` | `-> বাক্য` | read one line from standard input (heap string without the newline; `খালি` at end of input) | runtime |
| `পঢ়া_পূৰ্ণ()` | `-> পূ৬৪` | read a line and convert it to an integer; Assamese digits accepted | runtime |
| `পঢ়া_দশমিক()` | `-> দশমিক` | read a line and convert it to a decimal | runtime |
| `সংখ্যালৈ(বাক্য)` | `-> পূ৬৪` | text to integer; Assamese digits accepted | runtime |
| `দশমিকলৈ(বাক্য)` | `-> দশমিক` | text to decimal | runtime |
| `বাক্যলৈ(পূ৬৪)` | `-> বাক্য` | integer to a heap string with Assamese digits | runtime |
| `ছপা(বাক্য ধৰণ, ...)` | `-> পূৰ্ণ` | formatted output | `printf` |

### 9.2 Memory

| Function | Type | C |
| --- | --- | --- |
| `সংৰক্ষণ(ধ৬৪ n)` | `-> শূন্য*` | `malloc` |
| `পুনৰ_সংৰক্ষণ(শূন্য* p, ধ৬৪ n)` | `-> শূন্য*` | `realloc` |
| `মুকলি(শূন্য* p)` | — | `free` |
| `প্ৰতিলিপি(শূন্য* গন্তব্য, শূন্য* উৎস, ধ৬৪ n)` | `-> শূন্য*` | `memcpy` |
| `ভৰোৱা(শূন্য* p, পূৰ্ণ মান, ধ৬৪ n)` | `-> শূন্য*` | `memset` |

### 9.3 Strings

| Function | Type | Meaning | C |
| --- | --- | --- | --- |
| `দৈৰ্ঘ্য(x)` | `-> পূ৬৪` | built-in, see §7.8 | — |
| `বাক্য_দৈৰ্ঘ্য(বাক্য)` | `-> পূ৬৪` | bytes before the NUL | `strlen` |
| `আখৰ_সংখ্যা(বাক্য)` | `-> পূ৬৪` | number of Unicode code points | runtime |
| `তুলনা(বাক্য, বাক্য)` | `-> পূৰ্ণ` | <0, 0, >0 by byte order | `strcmp` |
| `বাক্য_প্ৰতিলিপি(বাক্য)` | `-> বাক্য` | heap copy | runtime |
| `যোগ_বাক্য(বাক্য, বাক্য)` | `-> বাক্য` | new heap string ক + খ | runtime |

### 9.4 Mathematics (`দশমিক` in, `দশমিক` out)

`বৰ্গমূল` (sqrt), `ঘাত(x, y)` (pow), `পৰম` (fabs), `ছাইন` (sin), `কছাইন` (cos), `টেন` (tan), `লগ` (natural log), `লগ১০` (log10), `তল` (floor), `ওপৰ` (ceil), `ঘূৰণীয়া` (round, halves away from zero).

### 9.5 Process, time and random numbers

| Function | Type | C |
| --- | --- | --- |
| `প্ৰস্থান(পূৰ্ণ)` | — | `exit` |
| `যাদৃচ্ছিক()` | `-> পূৰ্ণ` | `rand` |
| `বীজ(ধ৩২)` | — | `srand` |
| `সময়()` | `-> পূ৬৪` | `time(NULL)` |

### 9.6 Files

| Function | Type | C |
| --- | --- | --- |
| `খোলা(বাক্য পথ, বাক্য ধৰণ)` | `-> ফাইল*` (`খালি` on failure) | `fopen` |
| `বন্ধ(ফাইল*)` | `-> পূৰ্ণ` | `fclose` |
| `ফাইলত_লিখা(ফাইল*, বাক্য)` | `-> পূৰ্ণ` | `fputs` |
| `ফাইলত_ছপা(ফাইল*, বাক্য ধৰণ, ...)` | `-> পূৰ্ণ` | `fprintf` |
| `ফাইলৰ_শাৰী(ফাইল*)` | `-> বাক্য` (`খালি` at end) | runtime |

Strings returned by `পঢ়া`, `ফাইলৰ_শাৰী`, `বাক্যলৈ`, `বাক্য_প্ৰতিলিপি` and `যোগ_বাক্য` are on the heap; free them with `মুকলি`.

---

## 10. Translation to C

This section is informative: it describes how the reference compiler works, not requirements on programs.

- The output is one C11 file: a header comment, the runtime (§9 helpers, all `static inline`), `#include`s from `চি_অন্তৰ্ভুক্ত`, `typedef`s for structures and unions, enumerations, structure bodies in dependency order, `extern` prototypes, function prototypes, globals, function bodies, and `main`.
- Every user name `x` becomes `a_x`, so it can never clash with a C keyword or library name. Assamese letters stay as UTF-8 (gcc ≥ 10 and clang accept them); `--ascii-names` writes `_uXXXX_` instead. External functions keep their C names.
- User functions are `static`. `main` initialises globals, runs the script statements or calls `a_মূল`, and returns the exit status.
- Each `লিখা` becomes calls to `asb_rt_print_*` chosen by the static type of each argument.
- Range loops become `for (T i = a, end = b; i <= end; i += s)`.
- The C compiler is called as `cc -std=c11 -O2 prog.c -lm` (`-O` and `-g` follow the command-line options).

```text
$ asomiya c examples/hello.asb | tail -12
int main(int argc, char **argv) {
    (void)argc; (void)argv;
    asb_rt_print_str("নমস্কাৰ বিশ্ব!");
    asb_rt_nl();
    …
```

---

## 11. Diagnostics

Every message gives `file:line:column`, the severity (`ত্ৰুটি` error, `সতৰ্কবাণী` warning), the message, the source line and a caret under the column. All errors in a file are reported together; a parse error stops at the first one. An expression that already produced an error does not produce follow-on errors.

### 11.1 Lexical and syntax errors

| Message (Assamese) | Meaning |
| --- | --- |
| `অচিনাক্ত চিহ্ন 'X' (U+XXXX)` | a character that is not part of the language |
| `বাক্য (string) বন্ধ কৰা হোৱা নাই` | string without its closing `"` on the same line |
| `'...'-ৰ ভিতৰত ঠিক এটা আখৰ থাকিব লাগে` | character literal with zero or several code points |
| `অচিনাক্ত escape '\X'` | unsupported escape sequence |
| `X প্ৰত্যাশিত, কিন্তু Y পোৱা গ'ল` | expected X, found Y |
| `'থাকিলে' প্ৰত্যাশিত (যদি ... থাকিলে)` | `যদি` without `থাকিলে` |
| `… block বন্ধ কৰিবলৈ 'শেষ' নাই` | a block runs to the end of the file (reported at the line that opened it) |
| `অপ্ৰত্যাশিত 'শেষ' — ইয়াৰ আগত কোনো block খোলা হোৱা নাই` | an extra `শেষ` |
| `বিবৃতিৰ শেষত শাৰী সলনি হ'ব লাগিছিল` | two statements on one line without `;` |
| `কাজৰ ভিতৰত আন কাজ ঘোষণা কৰিব নোৱাৰি` | nested function |

### 11.2 Semantic errors

| Message (Assamese) | Meaning |
| --- | --- |
| `অপৰিভাষিত নাম 'x' — আপুনি 'y' বুজাইছিল নেকি?` | unknown name, with the closest known name |
| `'x' এই পৰিসৰত … আগতেই ঘোষণা কৰা হৈছে` | duplicate declaration in one scope |
| `'S' মান 'D'-লৈ দিব নোৱাৰি` | value of type S cannot be stored as D (§4.4), with a hint |
| `দশমিকৰ পৰা পূৰ্ণলৈ নিবলৈ 'হিচাপে' লিখক` | float to integer needs a cast |
| `মান N 'T'-ৰ সীমাৰ (… … …) বাহিৰত` | constant outside the target type's range |
| `'op' 'A' আৰু 'B'-ৰ মাজত ব্যৱহাৰ কৰিব নোৱাৰি` | operator not defined for these types |
| `বাক্য '+' দি জোৰা নাযায়` | string concatenation with `+` |
| `'f'-এ Nটা আৰ্গুমেণ্ট লয়, কিন্তু Mটা দিয়া হৈছে` | wrong number of arguments |
| `এই বিবৃতিৰ কোনো প্ৰভাৱ নাই` | expression statement with no effect |
| `'P*' এটা সূচক; '.'-ৰ সলনি '->' লিখক` (and the reverse) | wrong member operator |
| `'S'-ত 'f' নামৰ ক্ষেত্ৰ নাই — আছে: …` | unknown field, listing the real ones |
| `'x' স্থিৰ; ইয়াৰ মান সলনি কৰিব নোৱাৰি` | assignment to a constant |
| `সূচী N তালিকাৰ সীমাৰ (০ … M) বাহিৰত` | constant index out of bounds |
| `শূন্যৰে হৰণ কৰিব নোৱাৰি` | division by constant zero |
| `তালিকাৰ আকাৰ এটা স্থিৰ পূৰ্ণ সংখ্যা হ'ব লাগিব` | non-constant array size |
| `'ভাঙা' কেৱল loop বা বাছকৰ ভিতৰত …`, `'আগবাঢ়া' কেৱল loop-ৰ ভিতৰত …` | misplaced break or continue |
| `'উভতি' কেৱল কাজৰ ভিতৰত …` | return outside a function |
| `'f'-ৰ ফেৰত প্ৰকাৰ এতিয়াও জনা নাই; … '-> প্ৰকাৰ' লিখক` | inference needs an explicit return type |
| `'S' নিজকেই মান হিচাপে ধাৰণ কৰে …; সূচক (*) ব্যৱহাৰ কৰক` | recursive struct by value |
| `ক্ষেত্ৰ N দুবাৰ আছে` | duplicate case label |
| `'মূল' কাজ থাকিলে শীৰ্ষ স্তৰত কেৱল ঘোষণা থাকিব পাৰে` | top-level statement in main mode |
| `আমদানি কৰা ফাইলত কেৱল ঘোষণা থাকিব পাৰে` | statement in an imported file |
| `সংযোগ 'U' গোটেইটো লিখিব নোৱাৰি` | printing a union |

### 11.3 Warnings

| Message | Meaning |
| --- | --- |
| `চৰ্তৰ ভিতৰত '=' আছে; তুলনাৰ বাবে '==' লিখক` | assignment used as a condition |
| `দুটা বাক্যৰ '==' তুলনাই ঠিকনা তুলনা কৰে …` | comparing string addresses |
| `'f' কাজৰ সকলো পথে মান ঘূৰাই নিদিয়ে` | a non-`শূন্য` function can end without returning |

If the C compiler fails on generated code, the CLI prints its output under `C কম্পাইলাৰ (cc) বিফল হ'ল`; that indicates a compiler bug and should be reported.

---

## 12. Undefined behaviour and differences from C

Asomiya Bhasha 2.0 inherits C's run-time model. The following are **not** checked at run time and have undefined behaviour, exactly as in C: reading or writing outside an array or allocation, dereferencing `খালি` or a freed pointer, freeing twice, signed integer overflow, integer division by zero, shifting by a negative amount or by at least the width of the type, and reading a union field other than the one last written (the reference compiler gives C's result).

Differences from C, all compile-time:

| C | Asomiya Bhasha 2.0 |
| --- | --- |
| uninitialised locals hold garbage | every variable starts at zero |
| `double` → `int` converts silently | requires `হিচাপে` |
| `x + 1;` is allowed | error: statement has no effect |
| `switch` cases fall through | no fall-through |
| `"a" + 1` is pointer arithmetic | error: strings are not joined with `+` |
| constant out-of-range values truncate | error |
| constant out-of-bounds index compiles | error |
| `goto`, labels, the preprocessor, bit-fields, VLAs, `static` locals | not provided |
| `sizeof` gives `size_t` | `আকাৰ` gives `পূ৬৪` |
| nested functions (GNU) | not allowed |
| `char` literal `'ক'` is an error | it is the code point, type `পূৰ্ণ` |

Planned additions are listed in [roadmap.md](roadmap.md).
__ASOMIYA_BHASHA_EOF__

cat > "docs/syntax.md" <<'__ASOMIYA_BHASHA_EOF__'
# অসমীয়া ভাষা ২.০ — শিকিবলৈ সহায় (Tutorial)

এই গাইডত ভাষাটোৰ মূল কথাবোৰ উদাহৰণসহ দিয়া হৈছে। সম্পূৰ্ণ নিয়ম আৰু ব্যাকৰণ (grammar) [spec.md](spec.md)-ত আছে।

প্ৰতিটো উদাহৰণ এটা `.asb` ফাইলত save কৰি চলাওক:

```bash
node src/cli.js মোৰ_প্ৰ'গ্ৰাম.asb
```

## ১. প্ৰথম প্ৰ'গ্ৰাম

```asb
লিখা "নমস্কাৰ বিশ্ব!"
```

`লিখা`-এ মানবোৰ space দি লিখে আৰু শেষত নতুন শাৰী দিয়ে। সংখ্যা অসমীয়া অংকত ওলায়:

```asb
লিখা "যোগফল:", ২ + ৩        # যোগফল: ৫
দেখুওৱা "ক"                  # নতুন শাৰী নিদিয়াকৈ
দেখুওৱা "খ"
লিখা                          # ক খ
```

`#`-ৰ পিছৰ লেখা মন্তব্য (comment)।

## ২. চলক আৰু প্ৰকাৰ (variables and types)

প্ৰতিটো চলকৰ প্ৰকাৰ লিখিব লাগে। মান নিদিলে চলক শূন্যৰে আৰম্ভ হয়।

```asb
পূৰ্ণ বয়স = ২৮            # ৩২-বিট পূৰ্ণ সংখ্যা
পূ৬৪ জনসংখ্যা = ৩১২০৫৫৭৬   # ৬৪-বিট
দশমিক উচ্চতা = ১.৭৫
বুলিয়ান ছাত্ৰ = সত্য
বাক্য নাম = "অসম"
আখৰ বৰ্ণ = 'A'
স্থিৰ পূৰ্ণ সৰ্বোচ্চ = ১০০   # সলনি কৰিব নোৱাৰি
পূৰ্ণ গণক                  # ০
```

| প্ৰকাৰ | কি ৰাখে |
| --- | --- |
| `পূৰ্ণ`, `পূ৮`, `পূ১৬`, `পূ৩২`, `পূ৬৪` | চিহ্নযুক্ত পূৰ্ণ সংখ্যা |
| `ধ৮`, `ধ১৬`, `ধ৩২`, `ধ৬৪` | চিহ্নহীন (০ বা ধনাত্মক) পূৰ্ণ সংখ্যা |
| `দশমিক`, `দশমিক৩২` | দশমিক সংখ্যা |
| `বুলিয়ান` | `সত্য` বা `মিছা` |
| `আখৰ` | এটা বাইট (ASCII আখৰ) |
| `বাক্য` | লেখা (string) |

দশমিকক পূৰ্ণলৈ নিবলৈ `হিচাপে` লিখক:

```asb
দশমিক উষ্ণতা = ৩৬.৬
পূৰ্ণ গোটা = উষ্ণতা হিচাপে পূৰ্ণ    # ৩৬
লিখা ৭ / ২, ৭ হিচাপে দশমিক / ২      # ৩ ৩.৫
```

## ৩. গণনা আৰু তুলনা

```asb
লিখা ১৭ + ৫, ১৭ - ৫, ১৭ * ৫, ১৭ / ৫, ১৭ % ৫   # ২২ ১২ ৮৫ ৩ ২
লিখা ৫ > ৩, ৫ == ৩, ৫ != ৩                     # সত্য মিছা সত্য
লিখা সত্য আৰু মিছা, সত্য বা মিছা, নহয় সত্য      # মিছা সত্য মিছা
পূৰ্ণ x = ১০
x += ৫         # x = x + ৫
x++            # x = x + ১
```

## ৪. চৰ্ত (conditions)

```asb
পূৰ্ণ নম্বৰ = ৮২
যদি নম্বৰ >= ৯০ থাকিলে
    লিখা "এ+"
নহলে যদি নম্বৰ >= ৭৫ থাকিলে
    লিখা "এ"
নহলে
    লিখা "বি"
শেষ
```

গোটেই `যদি … নহলে যদি … নহলে` এটা `শেষ`-ৰে বন্ধ হয়।

এটা মানৰ বহুতো সম্ভাৱনা থাকিলে `বাছক`:

```asb
পূৰ্ণ দিন = ৩
বাছক দিন
    ক্ষেত্ৰ ১, ৭
        লিখা "সপ্তাহান্ত"
    ক্ষেত্ৰ ২, ৩, ৪, ৫, ৬
        লিখা "কামৰ দিন"
    অন্যথা
        লিখা "ভুল দিন"
শেষ
```

সৰু চৰ্তৰ বাবে `?:` — `লিখা x % ২ == ০ ? "যুগ্ম" : "অযুগ্ম"`

## ৫. লুপ (loops)

```asb
পূৰ্ণ i = ১
যেতিয়া i <= ৩              # চৰ্ত সত্য হৈ থকালৈকে
    লিখা i
    i++
শেষ

প্ৰতিবাৰ k = ১ লৈকে ৫          # ১, ২, ৩, ৪, ৫
    দেখুওৱা k
শেষ
লিখা

প্ৰতিবাৰ k = ১০ লৈকে ০ ক্ৰমে -২   # ১০, ৮, ৬, ৪, ২, ০
    দেখুওৱা k
শেষ
লিখা

প্ৰতিবাৰ (পূৰ্ণ j = ০; j < ৩; j++)   # C-ৰ দৰে
    দেখুওৱা j
শেষ
লিখা

কৰা                                 # অন্ততঃ এবাৰ চলে
    i--
শেষ যেতিয়া i > ০
```

`ভাঙা`-এ loop-ৰ পৰা ওলাই যায়, `আগবাঢ়া`-এ পৰৱৰ্তী পাকলৈ যায়।

## ৬. কাজ (functions)

```asb
কাজ যোগ(পূৰ্ণ a, পূৰ্ণ b) -> পূৰ্ণ
    উভতি a + b
শেষ

কাজ নমস্কাৰ_দিয়া(বাক্য নাম)        # একো ঘূৰাই নিদিয়ে
    লিখা "নমস্কাৰ,", নাম
শেষ

লিখা যোগ(২, ৩)
নমস্কাৰ_দিয়া("ৰিমা")
```

`-> প্ৰকাৰ` নিদিলে প্ৰথম `উভতি`-ৰ মানৰ পৰা প্ৰকাৰ বুজি লোৱা হয়। নিজকে মতা (recursive) কাজত প্ৰকাৰটো লিখি দিয়াই ভাল:

```asb
কাজ ফেক্ট(পূ৬৪ n) -> পূ৬৪
    যদি n <= ১ থাকিলে
        উভতি ১
    শেষ
    উভতি n * ফেক্ট(n - ১)
শেষ
```

## ৭. তালিকা (arrays)

```asb
পূৰ্ণ[] মান = [৫, ২, ৯]          # আকাৰ ৩
পূৰ্ণ[১০] খালি_তালিকা              # ১০টা ০
মান[১] = ৭
লিখা মান, দৈৰ্ঘ্য(মান)            # [৫, ৭, ৯] ৩

পূৰ্ণ[২][৩] m = [[১, ২, ৩], [৪, ৫, ৬]]
লিখা m[১][২]                      # ৬

বাক্য[] ফল = ["আম", "কল"]
```

তালিকাৰ সূচী (index) ০ৰ পৰা আৰম্ভ হয়।

## ৮. সূচক আৰু স্মৃতি (pointers and memory)

সূচকে আন এটা মানৰ ঠিকনা ৰাখে। `&x` = x-ৰ ঠিকনা, `*p` = p-এ দেখুওৱা মান।

```asb
কাজ সলনি(পূৰ্ণ* ক, পূৰ্ণ* খ)
    পূৰ্ণ t = *ক
    *ক = *খ
    *খ = t
শেষ

পূৰ্ণ a = ৩, b = ৭
সলনি(&a, &b)
লিখা a, b                      # ৭ ৩

পূৰ্ণ* তালিকা = নতুন(পূৰ্ণ, ১০০)   # heap-ত ১০০টা পূৰ্ণ
তালিকা[৯৯] = ৫
মুকলি(তালিকা)                   # কাম শেষ হ'লে মুক্ত কৰক
```

## ৯. গঠন, সংযোগ আৰু গণনা

```asb
গঠন বিন্দু
    পূৰ্ণ x, y
শেষ

বিন্দু p = {x: ১, y: ২}
বিন্দু* q = &p
q->y = ৫                         # সূচকৰ পৰা: ->
লিখা p, p.x                      # {x: ১, y: ৫} ১

গণনা ৰং
    ৰঙা
    সেউজীয়া
    নীলা
শেষ
ৰং এটা = নীলা                    # ২
```

## ১০. ইনপুট আৰু ফাইল

```asb
দেখুওৱা "নাম কি?"
বাক্য নাম = পঢ়া()
দেখুওৱা "বয়স?"
পূ৬৪ বয়স = পঢ়া_পূৰ্ণ()          # অসমীয়া বা ASCII অংক দুয়োটা চলে
লিখা নাম, বয়স + ১

ফাইল* f = খোলা("টোকা.txt", "w")
ফাইলত_লিখা(f, "নমস্কাৰ\n")
বন্ধ(f)
```

## ১১. আন ফাইল আৰু C লাইব্ৰেৰী

```asb
আমদানি "lib/geometry.asb"          # আন .asb ফাইলৰ ঘোষণা
বাহিৰৰ কাজ abs(পূৰ্ণ) -> পূৰ্ণ         # C-ৰ কাজ
লিখা abs(-৫)
```

## ১২. ডাঙৰ প্ৰ'গ্ৰাম: `মূল`

শীৰ্ষ স্তৰৰ বিবৃতিৰ সলনি `মূল` কাজ লিখিব পাৰি; তেতিয়া command-line আৰ্গুমেণ্ট পোৱা যায়:

```asb
কাজ মূল(পূৰ্ণ মুঠ, বাক্য* আৰ্গুমেণ্ট) -> পূৰ্ণ
    প্ৰতিবাৰ i = ১ লৈকে মুঠ - ১
        লিখা আৰ্গুমেণ্ট[i]
    শেষ
    উভতি ০
শেষ
```

```bash
node src/cli.js prog.asb -- ক খ
```

## ১৩. সাধাৰণ ভুল

| ভুল | শুদ্ধ |
| --- | --- |
| `লিখা "ফল: " + x` | `লিখা "ফল:", x` |
| `পূৰ্ণ i = ২.৫` | `পূৰ্ণ i = ২.৫ হিচাপে পূৰ্ণ` বা `দশমিক i = ২.৫` |
| `যদি x > ৫` (থাকিলে নাই) | `যদি x > ৫ থাকিলে` |
| `p.x` (p সূচক) | `p->x` |
| `যদি a == "হয়" থাকিলে` (বাক্য) | `যদি তুলনা(a, "হয়") == ০ থাকিলে` |

কম্পাইলাৰে প্ৰতিটো ভুলত শাৰী, স্তম্ভ আৰু `^` চিন দি দেখুৱায়।
__ASOMIYA_BHASHA_EOF__

cat > "examples/arrays.asb" <<'__ASOMIYA_BHASHA_EOF__'
# তালিকা (array): এক আৰু দুই মাত্ৰা
পূৰ্ণ[] মান = [৫, ২, ৯, ১, ৭]
লিখা "মূল:", মান
পূৰ্ণ n = দৈৰ্ঘ্য(মান)
প্ৰতিবাৰ i = ১ লৈকে n - ১          # insertion sort
    পূৰ্ণ চাবি = মান[i]
    পূৰ্ণ j = i - ১
    যেতিয়া j >= ০ আৰু মান[j] > চাবি
        মান[j + ১] = মান[j]
        j--
    শেষ
    মান[j + ১] = চাবি
শেষ
লিখা "সজোৱা:", মান

# ২×৩ আৰু ৩×২ matrix-ৰ পূৰণ
পূৰ্ণ[২][৩] ক = [[১, ২, ৩], [৪, ৫, ৬]]
পূৰ্ণ[৩][২] খ = [[৭, ৮], [৯, ১০], [১১, ১২]]
পূৰ্ণ[২][২] গ
প্ৰতিবাৰ r = ০ লৈকে ১
    প্ৰতিবাৰ c = ০ লৈকে ১
        প্ৰতিবাৰ k = ০ লৈকে ২
            গ[r][c] += ক[r][k] * খ[k][c]
        শেষ
    শেষ
শেষ
লিখা "পূৰণফল:", গ

বাক্য[] ফল = ["আম", "কল", "লিচু", "কমলা"]
প্ৰতিবাৰ i = ০ লৈকে দৈৰ্ঘ্য(ফল) - ১
    লিখা i + ১, ফল[i]
শেষ
__ASOMIYA_BHASHA_EOF__

cat > "examples/catalog.js" <<'__ASOMIYA_BHASHA_EOF__'
'use strict';
/**
 * 100 graded sample programs for Asomiya Bhasha 2.0 (10 categories × 10).
 * Each sample carries the exact output a native run must print; the test
 * suite compiles and runs every one of them.
 */

const as = v => String(v).replace(/[0-9]/g, d => String.fromCodePoint(0x09E6 + Number(d)));
const samples = [];
const add = (category, title, code, expected) => samples.push({ id: samples.length + 1, category, title, code, expected });

const CATEGORIES = {
    printing: 'লিখা (output)', variables: 'চলক আৰু প্ৰকাৰ', arithmetic: 'গণনা', logic: 'তুলনা আৰু লজিক',
    conditions: 'চৰ্ত', loops: 'লুপ', functions: 'কাজ', arrays: 'তালিকা', pointers: 'সূচক আৰু স্মৃতি', structs: 'গঠন',
};

// 1. Printing
['নমস্কাৰ', 'স্বাগতম', 'শুভদিন', 'শুভসন্ধ্যা', 'শুভৰাত্ৰি'].forEach((m, k) =>
    add('printing', `লিখা ${as(k + 1)}`, `লিখা "${m}, অসম!"`, `${m}, অসম!\n`));
[[2026, 'বছৰ'], [100, 'নম্বৰ'], [42, 'উত্তৰ'], [7, 'দিন'], [365, 'দিনত এবছৰ']].forEach(([n, w], k) =>
    add('printing', `লিখা ${as(k + 6)}`, `লিখা "${w}:", ${as(n)}\nলিখা ${as(n)}, "+ ১ =", ${as(n)} + ১`, `${w}: ${as(n)}\n${as(n)} + ১ = ${as(n + 1)}\n`));

// 2. Variables and types
[['পূৰ্ণ', 'বয়স', 28, as(28)], ['পূ৬৪', 'জনসংখ্যা', 31205576, as(31205576)], ['দশমিক', 'উচ্চতা', 1.75, as('1.75')], ['বুলিয়ান', 'ছাত্ৰ', 'সত্য', 'সত্য'], ['বাক্য', 'চহৰ', '"গুৱাহাটী"', 'গুৱাহাটী']]
    .forEach(([t, n, v, out], k) => add('variables', `চলক ${as(k + 1)}`, `${t} ${n} = ${typeof v === 'number' ? as(v) : v}\nলিখা "${n} =", ${n}`, `${n} = ${out}\n`));
[3, 8, 15, 21, 40].forEach((n, k) => add('variables', `চলক ${as(k + 6)}`,
    `পূৰ্ণ ক = ${as(n)}\nক = ক * ২\nক += ৫\nস্থিৰ পূৰ্ণ সৰ্বোচ্চ = ১০০\nলিখা ক, সৰ্বোচ্চ - ক`, `${as(n * 2 + 5)} ${as(100 - (n * 2 + 5))}\n`));

// 3. Arithmetic
[[20, 6], [45, 7], [100, 9], [17, 4], [81, 9]].forEach(([a, b], k) => add('arithmetic', `গণনা ${as(k + 1)}`,
    `পূৰ্ণ a = ${as(a)}, b = ${as(b)}\nলিখা a + b, a - b, a * b\nলিখা "ভাগফল:", a / b, "ভাগশেষ:", a % b`,
    `${as(a + b)} ${as(a - b)} ${as(a * b)}\nভাগফল: ${as(Math.trunc(a / b))} ভাগশেষ: ${as(a % b)}\n`));
[[7, 2], [10, 4], [1, 3], [22, 7], [9, 8]].forEach(([a, b], k) => {
    const q = a / b;
    add('arithmetic', `গণনা ${as(k + 6)}`, `দশমিক ফল = ${as(a)} হিচাপে দশমিক / ${as(b)}\nলিখা ফল\nলিখা ঘূৰণীয়া(ফল * ১০০) / ১০০`,
        `${as(Number(q.toPrecision(15)))}\n${as(Math.round(q * 100) / 100)}\n`);
});

// 4. Comparison and logic
[[5, 3], [4, 4], [2, 9], [10, 10], [7, 1]].forEach(([a, b], k) => add('logic', `তুলনা ${as(k + 1)}`,
    `পূৰ্ণ a = ${as(a)}, b = ${as(b)}\nলিখা a > b, a == b, a != b, a <= b`,
    `${[a > b, a === b, a !== b, a <= b].map(x => (x ? 'সত্য' : 'মিছা')).join(' ')}\n`));
[[true, true], [true, false], [false, true], [false, false], [true, true]].forEach(([p, q], k) => {
    const b = x => (x ? 'সত্য' : 'মিছা');
    add('logic', `লজিক ${as(k + 6)}`, `বুলিয়ান p = ${b(p)}, q = ${b(q)}\nলিখা p আৰু q, p বা q, নহয় p`, `${b(p && q)} ${b(p || q)} ${b(!p)}\n`);
});

// 5. Conditions
[95, 82, 67, 45, 75].forEach((m, k) => {
    const g = m >= 90 ? 'এ+' : m >= 75 ? 'এ' : m >= 60 ? 'বি' : 'চি';
    add('conditions', `গ্ৰেড ${as(k + 1)}`, `পূৰ্ণ নম্বৰ = ${as(m)}\nযদি নম্বৰ >= ৯০ থাকিলে\n    লিখা "এ+"\nনহলে যদি নম্বৰ >= ৭৫ থাকিলে\n    লিখা "এ"\nনহলে যদি নম্বৰ >= ৬০ থাকিলে\n    লিখা "বি"\nনহলে\n    লিখা "চি"\nশেষ`, `${g}\n`);
});
[1, 4, 6, 7, 3].forEach((d, k) => {
    const days = ['', 'দেওবাৰ', 'সোমবাৰ', 'মঙলবাৰ', 'বুধবাৰ', 'বৃহস্পতিবাৰ', 'শুকুৰবাৰ', 'শনিবাৰ'];
    add('conditions', `বাছক ${as(k + 6)}`,
        `পূৰ্ণ দিন = ${as(d)}\nবাছক দিন\n${days.slice(1).map((n, i) => `    ক্ষেত্ৰ ${as(i + 1)}\n        লিখা "${n}"`).join('\n')}\n    অন্যথা\n        লিখা "ভুল দিন"\nশেষ`,
        `${days[d]}\n`);
});

// 6. Loops
[5, 10, 20, 50, 100].forEach((n, k) => add('loops', `যোগফল ${as(k + 1)}`,
    `পূৰ্ণ যোগফল = ০\nপূৰ্ণ i = ১\nযেতিয়া i <= ${as(n)}\n    যোগফল += i\n    i++\nশেষ\nলিখা "১ ৰ পৰা ${as(n)} লৈ যোগফল:", যোগফল`,
    `১ ৰ পৰা ${as(n)} লৈ যোগফল: ${as((n * (n + 1)) / 2)}\n`));
[[2, 5], [3, 4], [5, 3], [7, 5], [9, 3]].forEach(([t, rows], k) => {
    let out = '';
    for (let i = 1; i <= rows; i++) out += `${as(t)} × ${as(i)} = ${as(t * i)}\n`;
    add('loops', `নামতা ${as(k + 6)}`, `প্ৰতিবাৰ i = ১ লৈকে ${as(rows)}\n    লিখা ${as(t)}, "×", i, "=", ${as(t)} * i\nশেষ`, out);
});

// 7. Functions
[5, 6, 7, 10, 12].forEach((n, k) => {
    let f = 1n; for (let i = 2n; i <= BigInt(n); i++) f *= i;
    add('functions', `ক্ৰমগুণিতক ${as(k + 1)}`, `কাজ ফেক্ট(পূ৬৪ n) -> পূ৬৪\n    যদি n <= ১ থাকিলে\n        উভতি ১\n    শেষ\n    উভতি n * ফেক্ট(n - ১)\nশেষ\nলিখা "${as(n)}! =", ফেক্ট(${as(n)})`, `${as(n)}! = ${as(f)}\n`);
});
[[48, 18], [100, 75], [17, 5], [81, 27], [270, 192]].forEach(([a, b], k) => {
    const gcd = (x, y) => (y === 0 ? x : gcd(y, x % y));
    add('functions', `গ.সা.উ. ${as(k + 6)}`, `কাজ গসাউ(পূৰ্ণ a, পূৰ্ণ b) -> পূৰ্ণ\n    যেতিয়া b != ০\n        পূৰ্ণ r = a % b\n        a = b\n        b = r\n    শেষ\n    উভতি a\nশেষ\nলিখা গসাউ(${as(a)}, ${as(b)})`, `${as(gcd(a, b))}\n`);
});

// 8. Arrays
[[4, 8, 15, 16, 23], [3, 1, 4, 1, 5], [10, 20, 30, 40, 50], [9, 7, 5, 3, 1], [2, 7, 1, 8, 2]].forEach((v, k) => {
    add('arrays', `তালিকা ${as(k + 1)}`, `পূৰ্ণ[] মান = [${v.map(as).join(', ')}]\nপূৰ্ণ মুঠ = ০, ডাঙৰ = মান[০]\nপ্ৰতিবাৰ i = ০ লৈকে দৈৰ্ঘ্য(মান) - ১\n    মুঠ += মান[i]\n    যদি মান[i] > ডাঙৰ থাকিলে\n        ডাঙৰ = মান[i]\n    শেষ\nশেষ\nলিখা মান\nলিখা "মুঠ:", মুঠ, "সৰ্বোচ্চ:", ডাঙৰ`,
        `[${v.map(as).join(', ')}]\nমুঠ: ${as(v.reduce((a, b) => a + b, 0))} সৰ্বোচ্চ: ${as(Math.max(...v))}\n`);
});
[[5, 2, 9, 1, 7], [3, 3, 1, 2, 0], [8, 6, 7, 5, 3], [1, 2, 3, 4, 5], [9, 4, 6, 2, 8]].forEach((v, k) => {
    const s = [...v].sort((a, b) => a - b);
    add('arrays', `বাবল ছৰ্ট ${as(k + 6)}`, `পূৰ্ণ[] ক = [${v.map(as).join(', ')}]\nপূৰ্ণ n = দৈৰ্ঘ্য(ক)\nপ্ৰতিবাৰ i = ০ লৈকে n - ২\n    প্ৰতিবাৰ j = ০ লৈকে n - ২ - i\n        যদি ক[j] > ক[j + ১] থাকিলে\n            পূৰ্ণ t = ক[j]\n            ক[j] = ক[j + ১]\n            ক[j + ১] = t\n        শেষ\n    শেষ\nশেষ\nলিখা ক`,
        `[${s.map(as).join(', ')}]\n`);
});

// 9. Pointers and memory
[[3, 9], [12, 5], [0, 1], [-4, 4], [100, 200]].forEach(([a, b], k) => add('pointers', `সলনি ${as(k + 1)}`,
    `কাজ সলনি(পূৰ্ণ* ক, পূৰ্ণ* খ)\n    পূৰ্ণ t = *ক\n    *ক = *খ\n    *খ = t\nশেষ\nপূৰ্ণ a = ${as(a)}, b = ${as(b)}\nসলনি(&a, &b)\nলিখা a, b`,
    `${as(b)} ${as(a)}\n`));
[3, 5, 8, 10, 4].forEach((n, k) => {
    const sq = Array.from({ length: n }, (_, i) => i * i);
    add('pointers', `গতিশীল তালিকা ${as(k + 6)}`, `পূৰ্ণ n = ${as(n)}\nপূৰ্ণ* বৰ্গ = নতুন(পূৰ্ণ, n)\nপ্ৰতিবাৰ i = ০ লৈকে n - ১\n    *(বৰ্গ + i) = i * i\nশেষ\nপূ৬৪ মুঠ = ০\nপ্ৰতিবাৰ i = ০ লৈকে n - ১\n    মুঠ += বৰ্গ[i]\nশেষ\nলিখা "শেষ বৰ্গ:", বৰ্গ[n - ১], "মুঠ:", মুঠ\nমুকলি(বৰ্গ)`,
        `শেষ বৰ্গ: ${as(sq[n - 1])} মুঠ: ${as(sq.reduce((a, b) => a + b, 0))}\n`);
});

// 10. Structs
[[4, 5], [10, 3], [7, 7], [12, 2], [6, 9]].forEach(([w, h], k) => add('structs', `আয়ত ${as(k + 1)}`,
    `গঠন আয়ত\n    পূৰ্ণ দীঘ, প্ৰস্থ\nশেষ\nকাজ কালি(আয়ত* ক) -> পূৰ্ণ\n    উভতি ক->দীঘ * ক->প্ৰস্থ\nশেষ\nআয়ত ক = {দীঘ: ${as(w)}, প্ৰস্থ: ${as(h)}}\nলিখা ক, "কালি:", কালি(&ক), "পৰিসীমা:", ২ * (ক.দীঘ + ক.প্ৰস্থ)`,
    `{দীঘ: ${as(w)}, প্ৰস্থ: ${as(h)}} কালি: ${as(w * h)} পৰিসীমা: ${as(2 * (w + h))}\n`));
[['ৰিমা', 88, 'ৰাহুল', 72], ['অনু', 64, 'বিজয়', 91], ['মুন', 55, 'জয়', 55], ['দীপ', 99, 'লতা', 98], ['ৰূপ', 70, 'নীলা', 80]].forEach(([n1, m1, n2, m2], k) => {
    const best = m1 >= m2 ? n1 : n2;
    add('structs', `ছাত্ৰ ${as(k + 6)}`, `গঠন ছাত্ৰ\n    বাক্য নাম\n    পূৰ্ণ নম্বৰ\nশেষ\nছাত্ৰ[] শ্ৰেণী = [{"${n1}", ${as(m1)}}, {"${n2}", ${as(m2)}}]\nছাত্ৰ শ্ৰেষ্ঠ = শ্ৰেণী[০]\nযদি শ্ৰেণী[১].নম্বৰ > শ্ৰেষ্ঠ.নম্বৰ থাকিলে\n    শ্ৰেষ্ঠ = শ্ৰেণী[১]\nশেষ\nলিখা "শ্ৰেষ্ঠ ছাত্ৰ:", শ্ৰেষ্ঠ.নাম, শ্ৰেষ্ঠ.নম্বৰ`,
        `শ্ৰেষ্ঠ ছাত্ৰ: ${best} ${as(Math.max(m1, m2))}\n`);
});

module.exports = samples;
module.exports.CATEGORIES = CATEGORIES;
__ASOMIYA_BHASHA_EOF__

cat > "examples/conditions.asb" <<'__ASOMIYA_BHASHA_EOF__'
# চৰ্ত: যদি / নহলে যদি / নহলে, বাছক আৰু ?:
কাজ গ্ৰেড(পূৰ্ণ নম্বৰ) -> বাক্য
    যদি নম্বৰ >= ৯০ থাকিলে
        উভতি "এ+"
    নহলে যদি নম্বৰ >= ৭৫ থাকিলে
        উভতি "এ"
    নহলে যদি নম্বৰ >= ৬০ থাকিলে
        উভতি "বি"
    নহলে
        উভতি "চি"
    শেষ
শেষ

পূৰ্ণ[] নম্বৰসমূহ = [৯৫, ৮২, ৬৭, ৪৫]
প্ৰতিবাৰ i = ০ লৈকে দৈৰ্ঘ্য(নম্বৰসমূহ) - ১
    লিখা নম্বৰসমূহ[i], "→", গ্ৰেড(নম্বৰসমূহ[i])
শেষ

গণনা ঋতু
    বসন্ত
    গ্ৰীষ্ম
    বৰ্ষা
    শৰৎ
শেষ

ঋতু এতিয়া = বৰ্ষা
বাছক এতিয়া
    ক্ষেত্ৰ বসন্ত
        লিখা "ফুল ফুলিছে"
    ক্ষেত্ৰ গ্ৰীষ্ম, বৰ্ষা
        লিখা "বৰষুণৰ দিন"
    অন্যথা
        লিখা "আন ঋতু"
শেষ

পূৰ্ণ সংখ্যা১ = ১৭
লিখা সংখ্যা১, সংখ্যা১ % ২ == ০ ? "যুগ্ম" : "অযুগ্ম"
যদি সংখ্যা১ > ১০ আৰু নহয় (সংখ্যা১ > ২০) থাকিলে
    লিখা "১০ আৰু ২০ৰ মাজত"
শেষ
__ASOMIYA_BHASHA_EOF__

cat > "examples/files.asb" <<'__ASOMIYA_BHASHA_EOF__'
# ফাইলত লিখা আৰু পঢ়া
ফাইল* f = খোলা("asomiya_demo.txt", "w")
যদি f == খালি থাকিলে
    লিখা "ফাইল খুলিব নোৱাৰি"
    প্ৰস্থান(১)
শেষ
প্ৰতিবাৰ i = ১ লৈকে ৩
    ফাইলত_ছপা(f, "শাৰী %d\n", i)
শেষ
বন্ধ(f)

f = খোলা("asomiya_demo.txt", "r")
বাক্য শাৰী = ফাইলৰ_শাৰী(f)
পূৰ্ণ গণক = ০
যেতিয়া শাৰী != খালি
    গণক++
    লিখা গণক, ":", শাৰী
    মুকলি(শাৰী)
    শাৰী = ফাইলৰ_শাৰী(f)
শেষ
বন্ধ(f)
__ASOMIYA_BHASHA_EOF__

cat > "examples/functions.asb" <<'__ASOMIYA_BHASHA_EOF__'
# কাজ: ফেৰত প্ৰকাৰ, পুনৰাবৃত্তি, কাজৰ সূচক
কাজ ফিব(পূৰ্ণ n) -> পূৰ্ণ
    যদি n < ২ থাকিলে
        উভতি n
    শেষ
    উভতি ফিব(n - ১) + ফিব(n - ২)
শেষ

# '-> প্ৰকাৰ' নিদিলে প্ৰথম 'উভতি'ৰ পৰা প্ৰকাৰ বুজি লোৱা হয়
কাজ বৰ্গ(দশমিক x)
    উভতি x * x
শেষ

কাজ যোগ(পূৰ্ণ a, পূৰ্ণ b) -> পূৰ্ণ
    উভতি a + b
শেষ
কাজ পূৰণ(পূৰ্ণ a, পূৰ্ণ b) -> পূৰ্ণ
    উভতি a * b
শেষ

# কাজক আৰ্গুমেণ্ট হিচাপে দিয়া
কাজ প্ৰয়োগ(কাজ(পূৰ্ণ, পূৰ্ণ) -> পূৰ্ণ ক্ৰিয়া, পূৰ্ণ x, পূৰ্ণ y) -> পূৰ্ণ
    উভতি ক্ৰিয়া(x, y)
শেষ

# ছপা() হৈছে C-ৰ printf: ই ASCII অংক (0-9) লিখে
প্ৰতিবাৰ i = ০ লৈকে ১০
    ছপা("%d ", ফিব(i))
শেষ
লিখা
লিখা বৰ্গ(১.৫), প্ৰয়োগ(যোগ, ৬, ৭), প্ৰয়োগ(পূৰণ, ৬, ৭)
__ASOMIYA_BHASHA_EOF__

cat > "examples/hello.asb" <<'__ASOMIYA_BHASHA_EOF__'
# নমস্কাৰ বিশ্ব — অসমীয়া ভাষা ২.০ৰ প্ৰথম প্ৰ'গ্ৰাম
লিখা "নমস্কাৰ বিশ্ব!"
লিখা "অসমীয়া ভাষালৈ স্বাগতম!"

বাক্য নাম = "ইঞ্জিনিয়াৰ পঞ্চানন নাথ"
পূৰ্ণ বয়স = ২৮
লিখা "মোৰ নাম", নাম, "আৰু বয়স", বয়স
__ASOMIYA_BHASHA_EOF__

cat > "examples/input.asb" <<'__ASOMIYA_BHASHA_EOF__'
# keyboard-ৰ পৰা ইনপুট
ছপা("আপোনাৰ নাম কি? ")
বাক্য নাম = পঢ়া()
ছপা("আপোনাৰ বয়স কিমান? ")
পূ৬৪ বয়স = পঢ়া_পূৰ্ণ()
লিখা
লিখা "নমস্কাৰ,", নাম
লিখা "দহ বছৰৰ পিছত আপোনাৰ বয়স হ'ব", বয়স + ১০
মুকলি(নাম)
__ASOMIYA_BHASHA_EOF__

cat > "examples/input.in" <<'__ASOMIYA_BHASHA_EOF__'
পঞ্চানন
২৮
__ASOMIYA_BHASHA_EOF__

cat > "examples/lib/geometry.asb" <<'__ASOMIYA_BHASHA_EOF__'
# জ্যামিতি মডিউল: আমদানি কৰিব পৰা ঘোষণা
স্থিৰ দশমিক পাই = ৩.১৪১৫৯২৬৫৩৫৮৯৭৯

গঠন আয়ত
    দশমিক দীঘ, প্ৰস্থ
শেষ

কাজ আয়তৰ_কালি(আয়ত ক) -> দশমিক
    উভতি ক.দীঘ * ক.প্ৰস্থ
শেষ

কাজ বৃত্তৰ_কালি(দশমিক ব্যাসাৰ্ধ) -> দশমিক
    উভতি পাই * ব্যাসাৰ্ধ * ব্যাসাৰ্ধ
শেষ
__ASOMIYA_BHASHA_EOF__

cat > "examples/linked_list.asb" <<'__ASOMIYA_BHASHA_EOF__'
# heap-ত সংযুক্ত তালিকা (linked list): নতুন() আৰু মুকলি()
গঠন নোড
    পূৰ্ণ মান
    নোড* পিছৰ
শেষ

কাজ আগত_সুমুওৱা(নোড* মূৰ, পূৰ্ণ মান) -> নোড*
    নোড* ন = নতুন(নোড)
    ন->মান = মান
    ন->পিছৰ = মূৰ
    উভতি ন
শেষ

কাজ ওলোটা(নোড* মূৰ) -> নোড*
    নোড* আগৰ = খালি
    যেতিয়া মূৰ != খালি
        নোড* পিছৰ = মূৰ->পিছৰ
        মূৰ->পিছৰ = আগৰ
        আগৰ = মূৰ
        মূৰ = পিছৰ
    শেষ
    উভতি আগৰ
শেষ

কাজ ছপা_কৰা(নোড* মূৰ)
    যেতিয়া মূৰ != খালি
        দেখুওৱা মূৰ->মান, "->"
        মূৰ = মূৰ->পিছৰ
    শেষ
    লিখা "খালি"
শেষ

কাজ মুকলি_কৰা(নোড* মূৰ)
    যেতিয়া মূৰ != খালি
        নোড* পিছৰ = মূৰ->পিছৰ
        মুকলি(মূৰ)
        মূৰ = পিছৰ
    শেষ
শেষ

নোড* তালিকা = খালি
প্ৰতিবাৰ i = ১ লৈকে ৫
    তালিকা = আগত_সুমুওৱা(তালিকা, i * ১০)
শেষ
ছপা_কৰা(তালিকা)
তালিকা = ওলোটা(তালিকা)
ছপা_কৰা(তালিকা)
মুকলি_কৰা(তালিকা)
__ASOMIYA_BHASHA_EOF__

cat > "examples/loops.asb" <<'__ASOMIYA_BHASHA_EOF__'
# লুপ: যেতিয়া, প্ৰতিবাৰ (ক্ৰমে), C-ধৰণৰ প্ৰতিবাৰ, কৰা … শেষ যেতিয়া

# ১০০ লৈকে মৌলিক সংখ্যা
পূৰ্ণ গণক = ০
প্ৰতিবাৰ n = ২ লৈকে ১০০
    বুলিয়ান মৌলিক = সত্য
    প্ৰতিবাৰ (পূৰ্ণ d = ২; d * d <= n; d++)
        যদি n % d == ০ থাকিলে
            মৌলিক = মিছা
            ভাঙা
        শেষ
    শেষ
    যদি মৌলিক থাকিলে
        গণক++
    শেষ
শেষ
লিখা "১০০ লৈকে মৌলিক সংখ্যা:", গণক

# উলটা গণনা
প্ৰতিবাৰ i = ১০ লৈকে ০ ক্ৰমে -২
    লিখা i
শেষ

# অযুগ্ম সংখ্যাৰ যোগফল (আগবাঢ়া)
পূৰ্ণ যোগফল = ০
পূৰ্ণ k = ০
যেতিয়া k < ১০
    k++
    যদি k % ২ == ০ থাকিলে
        আগবাঢ়া
    শেষ
    যোগফল += k
শেষ
লিখা "অযুগ্মৰ যোগফল:", যোগফল

# কৰা … শেষ যেতিয়া: অন্ততঃ এবাৰ চলে
পূৰ্ণ অংক = ০, মান = ৯৮৭৬৫
কৰা
    অংক++
    মান /= ১০
শেষ যেতিয়া মান > ০
লিখা "অংকৰ সংখ্যা:", অংক
__ASOMIYA_BHASHA_EOF__

cat > "examples/main_args.args" <<'__ASOMIYA_BHASHA_EOF__'
ক খ
__ASOMIYA_BHASHA_EOF__

cat > "examples/main_args.asb" <<'__ASOMIYA_BHASHA_EOF__'
# 'মূল' কাজ: command-line আৰ্গুমেণ্ট আৰু exit code
কাজ মূল(পূৰ্ণ মুঠ, বাক্য* আৰ্গুমেণ্ট) -> পূৰ্ণ
    লিখা "আৰ্গুমেণ্টৰ সংখ্যা:", মুঠ - ১
    প্ৰতিবাৰ i = ১ লৈকে মুঠ - ১
        লিখা i, আৰ্গুমেণ্ট[i]
    শেষ
    উভতি ০
শেষ
__ASOMIYA_BHASHA_EOF__

cat > "examples/modules.asb" <<'__ASOMIYA_BHASHA_EOF__'
# আন ফাইলৰ পৰা আমদানি
আমদানি "lib/geometry.asb"

আয়ত মজিয়া = {৫, ৪}
লিখা "আয়তৰ কালি:", আয়তৰ_কালি(মজিয়া)
লিখা "বৃত্তৰ কালি:", বৃত্তৰ_কালি(২)
__ASOMIYA_BHASHA_EOF__

cat > "examples/pointers.asb" <<'__ASOMIYA_BHASHA_EOF__'
# সূচক (pointer): ঠিকনা, মান, সূচক গণিত
কাজ সলনি(পূৰ্ণ* ক, পূৰ্ণ* খ)
    পূৰ্ণ অস্থায়ী = *ক
    *ক = *খ
    *খ = অস্থায়ী
শেষ

কাজ বাঢ়োৱা(পূৰ্ণ* তালিকা, পূৰ্ণ n, পূৰ্ণ পৰিমাণ)
    প্ৰতিবাৰ i = ০ লৈকে n - ১
        *(তালিকা + i) += পৰিমাণ
    শেষ
শেষ

পূৰ্ণ a = ৩, b = ৭
সলনি(&a, &b)
লিখা "সলনিৰ পিছত:", a, b

পূৰ্ণ[] নম্বৰ = [১০, ২০, ৩০]
বাঢ়োৱা(নম্বৰ, দৈৰ্ঘ্য(নম্বৰ), ৫)
লিখা নম্বৰ

পূৰ্ণ* p = &নম্বৰ[০]
p++
লিখা "দ্বিতীয়:", *p, "সূচী:", p - &নম্বৰ[০]

পূৰ্ণ** pp = &p
**pp = ৯৯
লিখা নম্বৰ, p == খালি
__ASOMIYA_BHASHA_EOF__

cat > "examples/strings.asb" <<'__ASOMIYA_BHASHA_EOF__'
# বাক্য (string): UTF-8 বাইটৰ শাৰী, শেষত '\0'
বাক্য নাম = "অসম"
লিখা "বাইট:", দৈৰ্ঘ্য(নাম), "আখৰ:", আখৰ_সংখ্যা(নাম)

বাক্য পূৰা = যোগ_বাক্য(নাম, " দেশ")
লিখা পূৰা
মুকলি(পূৰা)

লিখা তুলনা("ক", "ক") == ০, তুলনা("ক", "খ") < ০

# সংখ্যা ↔ বাক্য
পূ৬৪ মান = সংখ্যালৈ("১২৩") + 1
লিখা মান, বাক্যলৈ(মান)

# আখৰ[] এটা সলনি কৰিব পৰা বাফাৰ
আখৰ[৩২] শব্দ = "hello"
প্ৰতিবাৰ i = ০ লৈকে দৈৰ্ঘ্য(শব্দ) - ১
    শব্দ[i] = শব্দ[i] - ৩২ হিচাপে আখৰ      # সৰু আখৰ → ডাঙৰ আখৰ
শেষ
লিখা শব্দ
__ASOMIYA_BHASHA_EOF__

cat > "examples/structs.asb" <<'__ASOMIYA_BHASHA_EOF__'
# গঠন (struct), সংযোগ (union) আৰু গণনা (enum)
গঠন বিন্দু
    দশমিক x, y
শেষ

গঠন বৃত্ত
    বিন্দু কেন্দ্ৰ
    দশমিক ব্যাসাৰ্ধ
শেষ

কাজ কালি(বৃত্ত* ব) -> দশমিক
    উভতি ৩.১৪১৫৯২৬৫৩৫৮৯৭৯ * ব->ব্যাসাৰ্ধ * ব->ব্যাসাৰ্ধ
শেষ

কাজ স্থানান্তৰ(বৃত্ত ব, দশমিক dx, দশমিক dy) -> বৃত্ত
    ব.কেন্দ্ৰ.x += dx
    ব.কেন্দ্ৰ.y += dy
    উভতি ব
শেষ

বৃত্ত ব১ = {কেন্দ্ৰ: {১, ২}, ব্যাসাৰ্ধ: ৩}
লিখা ব১
লিখা "কালি:", কালি(&ব১)
বৃত্ত ব২ = স্থানান্তৰ(ব১, ১০, ০)
লিখা ব২.কেন্দ্ৰ, ব১.কেন্দ্ৰ

# সংযোগ: একে স্মৃতি বেলেগ প্ৰকাৰে চোৱা
সংযোগ বাইটসমূহ
    ধ৩২ গোটা
    ধ৮[৪] অংশ
শেষ
বাইটসমূহ ব
ব.গোটা = ০x01020304
লিখা "নিম্নতম বাইট:", ব.অংশ[০]

গণনা অৱস্থা
    চলি_আছে = ১
    ৰখা
    সমাপ্ত
শেষ
অৱস্থা এতিয়া = ৰখা
লিখা "অৱস্থা:", এতিয়া
__ASOMIYA_BHASHA_EOF__

cat > "examples/types.asb" <<'__ASOMIYA_BHASHA_EOF__'
# প্ৰকাৰ (types), ৰূপান্তৰ আৰু আকাৰ
পূৰ্ণ ক = ৪২                # ৩২-বিট চিহ্নযুক্ত পূৰ্ণ সংখ্যা
পূ৬৪ ডাঙৰ = ৯০০৭১৯৯২৫৪৭৪০৯৯৩
ধ৮ বাইট = ২৫৫               # ৮-বিট চিহ্নহীন
দশমিক পাই = ৩.১৪১৫৯২৬৫৩৫৮৯৭৯
দশমিক৩২ সৰু_দশমিক = ২.৫
বুলিয়ান সঁচা = সত্য
আখৰ বৰ্ণ = 'A'
বাক্য বাৰ্তা = "অসম"
স্থিৰ পূৰ্ণ সৰ্বোচ্চ = ১০০

লিখা ক, ডাঙৰ, বাইট, পাই, সৰু_দশমিক, সঁচা, বৰ্ণ, বাৰ্তা, সৰ্বোচ্চ
লিখা "আকাৰ (বাইট):", আকাৰ(পূৰ্ণ), আকাৰ(পূ৬৪), আকাৰ(ধ৮), আকাৰ(দশমিক), আকাৰ(বুলিয়ান)

# পূৰ্ণ ÷ পূৰ্ণ = পূৰ্ণ ; দশমিক লাগিলে 'হিচাপে' ব্যৱহাৰ কৰক
লিখা ৭ / ২, ৭ হিচাপে দশমিক / ২, ৭ % ২
দশমিক উষ্ণতা = ৩৬.৬
পূৰ্ণ গোটা = উষ্ণতা হিচাপে পূৰ্ণ
লিখা গোটা

# ASCII আৰু অসমীয়া অংক একেলগে চলে; hex আৰু binary-ও
লিখা 10 + ১০, ০xFF, ০b1010, ১_০০০_০০০
__ASOMIYA_BHASHA_EOF__

cat > "package.json" <<'__ASOMIYA_BHASHA_EOF__'
{
  "name": "asomiya-bhasha",
  "version": "2.0.0",
  "description": "Asomiya Bhasha (অসমীয়া ভাষা) — a statically typed, C-level programming language written in Assamese script, compiled to native code through C",
  "main": "src/index.js",
  "bin": {
    "asomiya": "./src/cli.js"
  },
  "files": [
    "src/",
    "examples/",
    "docs/",
    "README.md",
    "LICENSE"
  ],
  "scripts": {
    "start": "node src/cli.js",
    "test": "node tests/test.js",
    "test:quick": "node tests/test.js --quick",
    "test:clang": "node tests/test.js --cc clang",
    "build": "npm run build:web",
    "build:web": "esbuild src/browser.js --bundle --format=iife --global-name=AsomiyaRuntime --outfile=public/runtime.js",
    "web": "npm run build:web && live-server public"
  },
  "keywords": [
    "assamese",
    "asomiya",
    "programming-language",
    "compiler",
    "c",
    "systems-programming",
    "mother-tongue",
    "education"
  ],
  "author": "Er Panchanan Nath",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/PanchananNath/Asomiya_Bhasha.git"
  },
  "bugs": {
    "url": "https://github.com/PanchananNath/Asomiya_Bhasha/issues"
  },
  "homepage": "https://github.com/PanchananNath/Asomiya_Bhasha#readme",
  "devDependencies": {
    "esbuild": "^0.25.12",
    "live-server": "^1.2.2"
  },
  "engines": {
    "node": ">=16.0.0"
  }
}
__ASOMIYA_BHASHA_EOF__

cat > "programs/first.asb" <<'__ASOMIYA_BHASHA_EOF__'
# এইটো আপোনাৰ প্ৰথম প্ৰ'গ্ৰাম: node src/cli.js programs/first.asb
লিখা "মই অসমীয়াত প্ৰ'গ্ৰাম লিখিছোঁ!"
__ASOMIYA_BHASHA_EOF__

cat > "public/index.html" <<'__ASOMIYA_BHASHA_EOF__'
<!DOCTYPE html>
<html lang="as">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>অসমীয়া প্ৰ'গ্ৰামিং ভাষা</title>
    <link rel="stylesheet" href="style.css">
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Assamese:wght@400;500;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
</head>
<body>
    <div class="container">
        <header class="app-header">
            <div class="brand-lockup">
                <div class="brand-mark"><i class="fas fa-code"></i></div>
                <div>
                    <p class="eyebrow">ASOMIYA BHASHA <span>•</span> PLAYGROUND</p>
                    <h1>অসমীয়া প্ৰ'গ্ৰামিং ভাষা</h1>
                    <p class="subtitle">আপোনাৰ মাতৃভাষাত C-ৰ সমান ক্ষমতাৰে প্ৰ'গ্ৰামিং</p>
                    <p class="developer-credit">Developed by Er Panchanan Nath</p>
                </div>
            </div>
            <div class="header-status">
                <span class="status-dot"></span>
                <span>v2.0 · compiler</span>
            </div>
        </header>

        <div class="workspace-intro">
            <div>
                <p class="eyebrow">INTERACTIVE WORKSPACE</p>
                <h2>Write, check, and translate to C.</h2>
            </div>
            <div class="shortcut-note"><i class="fas fa-keyboard"></i> Ctrl + Enter to translate</div>
        </div>

        <div class="main-content">
            <div class="editor-section">
                <div class="editor-header">
                    <div class="panel-title"><span class="panel-kicker">01</span><div><h2><i class="fas fa-edit"></i> কোড লিখক</h2><p>Build your first Assamese program</p></div></div>
                    <div class="editor-buttons">
                        <button id="runBtn" class="btn run-btn">
                            <i class="fas fa-gears"></i> C লৈ ৰূপান্তৰ
                        </button>
                        <button id="typingBtn" class="btn typing-btn" aria-expanded="false" aria-controls="typingPanel">
                            <i class="fas fa-keyboard"></i> অসমীয়া টাইপ
                        </button>
                        <button id="clearBtn" class="btn clear-btn">
                            <i class="fas fa-broom"></i> পৰিষ্কাৰ কৰক
                        </button>
                        <button id="exampleBtn" class="btn example-btn">
                            <i class="fas fa-book"></i> উদাহৰণ
                        </button>
                    </div>
                </div>

                <div id="typingPanel" class="typing-panel" hidden>
                    <div class="typing-panel-header">
                        <div><p class="eyebrow">ON-SCREEN INPUT</p><h3>অসমীয়া keyboard</h3></div>
                        <button id="typingClose" class="typing-close" type="button" aria-label="Keyboard বন্ধ কৰক"><i class="fas fa-xmark"></i></button>
                    </div>
                    <div id="typingKeys" class="typing-keys"></div>
                </div>
                
                <div class="code-editor">
                    <div class="line-numbers">
                        <div>1</div>
                        <div>2</div>
                        <div>3</div>
                        <div>4</div>
                        <div>5</div>
                        <div>6</div>
                        <div>7</div>
                        <div>8</div>
                        <div>9</div>
                        <div>10</div>
                    </div>
                    <textarea id="codeInput" spellcheck="false"># মোৰ প্ৰথম অসমীয়া প্ৰ'গ্ৰাম
লিখা "অসমৰ পৰা সমগ্ৰ বিশ্ববাসীক নমস্কাৰ!"

পূৰ্ণ x = ১০
পূৰ্ণ y = ২০
লিখা "যোগফল:", x + y

কাজ বৰ্গ(পূৰ্ণ n) -> পূৰ্ণ
    উভতি n * n
শেষ
লিখা "৭-ৰ বৰ্গ:", বৰ্গ(৭)
</textarea>
                </div>
            </div>

            <div class="output-section">
                <div class="output-header">
                    <div class="panel-title"><span class="panel-kicker">02</span><div><h2><i class="fas fa-terminal"></i> ফলাফল</h2><p>Errors or the generated C code appear here</p></div></div>
                    <button id="clearOutputBtn" class="btn clear-output-btn">
                        <i class="fas fa-trash"></i> পৰিষ্কাৰ
                    </button>
                </div>
                <div id="output" class="output-console">
                    <div class="welcome-message">
                        <p>অসমীয়া ভাষালৈ স্বাগতম!</p>
                        <p>ক'ড লিখি "C লৈ ৰূপান্তৰ" টিপক। native ভাৱে চলাবলৈ: node src/cli.js program.asb</p>
                    </div>
                </div>
            </div>

            <div class="examples-section">
                <div class="section-heading"><div><p class="eyebrow">STARTER LIBRARY</p><h2><i class="fas fa-lightbulb"></i> উদাহৰণসমূহ</h2></div><span class="section-count">100 samples</span></div>
                <div class="example-cards">
                    <div class="example-card" data-example="hello">
                        <h3>নমস্কাৰ</h3>
                        <pre><code>লিখা "নমস্কাৰ অসম!"
পূৰ্ণ বছৰ = ২০২৬</code></pre>
                    </div>
                    <div class="example-card" data-example="struct">
                        <h3>গঠন</h3>
                        <pre><code>গঠন বিন্দু
    পূৰ্ণ x, y
শেষ</code></pre>
                    </div>
                    <div class="example-card" data-example="pointer">
                        <h3>সূচক</h3>
                        <pre><code>পূৰ্ণ a = ৩, b = ৭
সলনি(&amp;a, &amp;b)</code></pre>
                    </div>
                    <div class="example-card" data-example="function">
                        <h3>কাজ</h3>
                        <pre><code>কাজ ফেক্ট(পূ৬৪ n) -&gt; পূ৬৪
    …
শেষ</code></pre>
                    </div>
                </div>
            </div>

            <div class="docs-section">
                <div class="section-heading"><div><p class="eyebrow">QUICK REFERENCE</p><h2><i class="fas fa-book-open"></i> সহায়</h2></div><button id="docsLink" class="text-action">সম্পূৰ্ণ docs <i class="fas fa-arrow-up-right-from-square"></i></button></div>
                <div class="docs-grid">
                    <div class="doc-card">
                        <h3>প্ৰকাৰ আৰু চলক</h3>
                        <ul>
                            <li><code>পূৰ্ণ x = ১০</code> - ৩২-বিট পূৰ্ণ সংখ্যা</li>
                            <li><code>দশমিক d = ২.৫</code> - দশমিক সংখ্যা</li>
                            <li><code>বাক্য নাম = "অসম"</code> - বাক্য</li>
                            <li><code>পূৰ্ণ[] ক = [১, ২]</code> - তালিকা</li>
                        </ul>
                    </div>
                    <div class="doc-card">
                        <h3>নিয়ন্ত্ৰণ</h3>
                        <ul>
                            <li><code>যদি x &gt; ৫ থাকিলে … শেষ</code></li>
                            <li><code>প্ৰতিবাৰ i = ১ লৈকে ১০ … শেষ</code></li>
                            <li><code>বাছক x … ক্ষেত্ৰ ১ … শেষ</code></li>
                        </ul>
                    </div>
                    <div class="doc-card">
                        <h3>স্মৃতি আৰু সূচক</h3>
                        <ul>
                            <li><code>পূৰ্ণ* p = &amp;x</code> - ঠিকনা</li>
                            <li><code>নতুন(পূৰ্ণ, n)</code> / <code>মুকলি(p)</code></li>
                            <li><code>p-&gt;ক্ষেত্ৰ</code>, <code>আকাৰ(T)</code></li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>

        <footer>
            <p>অসমীয়া ভাষা v2.0 | <i class="fas fa-heart"></i> অসমৰ বাবে</p>
            <p>Developed and open sourced by Er Panchanan Nath | Copyright Er Panchanan Nath</p>
            <p class="footer-links">
                <a href="https://github.com/PanchananNath/Asomiya_Bhasha" id="githubLink" target="_blank" rel="noopener"><i class="fab fa-github"></i> GitHub</a>
                |
                <a href="#" id="footerDocsLink"><i class="fas fa-file-alt"></i> ডকুমেন্টেচন</a>
                |
                <a href="#" id="aboutLink"><i class="fas fa-info-circle"></i> আমি সম্পৰ্কে</a>
            </p>
        </footer>
    </div>

    <div id="exampleModal" class="modal">
        <div class="modal-content">
            <span class="close">&times;</span>
            <div class="sample-modal-heading">
                <div><p class="eyebrow">100 GRADED SAMPLES</p><h3>উদাহৰণ নির্বাচন কৰক</h3></div>
                <span id="sampleCount" class="section-count">100 samples</span>
            </div>
            <div class="sample-controls">
                <input id="sampleSearch" type="search" placeholder="উদাহৰণ বিচাৰক..." aria-label="উদাহৰণ বিচাৰক">
                <select id="sampleCategory" aria-label="উদাহৰণৰ বিভাগ">
                    <option value="all">সকলো বিভাগ</option>
                </select>
            </div>
            <div id="modalExamples" class="modal-examples"></div>
        </div>
    </div>

    <script src="runtime.js"></script>
    <script src="web.js"></script>
</body>
</html>
__ASOMIYA_BHASHA_EOF__

cat > "public/style.css" <<'__ASOMIYA_BHASHA_EOF__'
/* Reset and Base Styles */
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: 'Noto Sans Assamese', sans-serif;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
    color: #333;
    line-height: 1.6;
}

.container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
}

/* Header */
header {
    text-align: center;
    margin-bottom: 30px;
    color: white;
    padding: 20px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.2);
}

header h1 {
    font-size: 2.5em;
    margin-bottom: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 15px;
}

.subtitle {
    font-size: 1.2em;
    opacity: 0.9;
}

/* Main Content */
.main-content {
    display: grid;
    gap: 30px;
}

/* Editor Section */
.editor-section, .output-section, .examples-section, .docs-section {
    background: white;
    border-radius: 10px;
    padding: 25px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
}

.editor-header, .output-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    border-bottom: 2px solid #f0f0f0;
    padding-bottom: 15px;
}

.editor-header h2, .output-header h2, .examples-section h2, .docs-section h2 {
    color: #4a5568;
    display: flex;
    align-items: center;
    gap: 10px;
}

/* Buttons */
.btn {
    padding: 10px 20px;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    font-family: 'Noto Sans Assamese', sans-serif;
    font-weight: 600;
    font-size: 1em;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    transition: all 0.3s ease;
}

.run-btn {
    background: #48bb78;
    color: white;
}

.run-btn:hover {
    background: #38a169;
    transform: translateY(-2px);
}

.clear-btn {
    background: #e53e3e;
    color: white;
}

.clear-btn:hover {
    background: #c53030;
    transform: translateY(-2px);
}

.example-btn {
    background: #4299e1;
    color: white;
}

.example-btn:hover {
    background: #3182ce;
    transform: translateY(-2px);
}

.clear-output-btn {
    background: #a0aec0;
    color: white;
    padding: 8px 15px;
    font-size: 0.9em;
}

.clear-output-btn:hover {
    background: #718096;
}

/* Code Editor */
.code-editor {
    display: flex;
    border: 2px solid #e2e8f0;
    border-radius: 8px;
    overflow: hidden;
    background: #1a202c;
}

.line-numbers {
    background: #2d3748;
    color: #a0aec0;
    padding: 15px 10px;
    text-align: right;
    font-family: 'Courier New', monospace;
    font-size: 0.9em;
    user-select: none;
}

.line-numbers div {
    height: 22px;
    line-height: 22px;
}

#codeInput {
    flex: 1;
    padding: 15px;
    border: none;
    background: #1a202c;
    color: #e2e8f0;
    font-family: 'Courier New', monospace;
    font-size: 1em;
    line-height: 1.5;
    resize: vertical;
    min-height: 300px;
    outline: none;
    tab-size: 4;
}

#codeInput:focus {
    outline: none;
}

/* Output Console */
.output-console {
    background: #1a202c;
    color: #e2e8f0;
    padding: 20px;
    border-radius: 8px;
    min-height: 150px;
    max-height: 400px;
    overflow-y: auto;
    font-family: 'Courier New', monospace;
    white-space: pre-wrap;
    line-height: 1.6;
}

.welcome-message {
    color: #a0aec0;
    text-align: center;
    padding: 20px;
}

.welcome-message p {
    margin-bottom: 10px;
}

/* Examples Section */
.example-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 20px;
    margin-top: 20px;
}

.example-card {
    background: #f7fafc;
    border: 2px solid #e2e8f0;
    border-radius: 8px;
    padding: 20px;
    cursor: pointer;
    transition: all 0.3s ease;
}

.example-card:hover {
    transform: translateY(-5px);
    box-shadow: 0 10px 20px rgba(0, 0, 0, 0.1);
    border-color: #4299e1;
}

.example-card h3 {
    color: #2d3748;
    margin-bottom: 15px;
    font-size: 1.2em;
}

.example-card pre {
    background: #1a202c;
    color: #e2e8f0;
    padding: 15px;
    border-radius: 5px;
    overflow-x: auto;
    font-size: 0.9em;
}

/* Documentation */
.docs-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 20px;
    margin-top: 20px;
}

.doc-card {
    background: #f7fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 20px;
}

.doc-card h3 {
    color: #2d3748;
    margin-bottom: 15px;
    font-size: 1.2em;
}

.doc-card ul {
    list-style: none;
}

.doc-card li {
    padding: 8px 0;
    border-bottom: 1px solid #e2e8f0;
}

.doc-card li:last-child {
    border-bottom: none;
}

.doc-card code {
    background: #edf2f7;
    padding: 2px 6px;
    border-radius: 3px;
    font-family: 'Courier New', monospace;
    color: #2d3748;
}

/* Footer */
footer {
    text-align: center;
    color: white;
    margin-top: 40px;
    padding: 20px;
    font-size: 0.9em;
}

.footer-links {
    margin-top: 10px;
}

.footer-links a {
    color: white;
    text-decoration: none;
    margin: 0 10px;
    transition: opacity 0.3s ease;
}

.footer-links a:hover {
    opacity: 0.8;
}

/* Modal */
.modal {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    z-index: 1000;
    justify-content: center;
    align-items: center;
}

.modal-content {
    background: white;
    padding: 30px;
    border-radius: 10px;
    max-width: 800px;
    width: 90%;
    max-height: 80vh;
    overflow-y: auto;
    position: relative;
}

.close {
    position: absolute;
    right: 20px;
    top: 20px;
    font-size: 30px;
    cursor: pointer;
    color: #718096;
}

.close:hover {
    color: #2d3748;
}

.modal-examples {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 20px;
    margin-top: 20px;
}

.modal-example {
    background: #f7fafc;
    border: 2px solid #e2e8f0;
    border-radius: 8px;
    padding: 20px;
    cursor: pointer;
    transition: all 0.3s ease;
}

.modal-example:hover {
    border-color: #4299e1;
    transform: translateY(-2px);
}

.modal-example h4 {
    color: #2d3748;
    margin-bottom: 15px;
}

.sample-modal-heading {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 20px;
}

.sample-modal-heading h3 {
    margin-top: 5px;
    color: var(--ink);
}

.sample-controls {
    display: flex;
    gap: 10px;
    margin-top: 18px;
}

.sample-controls input,
.sample-controls select {
    min-height: 40px;
    padding: 8px 11px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: #f8faf7;
    color: var(--ink);
    font: inherit;
}

.sample-controls input { flex: 1; }
.sample-controls select { min-width: 170px; }
.sample-controls input:focus,
.sample-controls select:focus { outline: 2px solid rgba(15, 118, 110, .2); border-color: var(--teal); }
.modal-examples .modal-example { min-height: 0; padding: 14px; }
.modal-examples .modal-example h4 { margin-bottom: 9px; font-size: .85rem; }
.modal-examples .modal-example pre { max-height: 130px; margin: 0; padding: 10px; overflow: auto; font-size: .7rem; white-space: pre-wrap; }

/* Responsive Design */
@media (max-width: 768px) {
    .container {
        padding: 10px;
    }
    
    header h1 {
        font-size: 1.8em;
        flex-direction: column;
        gap: 10px;
    }
    
    .editor-header {
        flex-direction: column;
        gap: 15px;
        align-items: stretch;
    }
    
    .editor-buttons {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
    }
    
    .example-cards, .docs-grid {
        grid-template-columns: 1fr;
    }
    
    .code-editor {
        flex-direction: column;
    }
    
    .line-numbers {
        display: flex;
        overflow-x: auto;
        padding: 10px;
    }
    
    .line-numbers div {
        margin-right: 20px;
        min-width: 20px;
    }

    .sample-modal-heading,
    .sample-controls { align-items: stretch; flex-direction: column; }

    .sample-controls select { width: 100%; }
}

/* Scrollbar Styling */
::-webkit-scrollbar {
    width: 10px;
    height: 10px;
}

::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 5px;
}

::-webkit-scrollbar-thumb {
    background: #c1c1c1;
    border-radius: 5px;
}

::-webkit-scrollbar-thumb:hover {
    background: #a8a8a8;
}

/* Syntax Highlighting in Output */
.output-console .error {
    color: #fc8181;
    font-weight: bold;
}

.output-console .success {
    color: #68d391;
}

/* Loading Animation */
.loading {
    display: inline-block;
    width: 20px;
    height: 20px;
    border: 3px solid rgba(255,255,255,.3);
    border-radius: 50%;
    border-top-color: white;
    animation: spin 1s ease-in-out infinite;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

/* Dashboard layer */
:root {
    --ink: #17212b;
    --muted: #687681;
    --paper: #f4f6f2;
    --panel: #ffffff;
    --line: #dce4df;
    --teal: #0f766e;
    --teal-dark: #115e59;
    --coral: #e76f51;
    --code: #14232a;
    --code-soft: #1b3239;
}

body {
    background: var(--paper);
    color: var(--ink);
    font-family: 'Noto Sans Assamese', 'Trebuchet MS', sans-serif;
}

body::before {
    content: '';
    position: fixed;
    inset: 0;
    pointer-events: none;
    background-image: linear-gradient(rgba(15, 118, 110, .035) 1px, transparent 1px), linear-gradient(90deg, rgba(15, 118, 110, .035) 1px, transparent 1px);
    background-size: 32px 32px;
}

.container {
    max-width: 1320px;
    padding: 28px 32px 42px;
    position: relative;
}

.app-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 24px;
    padding: 24px 28px;
    border: 1px solid rgba(255, 255, 255, .16);
    border-radius: 16px;
    background: #17343a;
    box-shadow: 0 16px 36px rgba(28, 52, 55, .16);
    color: #f7fbf8;
    text-align: left;
}

.brand-lockup { display: flex; align-items: center; gap: 16px; }
.brand-mark { width: 48px; height: 48px; display: grid; place-items: center; border-radius: 12px; background: #e4f0e7; color: var(--teal-dark); font-size: 20px; }
.app-header h1 { margin: 2px 0 3px; font-size: clamp(1.55rem, 3vw, 2.25rem); letter-spacing: 0; justify-content: flex-start; }
.subtitle { margin: 0; color: #b8cec8; font-size: .95rem; }
.eyebrow { margin: 0; color: #8fc9ba; font: 700 .68rem/1.2 'Trebuchet MS', sans-serif; letter-spacing: .12em; }
.eyebrow span { color: var(--coral); }
.developer-credit { margin: 6px 0 0; color: #d2e9df; font-size: .76rem; }
.header-status, .shortcut-note, .section-count { display: inline-flex; align-items: center; gap: 8px; color: var(--muted); font-size: .8rem; font-weight: 700; }
.header-status { padding: 9px 12px; border: 1px solid rgba(202, 235, 218, .2); border-radius: 999px; color: #d2e9df; background: rgba(255, 255, 255, .06); }
.status-dot { width: 7px; height: 7px; border-radius: 50%; background: #74d69e; box-shadow: 0 0 0 4px rgba(116, 214, 158, .14); }

.workspace-intro { display: flex; align-items: end; justify-content: space-between; margin: 12px 4px 18px; }
.workspace-intro h2 { margin: 5px 0 0; font: 700 clamp(1.3rem, 2.5vw, 1.8rem)/1.2 'Trebuchet MS', sans-serif; letter-spacing: 0; }
.shortcut-note { color: var(--teal-dark); font-size: .78rem; }

.main-content { grid-template-columns: minmax(0, 1.35fr) minmax(320px, .65fr); gap: 18px; }
.editor-section, .output-section, .examples-section, .docs-section { padding: 20px; border: 1px solid var(--line); border-radius: 14px; background: rgba(255, 255, 255, .92); box-shadow: 0 10px 24px rgba(36, 61, 58, .06); }
.editor-section { grid-column: 1; }
.output-section { grid-column: 2; }
.examples-section, .docs-section { grid-column: 1 / -1; }
.editor-header, .output-header { align-items: flex-start; margin-bottom: 14px; padding-bottom: 14px; border-bottom: 1px solid var(--line); }
.panel-title { display: flex; align-items: flex-start; gap: 11px; }
.panel-title h2, .examples-section h2, .docs-section h2 { color: var(--ink); font-size: 1.05rem; }
.panel-title p { margin: 3px 0 0; color: var(--muted); font-size: .76rem; }
.panel-kicker { color: var(--coral); font: 700 .72rem/1 'Trebuchet MS', sans-serif; }
.editor-buttons { display: flex; gap: 7px; }
.btn { padding: 9px 12px; border-radius: 8px; font-size: .82rem; box-shadow: none; }
.run-btn { background: var(--teal); }
.run-btn:hover { background: var(--teal-dark); transform: none; }
.clear-btn { background: #f8e7e2; color: #b34f3c; }
.clear-btn:hover { background: #f4d8d0; transform: none; }
.example-btn { background: #e5f1ec; color: var(--teal-dark); }
.example-btn:hover { background: #d3e8df; transform: none; }
.clear-output-btn { background: transparent; color: var(--muted); border: 1px solid var(--line); }
.clear-output-btn:hover { background: var(--paper); }

.code-editor { min-height: 388px; border: 1px solid #25434a; border-radius: 10px; background: var(--code); }
.line-numbers { min-width: 42px; padding: 16px 10px; background: var(--code-soft); color: #769099; font-size: .8rem; }
#codeInput { min-height: 388px; padding: 16px; color: #d9eee5; background: var(--code); font-size: .92rem; line-height: 1.65; }
.output-console { min-height: 388px; max-height: none; padding: 18px; border-radius: 10px; background: var(--code); color: #d9eee5; font-size: .9rem; }
.welcome-message { padding: 50px 20px; color: #8da6a0; }

.section-heading { display: flex; align-items: end; justify-content: space-between; margin-bottom: 17px; }
.section-heading h2 { margin-top: 5px; }
.section-count { padding: 6px 10px; border-radius: 999px; color: var(--teal-dark); background: #e5f1ec; font-size: .72rem; }
.text-action { border: 0; background: transparent; color: var(--teal-dark); cursor: pointer; font: 700 .78rem 'Noto Sans Assamese', sans-serif; }
.text-action i { margin-left: 4px; font-size: .7rem; }
.example-cards { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-top: 0; }
.example-card { min-height: 150px; padding: 15px; border: 1px solid var(--line); border-radius: 10px; background: #f8faf7; }
.example-card:hover { transform: translateY(-3px); border-color: #8bbcae; box-shadow: 0 10px 20px rgba(36, 61, 58, .08); }
.example-card h3 { margin-bottom: 11px; color: var(--ink); font-size: .98rem; }
.example-card pre { padding: 12px; border-radius: 7px; background: var(--code); color: #b9d9cd; font-size: .72rem; }
.docs-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-top: 0; }
.doc-card { padding: 15px; border: 1px solid var(--line); border-radius: 10px; background: #f8faf7; }
.doc-card h3 { margin-bottom: 9px; color: var(--ink); font-size: .93rem; }
.doc-card li { padding: 6px 0; border-bottom-color: var(--line); color: var(--muted); font-size: .8rem; }
.doc-card code { color: var(--teal-dark); background: #e7f0eb; }
footer { margin-top: 28px; padding: 8px; color: var(--muted); font-size: .78rem; }
.footer-links a { color: var(--teal-dark); }

@media (max-width: 900px) {
    .main-content { grid-template-columns: 1fr; }
    .editor-section, .output-section, .examples-section, .docs-section { grid-column: 1; }
    .example-cards { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 600px) {
    .container { padding: 14px 12px 28px; }
    .app-header { align-items: flex-start; flex-direction: column; gap: 18px; padding: 20px; }
    .header-status { align-self: flex-start; }
    .workspace-intro { align-items: flex-start; flex-direction: column; gap: 10px; }
    .editor-header, .output-header { flex-direction: column; gap: 12px; }
    .editor-buttons { width: 100%; min-width: 0; grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .editor-buttons .btn { flex: 1; min-width: 0; justify-content: center; overflow-wrap: anywhere; }
    .example-cards, .docs-grid { grid-template-columns: 1fr; }
    .section-heading { align-items: flex-start; flex-direction: column; gap: 10px; }
    .code-editor { width: 100%; min-width: 0; flex-direction: row; }
    .line-numbers { display: block; flex: 0 0 40px; width: 40px; min-width: 40px; overflow: hidden; padding: 15px 7px; }
    .line-numbers div { margin-right: 0; min-width: 0; }
    #codeInput { width: auto; min-width: 0; flex: 1; }
}

.typing-btn {
    background: #edf0f8;
    color: #43527a;
}

.typing-btn:hover {
    background: #e0e5f3;
    transform: none;
}

.typing-panel {
    margin: 0 0 14px;
    padding: 14px;
    border: 1px solid var(--line);
    border-radius: 10px;
    background: #f8faf7;
}

.typing-panel[hidden] { display: none; }

.typing-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
}

.typing-panel-header h3 {
    margin-top: 4px;
    color: var(--ink);
    font-size: .95rem;
}

.typing-close {
    width: 32px;
    height: 32px;
    border: 1px solid var(--line);
    border-radius: 7px;
    background: white;
    color: var(--muted);
    cursor: pointer;
}

.typing-group { margin-top: 9px; }
.typing-group-label { display: block; margin-bottom: 5px; color: var(--muted); font-size: .7rem; font-weight: 700; }
.typing-row { display: flex; flex-wrap: wrap; gap: 5px; }
.typing-key {
    min-width: 34px;
    min-height: 32px;
    padding: 4px 8px;
    border: 1px solid #cbd9d2;
    border-radius: 6px;
    background: white;
    color: var(--ink);
    cursor: pointer;
    font: 600 .84rem 'Noto Sans Assamese', sans-serif;
}
.typing-key:hover { border-color: var(--teal); background: #e7f2ed; color: var(--teal-dark); }
.typing-controls { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 11px; padding-top: 10px; border-top: 1px solid var(--line); }
.typing-control { min-width: 86px; color: var(--teal-dark); }

@media (max-width: 600px) {
    .typing-row { gap: 4px; }
    .typing-key { min-width: 30px; padding: 3px 6px; }
}
/* v2.0 compiler output */
.output-console pre { margin: 8px 0 0; white-space: pre-wrap; font-family: 'Courier New', monospace; font-size: .82rem; line-height: 1.55; }
.output-console pre.c-code { max-height: 420px; overflow: auto; padding: 12px; border-radius: 8px; background: rgba(255,255,255,.04); color: #cfe7de; }
.output-console pre.expected { padding: 10px 12px; border-left: 3px solid #68d391; background: rgba(104,211,145,.08); color: #e6f6ee; }
.output-console pre.diag { color: #fbb6b6; }
.output-console pre.diag.warn { color: #f6e05e; }
.output-console .output-label { margin-top: 14px; color: #8da6a0; font-size: .8rem; }
.output-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.small-btn { padding: 6px 12px; font-size: .78rem; background: #25434a; color: #d9eee5; }
.small-btn:hover { background: #2f5860; }
__ASOMIYA_BHASHA_EOF__

cat > "public/web.js" <<'__ASOMIYA_BHASHA_EOF__'
/**
 * Asomiya Bhasha 2.0 playground.
 * Browsers have no C compiler, so the playground translates Asomiya source
 * to C (with full error checking) using the same compiler as the CLI.
 * To run a program natively:  node src/cli.js program.asb
 */

const KEYBOARD = [
    ['স্বৰ', ['অ', 'আ', 'ই', 'ঈ', 'উ', 'ঊ', 'ঋ', 'এ', 'ঐ', 'ও', 'ঔ']],
    ['ব্যঞ্জন', ['ক', 'খ', 'গ', 'ঘ', 'ঙ', 'চ', 'ছ', 'জ', 'ঝ', 'ঞ', 'ট', 'ঠ', 'ড', 'ঢ', 'ণ', 'ত', 'থ', 'দ', 'ধ', 'ন', 'প', 'ফ', 'ব', 'ভ', 'ম', 'য', 'ৰ', 'ল', 'ৱ', 'শ', 'ষ', 'স', 'হ', 'ক্ষ', 'ড়', 'ঢ়', 'য়', 'ৎ']],
    ['চিহ্ন', ['া', 'ি', 'ী', 'ু', 'ূ', 'ৃ', 'ে', 'ৈ', 'ো', 'ৌ', '্', 'ঁ', 'ং', 'ঃ', '়']],
    ['অংক', ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯']],
    ['প্ৰকাৰ', ['পূৰ্ণ', 'পূ৬৪', 'দশমিক', 'আখৰ', 'বাক্য', 'বুলিয়ান', 'শূন্য', 'গঠন', 'গণনা', 'স্থিৰ']],
    ['শব্দ', ['লিখা', 'দেখুওৱা', 'যদি', 'থাকিলে', 'নহলে', 'যেতিয়া', 'প্ৰতিবাৰ', 'লৈকে', 'ক্ৰমে', 'বাছক', 'ক্ষেত্ৰ', 'কাজ', 'উভতি', 'শেষ', 'সত্য', 'মিছা', 'খালি', 'আৰু', 'বা', 'নহয়', 'নতুন', 'মুকলি', 'হিচাপে']],
    ['চিন', ['->', '*', '&', '[', ']', '{', '}', '(', ')', '"', ',', '==', '!=', '<=', '>=']],
];

const STARTERS = {
    hello: 'লিখা "নমস্কাৰ অসম!"\nপূৰ্ণ বছৰ = ২০২৬\nলিখা "এইটো", বছৰ, "চন"',
    struct: 'গঠন বিন্দু\n    পূৰ্ণ x, y\nশেষ\n\nবিন্দু p = {x: ৩, y: ৪}\nলিখা p, p.x * p.x + p.y * p.y',
    pointer: 'কাজ সলনি(পূৰ্ণ* ক, পূৰ্ণ* খ)\n    পূৰ্ণ t = *ক\n    *ক = *খ\n    *খ = t\nশেষ\n\nপূৰ্ণ a = ৩, b = ৭\nসলনি(&a, &b)\nলিখা a, b',
    function: 'কাজ ফেক্ট(পূ৬৪ n) -> পূ৬৪\n    যদি n <= ১ থাকিলে\n        উভতি ১\n    শেষ\n    উভতি n * ফেক্ট(n - ১)\nশেষ\n\nলিখা ফেক্ট(২০)',
};

class AsomiyaWeb {
    constructor() {
        const $ = id => document.getElementById(id);
        this.codeInput = $('codeInput');
        this.outputDiv = $('output');
        this.modal = $('exampleModal');
        this.modalExamples = $('modalExamples');
        this.sampleSearch = $('sampleSearch');
        this.sampleCategory = $('sampleCategory');
        this.sampleCount = $('sampleCount');
        this.typingPanel = $('typingPanel');
        this.typingBtn = $('typingBtn');
        this.typingKeys = $('typingKeys');
        this.runtime = window.AsomiyaRuntime || null;
        this.samples = (this.runtime && this.runtime.samples) || [];
        this.loadedSample = null;
        this.lastC = '';
        this.init();
    }

    init() {
        const on = (id, ev, fn) => { const el = document.getElementById(id); if (el) el.addEventListener(ev, fn); };
        on('runBtn', 'click', () => this.translate());
        on('clearBtn', 'click', () => this.clearCode());
        on('exampleBtn', 'click', () => this.openExampleModal());
        on('typingBtn', 'click', () => this.toggleTypingPanel());
        on('typingClose', 'click', () => this.closeTypingPanel());
        on('clearOutputBtn', 'click', () => this.clearOutput());
        on('docsLink', 'click', e => { e.preventDefault(); this.showDocumentation(); });
        on('footerDocsLink', 'click', e => { e.preventDefault(); this.showDocumentation(); });
        on('aboutLink', 'click', e => { e.preventDefault(); this.showAbout(); });

        document.querySelectorAll('.example-card').forEach(card => card.addEventListener('click', () => this.loadStarter(card.dataset.example)));
        const close = document.querySelector('#exampleModal .close');
        if (close) close.addEventListener('click', () => this.closeExampleModal());
        window.addEventListener('click', e => { if (e.target === this.modal) this.closeExampleModal(); });
        this.modalExamples.addEventListener('click', e => {
            const card = e.target.closest('.modal-example');
            if (card) { this.loadSample(Number(card.dataset.sampleId)); this.closeExampleModal(); }
        });
        this.sampleSearch.addEventListener('input', () => this.renderSampleCatalog());
        this.sampleCategory.addEventListener('change', () => this.renderSampleCatalog());
        this.codeInput.addEventListener('keydown', e => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); this.translate(); }
            if (e.key === 'Tab') { e.preventDefault(); this.insertText('    '); }
        });
        this.codeInput.addEventListener('input', () => this.updateLineNumbers());

        this.fillCategories();
        this.renderTypingKeyboard();
        this.updateLineNumbers();
        if (!this.runtime) this.showMessage("কম্পাইলাৰ (runtime.js) load নহ'ল। 'npm run build' চলাওক।", 'error');
    }

    fillCategories() {
        const cats = (this.runtime && this.runtime.categories) || {};
        this.sampleCategory.replaceChildren(new Option('সকলো বিভাগ', 'all'), ...Object.entries(cats).map(([k, v]) => new Option(v, k)));
    }

    // ---- translation -------------------------------------------------------
    translate() {
        const code = this.codeInput.value;
        if (!code.trim()) { this.showMessage("ক'ড খালি! অনুগ্ৰহ কৰি কিছু ক'ড লিখক।", 'error'); return; }
        if (!this.runtime) { this.showMessage("কম্পাইলাৰ load নহ'ল।", 'error'); return; }
        let res;
        try {
            res = this.runtime.translate(code);
        } catch (err) {
            this.showMessage(`কম্পাইলাৰৰ আভ্যন্তৰীণ ত্ৰুটি: ${err.message}`, 'error');
            return;
        }
        const parts = [];
        if (!res.success) {
            parts.push(this.block('error', `✗ ${res.errors}টা ভুল পোৱা গ'ল`), this.pre(res.diagnostics, 'diag'));
            this.outputDiv.replaceChildren(...parts);
            return;
        }
        this.lastC = res.c;
        parts.push(this.block('success', `✓ কোনো ভুল নাই — C ক'ডলৈ ৰূপান্তৰ সম্পূৰ্ণ`));
        if (res.warnings) parts.push(this.pre(res.diagnostics, 'diag warn'));
        const sample = this.loadedSample;
        if (sample && sample.code === code) {
            parts.push(this.block('label', 'নিজৰ কম্পিউটাৰত চলালে এই ফল পাব (প্ৰত্যাশিত):'), this.pre(sample.expected, 'expected'));
        }
        parts.push(this.block('label', "চলাবলৈ:  node src/cli.js program.asb    ·    C ক'ড (runtime বাদ দি):"));
        const userPart = res.c.split('/* ---- end of runtime ---- */').pop().trim();
        parts.push(this.pre(userPart, 'c-code'));
        const actions = document.createElement('div');
        actions.className = 'output-actions';
        actions.append(
            this.button('C কপি কৰক', 'fa-copy', () => navigator.clipboard && navigator.clipboard.writeText(this.lastC)),
            this.button('program.c ডাউনলোড', 'fa-download', () => this.download('program.c', this.lastC)),
            this.button('program.asb ডাউনলোড', 'fa-download', () => this.download('program.asb', code)),
        );
        parts.push(actions);
        this.outputDiv.replaceChildren(...parts);
    }

    block(cls, text) { const d = document.createElement('div'); d.className = cls === 'label' ? 'output-label' : cls; d.textContent = text; return d; }
    pre(text, cls) { const p = document.createElement('pre'); p.className = cls; p.textContent = text; return p; }
    button(label, icon, fn) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'btn small-btn';
        const i = document.createElement('i'); i.className = `fas ${icon}`;
        b.append(i, ' ' + label);
        b.addEventListener('click', fn);
        return b;
    }
    download(name, text) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
        a.download = name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }
    showMessage(text, cls = 'info') { this.outputDiv.replaceChildren(this.block(cls, text)); }

    // ---- editor helpers ----------------------------------------------------
    insertText(text) {
        const el = this.codeInput;
        const { selectionStart: s, selectionEnd: e, value } = el;
        if (text === 'BACKSPACE') {
            const from = s !== e ? s : Math.max(0, s - 1);
            el.value = value.slice(0, from) + value.slice(e);
            el.setSelectionRange(from, from);
        } else {
            el.value = value.slice(0, s) + text + value.slice(e);
            el.setSelectionRange(s + text.length, s + text.length);
        }
        el.focus();
        this.updateLineNumbers();
    }

    renderTypingKeyboard() {
        this.typingKeys.replaceChildren();
        for (const [label, keys] of KEYBOARD) {
            const group = document.createElement('div'); group.className = 'typing-group';
            const heading = document.createElement('span'); heading.className = 'typing-group-label'; heading.textContent = label;
            const row = document.createElement('div'); row.className = 'typing-row';
            for (const key of keys) {
                const b = document.createElement('button');
                b.type = 'button'; b.className = 'typing-key'; b.dataset.insert = key; b.textContent = key;
                row.appendChild(b);
            }
            group.append(heading, row);
            this.typingKeys.appendChild(group);
        }
        const controls = document.createElement('div'); controls.className = 'typing-controls';
        for (const [label, value] of [['Space', ' '], ['Tab', '    '], ['নতুন শাৰী', '\n'], ['পিছলৈ', 'BACKSPACE']]) {
            const b = document.createElement('button');
            b.type = 'button'; b.className = 'typing-key typing-control'; b.dataset.insert = value; b.textContent = label;
            controls.appendChild(b);
        }
        this.typingKeys.appendChild(controls);
        this.typingKeys.addEventListener('click', e => { const b = e.target.closest('[data-insert]'); if (b) this.insertText(b.dataset.insert); });
    }

    toggleTypingPanel() {
        const open = !this.typingPanel.hidden;
        this.typingPanel.hidden = open;
        this.typingBtn.setAttribute('aria-expanded', String(!open));
        if (!open) this.codeInput.focus();
    }
    closeTypingPanel() { this.typingPanel.hidden = true; this.typingBtn.setAttribute('aria-expanded', 'false'); this.codeInput.focus(); }

    updateLineNumbers() {
        const n = Math.max(this.codeInput.value.split('\n').length, 10);
        const box = document.querySelector('.line-numbers');
        box.replaceChildren(...Array.from({ length: n }, (_, i) => { const d = document.createElement('div'); d.textContent = i + 1; return d; }));
    }

    clearCode() {
        if (confirm("আপুনি নিশ্চিত নেকি ক'ড পৰিষ্কাৰ কৰিবলৈ?")) { this.codeInput.value = ''; this.loadedSample = null; this.updateLineNumbers(); }
    }
    clearOutput() {
        this.outputDiv.innerHTML = '<div class="welcome-message"><p>অসমীয়া ভাষা ২.০লৈ স্বাগতম!</p><p>ক\'ড লিখি "C লৈ ৰূপান্তৰ" টিপক।</p></div>';
    }

    // ---- samples -----------------------------------------------------------
    loadStarter(name) {
        if (!STARTERS[name]) return;
        this.codeInput.value = STARTERS[name];
        this.loadedSample = null;
        this.updateLineNumbers();
        this.translate();
    }
    loadSample(id) {
        const s = this.samples.find(x => x.id === id);
        if (!s) return;
        this.codeInput.value = s.code;
        this.loadedSample = s;
        this.updateLineNumbers();
        this.translate();
    }
    openExampleModal() { this.renderSampleCatalog(); this.modal.style.display = 'flex'; }
    closeExampleModal() { this.modal.style.display = 'none'; }
    renderSampleCatalog() {
        const q = this.sampleSearch.value.trim().toLowerCase();
        const cat = this.sampleCategory.value;
        const visible = this.samples.filter(s => (cat === 'all' || s.category === cat) && (!q || `${s.title} ${s.code}`.toLowerCase().includes(q)));
        this.sampleCount.textContent = `${visible.length} / ${this.samples.length} samples`;
        this.modalExamples.replaceChildren(...visible.map(s => {
            const card = document.createElement('div');
            card.className = 'modal-example'; card.dataset.sampleId = s.id;
            const h = document.createElement('h4'); h.textContent = `${String(s.id).padStart(3, '0')} · ${s.title}`;
            const pre = document.createElement('pre'); pre.textContent = s.code;
            card.append(h, pre);
            return card;
        }));
    }

    // ---- help --------------------------------------------------------------
    showDocumentation() {
        const text = [
            'অসমীয়া ভাষা ২.০ — চমু সহায়',
            '',
            'প্ৰকাৰ:  পূৰ্ণ (৩২-বিট)  পূ৮ পূ১৬ পূ৩২ পূ৬৪  ধ৮ ধ১৬ ধ৩২ ধ৬৪ (চিহ্নহীন)',
            '         দশমিক  দশমিক৩২  আখৰ  বুলিয়ান  বাক্য  শূন্য  ফাইল',
            '         T* (সূচক)  T[n] (তালিকা)  কাজ(T, U) -> R (কাজৰ সূচক)',
            'ঘোষণা:   পূৰ্ণ x = ৫     স্থিৰ পূৰ্ণ N = ১০     পূৰ্ণ[] ক = [১, ২, ৩]',
            'গঠন:     গঠন নাম … শেষ      সংযোগ নাম … শেষ      গণনা নাম … শেষ',
            'কাজ:     কাজ নাম(পূৰ্ণ a) -> পূৰ্ণ … উভতি a … শেষ',
            'চৰ্ত:    যদি c থাকিলে … নহলে যদি c থাকিলে … নহলে … শেষ',
            'বাছক:    বাছক x / ক্ষেত্ৰ ১, ২ / অন্যথা / শেষ',
            'লুপ:     যেতিয়া c … শেষ     প্ৰতিবাৰ i = ১ লৈকে ১০ [ক্ৰমে ২] … শেষ',
            '         প্ৰতিবাৰ (পূৰ্ণ i = ০; i < n; i++) … শেষ     কৰা … শেষ যেতিয়া c',
            '         ভাঙা (break)   আগবাঢ়া (continue)',
            'সূচক:    &x  *p  p->ক্ষেত্ৰ  নতুন(T, n)  মুকলি(p)  আকাৰ(T)  x হিচাপে T',
            'লজিক:    আৰু (&&)  বা (||)  নহয় (!)',
            'আউটপুট:  লিখা a, b (শেষত নতুন শাৰী)   দেখুওৱা a (শেষত space)   ছপা("%d", x)',
            'ইনপুট:   পঢ়া()  পঢ়া_পূৰ্ণ()  পঢ়া_দশমিক()',
            '',
            'সম্পূৰ্ণ বিৱৰণ: docs/spec.md (ভাষাৰ নিৰ্দিষ্টকৰণ আৰু ব্যাকৰণ)',
        ].join('\n');
        this.outputDiv.replaceChildren(this.pre(text, 'help'));
    }
    showAbout() {
        const text = [
            'অসমীয়া ভাষা ২.০',
            'অসমীয়া লিপিত লিখা, C-ৰ সমান ক্ষমতাৰ এটা compiled programming language।',
            'কম্পাইলাৰে অসমীয়া ক\'ডক C11-লৈ ৰূপান্তৰ কৰে; gcc বা clang-এ native program তৈয়াৰ কৰে।',
            '',
            `সংস্কৰণ: ${(this.runtime && this.runtime.VERSION) || '2.0.0'}   ·   লাইচেন্স: MIT`,
            'Developed and open sourced by Er Panchanan Nath',
            'https://github.com/PanchananNath/Asomiya_Bhasha',
        ].join('\n');
        this.outputDiv.replaceChildren(this.pre(text, 'help'));
    }
}

document.addEventListener('DOMContentLoaded', () => { window.asomiyaWeb = new AsomiyaWeb(); });
__ASOMIYA_BHASHA_EOF__

cat > "setup.sh" <<'__ASOMIYA_BHASHA_EOF__'
#!/bin/bash
# অসমীয়া ভাষা ২.০ — setup script
set -e
echo "=========================================="
echo " অসমীয়া ভাষা ২.০ — Asomiya Bhasha compiler"
echo "=========================================="

if ! command -v node >/dev/null 2>&1; then
    echo "✗ Node.js পোৱা নগ'ল। Node.js 16 বা তাতকৈ নতুন ইনষ্টল কৰক: https://nodejs.org"
    exit 1
fi
echo "✓ Node.js: $(node --version)"

CC_FOUND=""
for c in "${CC:-}" cc gcc clang; do
    if [ -n "$c" ] && command -v "$c" >/dev/null 2>&1; then CC_FOUND="$c"; break; fi
done
if [ -z "$CC_FOUND" ]; then
    echo "✗ C কম্পাইলাৰ (gcc বা clang) পোৱা নগ'ল।"
    echo "  Ubuntu/Debian: sudo apt install build-essential"
    echo "  macOS:         xcode-select --install"
    echo "  Windows:       MSYS2 বা WSL-ত gcc ইনষ্টল কৰক"
    exit 1
fi
echo "✓ C compiler: $CC_FOUND"

npm install
chmod +x src/cli.js
npm test

read -p "সকলো ঠাইৰ পৰা 'asomiya' command ব্যৱহাৰ কৰিবলৈ global install কৰিব নেকি? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then npm link; fi

echo ""
echo "আৰম্ভ কৰক:"
echo "  node src/cli.js examples/hello.asb           # compile কৰি চলোৱা"
echo "  node src/cli.js build examples/hello.asb     # native executable"
echo "  node src/cli.js c examples/hello.asb         # তৈয়াৰ হোৱা C ক'ড চোৱা"
echo "  npm run web                                  # playground (http://localhost:8080)"
__ASOMIYA_BHASHA_EOF__

cat > "src/browser.js" <<'__ASOMIYA_BHASHA_EOF__'
'use strict';
/**
 * Browser entry point, bundled by esbuild into public/runtime.js as the
 * global `AsomiyaRuntime`. Browsers have no C compiler, so the playground
 * translates Asomiya to C and reports errors; native execution needs the CLI.
 */
const { compile, VERSION } = require('./compiler');
const samples = require('../examples/catalog');

function translate(code, opts = {}) {
    const res = compile(code, { file: 'playground.asb', asciiDigits: !!opts.asciiDigits, asciiNames: !!opts.asciiNames });
    return {
        success: res.ok,
        c: res.ok ? res.c : '',
        diagnostics: res.diagnostics.formatAll(),
        errors: res.diagnostics.errors.length,
        warnings: res.diagnostics.warnings.length,
    };
}

module.exports = { translate, VERSION, samples, categories: samples.CATEGORIES };
__ASOMIYA_BHASHA_EOF__

cat > "src/checker.js" <<'__ASOMIYA_BHASHA_EOF__'
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
        for (const p of f.params) {
            if (p.type.k === 'void') this.error("পেৰামিটাৰৰ প্ৰকাৰ 'শূন্য' হ'ব নোৱাৰে", p.pos);
            this.declare(scope, { kind: 'var', name: p.name, type: p.type, isParam: true }, p.pos);
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
__ASOMIYA_BHASHA_EOF__

cat > "src/cli.js" <<'__ASOMIYA_BHASHA_EOF__'
#!/usr/bin/env node
'use strict';
/**
 * asomiya — command-line driver for Asomiya Bhasha 2.0.
 */
const fs = require('fs');
const path = require('path');
const { compile, VERSION } = require('./compiler');
const { buildNative, runNative, fileLoader, findCC } = require('./native');

const HELP = `অসমীয়া ভাষা ${VERSION} — অসমীয়া লিপিৰ systems programming language

ব্যৱহাৰ (usage):
  asomiya <ফাইল.asb> [-- args…]        compile কৰি চলোৱা (run-ৰ দৰে)
  asomiya run <ফাইল.asb> [-- args…]    compile কৰি চলোৱা
  asomiya build <ফাইল.asb> [-o নাম]    native executable তৈয়াৰ কৰা
  asomiya c <ফাইল.asb> [-o নাম.c]      তৈয়াৰ হোৱা C ক'ড দেখুওৱা বা সাঁচি ৰখা
  asomiya check <ফাইল.asb>             কেৱল ভুল পৰীক্ষা কৰা
  asomiya -e "<ক'ড>"                   command line-ৰ ক'ড চলোৱা

বিকল্প (options):
  --cc <compiler>     C কম্পাইলাৰ (মূল: cc, gcc বা clang)
  --ascii-digits      লিখা-ই সংখ্যা 0-9 ৰূপত লিখিব (মূল: ০-৯)
  --ascii-names       C ক'ডত অসমীয়া নাম _uXXXX_ ৰূপত লিখা
  -O0 … -O3           optimisation স্তৰ (মূল: -O2)
  -g                  debugger-ৰ বাবে তথ্য ৰখা
  --version, --help

উদাহৰণ:
  asomiya examples/hello.asb
  asomiya build examples/linked_list.asb -o তালিকা
`;

function parseArgs(argv) {
    const o = { cmd: null, file: null, out: null, cc: null, opt: 2, asciiDigits: false, asciiNames: false, debug: false, code: null, args: [] };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--') { o.args = argv.slice(i + 1); break; }
        if (a === '-h' || a === '--help') o.cmd = 'help';
        else if (a === '-v' || a === '--version') o.cmd = 'version';
        else if (a === '-o') o.out = argv[++i];
        else if (a === '--cc') o.cc = argv[++i];
        else if (/^-O[0-3s]$/.test(a)) o.opt = a.slice(2);
        else if (a === '-g') o.debug = true;
        else if (a === '--ascii-digits') o.asciiDigits = true;
        else if (a === '--ascii-names') o.asciiNames = true;
        else if (a === '-e') { o.code = argv[++i]; o.cmd = o.cmd || 'run'; }
        else if (!o.cmd && ['run', 'build', 'c', 'check'].includes(a)) o.cmd = a;
        else if (a.startsWith('-')) { console.error(`অচিনাক্ত বিকল্প: ${a}`); process.exit(2); }
        else if (!o.file) o.file = a;
        else o.args.push(a);
    }
    if (!o.cmd) o.cmd = o.file ? 'run' : 'help';
    return o;
}

function readSource(o) {
    if (o.code != null) return { text: o.code, file: '<-e>' };
    if (!o.file) { console.error('ফাইলৰ নাম দিয়া নাই। asomiya --help চাওক।'); process.exit(2); }
    if (!fs.existsSync(o.file)) { console.error(`ফাইল পোৱা নগ'ল: ${o.file}`); process.exit(2); }
    return { text: fs.readFileSync(o.file, 'utf8'), file: o.file };
}

function report(res) {
    if (res.diagnostics && res.diagnostics.items.length) console.error(res.diagnostics.formatAll());
    if (res.ccError) console.error(res.ccError);
}

function main() {
    const o = parseArgs(process.argv.slice(2));
    if (o.cmd === 'help') { console.log(HELP); return 0; }
    if (o.cmd === 'version') { console.log(`অসমীয়া ভাষা ${VERSION} (C compiler: ${findCC(o.cc) || 'পোৱা নগ\'ল'})`); return 0; }
    const src = readSource(o);
    const opts = { file: src.file, cc: o.cc, opt: o.opt, debug: o.debug, asciiDigits: o.asciiDigits, asciiNames: o.asciiNames };

    if (o.cmd === 'check' || o.cmd === 'c') {
        const res = compile(src.text, Object.assign({ loader: fileLoader }, opts));
        report(res);
        if (!res.ok) return 1;
        if (o.cmd === 'check') { console.log(`✓ ${src.file}: কোনো ভুল নাই`); return 0; }
        if (o.out) { fs.writeFileSync(o.out, res.c); console.error(`✓ C ক'ড সাঁচি থোৱা হ'ল: ${o.out}`); }
        else process.stdout.write(res.c);
        return 0;
    }
    if (o.cmd === 'build') {
        const out = o.out || (o.file ? path.basename(o.file).replace(/\.(asb|asm)$/i, '') : 'program');
        const res = buildNative(src.text, Object.assign({}, opts, { out: path.resolve(out) }));
        report(res);
        if (!res.ok) return 1;
        console.error(`✓ তৈয়াৰ হ'ল: ${out}  (${res.cc})`);
        return 0;
    }
    // run
    const res = runNative(src.text, Object.assign({}, opts, { args: o.args, inherit: true }));
    report(res);
    if (!res.ok) return 1;
    if (res.signal) { console.error(`প্ৰ'গ্ৰামটো ${res.signal} সংকেতত বন্ধ হ'ল`); return 1; }
    return res.status == null ? 1 : res.status;
}

process.exitCode = main();
__ASOMIYA_BHASHA_EOF__

cat > "src/codegen_c.js" <<'__ASOMIYA_BHASHA_EOF__'
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
        this.line('(void)argc; (void)argv;');
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
__ASOMIYA_BHASHA_EOF__

cat > "src/compiler.js" <<'__ASOMIYA_BHASHA_EOF__'
'use strict';
/**
 * Asomiya Bhasha 2.0 — compiler driver (platform independent).
 *   source text → tokens → AST (+ imports) → checked model → C11 text
 * Works in Node.js and in the browser; file access for `আমদানি` goes
 * through the optional `loader(path, fromFile)` callback.
 */
const { tokenize } = require('./lexer');
const { parse } = require('./parser');
const { Checker } = require('./checker');
const { CGen } = require('./codegen_c');
const { Diagnostics, CompileError } = require('./diagnostics');
const { PRELUDE } = require('./runtime');

const VERSION = '2.0.0';
let preludeCache = null;

function parsePrelude() {
    if (!preludeCache) preludeCache = parse(tokenize(PRELUDE, '<মানক>'), '<মানক>').items;
    return JSON.parse(JSON.stringify(preludeCache, (k, v) => (typeof v === 'bigint' ? { $big: v.toString() } : v)), (k, v) => (v && v.$big !== undefined ? BigInt(v.$big) : v));
}

/**
 * Compile Asomiya source to C.
 * @returns {{ok: boolean, c?: string, diagnostics: Diagnostics, ast?: object}}
 */
function compile(source, opts = {}) {
    const file = opts.file || '<উৎস>';
    const diag = new Diagnostics();
    diag.addSource(file, source.normalize('NFC'));
    let items;
    try {
        items = loadFile(source, file, opts, diag, new Set([file]), false);
    } catch (e) {
        if (e instanceof CompileError) { diag.error(e.message, Object.assign({ file: e.file }, e.pos)); return { ok: false, diagnostics: diag }; }
        throw e;
    }
    const checker = new Checker(diag);
    const model = checker.check(parsePrelude(), items);
    if (diag.hasErrors()) return { ok: false, diagnostics: diag };
    let c;
    try {
        c = new CGen(model, { asciiNames: opts.asciiNames, asciiDigits: opts.asciiDigits, file }).generate();
    } catch (e) {
        diag.error(`কম্পাইলাৰৰ আভ্যন্তৰীণ ত্ৰুটি (এইটো কম্পাইলাৰৰ bug; অনুগ্ৰহ কৰি GitHub-ত জনাওক): ${e.message}`, { line: 1, col: 1, file });
        return { ok: false, diagnostics: diag };
    }
    return { ok: true, c, diagnostics: diag, model };
}

function loadFile(source, file, opts, diag, seen, isImport) {
    const ast = parse(tokenize(source, file), file);
    const out = [];
    for (const it of ast.items) {
        if (it.kind === 'Import') {
            if (!opts.loader) throw new CompileError('এই পৰিৱেশত আমদানি (import) সমৰ্থিত নহয়', it.pos, file);
            const loaded = opts.loader(it.path, file);
            if (!loaded) throw new CompileError(`আমদানি কৰিবলগীয়া ফাইল '${it.path}' পোৱা নগ'ল`, it.pos, file);
            if (seen.has(loaded.file)) continue;
            seen.add(loaded.file);
            diag.addSource(loaded.file, loaded.text.normalize('NFC'));
            out.push(...loadFile(loaded.text, loaded.file, opts, diag, seen, true));
            continue;
        }
        if (isImport) it.fromImport = true;
        out.push(it);
    }
    return out;
}

module.exports = { compile, VERSION };
__ASOMIYA_BHASHA_EOF__

cat > "src/diagnostics.js" <<'__ASOMIYA_BHASHA_EOF__'
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
__ASOMIYA_BHASHA_EOF__

cat > "src/index.js" <<'__ASOMIYA_BHASHA_EOF__'
'use strict';
/**
 * Public JavaScript API for Asomiya Bhasha 2.0.
 *
 *   const asomiya = require('asomiya-bhasha');
 *   const { ok, c, diagnostics } = asomiya.compile('লিখা "নমস্কাৰ"');
 *   const run = asomiya.run('লিখা ২ + ৩');   // needs cc/gcc/clang
 *   console.log(run.stdout);                  // "৫\n"
 */
const { compile, VERSION } = require('./compiler');
const { buildNative, runNative, findCC, fileLoader } = require('./native');
const { tokenize } = require('./lexer');
const { parse } = require('./parser');

module.exports = {
    VERSION,
    compile: (source, opts = {}) => compile(source, Object.assign({ loader: fileLoader }, opts)),
    build: buildNative,
    run: runNative,
    findCC,
    tokenize,
    parse: (source, file) => parse(tokenize(source, file), file),
};
__ASOMIYA_BHASHA_EOF__

cat > "src/lexer.js" <<'__ASOMIYA_BHASHA_EOF__'
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
__ASOMIYA_BHASHA_EOF__

cat > "src/native.js" <<'__ASOMIYA_BHASHA_EOF__'
'use strict';
/**
 * Node.js helpers that turn generated C into a native executable with the
 * system C compiler (cc, gcc or clang) and run it.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { compile } = require('./compiler');

function findCC(preferred) {
    const candidates = [preferred, process.env.CC, 'cc', 'gcc', 'clang'].filter(Boolean);
    for (const cc of candidates) {
        const r = spawnSync(cc, ['--version'], { encoding: 'utf8' });
        if (r.status === 0) return cc;
    }
    return null;
}

function fileLoader(importPath, fromFile) {
    const base = fromFile && !fromFile.startsWith('<') ? path.dirname(fromFile) : process.cwd();
    const full = path.resolve(base, importPath);
    if (!fs.existsSync(full)) return null;
    return { file: path.relative(process.cwd(), full) || full, text: fs.readFileSync(full, 'utf8') };
}

/**
 * Compile Asomiya source to a native executable.
 * @returns {{ok, diagnostics, c, exe?, ccOutput?}}
 */
function buildNative(source, opts = {}) {
    const res = compile(source, Object.assign({ loader: fileLoader }, opts));
    if (!res.ok) return res;
    const cc = findCC(opts.cc);
    if (!cc) return Object.assign(res, { ok: false, ccError: 'C কম্পাইলাৰ (cc, gcc বা clang) পোৱা নগ\'ল। gcc বা clang ইনষ্টল কৰক।' });
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'asomiya-'));
    const cFile = opts.cOut || path.join(dir, 'program.c');
    fs.writeFileSync(cFile, res.c);
    const exe = opts.out || path.join(dir, process.platform === 'win32' ? 'program.exe' : 'program');
    const args = ['-std=c11', `-O${opts.opt == null ? 2 : opts.opt}`, '-o', exe, cFile, '-lm'];
    if (opts.debug) args.unshift('-g');
    const r = spawnSync(cc, args, { encoding: 'utf8' });
    if (r.status !== 0) return Object.assign(res, { ok: false, ccError: `C কম্পাইলাৰ (${cc}) বিফল হ'ল:\n${r.stderr || r.stdout}` });
    return Object.assign(res, { exe, cFile, cc, dir });
}

function runNative(source, opts = {}) {
    const b = buildNative(source, opts);
    if (!b.ok) return b;
    const r = spawnSync(b.exe, opts.args || [], { encoding: 'utf8', input: opts.input, stdio: opts.inherit ? 'inherit' : 'pipe', timeout: opts.timeout || 0 });
    if (!opts.keep && b.dir) fs.rmSync(b.dir, { recursive: true, force: true });
    return Object.assign(b, { status: r.status, stdout: r.stdout, stderr: r.stderr, signal: r.signal });
}

module.exports = { buildNative, runNative, findCC, fileLoader };
__ASOMIYA_BHASHA_EOF__

cat > "src/parser.js" <<'__ASOMIYA_BHASHA_EOF__'
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
__ASOMIYA_BHASHA_EOF__

cat > "src/runtime.js" <<'__ASOMIYA_BHASHA_EOF__'
'use strict';
/**
 * C runtime embedded at the top of every generated program, plus the
 * standard prelude: the built-in library, written in Asomiya Bhasha itself
 * as `বাহিৰৰ কাজ` declarations mapped onto C functions.
 */

const RUNTIME_C = String.raw`/* ---- Asomiya Bhasha runtime (asb_rt) ---- */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>
#include <stdbool.h>
#include <math.h>
#include <time.h>

#ifndef ASB_ASCII_DIGITS
#define ASB_ASCII_DIGITS 0
#endif
#if defined(__GNUC__) || defined(__clang__)
#define ASB_RT static inline __attribute__((unused))
#else
#define ASB_RT static inline
#endif

/* Write s to stdout, turning ASCII digits into Assamese digits ০-৯ (U+09E6-U+09EF). */
ASB_RT void asb_rt_put_number(const char *s) {
    for (; *s; s++) {
        if (!ASB_ASCII_DIGITS && *s >= '0' && *s <= '9') {
            char b[3] = { (char)0xE0, (char)0xA7, (char)(0xA6 + (*s - '0')) };
            fwrite(b, 1, 3, stdout);
        } else {
            putchar(*s);
        }
    }
}
ASB_RT void asb_rt_puts(const char *s) { fputs(s, stdout); }
ASB_RT void asb_rt_sp(void) { putchar(' '); }
ASB_RT void asb_rt_nl(void) { putchar('\n'); }
ASB_RT void asb_rt_print_i64(long long v) { char b[32]; snprintf(b, sizeof b, "%lld", v); asb_rt_put_number(b); }
ASB_RT void asb_rt_print_u64(unsigned long long v) { char b[32]; snprintf(b, sizeof b, "%llu", v); asb_rt_put_number(b); }
ASB_RT void asb_rt_print_f64(double v) {
    char b[64];
    if (isnan(v)) { asb_rt_puts("অসংখ্যা"); return; }
    if (isinf(v)) { asb_rt_puts(v > 0 ? "অসীম" : "-অসীম"); return; }
    snprintf(b, sizeof b, "%.15g", v);
    asb_rt_put_number(b);
}
ASB_RT void asb_rt_print_bool(bool v) { asb_rt_puts(v ? "সত্য" : "মিছা"); }
ASB_RT void asb_rt_print_char(char c) { putchar(c); }
ASB_RT void asb_rt_print_cp(int32_t cp) {
    unsigned char b[4]; int n;
    if (cp < 0x80) { b[0] = (unsigned char)cp; n = 1; }
    else if (cp < 0x800) { b[0] = 0xC0 | (cp >> 6); b[1] = 0x80 | (cp & 0x3F); n = 2; }
    else if (cp < 0x10000) { b[0] = 0xE0 | (cp >> 12); b[1] = 0x80 | ((cp >> 6) & 0x3F); b[2] = 0x80 | (cp & 0x3F); n = 3; }
    else { b[0] = 0xF0 | (cp >> 18); b[1] = 0x80 | ((cp >> 12) & 0x3F); b[2] = 0x80 | ((cp >> 6) & 0x3F); b[3] = 0x80 | (cp & 0x3F); n = 4; }
    fwrite(b, 1, (size_t)n, stdout);
}
ASB_RT void asb_rt_print_str(const char *s) { asb_rt_puts(s ? s : "খালি"); }
ASB_RT void asb_rt_print_ptr(const void *p) { if (!p) asb_rt_puts("খালি"); else printf("%p", p); }

/* Input */
ASB_RT char *asb_rt_read_line_from(FILE *f) {
    size_t cap = 64, len = 0; int c = 0;
    char *buf = (char *)malloc(cap);
    if (!buf || !f) { free(buf); return NULL; }
    while ((c = fgetc(f)) != EOF && c != '\n') {
        if (len + 1 >= cap) { char *nb = (char *)realloc(buf, cap *= 2); if (!nb) { free(buf); return NULL; } buf = nb; }
        buf[len++] = (char)c;
    }
    if (c == EOF && len == 0) { free(buf); return NULL; }
    if (len && buf[len - 1] == '\r') len--;
    buf[len] = 0;
    return buf;
}
ASB_RT char *asb_rt_read_line(void) { fflush(stdout); return asb_rt_read_line_from(stdin); }
/* Copy s to out, converting Assamese digits to ASCII digits. */
ASB_RT void asb_rt_to_ascii(const char *s, char *out, size_t cap) {
    size_t k = 0;
    while (*s && k + 1 < cap) {
        const unsigned char *u = (const unsigned char *)s;
        if (u[0] == 0xE0 && u[1] == 0xA7 && u[2] >= 0xA6 && u[2] <= 0xAF) { out[k++] = (char)('0' + (u[2] - 0xA6)); s += 3; }
        else out[k++] = *s++;
    }
    out[k] = 0;
}
ASB_RT long long asb_rt_parse_i64(const char *s) { char b[128]; if (!s) return 0; asb_rt_to_ascii(s, b, sizeof b); return strtoll(b, NULL, 10); }
ASB_RT double asb_rt_parse_f64(const char *s) { char b[128]; if (!s) return 0; asb_rt_to_ascii(s, b, sizeof b); return strtod(b, NULL); }
ASB_RT long long asb_rt_read_i64(void) { char *l = asb_rt_read_line(); long long v = asb_rt_parse_i64(l); free(l); return v; }
ASB_RT double asb_rt_read_f64(void) { char *l = asb_rt_read_line(); double v = asb_rt_parse_f64(l); free(l); return v; }

/* Strings */
ASB_RT char *asb_rt_strdup(const char *s) { size_t n = strlen(s) + 1; char *p = (char *)malloc(n); if (p) memcpy(p, s, n); return p; }
ASB_RT char *asb_rt_concat(const char *a, const char *b) {
    size_t x = strlen(a), y = strlen(b); char *p = (char *)malloc(x + y + 1);
    if (!p) return NULL;
    memcpy(p, a, x); memcpy(p + x, b, y + 1);
    return p;
}
ASB_RT long long asb_rt_utf8_len(const char *s) { long long n = 0; for (; *s; s++) if (((unsigned char)*s & 0xC0) != 0x80) n++; return n; }
ASB_RT char *asb_rt_i64_to_str(long long v) {
    char b[32], *out = (char *)malloc(96), *o = out; const char *s = b;
    if (!out) return NULL;
    snprintf(b, sizeof b, "%lld", v);
    for (; *s; s++) {
        if (!ASB_ASCII_DIGITS && *s >= '0' && *s <= '9') { *o++ = (char)0xE0; *o++ = (char)0xA7; *o++ = (char)(0xA6 + (*s - '0')); }
        else *o++ = *s;
    }
    *o = 0;
    return out;
}
ASB_RT long long asb_rt_time(void) { return (long long)time(NULL); }
ASB_RT int asb_rt_fputs(FILE *f, const char *s) { return fputs(s, f); }
/* ---- end of runtime ---- */
`;

const PRELUDE = String.raw`
# অসমীয়া ভাষা ২.০ — মানক পুথিভঁৰাল (standard library)
# Input / output
বাহিৰৰ কাজ ছপা(বাক্য ধৰণ, ...) -> পূৰ্ণ = "printf"
বাহিৰৰ কাজ পঢ়া() -> বাক্য = "asb_rt_read_line"
বাহিৰৰ কাজ পঢ়া_পূৰ্ণ() -> পূ৬৪ = "asb_rt_read_i64"
বাহিৰৰ কাজ পঢ়া_দশমিক() -> দশমিক = "asb_rt_read_f64"
বাহিৰৰ কাজ সংখ্যালৈ(বাক্য) -> পূ৬৪ = "asb_rt_parse_i64"
বাহিৰৰ কাজ দশমিকলৈ(বাক্য) -> দশমিক = "asb_rt_parse_f64"
বাহিৰৰ কাজ বাক্যলৈ(পূ৬৪) -> বাক্য = "asb_rt_i64_to_str"
# Memory
বাহিৰৰ কাজ সংৰক্ষণ(ধ৬৪) -> শূন্য* = "malloc"
বাহিৰৰ কাজ পুনৰ_সংৰক্ষণ(শূন্য*, ধ৬৪) -> শূন্য* = "realloc"
বাহিৰৰ কাজ মুকলি(শূন্য*) = "free"
বাহিৰৰ কাজ প্ৰতিলিপি(শূন্য*, শূন্য*, ধ৬৪) -> শূন্য* = "memcpy"
বাহিৰৰ কাজ ভৰোৱা(শূন্য*, পূৰ্ণ, ধ৬৪) -> শূন্য* = "memset"
# Strings
বাহিৰৰ কাজ বাক্য_দৈৰ্ঘ্য(বাক্য) -> পূ৬৪ = "strlen"
বাহিৰৰ কাজ তুলনা(বাক্য, বাক্য) -> পূৰ্ণ = "strcmp"
বাহিৰৰ কাজ বাক্য_প্ৰতিলিপি(বাক্য) -> বাক্য = "asb_rt_strdup"
বাহিৰৰ কাজ যোগ_বাক্য(বাক্য, বাক্য) -> বাক্য = "asb_rt_concat"
বাহিৰৰ কাজ আখৰ_সংখ্যা(বাক্য) -> পূ৬৪ = "asb_rt_utf8_len"
# Mathematics (দশমিক)
বাহিৰৰ কাজ বৰ্গমূল(দশমিক) -> দশমিক = "sqrt"
বাহিৰৰ কাজ ঘাত(দশমিক, দশমিক) -> দশমিক = "pow"
বাহিৰৰ কাজ পৰম(দশমিক) -> দশমিক = "fabs"
বাহিৰৰ কাজ ছাইন(দশমিক) -> দশমিক = "sin"
বাহিৰৰ কাজ কছাইন(দশমিক) -> দশমিক = "cos"
বাহিৰৰ কাজ টেন(দশমিক) -> দশমিক = "tan"
বাহিৰৰ কাজ লগ(দশমিক) -> দশমিক = "log"
বাহিৰৰ কাজ লগ১০(দশমিক) -> দশমিক = "log10"
বাহিৰৰ কাজ তল(দশমিক) -> দশমিক = "floor"
বাহিৰৰ কাজ ওপৰ(দশমিক) -> দশমিক = "ceil"
বাহিৰৰ কাজ ঘূৰণীয়া(দশমিক) -> দশমিক = "round"
# Process, time and random numbers
বাহিৰৰ কাজ প্ৰস্থান(পূৰ্ণ) = "exit"
বাহিৰৰ কাজ যাদৃচ্ছিক() -> পূৰ্ণ = "rand"
বাহিৰৰ কাজ বীজ(ধ৩২) = "srand"
বাহিৰৰ কাজ সময়() -> পূ৬৪ = "asb_rt_time"
# Files
বাহিৰৰ কাজ খোলা(বাক্য পথ, বাক্য ধৰণ) -> ফাইল* = "fopen"
বাহিৰৰ কাজ বন্ধ(ফাইল*) -> পূৰ্ণ = "fclose"
বাহিৰৰ কাজ ফাইলত_লিখা(ফাইল*, বাক্য) -> পূৰ্ণ = "asb_rt_fputs"
বাহিৰৰ কাজ ফাইলত_ছপা(ফাইল*, বাক্য ধৰণ, ...) -> পূৰ্ণ = "fprintf"
বাহিৰৰ কাজ ফাইলৰ_শাৰী(ফাইল*) -> বাক্য = "asb_rt_read_line_from"
`;

/** C library functions already declared by the headers the runtime includes. */
const HEADER_SYMBOLS = new Set(('printf fprintf sprintf snprintf puts fputs putchar getchar fgets fopen fclose fread fwrite fflush ' +
    'malloc calloc realloc free exit abort atoi atol strtol strtoll strtod rand srand qsort bsearch abs labs llabs system getenv ' +
    'strlen strcmp strncmp strcpy strncpy strcat strncat strchr strrchr strstr memcpy memmove memset memcmp ' +
    'sqrt pow fabs sin cos tan asin acos atan atan2 exp log log10 log2 floor ceil round fmod hypot time clock').split(' '));

module.exports = { RUNTIME_C, PRELUDE, HEADER_SYMBOLS };
__ASOMIYA_BHASHA_EOF__

cat > "src/types.js" <<'__ASOMIYA_BHASHA_EOF__'
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
__ASOMIYA_BHASHA_EOF__

cat > "tests/expected/arrays.out" <<'__ASOMIYA_BHASHA_EOF__'
মূল: [৫, ২, ৯, ১, ৭]
সজোৱা: [১, ২, ৫, ৭, ৯]
পূৰণফল: [[৫৮, ৬৪], [১৩৯, ১৫৪]]
১ আম
২ কল
৩ লিচু
৪ কমলা
__ASOMIYA_BHASHA_EOF__

cat > "tests/expected/conditions.out" <<'__ASOMIYA_BHASHA_EOF__'
৯৫ → এ+
৮২ → এ
৬৭ → বি
৪৫ → চি
বৰষুণৰ দিন
১৭ অযুগ্ম
১০ আৰু ২০ৰ মাজত
__ASOMIYA_BHASHA_EOF__

cat > "tests/expected/files.out" <<'__ASOMIYA_BHASHA_EOF__'
১ : শাৰী 1
২ : শাৰী 2
৩ : শাৰী 3
__ASOMIYA_BHASHA_EOF__

cat > "tests/expected/functions.out" <<'__ASOMIYA_BHASHA_EOF__'
0 1 1 2 3 5 8 13 21 34 55 
২.২৫ ১৩ ৪২
__ASOMIYA_BHASHA_EOF__

cat > "tests/expected/hello.out" <<'__ASOMIYA_BHASHA_EOF__'
নমস্কাৰ বিশ্ব!
অসমীয়া ভাষালৈ স্বাগতম!
মোৰ নাম ইঞ্জিনিয়াৰ পঞ্চানন নাথ আৰু বয়স ২৮
__ASOMIYA_BHASHA_EOF__

cat > "tests/expected/input.out" <<'__ASOMIYA_BHASHA_EOF__'
আপোনাৰ নাম কি? আপোনাৰ বয়স কিমান? 
নমস্কাৰ, পঞ্চানন
দহ বছৰৰ পিছত আপোনাৰ বয়স হ'ব ৩৮
__ASOMIYA_BHASHA_EOF__

cat > "tests/expected/linked_list.out" <<'__ASOMIYA_BHASHA_EOF__'
৫০ -> ৪০ -> ৩০ -> ২০ -> ১০ -> খালি
১০ -> ২০ -> ৩০ -> ৪০ -> ৫০ -> খালি
__ASOMIYA_BHASHA_EOF__

cat > "tests/expected/loops.out" <<'__ASOMIYA_BHASHA_EOF__'
১০০ লৈকে মৌলিক সংখ্যা: ২৫
১০
৮
৬
৪
২
০
অযুগ্মৰ যোগফল: ২৫
অংকৰ সংখ্যা: ৫
__ASOMIYA_BHASHA_EOF__

cat > "tests/expected/main_args.out" <<'__ASOMIYA_BHASHA_EOF__'
আৰ্গুমেণ্টৰ সংখ্যা: ২
১ ক
২ খ
__ASOMIYA_BHASHA_EOF__

cat > "tests/expected/modules.out" <<'__ASOMIYA_BHASHA_EOF__'
আয়তৰ কালি: ২০
বৃত্তৰ কালি: ১২.৫৬৬৩৭০৬১৪৩৫৯২
__ASOMIYA_BHASHA_EOF__

cat > "tests/expected/pointers.out" <<'__ASOMIYA_BHASHA_EOF__'
সলনিৰ পিছত: ৭ ৩
[১৫, ২৫, ৩৫]
দ্বিতীয়: ২৫ সূচী: ১
[১৫, ৯৯, ৩৫] মিছা
__ASOMIYA_BHASHA_EOF__

cat > "tests/expected/strings.out" <<'__ASOMIYA_BHASHA_EOF__'
বাইট: ৯ আখৰ: ৩
অসম দেশ
সত্য সত্য
১২৪ ১২৪
HELLO
__ASOMIYA_BHASHA_EOF__

cat > "tests/expected/structs.out" <<'__ASOMIYA_BHASHA_EOF__'
{কেন্দ্ৰ: {x: ১, y: ২}, ব্যাসাৰ্ধ: ৩}
কালি: ২৮.২৭৪৩৩৩৮৮২৩০৮১
{x: ১১, y: ২} {x: ১, y: ২}
নিম্নতম বাইট: ৪
অৱস্থা: ২
__ASOMIYA_BHASHA_EOF__

cat > "tests/expected/types.out" <<'__ASOMIYA_BHASHA_EOF__'
৪২ ৯০০৭১৯৯২৫৪৭৪০৯৯৩ ২৫৫ ৩.১৪১৫৯২৬৫৩৫৮৯৭৯ ২.৫ সত্য A অসম ১০০
আকাৰ (বাইট): ৪ ৮ ১ ৮ ১
৩ ৩.৫ ১
৩৬
২০ ২৫৫ ১০ ১০০০০০০
__ASOMIYA_BHASHA_EOF__

cat > "tests/test.js" <<'__ASOMIYA_BHASHA_EOF__'
'use strict';
/**
 * Asomiya Bhasha 2.0 test suite.
 *   node tests/test.js              (uses cc / gcc / clang)
 *   node tests/test.js --cc clang   (pick the C compiler)
 *   node tests/test.js --quick      (skip the 100-sample sweep)
 *
 * Every program is compiled to C, built with the system C compiler and
 * run; the test compares the exact standard output.
 */
const fs = require('fs');
const path = require('path');
const { compile } = require('../src/compiler');
const { runNative, findCC, fileLoader } = require('../src/native');
const catalog = require('../examples/catalog');

const argv = process.argv.slice(2);
const ccArg = argv.includes('--cc') ? argv[argv.indexOf('--cc') + 1] : process.env.TEST_CC;
const quick = argv.includes('--quick');
const cc = findCC(ccArg);
const ROOT = path.join(__dirname, '..');

let passed = 0, failed = 0;
const failures = [];
function record(name, ok, detail) {
    if (ok) { passed++; return; }
    failed++;
    failures.push(`✗ ${name}\n${detail}`);
}

function runProgram(name, code, expected, opts = {}) {
    const r = runNative(code, Object.assign({ file: opts.file || `${name}.asb`, opt: 0, cc: cc, input: opts.input || '', args: opts.args, timeout: 20000 }, opts));
    if (!r.ok) return record(name, false, (r.diagnostics ? r.diagnostics.formatAll() : '') + (r.ccError || ''));
    const ok = r.stdout === expected && (opts.status === undefined || r.status === opts.status);
    record(name, ok, `  প্ৰত্যাশিত: ${JSON.stringify(expected)}\n  পোৱা গ'ল : ${JSON.stringify(r.stdout)} (exit ${r.status})${r.stderr ? '\n  stderr: ' + r.stderr : ''}`);
}

function expectError(name, code, fragment, line) {
    const r = compile(code, { file: `${name}.asb` });
    const errs = r.diagnostics.errors;
    const hit = errs.find(e => e.message.includes(fragment) && (line === undefined || e.pos.line === line));
    record(name, !r.ok && !!hit, `  প্ৰত্যাশিত ভুল: "${fragment}"${line ? ` (শাৰী ${line})` : ''}\n  পোৱা গ'ল: ${r.diagnostics.formatAll() || '(কোনো ভুল নাই)'}`);
}

function expectWarning(name, code, fragment) {
    const r = compile(code, { file: `${name}.asb` });
    record(name, r.ok && r.diagnostics.warnings.some(w => w.message.includes(fragment)), `  প্ৰত্যাশিত সতৰ্কবাণী: "${fragment}"\n  পোৱা গ'ল: ${r.diagnostics.formatAll()}`);
}

// ---------------------------------------------------------------------------
// 1. Language features (exact output)
const UNITS = [
    ['লিখা', 'লিখা "নমস্কাৰ"', 'নমস্কাৰ\n'],
    ['একাধিক মান', 'লিখা ১, "ক", সত্য, ২.৫', '১ ক সত্য ২.৫\n'],
    ['দেখুওৱা', 'দেখুওৱা "ক"\nদেখুওৱা "খ"\nলিখা', 'ক খ \n'],
    ['অগ্ৰাধিকাৰ', 'লিখা ২ + ৩ * ৪, (২ + ৩) * ৪, ১০ - ৪ - ৩, -২ * ৩', '১৪ ২০ ৩ -৬\n'],
    ['পূৰ্ণ হৰণ', 'লিখা ৭ / ২, -৭ / ২, ৭ % ৩, -৭ % ৩', '৩ -৩ ১ -১\n'],
    ['দশমিক', 'লিখা ০.১ + ০.২, ১.০ / ৪, ৭ হিচাপে দশমিক / ২', '০.৩ ০.২৫ ৩.৫\n'],
    ['মিশ্ৰ অংক', 'লিখা 12 + ১২, ২1, ০xFF, ০b101, ১_০০০', '২৪ ২১ ২৫৫ ৫ ১০০০\n'],
    ['bit operators', 'লিখা ১২ & ১০, ১২ | ১০, ১২ ^ ১০, ১ << ৪, ২৫৬ >> ২, ~০', '৮ ১৪ ৬ ১৬ ৬৪ -১\n'],
    ['লজিক', 'লিখা সত্য আৰু মিছা, সত্য বা মিছা, নহয় সত্য, নহয় (১ == ২)', 'মিছা সত্য মিছা সত্য\n'],
    ['?:', 'পূৰ্ণ x = ৭\nলিখা x > ৫ ? "ডাঙৰ" : "সৰু"', 'ডাঙৰ\n'],
    ['যৌগিক নিযুক্তি', 'পূৰ্ণ x = ১০\nx += ৫\nx -= ৩\nx *= ২\nx /= ৪\nx %= ৪\nx <<= ২\nলিখা x', '8\n'.replace('8', '৮')],
    ['++ আৰু --', 'পূৰ্ণ i = ৫\ni++\n++i\ni--\nপূৰ্ণ j = i++\nলিখা i, j', '৭ ৬\n'],
    ['যদি-নহলে যদি', 'পূৰ্ণ n = ৬৭\nযদি n >= ৯০ থাকিলে\n    লিখা "এ+"\nনহলে যদি n >= ৬০ থাকিলে\n    লিখা "বি"\nনহলে\n    লিখা "চি"\nশেষ', 'বি\n'],
    ['যেতিয়া', 'পূৰ্ণ i = ১\nযেতিয়া i <= ৩\n    লিখা i\n    i++\nশেষ', '১\n২\n৩\n'],
    ['কৰা-যেতিয়া', 'পূৰ্ণ i = ১০\nকৰা\n    লিখা i\n    i++\nশেষ যেতিয়া i < ৩', '১০\n'],
    ['প্ৰতিবাৰ ক্ৰমে', 'প্ৰতিবাৰ i = ১০ লৈকে ১ ক্ৰমে -৪\n    দেখুওৱা i\nশেষ\nলিখা', '১০ ৬ ২ \n'],
    ['C প্ৰতিবাৰ', 'প্ৰতিবাৰ (পূৰ্ণ i = ০; i < ৩; i++)\n    দেখুওৱা i\nশেষ\nলিখা', '০ ১ ২ \n'],
    ['ভাঙা আৰু আগবাঢ়া', 'প্ৰতিবাৰ i = ১ লৈকে ১০\n    যদি i % ২ == ০ থাকিলে\n        আগবাঢ়া\n    শেষ\n    যদি i > ৭ থাকিলে\n        ভাঙা\n    শেষ\n    দেখুওৱা i\nশেষ\nলিখা', '১ ৩ ৫ ৭ \n'],
    ['বাছক', 'পূৰ্ণ d = ৩\nবাছক d\n    ক্ষেত্ৰ ১, ২\n        লিখা "ক"\n    ক্ষেত্ৰ ৩\n        লিখা "খ"\n    অন্যথা\n        লিখা "গ"\nশেষ', 'খ\n'],
    ['পুনৰাবৃত্তি', 'কাজ ফিব(পূৰ্ণ n) -> পূৰ্ণ\n    যদি n < ২ থাকিলে\n        উভতি n\n    শেষ\n    উভতি ফিব(n - ১) + ফিব(n - ২)\nশেষ\nলিখা ফিব(২০)', '৬৭৬৫\n'],
    ['ফেৰত প্ৰকাৰ অনুমান', 'কাজ অৰ্ধেক(দশমিক x)\n    উভতি x / ২\nশেষ\nলিখা অৰ্ধেক(৫)', '২.৫\n'],
    ['কাজৰ সূচক', 'কাজ যোগ(পূৰ্ণ a, পূৰ্ণ b) -> পূৰ্ণ\n    উভতি a + b\nশেষ\nকাজ(পূৰ্ণ, পূৰ্ণ) -> পূৰ্ণ f = যোগ\nলিখা f(২, ৩)', '৫\n'],
    ['তালিকা', 'পূৰ্ণ[] ক = [৩, ১, ২]\nক[১] = ৯\nলিখা ক, দৈৰ্ঘ্য(ক), আকাৰ(ক)', '[৩, ৯, ২] ৩ ১২\n'],
    ['২-মাত্ৰাৰ তালিকা', 'পূৰ্ণ[২][৩] m = [[১, ২, ৩], [৪, ৫, ৬]]\nm[১][২] = ০\nলিখা m, m[১][০]', '[[১, ২, ৩], [৪, ৫, ০]] ৪\n'],
    ['শূন্যৰে আৰম্ভ', 'পূৰ্ণ x\nপূৰ্ণ[৩] ক\nবাক্য s\nলিখা x, ক, s', '০ [০, ০, ০] খালি\n'],
    ['সূচক', 'পূৰ্ণ x = ৫\nপূৰ্ণ* p = &x\n*p = ৯\nলিখা x, *p, p == খালি', '৯ ৯ মিছা\n'],
    ['সূচক গণিত', 'পূৰ্ণ[] ক = [১০, ২০, ৩০]\nপূৰ্ণ* p = ক\np += ২\nলিখা *p, *(p - ১), p - ক', '৩০ ২০ ২\n'],
    ['নতুন আৰু মুকলি', 'পূৰ্ণ* p = নতুন(পূৰ্ণ, ৪)\nপ্ৰতিবাৰ i = ০ লৈকে ৩\n    p[i] = i * i\nশেষ\nলিখা p[৩]\nমুকলি(p)', '৯\n'],
    ['গঠন', 'গঠন বিন্দু\n    পূৰ্ণ x, y\nশেষ\nবিন্দু p = {x: ১, y: ২}\nবিন্দু* q = &p\nq->y = ৫\nলিখা p, বিন্দু{৭, ৮}.y', '{x: ১, y: ৫} ৮\n'],
    ['গঠনৰ তালিকা', 'গঠন ছাত্ৰ\n    বাক্য নাম\n    পূৰ্ণ নম্বৰ\nশেষ\nছাত্ৰ[] শ = [{"ক", ১}, {"খ", ২}]\nলিখা শ[১].নাম, শ', 'খ [{নাম: ক, নম্বৰ: ১}, {নাম: খ, নম্বৰ: ২}]\n'],
    ['গণনা', 'গণনা ৰং\n    ৰঙা\n    সেউজীয়া = ৫\n    নীলা\nশেষ\nৰং ৰ = নীলা\nলিখা ৰঙা, সেউজীয়া, ৰ', '০ ৫ ৬\n'],
    ['সংযোগ', 'সংযোগ U\n    ধ৩২ গোটা\n    ধ৮[৪] অংশ\nশেষ\nU u\nu.গোটা = ০x0A0B0C0D\nলিখা u.অংশ[০]', '১৩\n'],
    ['প্ৰকাৰৰ উপনাম', 'প্ৰকাৰ নম্বৰ = পূ৬৪\nনম্বৰ n = ৯০০০০০০০০০\nলিখা n', '৯০০০০০০০০০\n'],
    ['স্থিৰ', 'স্থিৰ পূৰ্ণ N = ৩\nপূৰ্ণ[N * ২] ক\nলিখা দৈৰ্ঘ্য(ক)', '৬\n'],
    ['বাক্য কাজ', 'বাক্য s = যোগ_বাক্য("অসম", "ীয়া")\nলিখা s, দৈৰ্ঘ্য(s), আখৰ_সংখ্যা(s), তুলনা(s, "অসমীয়া") == ০', 'অসমীয়া ২১ ৭ সত্য\n'],
    ['আখৰ[]', 'আখৰ[১৬] ব = "abc"\nব[০] = \'X\'\nলিখা ব, দৈৰ্ঘ্য(ব), আকাৰ(ব)', 'Xbc ৩ ১৬\n'],
    ['গণিত', 'লিখা বৰ্গমূল(১৬.০), ঘাত(২, ১০), পৰম(-৩.৫), তল(২.৭), ওপৰ(২.১)', '৪ ১০২৪ ৩.৫ ২ ৩\n'],
    ['বিশ্বব্যাপী চলক', 'পূৰ্ণ গণক = ০\nকাজ বঢ়া()\n    গণক++\nশেষ\nবঢ়া()\nবঢ়া()\nলিখা গণক', '২\n'],
    ['ইনপুট', 'বাক্য নাম = পঢ়া()\nপূ৬৪ n = পঢ়া_পূৰ্ণ()\nলিখা নাম, n * ২', 'অসম ৪২\n', { input: 'অসম\n২১\n' }],
    ['ASCII অংক', 'লিখা ১২৩, ৪.৫', '123 4.5\n', { asciiDigits: true }],
    ['ASCII নাম', 'পূৰ্ণ ক = ৫\nলিখা ক', '৫\n', { asciiNames: true }],
    ['মূল কাজ', 'কাজ মূল() -> পূৰ্ণ\n    লিখা "ক"\n    উভতি ৩\nশেষ', 'ক\n', { status: 3 }],
    ['মূল আৰ্গুমেণ্ট', 'কাজ মূল(পূৰ্ণ n, বাক্য* a) -> পূৰ্ণ\n    লিখা n, a[১]\n    উভতি ০\nশেষ', '২ অসম\n', { args: ['অসম'] }],
    ['প্ৰস্থান', 'লিখা "ক"\nপ্ৰস্থান(৪)\nলিখা "খ"', 'ক\n', { status: 4 }],
    ['বাহিৰৰ কাজ', 'বাহিৰৰ কাজ abs(পূৰ্ণ) -> পূৰ্ণ\nলিখা abs(-৭)', '৭\n'],
    ['danda', 'লিখা "ক"। লিখা "খ"', 'ক\nখ\n'],
    // regressions for the defects found in v1.0.0 (D1–D10)
    ['D1 else-if ভিতৰত', 'কাজ g(পূৰ্ণ n) -> বাক্য\n    যদি n > ১ থাকিলে\n        উভতি "ক"\n    নহলে যদি n > ০ থাকিলে\n        উভতি "খ"\n    নহলে\n        উভতি "গ"\n    শেষ\nশেষ\nপ্ৰতিবাৰ i = ০ লৈকে ২\n    দেখুওৱা g(i)\nশেষ\nলিখা "শেষত"', 'গ খ ক শেষত\n'],
    ['D2 call statement', 'কাজ ক(পূৰ্ণ a)\n    লিখা a\nশেষ\nক(৫)', '৫\n'],
    ['D5 precomposed nukta', 'লিখা নহয় মিছা', 'সত্য\n'],
    ['D7 a1 নাম', 'পূৰ্ণ a1 = ৫\nলিখা a1', '৫\n'],
    ['D9 m[i][j]', 'পূৰ্ণ[২][২] m = [[১, ২], [৩, ৪]]\nলিখা m[১][০]', '৩\n'],
    ['D10 loop চলকৰ পৰিসৰ', 'পূৰ্ণ i = ১০০\nপ্ৰতিবাৰ i = ১ লৈকে ২\nশেষ\nলিখা i', '১০০\n'],
];

// 2. Diagnostics: the compiler must reject these with a clear message
const ERRORS = [
    ['অপৰিভাষিত নাম', 'লিখা ক', "অপৰিভাষিত নাম 'ক'", 1],
    ['নাম পৰামৰ্শ', 'পূৰ্ণ যোগফল = ১\nলিখা যোগফ', "আপুনি 'যোগফল' বুজাইছিল নেকি", 2],
    ['ভুল প্ৰকাৰ', 'পূৰ্ণ x = "অসম"', "'বাক্য' মান 'পূৰ্ণ'-লৈ দিব নোৱাৰি", 1],
    ['দশমিক → পূৰ্ণ', 'দশমিক d = ১.৫\nপূৰ্ণ i = d', "হিচাপে", 2],
    ['সীমাৰ বাহিৰৰ মান', 'ধ৮ b = ৩০০', 'সীমাৰ', 1],
    ['আৰ্গুমেণ্টৰ সংখ্যা', 'কাজ f(পূৰ্ণ a) -> পূৰ্ণ\n    উভতি a\nশেষ\nলিখা f(১, ২)', '১টা আৰ্গুমেণ্ট লয়', 4],
    ['প্ৰভাৱহীন বিবৃতি', 'পূৰ্ণ x = ১\nx + ১', 'কোনো প্ৰভাৱ নাই', 2],
    ['শেষ নাই', 'যদি সত্য থাকিলে\n    লিখা "ক"', "'শেষ' নাই", 1],
    ['অতিৰিক্ত শেষ', 'লিখা "ক"\nশেষ', "অপ্ৰত্যাশিত 'শেষ'", 2],
    ['থাকিলে নাই', 'যদি সত্য\n    লিখা "ক"\nশেষ', "'থাকিলে' প্ৰত্যাশিত", 1],
    ['বাক্য +', 'বাক্য s = "ক" + "খ"', "বাক্য '+' দি জোৰা নাযায়", 1],
    ['. বনাম ->', 'গঠন P\n    পূৰ্ণ a\nশেষ\nP* p = খালি\nলিখা p.a', "'->' লিখক", 5],
    ['অজ্ঞাত ক্ষেত্ৰ', 'গঠন P\n    পূৰ্ণ a\nশেষ\nP p\nলিখা p.b', "'b' নামৰ ক্ষেত্ৰ নাই", 5],
    ['স্থিৰ সলনি', 'স্থিৰ পূৰ্ণ N = ১\nN = ২', 'স্থিৰ', 2],
    ['দুবাৰ ঘোষণা', 'পূৰ্ণ x = ১\nপূৰ্ণ x = ২', 'আগতেই ঘোষণা', 2],
    ['শূন্যৰে হৰণ', 'লিখা ১ / ০', 'শূন্যৰে হৰণ', 1],
    ['স্থিৰ সূচী', 'পূৰ্ণ[৩] ক\nলিখা ক[৫]', 'সীমাৰ', 2],
    ['ভাঙা বাহিৰত', 'ভাঙা', "'ভাঙা' কেৱল", 1],
    ['উভতি বাহিৰত', 'উভতি ৫', "'উভতি' কেৱল কাজৰ ভিতৰত", 1],
    ['শূন্য ফেৰত', 'কাজ f()\n    উভতি\nশেষ\nপূৰ্ণ x = f()', "'শূন্য' মান", 4],
    ['নিজৰ ভিতৰত গঠন', 'গঠন A\n    A ভিতৰ\nশেষ', 'নিজকেই', 1],
    ['অচিনাক্ত চিহ্ন', 'লিখা ৫ @ ৩', 'অচিনাক্ত চিহ্ন', 1],
    ['মূলৰ বাহিৰৰ বিবৃতি', 'কাজ মূল() -> পূৰ্ণ\n    উভতি ০\nশেষ\nলিখা "ক"', "'মূল' কাজ থাকিলে", 4],
    ['ফেৰত প্ৰকাৰ লাগে', 'কাজ f(পূৰ্ণ n)\n    উভতি f(n - ১)\nশেষ\nলিখা f(৩)', "'-> প্ৰকাৰ' লিখক", 2],
];

const WARNINGS = [
    ['চৰ্তত =', 'পূৰ্ণ x = ১\nযদি x = ২ থাকিলে\n    লিখা x\nশেষ', "'==' লিখক"],
    ['বাক্য ==', 'বাক্য a = "ক"\nলিখা a == "ক"', 'তুলনা(ক, খ)'],
    ['সকলো পথে উভতি নাই', 'কাজ f(পূৰ্ণ n) -> পূৰ্ণ\n    যদি n > ০ থাকিলে\n        উভতি ১\n    শেষ\nশেষ\nলিখা f(১)', 'সকলো পথে'],
];

// ---------------------------------------------------------------------------
console.log('অসমীয়া ভাষা পৰীক্ষা (Asomiya Bhasha tests)');
console.log('======================================');
if (!cc) {
    console.log('✗ C কম্পাইলাৰ (cc / gcc / clang) পোৱা নগ\'ল — native পৰীক্ষা চলাব নোৱাৰি।');
    process.exit(1);
}
console.log(`C compiler: ${cc}\n`);

const t0 = Date.now();
for (const [name, code, out, opts] of UNITS) runProgram(`ভাষা: ${name}`, code, out, opts);
for (const [name, code, frag, line] of ERRORS) expectError(`ভুল: ${name}`, code, frag, line);
for (const [name, code, frag] of WARNINGS) expectWarning(`সতৰ্কবাণী: ${name}`, code, frag);

// 3. Example programs (golden output in tests/expected/<name>.out)
const exDir = path.join(ROOT, 'examples');
for (const f of fs.readdirSync(exDir).filter(x => x.endsWith('.asb')).sort()) {
    const name = f.replace(/\.asb$/, '');
    const expFile = path.join(__dirname, 'expected', `${name}.out`);
    if (!fs.existsSync(expFile)) { record(`উদাহৰণ: ${f}`, false, '  tests/expected/ ত প্ৰত্যাশিত ফল নাই'); continue; }
    const inFile = path.join(exDir, `${name}.in`);
    const argsFile = path.join(exDir, `${name}.args`);
    const cwd = process.cwd();
    process.chdir(exDir);
    runProgram(`উদাহৰণ: ${f}`, fs.readFileSync(path.join(exDir, f), 'utf8'), fs.readFileSync(expFile, 'utf8'), {
        file: f, input: fs.existsSync(inFile) ? fs.readFileSync(inFile, 'utf8') : '',
        args: fs.existsSync(argsFile) ? fs.readFileSync(argsFile, 'utf8').trim().split(/\s+/) : [],
    });
    process.chdir(cwd);
}
fs.rmSync(path.join(exDir, 'asomiya_demo.txt'), { force: true });

// 4. The 100 graded samples
if (!quick) for (const s of catalog) runProgram(`নমুনা ${String(s.id).padStart(3, '0')} (${s.category}) ${s.title}`, s.code, s.expected);

const secs = ((Date.now() - t0) / 1000).toFixed(1);
if (failures.length) console.log(failures.join('\n\n') + '\n');
console.log(`মুঠ পৰীক্ষা: ${passed + failed}   পাছ: ${passed}   ফেইল: ${failed}   (${secs} s)`);
console.log(`Total: ${passed + failed}   passed: ${passed}   failed: ${failed}`);
process.exit(failed ? 1 : 0);
__ASOMIYA_BHASHA_EOF__

cat > "vercel.json" <<'__ASOMIYA_BHASHA_EOF__'
{
  "version": 2,
  "framework": null,
  "buildCommand": "npm run build",
  "outputDirectory": "public",
  "cleanUrls": true
}
__ASOMIYA_BHASHA_EOF__

chmod +x src/cli.js setup.sh

echo "→ npm install…"
npm install --no-audit --no-fund

echo "→ Building the playground bundle (public/runtime.js)…"
npm run build --silent

CC_FOUND=""
for c in "${CC:-}" cc gcc clang; do
    if [ -n "$c" ] && command -v "$c" >/dev/null 2>&1; then CC_FOUND="$c"; break; fi
done
if [ -z "$CC_FOUND" ]; then
    echo ""
    echo "⚠ C compiler (gcc/clang) পোৱা নগ'ল — files install হ'ল, কিন্তু tests চলোৱা নহ'ল।"
    echo "  Install gcc or clang (Ubuntu: sudo apt install build-essential, macOS: xcode-select --install), then run: npm test"
    exit 0
fi

echo "→ Running the test suite with $CC_FOUND…"
npm test

echo ""
echo "✓ অসমীয়া ভাষা ২.০ install সম্পূৰ্ণ হ'ল।"
echo "  node src/cli.js examples/hello.asb"
echo "  node src/cli.js c examples/structs.asb     # generated C"
echo "  Spec: docs/spec.md   ·   Tutorial: docs/syntax.md   ·   Changes: CHANGELOG.md"
)
