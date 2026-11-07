# Roadmap

Asomiya Bhasha is being built in three compiler stages. Each stage keeps the same front end (lexer, parser, type checker in `src/`) and adds a new back end, so programs written today keep working.

| Stage | Back end | Status | What it adds |
| --- | --- | --- | --- |
| 1 | C11 → gcc / clang | **done (v2.0)** | Native executables, C-level language, full C library access |
| 2 | LLVM IR, WebAssembly | **done (v2.1)** | Direct LLVM code generation with DWARF debug info; a WebAssembly back end so programs run in the browser playground and in plain Node.js |
| 3 | MLIR dialect | next | An `asomiya` MLIR dialect lowered through `scf`/`arith`/`memref`/`func` to LLVM; a platform for language-level analysis and optimisation research |

## Stage 2 — what was built (v2.1)

1. `src/codegen_llvm.js` lowers the checked AST to textual LLVM IR: locals as `alloca`, structures as named LLVM types, unions laid out like C, `লিখা` as calls into the runtime, which is compiled from C and linked. `--backend llvm` builds through `clang -c` and the C compiler's linker, using the C compiler's target triple (so MinGW works on Windows).
2. `-g` emits DWARF from AST positions: gdb and lldb stop at `.asb` lines, show Assamese function and variable names, and print structures with their fields.
3. `src/codegen_wasm.js` writes WebAssembly binaries directly (no Emscripten or WASI SDK), with a JavaScript host (`src/wasm_host.js`) for printing, input, the heap, a C library subset and files. The playground compiles to WebAssembly and runs programs in a Web Worker with a time limit; Node.js runs them with `--backend wasm`.
4. All 193 checks pass on all three back ends (Linux gcc/clang, Windows MinGW-w64). On a small benchmark (recursive Fibonacci of 32 plus 20 million array updates) every back end finishes in well under a second including compilation; WebAssembly is quickest end-to-end because it starts no C compiler.

Still open from Stage 2: an optional `--safe` mode for the native back ends (bounds and null checks like the WebAssembly target already has for null pointers), and a WASI build so `.wasm` files run in wasmtime/wasmer as well.

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
