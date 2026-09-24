# অসমীয়া ভাষা (Asomiya Bhasha)

অসমীয়া নাম, কীৱৰ্ড আৰু সংখ্যাৰে লিখিব পৰা এটা সৰু শিক্ষামূলক programming language prototype। Runtime-টো Node.js-ত চলে আৰু lexer, parser, AST আৰু interpreter-ৰে গঠিত।

**Developed by:** Er Panchanan Nath  
**Open source project by:** Er Panchanan Nath  
**Original copyright:** Er Panchanan Nath

## Introduction

**Asomiya Bhasha** is a small educational programming language prototype designed to allow programming concepts to be explored using Assamese identifiers, keywords, and numerals.

The runtime is implemented in Node.js and follows a simple:

**lexer → parser → AST → interpreter**

architecture.

The **Node.js runtime is the canonical interpreter**. The web playground uses a generated browser bundle of the same runtime, keeping language behavior consistent between CLI and browser execution.

---

## Current Status

The core interpreter milestone is complete.

The language currently supports:

* Assamese and ASCII identifiers
* Underscores in identifiers
* Assamese and ASCII numerals
* Numbers, strings, booleans, and lists
* `লিখা` output statement
* Variable declarations
* Variable assignment
* Comments
* Arithmetic operators
* Comparison operators
* Logical operators
* Unary operators
* `যদি`, `নহলে`, and `নহলে যদি` conditional statements
* `যেতিয়া` while loops
* `প্ৰতিবাৰ চলক = আৰম্ভ লৈকে শেষ` range loops
* Functions
* Typed parameters
* `উভতি` return statements
* `পঢ়া()` input builtin
* `দৈৰ্ঘ্য()` builtin
* Input providers
* Array indexing
* List element assignment
* Command-line interface (CLI)
* REPL
* Source-file execution
* Runnable example programs
* 100 categorized sample programs
* Browser playground
* Searchable samples
* Assamese on-screen keyboard

> **Important:** The project is still a prototype. The Node.js runtime is the canonical implementation, while the web playground uses a generated browser bundle of the same runtime.

---


## বৰ্তমান অৱস্থা

Core interpreter milestone সম্পূৰ্ণ:

- Assamese আৰু ASCII identifier, underscore, আৰু Assamese/ASCII সংখ্যা
- সংখ্যা, বাক্য, বুলিয়ান আৰু তালিকা
- `লিখা`, variable declaration, assignment আৰু comments
- arithmetic, comparison, logical আৰু unary operators
- `যদি`, `নহলে`, `নহলে যদি`, `যেতিয়া`
- `প্ৰতিবাৰ চলক = আৰম্ভ লৈকে শেষ` range loop
- functions, typed parameters, `উভতি`
- input provider-সহ `পঢ়া()` আৰু `দৈৰ্ঘ্য()` builtin
- array indexing আৰু list element assignment
- CLI, REPL, file execution আৰু example programs
- 100 categorized sample programs for learning and experimentation
- browser playground with canonical runtime, searchable samples, and an Assamese on-screen keyboard

এইটো এতিয়াও prototype। Node.js runtime-টোৱেই canonical interpreter, আৰু web playground-এ build কৰা একে runtime-ৰ browser bundle ব্যৱহাৰ কৰে।

## প্ৰয়োজনীয়তা

- Node.js 14 বা তাৰ পিছৰ version
- npm, Node.js-ৰ সৈতে অন্তৰ্ভুক্ত
- Git, GitHub-ৰ পৰা clone কৰিবলৈ

Node.js version check কৰক:

```powershell
node --version
npm --version
```

এই project-টো Python project নহয়। JavaScript dependencies-ৰ authoritative source হৈছে `package.json` আৰু `package-lock.json`।

## Installation

### Windows আৰু macOS/Linux

Repository clone কৰি project folder-ত যাওক:

```powershell
git clone https://github.com/PanchananNath/Asomiya_Bhasha.git
cd asomiya-bhasha
```

Dependencies install কৰক:

```bash
npm ci
```

`package-lock.json` নথকা fresh checkout-ত `npm install` ব্যৱহাৰ কৰিব পাৰি। Windows-ত `setup.sh` Bash script-ৰ সলনি ওপৰৰ commands ব্যৱহাৰ কৰক। macOS/Linux-ত optional automated setup:

```bash
chmod +x setup.sh
./setup.sh
```

### Configuration

এই prototype-ৰ বাবে কোনো `.env` file বা external service configuration প্ৰয়োজন নাই।

- Source files UTF-8 encoding-ত save কৰিব লাগে।
- CLI-এ local files execute কৰে।
- `npm run web`-এ `public` folder-ৰ development server `http://localhost:8080`-ত আৰম্ভ কৰে। Port ব্যস্ত থাকিলে `npx live-server public --port=8081` ব্যৱহাৰ কৰক।
- `পঢ়া()` ব্যৱহাৰ কৰা JavaScript program-ত input provider দিব লাগে; details [docs/syntax.md](docs/syntax.md)-ত আছে।

## Quick Start

```bash
node src/cli.js examples/hello.asm
npm test
```

REPL:

```bash
node src/cli.js --repl
```

Web demo:

```bash
npm run web
```

তাৰ পিছত `http://localhost:8080` খোলক।

Build only the browser runtime bundle:

```bash
npm run build
```

The web editor includes an `অসমীয়া টাইপ` keyboard beside the Run button. It inserts Assamese letters, signs, numerals, keywords, spaces, new lines, and backspaces at the current cursor position.

## Reproduce From A Clean System

The following sequence reproduces the current project on a new machine:

```bash
git clone https://github.com/PanchananNath/Asomiya_Bhasha.git
cd asomiya-bhasha
npm ci
npm test
node src/cli.js examples/hello.asm
```

Expected test result:

```text
22 tests passed
0 tests failed
```

Run a new program:

```bash
node src/cli.js path/to/program.asm
```

Run the web playground:

```bash
npm run web
```

The Node.js interpreter is the canonical runtime. The browser playground uses a generated browser bundle of the same lexer, parser, AST, and interpreter, so language behavior stays consistent between CLI and web execution.



## উদাহৰণ

```asm
সংখ্যা বয়স = ২৫
বাক্য নাম = "ইঞ্জিনিয়াৰ পঞ্চানন নাথ"

লিখা "নমস্কাৰ " + নাম

যদি বয়স >= ১৮ থাকিলে
	লিখা "প্ৰাপ্তবয়স্ক"
নহলে
	লিখা "শিশু"
শেষ

সংখ্যা i = ১
যেতিয়া i <= ৩
	লিখা i
	i = i + ১
শেষ
```

Supported keywords include `লিখা`, `সংখ্যা`, `বাক্য`, `বুলিয়ান`, `তালিকা`, `সত্য`, `মিছা`, `যদি`, `নহলে`, `যেতিয়া`, `কাজ`, `উভতি`, `দৈৰ্ঘ্য`, `আৰু`, `বা`, `নহয়`, `খালি`, and `শেষ`.

Detailed syntax notes are in [docs/syntax.md](docs/syntax.md). Runnable samples are in [examples](examples).

Input can be provided through the JavaScript API:

```js
const asomiya = new AsomiyaBhasha({ input: () => "অসম" });
asomiya.run(`বাক্য নাম = পঢ়া()
লিখা নাম`);
```

## Project Structure

| Path | Purpose |
| --- | --- |
| [src/lexer.js](src/lexer.js) | Source code to tokens |
| [src/parser.js](src/parser.js) | Tokens to AST |
| [src/ast.js](src/ast.js) | AST node definitions |
| [src/interpreter.js](src/interpreter.js) | AST execution |
| [src/index.js](src/index.js) | JavaScript API and file runner |
| [src/browser.js](src/browser.js) | Browser runtime entrypoint |
| [src/cli.js](src/cli.js) | CLI and REPL |
| [tests/test.js](tests/test.js) | Regression tests and example checks |
| [examples/catalog.js](examples/catalog.js) | 100 categorized sample programs |
| [public](public) | Browser playground and generated runtime output |
| [docs/syntax.md](docs/syntax.md) | Assamese and English syntax guide |
| [LICENSE](LICENSE) | MIT license and copyright notice |

## JavaScript API

```js
const AsomiyaBhasha = require('./src');

const result = new AsomiyaBhasha().run(`লিখা "নমস্কাৰ"`);

if (result.success) {
	console.log(result.output);
}
```

Each `run()` call uses a fresh interpreter environment, so separate programs and REPL commands are isolated from one another.




## License

MIT. Copyright (c) Er Panchanan Nath.
