'use strict';
// Child process used by wasm_run.js: node wasm_child.js <file.wasm> <program name> <args JSON>
const fs = require('fs');
const { runBytes } = require('./wasm_run');
const [file, prog, args] = process.argv.slice(2);
const r = runBytes(new Uint8Array(fs.readFileSync(file)), [prog, ...JSON.parse(args || '[]')]);
process.exitCode = r.status;
