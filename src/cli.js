#!/usr/bin/env node
/**
 * Command Line Interface
 */

const fs = require('fs');
const path = require('path');
const AsomiyaBhasha = require('./index');

function main() {
    console.log('অসমীয়া ভাষা v1.0.0');
    console.log('-------------------\n');
    
    if (process.argv.length < 3) {
        console.log('ব্যৱহাৰ: asomiya <ফাইল.asm>');
        console.log('       : asomiya --repl');
        console.log('\nউদাহৰণ:');
        console.log('  asomiya examples/hello.asm');
        console.log('  asomiya --repl');
        process.exit(1);
    }
    
    const arg = process.argv[2];
    
    if (arg === '--repl' || arg === '-r') {
        startREPL();
    } else if (arg === '--help' || arg === '-h') {
        showHelp();
    } else {
        runFile(arg);
    }
}

function runFile(filename) {
    if (!fs.existsSync(filename)) {
        console.error(`ফাইল পোৱা নগ'ল: ${filename}`);
        process.exit(1);
    }
    
    const asomiya = new AsomiyaBhasha();
    const result = asomiya.runFromFile(filename);
    
    if (result.success) {
        console.log(result.output);
    } else {
        console.error(`\nত্ৰুটি (লাইন ${result.line}):`);
        console.error(`  ${result.error}`);
        process.exit(1);
    }
}

function startREPL() {
    const readline = require('readline');
    const asomiya = new AsomiyaBhasha();
    
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: 'অসমীয়া> '
    });
    
    console.log('অসমীয়া REPL (Exit কৰিবলৈ Ctrl+C বা .exit লিখক)');
    console.log('উদাহৰণঃ লিখা "নমস্কাৰ!"');
    
    rl.prompt();
    
    let multiLineMode = false;
    let multiLineCode = '';
    
    rl.on('line', (line) => {
        if (line.trim() === '.exit' || line.trim() === '.quit') {
            console.log('বিদায়!');
            rl.close();
            return;
        }
        
        if (line.trim() === '.clear') {
            console.clear();
            rl.prompt();
            return;
        }
        
        if (line.trim() === '.help') {
            showREPLHelp();
            rl.prompt();
            return;
        }
        
        if (line.trim() === '...') {
            multiLineMode = !multiLineMode;
            if (multiLineMode) {
                console.log('বহু-লাইন মড চালু কৰা হল (বন্ধ কৰিবলৈ আকৌ ... লিখক)');
                multiLineCode = '';
            } else {
                console.log('বহু-লাইন মড বন্ধ কৰা হল, কোড চলোৱা হৈছে...');
                executeCode(multiLineCode);
                multiLineCode = '';
            }
            rl.prompt();
            return;
        }
        
        if (multiLineMode) {
            multiLineCode += line + '\n';
            rl.prompt();
        } else {
            executeCode(line);
            rl.prompt();
        }
    }).on('close', () => {
        console.log('\nবিদায়!');
        process.exit(0);
    });
    
    function executeCode(code) {
        if (!code.trim()) {
            return;
        }
        
        const result = asomiya.run(code);
        
        if (result.success) {
            if (result.output && result.output.trim()) {
                console.log(result.output);
            }
        } else {
            console.error(`ত্ৰুটি: ${result.error}`);
        }
    }
}

function showHelp() {
    console.log('অসমীয়া ভাষা - সহজে শিকিব পৰা প্ৰগ্ৰামিং ভাষা');
    console.log('\nকমাণ্ড:');
    console.log('  asomiya <ফাইল.asm>    ফাইল চলাওক');
    console.log('  asomiya --repl         REPL চালু কৰক');
    console.log('  asomiya --help         সহায় দেখুৱাওক');
    
    console.log('\nউদাহৰণ ফাইল:');
    console.log('  examples/hello.asm    - সাধাৰণ প্ৰিণ্ট');
    console.log('  examples/math.asm     - গণনা');
    console.log('  examples/conditions.asm - যদি/নহলে');
    
    console.log('\nসিনটেক্স:');
    console.log('  সংখ্যা x = ১০         # সংখ্যা চলক');
    console.log('  বাক্য নাম = "অসম"     # স্ট্রিং চলক');
    console.log('  লিখা "নমস্কাৰ!"       # আউটপুট');
    console.log('  যদি x > ৫ থাকিলে      # যদি বিবৃতি');
    console.log('  যেতিয়া x < ১০        # যেতিয়া লুপ');
}

function showREPLHelp() {
    console.log('\nREPL কমাণ্ড:');
    console.log('  .exit/.quit  - REPL বন্ধ কৰক');
    console.log('  .clear       - স্ক্ৰীন পৰিষ্কাৰ কৰক');
    console.log('  .help        - সহায় দেখুৱাওক');
    console.log('  ...          - বহু-লাইন মড টগল কৰক');
    console.log('\nউদাহৰণ:');
    console.log('  সংখ্যা x = ১০');
    console.log('  লিখা x');
    console.log('  লিখা x + ৫');
}

if (require.main === module) {
    main();
}

module.exports = { main };