/**
 * Test Suite for Asomiya Bhasha
 */

const AsomiyaBhasha = require('../src/index');
const fs = require('fs');

console.log('অসমীয়া ভাষা পৰীক্ষা...\n');

const asomiya = new AsomiyaBhasha();
const inputAsomiya = new AsomiyaBhasha({ input: () => 'অসম' });
let passed = 0;
let failed = 0;

function test(name, code, expectedOutput, runtime = asomiya) {
    console.log(`পৰীক্ষা: ${name}`);
    console.log(`কোড: ${code.substring(0, 50)}...`);
    
    const result = runtime.run(code);
    
    if (result.success) {
        const output = result.output.trim();
        if (output === expectedOutput) {
            console.log('পাছ কৰিলে!\n');
            passed++;
        } else {
            console.log(`ফেইল কৰিলে!`);
            console.log(`   আশাকৰি: "${expectedOutput}"`);
            console.log(`   পোৱা গ'ল: "${output}"\n`);
            failed++;
        }
    } else {
            console.log(`ফেইল কৰিলে!`);
        console.log(`   ত্ৰুটি: ${result.error}\n`);
        failed++;
    }
}

console.log('========== মূল পৰীক্ষা ==========\n');

test('বাচিক প্ৰিণ্ট', 'লিখা "নমস্কাৰ"', 'নমস্কাৰ');

test('যোগ', 'সংখ্যা x = ৫\nসংখ্যা y = ৩\nলিখা x + y', '8');

test('গণিতৰ অপাৰেটৰ',
`লিখা ২০ - ৫
লিখা ৬ * ৭
লিখা ২০ / ৪`, '15\n42\n5');

test('স্ট্রিং সংযোগ', 'বাক্য নাম = "অসম"\nলিখা "নমস্কাৰ " + নাম', 'নমস্কাৰ অসম');

test('যদি বিবৃতি', 
`সংখ্যা x = ১০
যদি x > ৫ থাকিলে
    লিখা "ডাঙৰ"
শেষ`, 'ডাঙৰ');

test('তুলনা আৰু লজিক',
`লিখা ৫ == ৫
লিখা ৫ != ৪
লিখা ৫ >= ৫
লিখা ৪ < ৫
লিখা ৪ <= ৪
লিখা সত্য আৰু নহয় মিছা
লিখা মিছা বা সত্য`, 'true\ntrue\ntrue\ntrue\ntrue\ntrue\ntrue');

test('যেতিয়া লুপ',
`সংখ্যা i = ১
যেতিয়া i <= ৩
    লিখা i
    i = i + ১
শেষ`, '1\n2\n3');

test('তালিকা',
`তালিকা ফল = [১, ২, ৩]
লিখা ফল[০]`, '1');

test('ইউনাৰি অপাৰেটৰ',
`সংখ্যা x = ৫
লিখা -x
লিখা নহয় মিছা`, '-5\ntrue');

test('নহলে যদি',
`সংখ্যা x = ৮৫
যদি x >= ৯০ থাকিলে
    লিখা "এ+"
নহলে যদি x >= ৮০ থাকিলে
    লিখা "এ"
নহলে
    লিখা "বি"
শেষ`, 'এ');

test('ফাংচন',
`কাজ যোগ(সংখ্যা a, সংখ্যা b)
    উভতি a + b
শেষ
লিখা যোগ(২, ৩)`, '5');

test('পুনৰাবৃত্তি ফাংচন',
`কাজ ফেক্ট(সংখ্যা n)
    যদি n <= ১ থাকিলে
        উভতি ১
    নহলে
        উভতি n * ফেক্ট(n - ১)
    শেষ
শেষ
লিখা ফেক্ট(৫)`, '120');

test('বুলিয়ান',
`বুলিয়ান ঠিক = সত্য
যদি ঠিক থাকিলে
    লিখা "হয়"
শেষ`, 'হয়');

test('প্ৰতিবাৰ লুপ',
`প্ৰতিবাৰ i = ১ লৈকে ৩
    লিখা i
শেষ`, '1\n2\n3');

test('ইনপুট',
`বাক্য নাম = পঢ়া()
লিখা "নমস্কাৰ " + নাম`, 'নমস্কাৰ অসম', inputAsomiya);

test('তালিকাত মান সলনি',
`তালিকা ফল = [১, ২]
ফল[১] = ৫
লিখা ফল[১]`, '5');

test('তুলনা আৰু দৈৰ্ঘ্য',
`তালিকা ফল = [১, ২, ৩]
লিখা ৫ != ৪
লিখা দৈৰ্ঘ্য(ফল)`, 'true\n3');

console.log('========== উদাহৰণ ফাইল পৰীক্ষা ==========\n');

const exampleFiles = ['hello.asm', 'math.asm', 'conditions.asm', 'functions.asm'];

exampleFiles.forEach(filename => {
    const filepath = `examples/${filename}`;
    if (fs.existsSync(filepath)) {
        console.log(`চলাই আছে: ${filename}`);
        const result = asomiya.runFromFile(filepath);
        if (result.success) {
            console.log('সফলভাবে চলিল!');
            console.log('আউটপুট:');
            console.log(result.output);
            passed++;
        } else {
            console.log(`ত্ৰুটি: ${result.error}`);
            failed++;
        }
        console.log();
    }
});

console.log('========== পৰীক্ষা সাৰাংশ ==========');
console.log(`মুঠ পৰীক্ষা: ${passed + failed}`);
console.log(`পাছ: ${passed}`);
console.log(`ফেইল: ${failed}`);
console.log(`সফলতাৰ হাৰ: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

if (failed > 0) {
    process.exit(1);
}