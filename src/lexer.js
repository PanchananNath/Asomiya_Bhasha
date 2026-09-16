/**
 * Lexer - Tokenizes Assamese code
 */

class Lexer {
    constructor(code) {
        this.code = code;
        this.position = 0;
        this.line = 1;
        this.column = 0;
        this.tokens = [];
    }

    // Assamese keyword mapping
    keywords = {
        // I/O
        'লিখা': 'PRINT',
        'পঢ়া': 'INPUT',
        
        // Variables
        'সংখ্যা': 'NUMBER',
        'বাক্য': 'STRING',
        'তালিকা': 'ARRAY',
        'বুলিয়ান': 'BOOLEAN',
        
        // Control flow
        'যদি': 'IF',
        'নহলে': 'ELSE',
        'যেতিয়া': 'WHILE',
        'প্রতিবাৰ': 'FOR',
        'প্ৰতিবাৰ': 'FOR',
        'লৈকে': 'TO',
        'থাকিলে': 'THEN',
        
        // Logic
        'সত্য': 'TRUE',
        'মিছা': 'FALSE',
        'আৰু': 'AND',
        'বা': 'OR',
        'নহয়': 'NOT',
        
        // Functions
        'কাজ': 'FUNCTION',
        'উভতি': 'RETURN',
        
        // Special
        'খালি': 'NULL',
        'শেষ': 'END'
    };

    // Operators
    operators = ['+', '-', '*', '/', '=', '!', '==', '!=', '<', '>', '<=', '>=', '(', ')', '{', '}', ',', '[', ']'];

    tokenize() {
        while (this.position < this.code.length) {
            const char = this.code[this.position];
            
            // Skip whitespace
            if (this.isWhitespace(char)) {
                this.advance();
                continue;
            }
            
            // Skip comments
            if (char === '#') {
                this.skipComment();
                continue;
            }
            
            // Handle numbers
            if (this.isDigit(char)) {
                this.tokenizeNumber();
                continue;
            }
            
            // Handle strings
            if (char === '"' || char === "'") {
                this.tokenizeString(char);
                continue;
            }
            
            // Handle Assamese characters
            if (this.isAssameseChar(char)) {
                this.tokenizeWord();
                continue;
            }
            
            // Handle operators
            if (this.isOperator(char)) {
                this.tokenizeOperator();
                continue;
            }
            
            // Handle newlines
            if (char === '\n') {
                this.tokens.push({ type: 'NEWLINE', value: '\\n', line: this.line, column: this.column });
                this.line++;
                this.column = 0;
                this.position++;
                continue;
            }
            
            // Unknown character
            throw new Error(`অচিনাক্ত চিহ্ন: "${char}" লাইন ${this.line}, স্তম্ভ ${this.column}`);
        }
        
        this.tokens.push({ type: 'EOF', value: 'EOF', line: this.line, column: this.column });
        return this.tokens;
    }

    tokenizeNumber() {
        let start = this.position;
        let hasDecimal = false;
        
        while (this.position < this.code.length) {
            const char = this.code[this.position];
            if (this.isDigit(char)) {
                this.advance();
            } else if (char === '.' && !hasDecimal) {
                hasDecimal = true;
                this.advance();
            } else {
                break;
            }
        }
        
        const value = this.code.substring(start, this.position);
        this.tokens.push({ 
            type: 'NUMBER', 
            value: value, 
            literal: parseFloat(this.normalizeDigits(value)),
            line: this.line, 
            column: start 
        });
    }

    tokenizeString(quoteChar) {
        this.advance(); // Skip opening quote
        let start = this.position;
        let value = '';
        
        while (this.position < this.code.length && this.code[this.position] !== quoteChar) {
            if (this.code[this.position] === '\\') {
                this.advance(); // Skip escape character
                if (this.position < this.code.length) {
                    const escapeChar = this.code[this.position];
                    switch (escapeChar) {
                        case 'n': value += '\n'; break;
                        case 't': value += '\t'; break;
                        case 'r': value += '\r'; break;
                        default: value += escapeChar;
                    }
                    this.advance();
                }
            } else {
                value += this.code[this.position];
                this.advance();
            }
        }
        
        if (this.position >= this.code.length) {
            throw new Error(`অপৰিপূৰ্ণ স্ট্রিং লাইন ${this.line}`);
        }
        
        this.advance(); // Skip closing quote
        
        this.tokens.push({ 
            type: 'STRING', 
            value: value, 
            literal: value,
            line: this.line, 
            column: start 
        });
    }

    tokenizeWord() {
        let start = this.position;
        
        while (this.position < this.code.length && this.isAssameseChar(this.code[this.position])) {
            this.advance();
        }
        
        const word = this.code.substring(start, this.position);
        
        if (this.keywords[word]) {
            this.tokens.push({ 
                type: this.keywords[word], 
                value: word, 
                line: this.line, 
                column: start 
            });
        } else {
            this.tokens.push({ 
                type: 'IDENTIFIER', 
                value: word, 
                line: this.line, 
                column: start 
            });
        }
    }

    tokenizeOperator() {
        const char = this.code[this.position];
        const nextChar = this.position + 1 < this.code.length ? this.code[this.position + 1] : '';
        
        const twoCharOp = char + nextChar;
        if (['==', '!=', '<=', '>='].includes(twoCharOp)) {
            this.tokens.push({ 
                type: twoCharOp, 
                value: twoCharOp, 
                line: this.line, 
                column: this.position 
            });
            this.advance();
            this.advance();
        } else {
            this.tokens.push({ 
                type: char, 
                value: char, 
                line: this.line, 
                column: this.position 
            });
            this.advance();
        }
    }

    skipComment() {
        while (this.position < this.code.length && this.code[this.position] !== '\n') {
            this.advance();
        }
    }

    advance() {
        this.position++;
        this.column++;
    }

    isWhitespace(char) {
        return /\s/.test(char) && char !== '\n';
    }

    isDigit(char) {
        return /[0-9\u09E6-\u09EF]/.test(char);
    }

    isAssameseChar(char) {
        return /[A-Za-z_\u0980-\u09FF]/.test(char);
    }

    normalizeDigits(value) {
        return value.replace(/[\u09E6-\u09EF]/g, digit => String(digit.charCodeAt(0) - 0x09E6));
    }

    isOperator(char) {
        return this.operators.includes(char);
    }
}

module.exports = Lexer;