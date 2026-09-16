# অসমীয়া ভাষা - Syntax Reference

এই নথিখনত অসমীয়া ভাষাৰ বৰ্তমানৰ syntax আৰু program চলোৱাৰ নিয়ম সহজ ভাষাত বুজোৱা হৈছে। তলত প্ৰথমে অসমীয়া গাইড আৰু তাৰ পিছত একে বিষয়ৰ English reference দিয়া হৈছে।

## অসমীয়া গাইড

### Code কেনেকৈ লিখিব আৰু চলাব

1. Project folder বা `examples` folder-ত `.asm` extension-ৰ এটা file বনাওক, যেনে `program.asm`।
2. File-টো UTF-8 encoding-ত save কৰক।
3. এটা statement সাধাৰণতে এটা line-ত লিখক।
4. VS Code-ৰ integrated terminal-ত project folder-ৰ পৰা program চলাওক:

```powershell
node src/cli.js program.asm
```

Example file চলাবলৈ:

```powershell
node src/cli.js examples/hello.asm
```

Test চলাবলৈ:

```powershell
npm test
```

Interactive REPL চলাবলৈ:

```powershell
node src/cli.js --repl
```

এই prototype-ত আলাদা machine-code compilation step নাই। Source code lexer, parser, AST আৰু interpreter-ৰ মাজেৰে গৈ execute হয়।

### Basic program structure

সাধাৰণতে program-ত comment, variable declaration, calculation আৰু output থাকে:

```asm
# দাম আৰু পৰিমাণ
সংখ্যা দাম = ৫০
সংখ্যা পৰিমাণ = ৩
সংখ্যা মুঠ = দাম * পৰিমাণ

লিখা "মুঠ দাম: " + মুঠ
```

Output:

```text
মুঠ দাম: 150
```

Comment `#`-ৰে আৰম্ভ হয়। খালী line interpreter-এ আওকাণ কৰে।

### Hello World

```asm
লিখা "নমস্কাৰ বিশ্ব!"
লিখা "অসমীয়া ভাষালৈ স্বাগতম!"

সংখ্যা বয়স = ২৫
বাক্য নাম = "ইঞ্জিনিয়াৰ পঞ্চানন নাথ"
লিখা "মোৰ নাম " + নাম + " আৰু বয়স " + বয়স
```

### Variable আৰু data type

Type keyword-ৰ পিছত variable name আৰু value লিখিব লাগে:

```asm
সংখ্যা বয়স = ২৫
বাক্য নাম = "অসম"
বুলিয়ান ঠিক = সত্য
তালিকা ফল = ["আম", "কল"]
```

আগতে declare কৰা variable assignment-ৰে সলনি কৰিব পাৰি:

```asm
সংখ্যা গণক = ১
গণক = গণক + ১
লিখা গণক
```

`সংখ্যা` number, `বাক্য` string, `বুলিয়ান` boolean, `তালিকা` array আৰু `খালি` null বুজায়। Boolean value হৈছে `সত্য` আৰু `মিছা`। Assamese digits (`০১২৩৪৫৬৭৮৯`) আৰু English digits দুয়োটাই চলে।

### Basic operations আৰু operators

```asm
লিখা ৫ + ৩
লিখা ২০ - ৫
লিখা ৬ * ৭
লিখা ২০ / ৪
লিখা -৫
```

Comparison operators:

```asm
লিখা ৫ == ৫
লিখা ৫ != ৪
লিখা ৫ > ৩
লিখা ৫ >= ৫
লিখা ৩ < ৫
লিখা ৩ <= ৫
```

Logical operators:

```asm
লিখা সত্য আৰু নহয় মিছা
লিখা মিছা বা সত্য
লিখা নহয় মিছা
```

`+` operator-এ number যোগ কৰে। যিকোনো এটা value string হ'লে `+`-এ string জোৰে:

```asm
সংখ্যা a = ১০
সংখ্যা b = ২০
লিখা "যোগফল: " + (a + b)
```

### Condition

`যদি` condition-ৰ শেষত `থাকিলে`, আৰু block-ৰ শেষত `শেষ` লিখিব লাগে:

```asm
যদি বয়স >= ১৮ থাকিলে
	লিখা "প্ৰাপ্তবয়স্ক"
নহলে যদি বয়স >= ১৩ থাকিলে
	লিখা "কিশোৰ"
নহলে
	লিখা "শিশু"
শেষ
```

### Loop

While loop:

```asm
সংখ্যা i = ১
যেতিয়া i <= ৩
	লিখা i
	i = i + ১
শেষ
```

Ascending range loop:

```asm
প্ৰতিবাৰ i = ১ লৈকে ৫
	লিখা i
শেষ
```

`লৈকে`-ৰ শেষৰ সংখ্যা loop-ত অন্তৰ্ভুক্ত হয় আৰু loop variable-এ প্ৰতিবাৰ ১ বৃদ্ধি পায়।

### Function

Function `কাজ`-ৰে আৰম্ভ, `উভতি`-ৰে value ঘূৰাই আৰু `শেষ`-ৰে বন্ধ হয়:

```asm
কাজ যোগ(সংখ্যা a, সংখ্যা b)
	উভতি a + b
শেষ

লিখা যোগ(২, ৩)
```

Function-এ নিজকে call কৰিব পাৰে:

```asm
কাজ ফেক্ট(সংখ্যা n)
	যদি n <= ১ থাকিলে
		উভতি ১
	নহলে
		উভতি n * ফেক্ট(n - ১)
	শেষ
শেষ

লিখা ফেক্ট(৫)
```

### তালিকা আৰু input

Index ০-ৰ পৰা আৰম্ভ হয়:

```asm
তালিকা ফল = ["আম", "কল", "লিচু"]
লিখা ফল[০]
ফল[১] = "কমলা"
লিখা ফল[১]
লিখা দৈৰ্ঘ্য(ফল)
```

Input:

```asm
বাক্য নাম = পঢ়া()
লিখা "নমস্কাৰ " + নাম
```

`পঢ়া()`-ৰ input provider JavaScript API-ৰ পৰা দিব পাৰি।

---

## English Reference

This document describes the language features currently implemented by the Node.js interpreter.

## Table of Contents

1. [Writing and Running Code](#writing-and-running-code)
2. [Basic Program Structure](#basic-program-structure)
3. [Hello World](#hello-world)
4. [Variables](#variables)
5. [Data Types](#data-types)
6. [Operators](#operators)
7. [Control Flow](#control-flow)
8. [Loops](#loops)
9. [Functions](#functions)
10. [Arrays](#arrays)
11. [Built-in Functions](#built-in-functions)

## Writing and Running Code

### 1. Create a source file

Create a file with the `.asm` extension, for example `program.asm`, inside the project folder or its `examples` directory. Save the file as UTF-8 so Assamese characters are preserved.

### 2. Write the program

Each instruction normally occupies one line. Use Assamese keywords for the language operation and a name for each variable:

```asm
সংখ্যা a = ১০
সংখ্যা b = ২০
লিখা a + b
```

### 3. Execute the program from VS Code

Open the integrated terminal in the project folder and run:

```powershell
node src/cli.js program.asm
```

For a file inside `examples`:

```powershell
node src/cli.js examples/hello.asm
```

The interpreter reads the source, creates tokens, builds an AST, executes the AST, and prints the result. There is currently no separate machine-code compilation step.

Run the complete test suite with:

```powershell
npm test
```

You can also try one-line programs in the REPL:

```powershell
node src/cli.js --repl
```

## Basic Program Structure

A basic program is usually written in this order:

1. Comments that describe the program.
2. Variable declarations.
3. Calculations or function definitions.
4. Output and control-flow statements.

```asm
# ১. চলক
সংখ্যা দাম = ৫০
সংখ্যা পৰিমাণ = ৩

# ২. গণনা
সংখ্যা মুঠ = দাম * পৰিমাণ

# ৩. ফলাফল
লিখা "মুঠ দাম: " + মুঠ
```

Output:

```text
মুঠ দাম: 150
```

Comments start with `#`. Blank lines are ignored. Names may contain Assamese letters, English letters, digits after the first character, and underscores.

## Hello World

```asm
লিখা "নমস্কাৰ বিশ্ব!"
```

Comments begin with `#` and continue to the end of the line.

The complete Hello World example is:

```asm
লিখা "নমস্কাৰ বিশ্ব!"
লিখা "অসমীয়া ভাষালৈ স্বাগতম!"

সংখ্যা বয়স = ২৫
বাক্য নাম = "ইঞ্জিনিয়াৰ পঞ্চানন নাথ"
লিখা "মোৰ নাম " + নাম + " আৰু বয়স " + বয়স
```

## Variables

Variables use a type keyword followed by a name. Assamese and ASCII names are both supported.

```asm
সংখ্যা বয়স = ২৫
বাক্য নাম = "অসম"
বুলিয়ান শুদ্ধ = সত্য
তালিকা ফল = ["আম", "কল"]
```

Values can be changed with assignment:

```asm
বয়স = বয়স + ১
```

The assignment name must already be declared:

```asm
সংখ্যা গণক = ১
গণক = গণক + ১
লিখা গণক
```

Assamese digits (`০১২৩৪৫৬৭৮৯`) and ASCII digits are supported.

## Data Types

| Keyword | Meaning | Example |
| --- | --- | --- |
| `সংখ্যা` | Number | `সংখ্যা x = ১০` |
| `বাক্য` | String | `বাক্য নাম = "অসম"` |
| `বুলিয়ান` | Boolean | `বুলিয়ান ঠিক = সত্য` |
| `তালিকা` | Array/list | `তালিকা সংখ্যা = [১, ২, ৩]` |
| `খালি` | Null value | `লিখা খালি` |

Boolean literals are `সত্য` and `মিছা`.

## Operators

### Arithmetic

```asm
লিখা ৫ + ৩
লিখা ৫ - ৩
লিখা ৫ * ৩
লিখা ৬ / ২
লিখা -৫
```

`+` also joins values when either operand is a string.

```asm
সংখ্যা a = ১০
সংখ্যা b = ২০

লিখা a + b
লিখা b - a
লিখা a * b
লিখা b / a
লিখা "যোগফল: " + (a + b)
```

Output:

```text
30
10
200
2
যোগফল: 30
```

Arithmetic precedence follows the usual order: multiplication and division happen before addition and subtraction. Use parentheses when you want to make the order explicit.

### Comparison and Logic

```asm
লিখা ৫ == ৫
লিখা ৫ != ৩
লিখা ৫ > ৩
লিখা ৫ >= ৫
লিখা ৩ < ৫
লিখা ৩ <= ৫
লিখা সত্য আৰু মিছা
লিখা সত্য বা মিছা
লিখা নহয় মিছা
```

Comparison and logical expressions produce `সত্য` or `মিছা` and are commonly used in conditions.

## Control Flow

`থাকিলে` ends an `যদি` condition. Every conditional block ends with `শেষ`.

```asm
যদি বয়স >= ১৮ থাকিলে
	লিখা "প্ৰাপ্তবয়স্ক"
নহলে যদি বয়স >= ১৩ থাকিলে
	লিখা "কিশোৰ"
নহলে
	লিখা "শিশু"
শেষ
```

The condition is evaluated before the block runs. Only the matching branch is executed.

## Loops

### While loop

```asm
সংখ্যা i = ১
যেতিয়া i <= ৩
	লিখা i
	i = i + ১
শেষ
```

### Range loop

`প্ৰতিবাৰ` counts inclusively from the starting number to the ending number.

```asm
প্ৰতিবাৰ i = ১ লৈকে ৫
	লিখা i
শেষ
```

The current range form increments by one and supports ascending ranges.

The loop variable is declared by the loop and can be used inside its body. The ending number is included.

## Functions

Functions can use optional type keywords before parameter names and return values with `উভতি`.

```asm
কাজ যোগ(সংখ্যা a, সংখ্যা b)
	উভতি a + b
শেষ

লিখা যোগ(২, ৩)
```

Function syntax:

```text
কাজ name(parameter1, parameter2)
	statements
	উভতি value
শেষ
```

Parameters may optionally have a type keyword. A function without `উভতি` returns `খালি`.

Functions can call themselves or another function:

```asm
কাজ ফেক্ট(সংখ্যা n)
	যদি n <= ১ থাকিলে
		উভতি ১
	নহলে
		উভতি n * ফেক্ট(n - ১)
	শেষ
শেষ

লিখা ফেক্ট(৫)
```

## Arrays

Array indexes start at zero.

```asm
তালিকা ফল = ["আম", "কল", "লিচু"]
লিখা ফল[০]

ফল[১] = "কমলা"
লিখা ফল[১]
```

Indexes must be valid integer positions.

List values can be numbers, strings, booleans, or expressions:

```asm
তালিকা মানসমূহ = [১, ২, ৩]
লিখা মানসমূহ[০] + মানসমূহ[২]
মানসমূহ[১] = ১০
লিখা মানসমূহ[১]
```

## Built-in Functions

### `দৈৰ্ঘ্য(value)`

Returns the length of a string or array:

```asm
লিখা দৈৰ্ঘ্য("অসমীয়া")
তালিকা ফল = [১, ২, ৩]
লিখা দৈৰ্ঘ্য(ফল)
```

### `পঢ়া()`

Reads input through the runtime input provider:

```asm
বাক্য নাম = পঢ়া()
লিখা নাম
```

For Node.js, provide input through the JavaScript API:

```js
const AsomiyaBhasha = require('./src');
const asomiya = new AsomiyaBhasha({ input: () => 'অসম' });
console.log(asomiya.run('লিখা পঢ়া()').output);
```

The browser demo currently uses its own limited evaluator and does not yet share every feature of the canonical interpreter.