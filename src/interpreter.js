/**
 * Interpreter - Executes the AST
 */

class Interpreter {
    constructor(inputProvider = null) {
        this.environment = new Environment();
        this.output = '';
        this.inputProvider = inputProvider || (() => {
            if (typeof prompt === 'function') {
                return prompt('ইনপুট দিয়ক:') || '';
            }
            throw new Error('পঢ়া ব্যৱহাৰ কৰিবলৈ input provider দিয়ক');
        });
        
        this.environment.define('পঢ়া', new Callable(0, () => this.inputProvider()));
        
        this.environment.define('দৈৰ্ঘ্য', new Callable(1, (interpreter, args) => {
            if (Array.isArray(args[0])) {
                return args[0].length;
            }
            if (typeof args[0] === 'string') {
                return args[0].length;
            }
            throw new Error('দৈৰ্ঘ্য কেৱল স্ট্রিং বা তালিকাৰ বাবে');
        }));
    }

    interpret(ast) {
        try {
            this.executeBlock(ast.body, this.environment);
            return this.output;
        } catch (error) {
            throw new Error(`কাৰ্যকৰীকৰণ ত্ৰুটি: ${error.message}`);
        }
    }

    execute(statement) {
        switch (statement.type) {
            case 'PrintStatement':
                return this.executePrint(statement);
            case 'VariableDeclaration':
                return this.executeVariableDeclaration(statement);
            case 'Assignment':
                return this.executeAssignment(statement);
            case 'IndexAssignment':
                return this.executeIndexAssignment(statement);
            case 'IfStatement':
                return this.executeIfStatement(statement);
            case 'WhileStatement':
                return this.executeWhileStatement(statement);
            case 'ForStatement':
                return this.executeForStatement(statement);
            case 'FunctionDeclaration':
                return this.executeFunctionDeclaration(statement);
            case 'ReturnStatement':
                return this.executeReturnStatement(statement);
            default:
                throw new Error(`অচিনাক্ত বিবৃতিঃ ${statement.type}`);
        }
    }

    executeBlock(statements, environment) {
        const previous = this.environment;
        try {
            this.environment = environment;
            for (const statement of statements) {
                this.execute(statement);
            }
        } finally {
            this.environment = previous;
        }
    }

    executePrint(statement) {
        let value;
        if (Array.isArray(statement.expression)) {
            value = statement.expression.map(expr => this.evaluate(expr)).join(' ');
        } else {
            value = this.evaluate(statement.expression);
        }
        
        const outputStr = String(value);
        this.output += outputStr + '\n';
        return null;
    }

    executeVariableDeclaration(statement) {
        let value = null;
        if (statement.value) {
            value = this.evaluate(statement.value);
            
            if (statement.variableType === 'সংখ্যা' && typeof value !== 'number') {
                throw new Error(`${statement.name} সংখ্যা হ'ব লাগে`);
            }
            if (statement.variableType === 'বাক্য' && typeof value !== 'string') {
                throw new Error(`${statement.name} বাক্য হ'ব লাগে`);
            }
            if (statement.variableType === 'বুলিয়ান' && typeof value !== 'boolean') {
                throw new Error(`${statement.name} সত্য/মিছা হ'ব লাগে`);
            }
            if (statement.variableType === 'তালিকা' && !Array.isArray(value)) {
                throw new Error(`${statement.name} তালিকা হ'ব লাগে`);
            }
        }
        
        this.environment.define(statement.name, value);
        return null;
    }

    executeAssignment(statement) {
        const value = this.evaluate(statement.value);
        this.environment.assign(statement.name, value);
        return value;
    }

    executeIndexAssignment(statement) {
        const array = this.evaluate(statement.array);
        const index = this.evaluate(statement.index);
        const value = this.evaluate(statement.value);

        if (!Array.isArray(array)) {
            throw new Error('ইণ্ডেক্সিং কেৱল তালিকাৰ বাবে');
        }
        if (!Number.isInteger(index) || index < 0 || index >= array.length) {
            throw new Error('ইণ্ডেক্স সীমাৰ বাহিৰত');
        }

        array[index] = value;
        return value;
    }

    executeIfStatement(statement) {
        const condition = this.evaluate(statement.condition);
        
        if (this.isTruthy(condition)) {
            this.executeBlock(statement.thenBlock, new Environment(this.environment));
        } else if (statement.elseBlock) {
            this.executeBlock(statement.elseBlock, new Environment(this.environment));
        }
        return null;
    }

    executeWhileStatement(statement) {
        while (this.isTruthy(this.evaluate(statement.condition))) {
            this.executeBlock(statement.body, new Environment(this.environment));
        }
        return null;
    }

    executeForStatement(statement) {
        this.execute(statement.initializer);
        
        while (this.isTruthy(this.evaluate(statement.condition))) {
            this.executeBlock(statement.body, new Environment(this.environment));
            this.execute(statement.increment);
        }
        return null;
    }

    executeFunctionDeclaration(statement) {
        const func = new Function(statement.name, statement.params, statement.body, this.environment);
        this.environment.define(statement.name, func);
        return null;
    }

    executeReturnStatement(statement) {
        const value = statement.value ? this.evaluate(statement.value) : null;
        throw new Return(value);
    }

    evaluate(expression) {
        switch (expression.type) {
            case 'Literal':
                return expression.value;
            case 'Identifier':
                return this.environment.get(expression.name);
            case 'BinaryExpression':
                return this.evaluateBinaryExpression(expression);
            case 'UnaryExpression':
                return this.evaluateUnaryExpression(expression);
            case 'CallExpression':
                return this.evaluateCallExpression(expression);
            case 'ArrayLiteral':
                return this.evaluateArrayLiteral(expression);
            case 'IndexExpression':
                return this.evaluateIndexExpression(expression);
            default:
                throw new Error(`অচিনাক্ত অভিব্যক্তিঃ ${expression.type}`);
        }
    }

    evaluateBinaryExpression(expression) {
        const left = this.evaluate(expression.left);
        const right = this.evaluate(expression.right);
        
        switch (expression.operator) {
            case '+':
                if (typeof left === 'string' || typeof right === 'string') {
                    return String(left) + String(right);
                }
                return left + right;
            case '-':
                this.checkNumberOperands(expression.operator, left, right);
                return left - right;
            case '*':
                this.checkNumberOperands(expression.operator, left, right);
                return left * right;
            case '/':
                this.checkNumberOperands(expression.operator, left, right);
                if (right === 0) throw new Error('শূন্যৰে হৰণ কৰিব নোৱাৰি');
                return left / right;
            
            case '==': return this.isEqual(left, right);
            case '!=': return !this.isEqual(left, right);
            case '<':
                this.checkNumberOperands(expression.operator, left, right);
                return left < right;
            case '>':
                this.checkNumberOperands(expression.operator, left, right);
                return left > right;
            case '<=':
                this.checkNumberOperands(expression.operator, left, right);
                return left <= right;
            case '>=':
                this.checkNumberOperands(expression.operator, left, right);
                return left >= right;
            
            case 'আৰু':
                return this.isTruthy(left) && this.isTruthy(right);
            case 'বা':
                return this.isTruthy(left) || this.isTruthy(right);
            
            default:
                throw new Error(`অচিনাক্ত অপাৰেটৰঃ ${expression.operator}`);
        }
    }

    evaluateUnaryExpression(expression) {
        const right = this.evaluate(expression.argument);
        
        switch (expression.operator) {
            case 'নহয়':
                return !this.isTruthy(right);
            case '-':
                this.checkNumberOperand(expression.operator, right);
                return -right;
            default:
                throw new Error(`অচিনাক্ত ইউনাৰি অপাৰেটৰঃ ${expression.operator}`);
        }
    }

    evaluateCallExpression(expression) {
        const callee = this.evaluate(expression.callee);
        const args = expression.args.map(arg => this.evaluate(arg));
        
        if (!(callee instanceof Callable) && typeof callee !== 'function') {
            throw new Error('কেৱল ফাংচনকল কৰিব পাৰি');
        }
        
        if (callee instanceof Callable) {
            if (args.length !== callee.arity) {
                throw new Error(`${callee.arity} আৰ্গুমেন্ট প্ৰয়োজন, ${args.length} পোৱা গ'ল`);
            }
            return callee.call(this, args);
        }
        
        return callee.apply(null, args);
    }

    evaluateArrayLiteral(expression) {
        return expression.elements.map(element => this.evaluate(element));
    }

    evaluateIndexExpression(expression) {
        const array = this.evaluate(expression.array);
        const index = this.evaluate(expression.index);
        
        if (!Array.isArray(array)) {
            throw new Error('ইণ্ডেক্সিং কেৱল তালিকাৰ বাবে');
        }
        
        if (typeof index !== 'number') {
            throw new Error('ইণ্ডেক্স সংখ্যা হব লাগে');
        }
        
        if (index < 0 || index >= array.length) {
            throw new Error('ইণ্ডেক্স সীমাৰ বাহিৰত');
        }
        
        return array[index];
    }

    isTruthy(value) {
        if (value === null) return false;
        if (typeof value === 'boolean') return value;
        if (typeof value === 'number') return value !== 0;
        if (typeof value === 'string') return value.length > 0;
        if (Array.isArray(value)) return value.length > 0;
        return true;
    }

    isEqual(a, b) {
        if (a === null && b === null) return true;
        if (a === null) return false;
        return a === b;
    }

    checkNumberOperand(operator, operand) {
        if (typeof operand === 'number') return;
        throw new Error(`${operator} অপাৰেটৰৰ বাবে সংখ্যা প্ৰয়োজন`);
    }

    checkNumberOperands(operator, left, right) {
        if (typeof left === 'number' && typeof right === 'number') return;
        throw new Error(`${operator} অপাৰেটৰৰ বাবে দুয়োটা সংখ্যা প্ৰয়োজন`);
    }
}

class Environment {
    constructor(enclosing = null) {
        this.values = {};
        this.enclosing = enclosing;
    }

    define(name, value) {
        this.values[name] = value;
    }

    assign(name, value) {
        if (name in this.values) {
            this.values[name] = value;
            return;
        }
        
        if (this.enclosing) {
            this.enclosing.assign(name, value);
            return;
        }
        
        throw new Error(`অপৰিভাষিত চলকঃ ${name}`);
    }

    get(name) {
        if (name in this.values) {
            return this.values[name];
        }
        
        if (this.enclosing) {
            return this.enclosing.get(name);
        }
        
        throw new Error(`অপৰিভাষিত চলকঃ ${name}`);
    }
}

class Return {
    constructor(value) {
        this.value = value;
    }
}

class Callable {
    constructor(arity, call) {
        this.arity = arity;
        this.call = call;
    }
}

class Function extends Callable {
    constructor(name, params, body, closure) {
        super(params.length, (interpreter, args) => {
            const environment = new Environment(closure);
            
            for (let i = 0; i < params.length; i++) {
                environment.define(params[i], args[i]);
            }
            
            try {
                interpreter.executeBlock(body, environment);
            } catch (returnValue) {
                if (returnValue instanceof Return) {
                    return returnValue.value;
                }
                throw returnValue;
            }
            
            return null;
        });
        
        this.name = name;
    }
}

module.exports = Interpreter;