const toAssameseDigits = value => String(value).replace(/[0-9]/g, digit => String.fromCharCode(0x09E6 + Number(digit)));

const samples = [];

function add(category, title, code) {
    samples.push({
        id: samples.length + 1,
        category,
        title,
        code
    });
}

const greetings = ['নমস্কাৰ', 'স্বাগতম', 'শুভদিন', 'শুভসন্ধ্যা', 'শুভৰাত্ৰি', 'অসমলৈ স্বাগতম', 'আজিৰ দিনটো ভাল', 'আহক শিকোঁ', 'মই কোড লিখোঁ', 'অসমীয়া ভাষা'];
greetings.forEach((message, index) => {
    add('printing', `প্ৰিণ্ট ${index + 1}`, `লিখা "${message}!"`);
});

const arithmetic = [
    ['যোগ', '+', 10, 20], ['বিয়োগ', '-', 30, 8], ['পূৰণ', '*', 6, 7], ['হৰণ', '/', 40, 5],
    ['যোগ', '+', 12, 18], ['বিয়োগ', '-', 50, 17], ['পূৰণ', '*', 9, 9], ['হৰণ', '/', 81, 9],
    ['যোগ', '+', 7, 13], ['বিয়োগ', '-', 100, 45], ['পূৰণ', '*', 8, 12], ['হৰণ', '/', 64, 8],
    ['যোগ', '+', 25, 25], ['বিয়োগ', '-', 90, 30], ['পূৰণ', '*', 11, 3], ['হৰণ', '/', 72, 9],
    ['যোগ', '+', 14, 16], ['বিয়োগ', '-', 44, 19], ['পূৰণ', '*', 5, 15], ['হৰণ', '/', 100, 10]
];
arithmetic.forEach(([name, operator, left, right], index) => {
    add('math', `গণনা ${index + 1}`, `# ${name}\nলিখা ${toAssameseDigits(left)} ${operator} ${toAssameseDigits(right)}`);
});

for (let index = 1; index <= 10; index++) {
    const value = index * 5;
    add('variables', `চলক ${index}`, `সংখ্যা মান = ${toAssameseDigits(value)}\nলিখা "মান: " + মান`);
}

const comparisons = ['==', '!=', '>', '>=', '<'];
comparisons.forEach((operator, index) => {
    const left = index + 3;
    const right = index % 2 === 0 ? left : left + 1;
    add('logic', `তুলনা ${index + 1}`, `লিখা ${toAssameseDigits(left)} ${operator} ${toAssameseDigits(right)}`);
});

for (let index = 1; index <= 5; index++) {
    const number = index % 2 === 0 ? 'সত্য' : 'মিছা';
    add('logic', `লজিক ${index}`, `বুলিয়ান ঠিক = ${number}\nলিখা নহয় ঠিক\nলিখা ঠিক আৰু সত্য\nলিখা ঠিক বা মিছা`);
}

for (let index = 1; index <= 10; index++) {
    const limit = index + 5;
    add('conditions', `শৰ্ত ${index}`, `সংখ্যা নম্বৰ = ${toAssameseDigits(limit)}\nযদি নম্বৰ > ১০ থাকিলে\n    লিখা "ডাঙৰ"\nনহলে\n    লিখা "সৰু"\nশেষ`);
}

for (let index = 1; index <= 10; index++) {
    add('loops', `যেতিয়া ${index}`, `সংখ্যা গণক = ১\nযেতিয়া গণক <= ${toAssameseDigits(index + 2)}\n    লিখা গণক\n    গণক = গণক + ১\nশেষ`);
}

for (let index = 1; index <= 10; index++) {
    add('loops', `প্ৰতিবাৰ ${index}`, `প্ৰতিবাৰ i = ১ লৈকে ${toAssameseDigits(index + 2)}\n    লিখা i\nশেষ`);
}

for (let index = 1; index <= 10; index++) {
    add('functions', `ফাংচন ${index}`, `কাজ যোগ(সংখ্যা a, সংখ্যা b)\n    উভতি a + b\nশেষ\nলিখা যোগ(${toAssameseDigits(index)}, ${toAssameseDigits(index + 1)})`);
}

for (let index = 1; index <= 10; index++) {
    add('arrays', `তালিকা ${index}`, `তালিকা মানসমূহ = [${toAssameseDigits(index)}, ${toAssameseDigits(index + 1)}, ${toAssameseDigits(index + 2)}]\nলিখা মানসমূহ[০]\nলিখা দৈৰ্ঘ্য(মানসমূহ)`);
}

if (samples.length !== 100) {
    throw new Error(`Expected 100 samples, created ${samples.length}`);
}

module.exports = samples;
