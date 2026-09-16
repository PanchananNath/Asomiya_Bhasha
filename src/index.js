/**
 * Main entry point for Asomiya Bhasha
 */

const Lexer = require('./lexer');
const Parser = require('./parser');
const Interpreter = require('./interpreter');

class AsomiyaBhasha {
    constructor(options = {}) {
        this.lexer = null;
        this.parser = null;
        this.inputProvider = options.input || null;
        this.interpreter = new Interpreter(this.inputProvider);
    }

    run(code) {
        try {
            this.interpreter = new Interpreter(this.inputProvider);
            this.lexer = new Lexer(code);
            const tokens = this.lexer.tokenize();
            
            this.parser = new Parser(tokens);
            const ast = this.parser.parse();
            
            const output = this.interpreter.interpret(ast);
            
            return {
                success: true,
                output: output,
                tokens: tokens,
                ast: ast
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                line: error.line || 1
            };
        }
    }

    runFromFile(filename) {
        const fs = require('fs');
        const code = fs.readFileSync(filename, 'utf-8');
        return this.run(code);
    }
}

module.exports = AsomiyaBhasha;

if (require.main === module) {
    const fs = require('fs');
    const asomiya = new AsomiyaBhasha();
    
    if (process.argv[2]) {
        const result = asomiya.runFromFile(process.argv[2]);
        if (result.success) {
            console.log(result.output);
        } else {
            console.error('ত্ৰুটি:', result.error);
            process.exit(1);
        }
    } else {
        console.log('ব্যৱহাৰঃ node src/index.js <ফাইল.asm>');
        console.log('উদাহৰণঃ node src/index.js examples/hello.asm');
    }
}