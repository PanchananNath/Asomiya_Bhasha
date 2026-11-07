# Changelog

## 2.1.0 — LLVM and WebAssembly back ends (Stage 2)

### Added
- **LLVM IR back end** (`--backend llvm`, `asomiya ll`): textual LLVM IR with opaque pointers, linked with the C runtime; works with the C compiler's target, including MinGW on Windows.
- **DWARF debug information** with `--backend llvm -g`: breakpoints by Assamese function name or `file.asb:line`, stepping through the source, variables, structures, unions, enums and arrays shown with their Assamese names in gdb and lldb.
- **WebAssembly back end** (`--backend wasm`, `asomiya wasm`): the compiler writes `.wasm` binaries itself; a JavaScript host provides printing, input, the heap, files and a C library subset (printf family, strings, ctype, math, qsort, glibc-compatible rand).
- The **playground runs programs**: ▶ চলাওক compiles to WebAssembly and runs in a Web Worker with an input box, a stop button and a 10-second limit; C and LLVM IR views; samples are checked against their expected output.
- WebAssembly run-time errors in Assamese: null pointer use, division by zero, endless recursion (stack exhausted), double `মুকলি`, calling a `খালি` function pointer.
- Tests: `npm run test:llvm`, `npm run test:wasm`, `npm run test:all`; `--clang` option; `--version` lists all back ends.
- JavaScript API: `compile(src, { backend: 'llvm' | 'wasm' })`, `run(src, { backend: 'wasm' })`, `runWasmFile(path)`.

### Changed
- `docs/spec.md` §10 now describes all three back ends; §7.8 notes that `আকাৰ` follows the target (pointers are 4 bytes on WebAssembly).
- The stray `install_asomiya_v2.sh` and `list.exe` were removed from the repository.


## 2.0.1 — Windows support

### Fixed
- The compiler now checks that a C compiler can build a program with the standard headers before using it, skips unusable ones (for example LLVM clang on Windows without Visual Studio) and explains how to install gcc.
- Windows: command-line arguments are passed to programs as UTF-8 (they arrived as `???`), and the console is switched to UTF-8.
- Windows: temporary build folders are removed with retries, because a just-finished `.exe` can stay locked briefly.
- Tests accept the `\r\n` line endings that Windows programs print.
- Verified with MinGW-w64 gcc: all 193 tests pass as Windows executables.

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
