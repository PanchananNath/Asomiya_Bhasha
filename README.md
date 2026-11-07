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
