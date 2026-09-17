const Lexer = require('./lexer');
const Parser = require('./parser');
const Interpreter = require('./interpreter');

function run(code, inputProvider = null) {
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    const interpreter = new Interpreter(inputProvider);

    return {
        output: interpreter.interpret(ast),
        tokens,
        ast
    };
}

module.exports = { run };