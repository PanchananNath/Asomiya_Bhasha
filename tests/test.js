'use strict';
/**
 * Asomiya Bhasha 2.0 test suite.
 *   node tests/test.js              (uses cc / gcc / clang)
 *   node tests/test.js --cc clang   (pick the C compiler)
 *   node tests/test.js --quick      (skip the 100-sample sweep)
 *   node tests/test.js --backend llvm   (LLVM IR back end, needs clang)
 *   node tests/test.js --backend wasm   (WebAssembly back end, runs in Node)
 *
 * Every program is compiled to C, built with the system C compiler and
 * run; the test compares the exact standard output.
 */
const fs = require('fs');
const path = require('path');
const { compile } = require('../src/compiler');
const { runNative, findCC, noCCMessage } = require('../src/native');
const catalog = require('../examples/catalog');

const argv = process.argv.slice(2);
const ccArg = argv.includes('--cc') ? argv[argv.indexOf('--cc') + 1] : process.env.TEST_CC;
const quick = argv.includes('--quick');
const backend = argv.includes('--backend') ? argv[argv.indexOf('--backend') + 1] : (process.env.TEST_BACKEND || 'c');
const { findClang, noClangMessage, ccTriple } = require('../src/native');
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
    const runner = backend === 'wasm' ? require('../src/wasm_run').runWasm : runNative;
    const r = runner(code, Object.assign({ file: opts.file || `${name}.asb`, opt: 0, cc: cc, backend, input: opts.input || '', args: opts.args, timeout: 20000 }, opts));
    if (!r.ok) return record(name, false, (r.diagnostics ? r.diagnostics.formatAll() : '') + (r.ccError || ''));
    const stdout = String(r.stdout || '').replace(/\r\n/g, '\n'); // Windows text-mode stdout writes \r\n
    const ok = stdout === expected && (opts.status === undefined || r.status === opts.status);
    record(name, ok, `  প্ৰত্যাশিত: ${JSON.stringify(expected)}\n  পোৱা গ'ল : ${JSON.stringify(stdout)} (exit ${r.status})${r.stderr ? '\n  stderr: ' + r.stderr : ''}`);
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
if (!cc && backend !== 'wasm') {
    console.log('✗ ' + noCCMessage());
    process.exit(1);
}
if (backend === 'llvm') {
    const clang = findClang(null, ccTriple(cc));
    if (!clang) { console.log('✗ ' + noClangMessage()); process.exit(1); }
    console.log(`Back end: LLVM IR (${clang}), linker: ${cc}\n`);
} else if (backend === 'wasm') {
    console.log('Back end: WebAssembly (Node.js host)\n');
} else {
    console.log(`Back end: C, compiler: ${cc}\n`);
}

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
try { fs.rmSync(path.join(exDir, 'asomiya_demo.txt'), { force: true }); } catch (e) { /* ignore */ }

// 4. The 100 graded samples
if (!quick) for (const s of catalog) runProgram(`নমুনা ${String(s.id).padStart(3, '0')} (${s.category}) ${s.title}`, s.code, s.expected);

const secs = ((Date.now() - t0) / 1000).toFixed(1);
if (failures.length) console.log(failures.join('\n\n') + '\n');
console.log(`মুঠ পৰীক্ষা: ${passed + failed}   পাছ: ${passed}   ফেইল: ${failed}   (${secs} s)`);
console.log(`Total: ${passed + failed}   passed: ${passed}   failed: ${failed}`);
process.exit(failed ? 1 : 0);
