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
