/**
 * AST Node Definitions
 */

class Node {
    constructor(type, line, column) {
        this.type = type;
        this.line = line || 0;
        this.column = column || 0;
    }
}

class Program extends Node {
    constructor(body) {
        super('Program');
        this.body = body || [];
    }
}

class PrintStatement extends Node {
    constructor(expression, line, column) {
        super('PrintStatement', line, column);
        this.expression = expression;
    }
}

class VariableDeclaration extends Node {
    constructor(variableType, name, value, line, column) {
        super('VariableDeclaration', line, column);
        this.variableType = variableType;
        this.name = name;
        this.value = value;
    }
}

class Assignment extends Node {
    constructor(name, value, line, column) {
        super('Assignment', line, column);
        this.name = name;
        this.value = value;
    }
}

class IndexAssignment extends Node {
    constructor(array, index, value, line, column) {
        super('IndexAssignment', line, column);
        this.array = array;
        this.index = index;
        this.value = value;
    }
}

class IfStatement extends Node {
    constructor(condition, thenBlock, elseBlock, line, column) {
        super('IfStatement', line, column);
        this.condition = condition;
        this.thenBlock = thenBlock;
        this.elseBlock = elseBlock;
    }
}

class WhileStatement extends Node {
    constructor(condition, body, line, column) {
        super('WhileStatement', line, column);
        this.condition = condition;
        this.body = body;
    }
}

class ForStatement extends Node {
    constructor(initializer, condition, increment, body, line, column) {
        super('ForStatement', line, column);
        this.initializer = initializer;
        this.condition = condition;
        this.increment = increment;
        this.body = body;
    }
}

class FunctionDeclaration extends Node {
    constructor(name, params, body, line, column) {
        super('FunctionDeclaration', line, column);
        this.name = name;
        this.params = params;
        this.body = body;
    }
}

class ReturnStatement extends Node {
    constructor(value, line, column) {
        super('ReturnStatement', line, column);
        this.value = value;
    }
}

class BinaryExpression extends Node {
    constructor(left, operator, right, line, column) {
        super('BinaryExpression', line, column);
        this.left = left;
        this.operator = operator;
        this.right = right;
    }
}

class UnaryExpression extends Node {
    constructor(operator, argument, line, column) {
        super('UnaryExpression', line, column);
        this.operator = operator;
        this.argument = argument;
    }
}

class Literal extends Node {
    constructor(value, line, column) {
        super('Literal', line, column);
        this.value = value;
    }
}

class Identifier extends Node {
    constructor(name, line, column) {
        super('Identifier', line, column);
        this.name = name;
    }
}

class CallExpression extends Node {
    constructor(callee, args, line, column) {
        super('CallExpression', line, column);
        this.callee = callee;
        this.args = args;
    }
}

class ArrayLiteral extends Node {
    constructor(elements, line, column) {
        super('ArrayLiteral', line, column);
        this.elements = elements;
    }
}

class IndexExpression extends Node {
    constructor(array, index, line, column) {
        super('IndexExpression', line, column);
        this.array = array;
        this.index = index;
    }
}

module.exports = {
    Node,
    Program,
    PrintStatement,
    VariableDeclaration,
    Assignment,
    IndexAssignment,
    IfStatement,
    WhileStatement,
    ForStatement,
    FunctionDeclaration,
    ReturnStatement,
    BinaryExpression,
    UnaryExpression,
    Literal,
    Identifier,
    CallExpression,
    ArrayLiteral,
    IndexExpression
};