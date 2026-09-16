/**
 * Parser - Converts tokens to AST
 */

const AST = require('./ast');

class Parser {
    constructor(tokens) {
        this.tokens = tokens;
        this.position = 0;
        this.currentToken = this.tokens[0] || { type: 'EOF', value: '' };
    }

    parse() {
        const statements = [];
        
        while (!this.isAtEnd()) {
            const stmt = this.parseStatement();
            if (stmt) {
                statements.push(stmt);
            }
            this.consumeNewlines();
        }
        
        return new AST.Program(statements);
    }

    parseStatement() {
        try {
            if (this.match('PRINT')) {
                return this.parsePrintStatement();
            }
            
            if (this.match('NUMBER', 'STRING', 'BOOLEAN', 'ARRAY')) {
                return this.parseVariableDeclaration();
            }
            
            if (this.match('IDENTIFIER')) {
                return this.parseAssignmentOrExpression();
            }
            
            if (this.match('IF')) {
                return this.parseIfStatement();
            }
            
            if (this.match('WHILE')) {
                return this.parseWhileStatement();
            }
            
            if (this.match('FOR')) {
                return this.parseForStatement();
            }
            
            if (this.match('FUNCTION')) {
                return this.parseFunctionDeclaration();
            }
            
            if (this.match('RETURN')) {
                return this.parseReturnStatement();
            }
            
            this.advance();
            return null;
        } catch (error) {
            throw new Error(`পাৰ্ছিং ত্ৰুটি লাইন ${this.currentToken.line}: ${error.message}`);
        }
    }

    parsePrintStatement() {
        const token = this.previous();
        this.consumeNewlines();
        
        const expressions = [];
        do {
            expressions.push(this.parseExpression());
        } while (this.match(','));
        
        this.consume('NEWLINE', 'EOF');
        return new AST.PrintStatement(
            expressions.length === 1 ? expressions[0] : expressions,
            token.line,
            token.column
        );
    }

    parseVariableDeclaration() {
        const typeToken = this.previous();
        const name = this.consume('IDENTIFIER', 'ভেচাৰ নাম প্ৰয়োজন').value;
        
        let value = null;
        if (this.match('=')) {
            value = this.parseExpression();
        }
        
        this.consume('NEWLINE', 'EOF');
        return new AST.VariableDeclaration(
            typeToken.value,
            name,
            value,
            typeToken.line,
            typeToken.column
        );
    }

    parseAssignmentOrExpression() {
        const name = this.previous().value;
        const line = this.previous().line;
        const column = this.previous().column;

        if (this.match('[')) {
            const index = this.parseExpression();
            this.consume(']');
            if (this.match('=')) {
                const value = this.parseExpression();
                this.consume('NEWLINE', 'EOF');
                return new AST.IndexAssignment(
                    new AST.Identifier(name, line, column),
                    index,
                    value,
                    line,
                    column
                );
            }
            throw new Error('তালিকা ইণ্ডেক্সত মান দিবলৈ "=" প্ৰয়োজন');
        }
        
        if (this.match('=')) {
            const value = this.parseExpression();
            this.consume('NEWLINE', 'EOF');
            return new AST.Assignment(name, value, line, column);
        }
        
        const expr = this.parseBinaryExpression();
        this.consume('NEWLINE', 'EOF');
        return expr;
    }

    parseIfStatement() {
        const token = this.previous();
        const condition = this.parseExpression();
        
        this.consume('THEN', '"থাকিলে" প্ৰয়োজন যদি-বিবৃতিত');
        this.consume('NEWLINE');
        
        const thenBlock = [];
        while (!this.check('ELSE') && !this.check('END') && !this.isAtEnd()) {
            const stmt = this.parseStatement();
            if (stmt) thenBlock.push(stmt);
            this.consumeNewlines();
        }
        
        let elseBlock = null;
        if (this.match('ELSE')) {
            if (this.match('IF')) {
                elseBlock = [this.parseIfStatement()];
            } else {
                this.consume('NEWLINE');
                elseBlock = [];
                while (!this.check('END') && !this.isAtEnd()) {
                    const stmt = this.parseStatement();
                    if (stmt) elseBlock.push(stmt);
                    this.consumeNewlines();
                }
            }
        }
        
        if (this.match('END')) {
            this.consume('NEWLINE', 'EOF');
        }
        
        return new AST.IfStatement(condition, thenBlock, elseBlock, token.line, token.column);
    }

    parseWhileStatement() {
        const token = this.previous();
        const condition = this.parseExpression();
        
        this.consume('NEWLINE');
        
        const body = [];
        while (!this.check('END') && !this.isAtEnd()) {
            const stmt = this.parseStatement();
            if (stmt) body.push(stmt);
            this.consumeNewlines();
        }
        
        if (this.match('END')) {
            this.consume('NEWLINE', 'EOF');
        }
        
        return new AST.WhileStatement(condition, body, token.line, token.column);
    }

    parseForStatement() {
        const token = this.previous();

        const nameToken = this.consume('IDENTIFIER', 'ফৰ লুপৰ চলকৰ নাম প্ৰয়োজন');
        this.consume('=', 'ফৰ লুপত "=" প্ৰয়োজন');
        const start = this.parseExpression();
        this.consume('TO', 'ফৰ লুপত "লৈকে" প্ৰয়োজন');
        const end = this.parseExpression();
        
        this.consume('NEWLINE');
        
        const body = [];
        while (!this.check('END') && !this.isAtEnd()) {
            const stmt = this.parseStatement();
            if (stmt) body.push(stmt);
            this.consumeNewlines();
        }
        
        if (this.match('END')) {
            this.consume('NEWLINE', 'EOF');
        }
        
        const initializer = new AST.VariableDeclaration('সংখ্যা', nameToken.value, start, token.line, token.column);
        const condition = new AST.BinaryExpression(
            new AST.Identifier(nameToken.value, nameToken.line, nameToken.column),
            '<=',
            end
        );
        const increment = new AST.Assignment(
            nameToken.value,
            new AST.BinaryExpression(
                new AST.Identifier(nameToken.value, nameToken.line, nameToken.column),
                '+',
                new AST.Literal(1, nameToken.line, nameToken.column)
            ),
            nameToken.line,
            nameToken.column
        );

        return new AST.ForStatement(initializer, condition, increment, body, token.line, token.column);
    }

    parseFunctionDeclaration() {
        const token = this.previous();
        const name = this.consume('IDENTIFIER', 'ফাংচনৰ নাম প্ৰয়োজন').value;
        
        this.consume('(');
        const params = [];
        if (!this.check(')')) {
            do {
                this.match('NUMBER', 'STRING', 'BOOLEAN', 'ARRAY');
                params.push(this.consume('IDENTIFIER', 'পেৰামিটাৰ নাম প্ৰয়োজন').value);
            } while (this.match(','));
        }
        this.consume(')');
        
        this.consume('NEWLINE');
        
        const body = [];
        while (!this.check('END') && !this.isAtEnd()) {
            const stmt = this.parseStatement();
            if (stmt) body.push(stmt);
            this.consumeNewlines();
        }
        
        if (this.match('END')) {
            this.consume('NEWLINE', 'EOF');
        }
        
        return new AST.FunctionDeclaration(name, params, body, token.line, token.column);
    }

    parseReturnStatement() {
        const token = this.previous();
        const value = this.parseExpression();
        this.consume('NEWLINE', 'EOF');
        return new AST.ReturnStatement(value, token.line, token.column);
    }

    parseExpression() {
        return this.parseBinaryExpression();
    }

    parseBinaryExpression(precedence = 0) {
        let left = this.parsePrimary();
        
        while (this.isBinaryOperator() && this.getPrecedence(this.currentToken.value) >= precedence) {
            const operator = this.advance().value;
            const right = this.parseBinaryExpression(this.getPrecedence(operator) + 1);
            left = new AST.BinaryExpression(left, operator, right);
        }
        
        return left;
    }

    parsePrimary() {
        if (this.match('NOT', '-')) {
            const operator = this.previous();
            return new AST.UnaryExpression(
                operator.value,
                this.parsePrimary(),
                operator.line,
                operator.column
            );
        }

        if (this.match('NUMBER', 'STRING', 'TRUE', 'FALSE', 'NULL')) {
            const token = this.previous();
            return new AST.Literal(
                token.type === 'NUMBER' ? token.literal : 
                token.type === 'STRING' ? token.literal :
                token.type === 'TRUE' ? true :
                token.type === 'FALSE' ? false :
                null,
                token.line,
                token.column
            );
        }
        
        if (this.match('IDENTIFIER', 'INPUT')) {
            const token = this.previous();
            
            if (this.match('(')) {
                const args = [];
                if (!this.check(')')) {
                    do {
                        args.push(this.parseExpression());
                    } while (this.match(','));
                }
                this.consume(')');
                return new AST.CallExpression(
                    new AST.Identifier(token.value, token.line, token.column),
                    args,
                    token.line,
                    token.column
                );
            }
            
            if (this.match('[')) {
                const index = this.parseExpression();
                this.consume(']');
                return new AST.IndexExpression(
                    new AST.Identifier(token.value, token.line, token.column),
                    index,
                    token.line,
                    token.column
                );
            }
            
            return new AST.Identifier(token.value, token.line, token.column);
        }
        
        if (this.match('(')) {
            const expr = this.parseExpression();
            this.consume(')');
            return expr;
        }
        
        if (this.match('[')) {
            const elements = [];
            if (!this.check(']')) {
                do {
                    elements.push(this.parseExpression());
                } while (this.match(','));
            }
            this.consume(']');
            return new AST.ArrayLiteral(elements);
        }
        
        throw new Error(`অপ্ৰত্যাশিত টকেন: ${this.currentToken.value}`);
    }

    match(...types) {
        for (const type of types) {
            if (this.check(type)) {
                this.advance();
                return true;
            }
        }
        return false;
    }

    check(type) {
        if (this.isAtEnd()) return false;
        return this.currentToken.type === type;
    }

    advance() {
        if (!this.isAtEnd()) {
            this.position++;
            this.currentToken = this.tokens[this.position];
        }
        return this.previous();
    }

    previous() {
        return this.tokens[this.position - 1];
    }

    consume(type, errorMessage) {
        if (type === 'EOF' && this.isAtEnd()) {
            return this.currentToken;
        }
        if (type === 'NEWLINE' && errorMessage === 'EOF' && this.isAtEnd()) {
            return this.currentToken;
        }
        if (this.check(type)) {
            return this.advance();
        }
        throw new Error(errorMessage || `${type} প্ৰয়োজন`);
    }

    consumeNewlines() {
        while (this.match('NEWLINE')) {
            // Skip newlines
        }
    }

    isAtEnd() {
        return this.currentToken.type === 'EOF';
    }

    isBinaryOperator() {
        if (this.isAtEnd()) return false;
        const ops = ['+', '-', '*', '/', '==', '!=', '<', '>', '<=', '>=', 'আৰু', 'বা'];
        return ops.includes(this.currentToken.value);
    }

    getPrecedence(operator) {
        const precedences = {
            'বা': 1,
            'আৰু': 2,
            '==': 3, '!=': 3, '<': 3, '>': 3, '<=': 3, '>=': 3,
            '+': 4, '-': 4,
            '*': 5, '/': 5
        };
        return precedences[operator] || 0;
    }
}

module.exports = Parser;