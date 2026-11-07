# অসমীয়া ভাষা (Asomiya Bhasha) 2.1


<img width="254" height="254" alt="logo" src="https://github.com/user-attachments/assets/53ece51a-409f-49f7-9a58-40ef8b11c380" />

অসমীয়া লিপিত লিখা, **C-ৰ সমান ক্ষমতাৰ** এটা statically typed, compiled programming language। কম্পাইলাৰৰ তিনিটা back end আছে: **C11** (gcc/clang-এ native executable বনায়), **LLVM IR** (clang; gdb/lldb-ৰ বাবে DWARF debug তথ্যসহ), আৰু **WebAssembly** (browser বা Node.js-তে চলে, C কম্পাইলাৰ নালাগে)।

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

**Asomiya Bhasha 2.1** is a systems programming language whose keywords, identifiers and numerals are Assamese. It has the capabilities of C — fixed-size integer types, floating point, pointers and pointer arithmetic, manual heap memory, arrays, structs, unions, enums, function pointers, separate modules and direct calls into any C library — with a few safety and teaching improvements: every variable starts at zero, implicit float-to-integer conversion is an error, `লিখা` prints numbers in Assamese digits, and all compiler messages are in Assamese with the offending line and a caret.

The compiler is written in JavaScript (Node.js 16+). One front end feeds three back ends:

```text
source → lexer → parser → AST → type checker ─┬─ C11 generator ───────→ gcc / clang ──────→ native executable   (default)
                                               ├─ LLVM IR generator ───→ clang -c + link ──→ native executable   (--backend llvm, -g: DWARF)
                                               └─ WebAssembly emitter ─→ .wasm + JS host ─→ browser / Node.js    (--backend wasm)
```

All three back ends give the same output on the whole test suite.

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

- Node.js 16 বা তাৰ পিছৰ (WebAssembly back end-ৰ বাবে এইটোৱেই যথেষ্ট)
- C back end (মূল): এটা C11 কম্পাইলাৰ — gcc 9+ বা clang 10+ (`cc` হিচাপে বা `--cc` দি)
  - Ubuntu/Debian: `sudo apt install build-essential`
  - macOS: `xcode-select --install`
  - Windows: MSYS2 UCRT64-ৰ gcc (`pacman -S mingw-w64-ucrt-x86_64-gcc`) বা WSL
- LLVM back end: ওপৰৰ C কম্পাইলাৰৰ লগতে clang 15+ (`sudo apt install clang`; Windows-ত `mingw-w64-ucrt-x86_64-clang` বা LLVM-ৰ installer)
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

# LLVM back end
node src/cli.js run --backend llvm examples/structs.asb
node src/cli.js build --backend llvm -g -O0 examples/structs.asb   # gdb ./structs, lldb ./structs
node src/cli.js ll examples/structs.asb                            # LLVM IR চোৱা

# WebAssembly back end (C কম্পাইলাৰ নালাগে)
node src/cli.js run --backend wasm examples/loops.asb
node src/cli.js wasm examples/loops.asb                            # loops.wasm
```

Options: `--backend c|llvm|wasm`, `--cc gcc|clang`, `--clang <path>`, `-O0`…`-O3`, `-g`, `--ascii-digits` (print 0–9 instead of ০–৯), `--ascii-names` (C output uses `_uXXXX_` names). `npm link`-ৰ পিছত `node src/cli.js`-ৰ সলনি `asomiya` লিখিব পাৰি।

With `--backend llvm -g`, debuggers show the Assamese source, function and variable names:

```text
$ gdb ./dbg
(gdb) break যোগফল
(gdb) run
Breakpoint 1, যোগফল (ক=3, খ=4) at dbg.asb:7
7	    পূৰ্ণ ফল = ক + খ
```

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

The playground **runs programs in the browser**: ▶ চলাওক compiles them to WebAssembly with the same compiler and runs them in a Web Worker, with a 10-second time limit, an input box for `পঢ়া()`, and run-time errors explained in Assamese (null pointer, division by zero, endless recursion, double `মুকলি`). The **C** and **LLVM IR** buttons show the code the native back ends generate. For the 100 built-in samples it checks the output against the expected one. Deployed as a static site (`npm run build` writes `public/runtime.js` and `public/worker.js`).

## JavaScript API

```js
const asomiya = require('./src/index');
const { ok, c, diagnostics } = asomiya.compile('লিখা "নমস্কাৰ"');               // C text
const { ll } = asomiya.compile('লিখা "নমস্কাৰ"', { backend: 'llvm', debug: true }); // LLVM IR
const { wasm } = asomiya.compile('লিখা "নমস্কাৰ"', { backend: 'wasm' });            // Uint8Array
const run = asomiya.run('লিখা ২ + ৩', { input: '' });                            // gcc/clang
const run2 = asomiya.run('লিখা ২ + ৩', { backend: 'wasm' });                    // Node.js only
console.log(run.stdout, run2.stdout);                                               // "৫\n" "৫\n"
```

## Tests

```bash
npm test               # 193 checks: language features, diagnostics, examples, 100 samples
npm run test:clang     # the same with clang
npm run test:llvm      # the same through the LLVM back end
npm run test:wasm      # the same through the WebAssembly back end
npm run test:all       # all three back ends
npm run test:quick     # skip the 100-sample sweep
```

Every check compiles the program, builds and runs it, and compares the exact output. The generated C compiles without warnings under `gcc` and `clang` with `-Wall -Wextra -pedantic`. All three back ends pass on Linux (gcc, clang) and Windows (MinGW-w64).

## Project structure

| Path | Purpose |
| --- | --- |
| [src/lexer.js](src/lexer.js) | Source text → tokens (NFC normalisation, Assamese digits, keywords) |
| [src/parser.js](src/parser.js) | Tokens → AST (recursive descent + precedence climbing) |
| [src/types.js](src/types.js) | Type representation and conversion rules |
| [src/checker.js](src/checker.js) | Name resolution, type checking, Assamese diagnostics |
| [src/codegen_c.js](src/codegen_c.js) | Checked AST → C11 |
| [src/codegen_llvm.js](src/codegen_llvm.js) | Checked AST → LLVM IR, with DWARF debug metadata |
| [src/codegen_wasm.js](src/codegen_wasm.js) | Checked AST → WebAssembly binary (no external tools) |
| [src/wasm_host.js](src/wasm_host.js) | WebAssembly host runtime: printing, input, heap, C library subset, files |
| [src/wasm_run.js](src/wasm_run.js) | Runs WebAssembly programs in Node.js (with time limit) |
| [src/wasm_worker.js](src/wasm_worker.js) | Runs WebAssembly programs in the playground's Web Worker |
| [src/runtime.js](src/runtime.js) | C runtime and the standard library prelude |
| [src/compiler.js](src/compiler.js) | Compiler driver (works in Node.js and browsers) |
| [src/native.js](src/native.js) | Invokes gcc/clang (C and LLVM back ends) and runs the executable |
| [src/cli.js](src/cli.js) | `asomiya` command-line tool |
| [src/index.js](src/index.js) | JavaScript API |
| [src/browser.js](src/browser.js) | Playground bundle entry point |
| [examples/](examples) | 14 example programs and the 100-sample catalogue |
| [tests/](tests) | Test suite and golden outputs |
| [docs/spec.md](docs/spec.md) | Language specification and grammar |
| [docs/syntax.md](docs/syntax.md) | Tutorial-style guide |
| [docs/roadmap.md](docs/roadmap.md) | Stage 2 (LLVM, WebAssembly — done) and Stage 3 (MLIR) |
| [public/](public) | Browser playground |

<img width="5828" height="7291" alt="diagram" src="https://github.com/user-attachments/assets/a17c88c7-d675-42db-acc9-782b1e00743c" />

*The diagram above shows the version 1 interpreter architecture.*

## License

MIT. Copyright (c) Er Panchanan Nath.
