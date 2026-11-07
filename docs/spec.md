# Asomiya Bhasha 2.0 — Language Specification

**অসমীয়া ভাষা ২.০ — ভাষাৰ নিৰ্দিষ্টকৰণ**

Version 2.0.1 · Reference implementation: the compiler in `src/` of [PanchananNath/Asomiya_Bhasha](https://github.com/PanchananNath/Asomiya_Bhasha)

This document defines the language: its characters and tokens, its grammar, its types and conversions, what each declaration, statement and expression means, the standard library, and the diagnostics the compiler produces. Where this document and the reference compiler disagree, that is a bug in one of them and should be reported.

Assamese terms appear with an English gloss on first use. Code examples are in Assamese; numbers in examples use Assamese digits, but ASCII digits are always accepted too.

---

## Contents

1. [Overview](#1-overview)
2. [Lexical structure](#2-lexical-structure)
3. [Grammar](#3-grammar)
4. [Types](#4-types)
5. [Declarations, scope and program structure](#5-declarations-scope-and-program-structure)
6. [Statements](#6-statements)
7. [Expressions](#7-expressions)
8. [Output formatting](#8-output-formatting)
9. [Standard library](#9-standard-library)
10. [Translation to C](#10-translation-to-c)
11. [Diagnostics](#11-diagnostics)
12. [Undefined behaviour and differences from C](#12-undefined-behaviour-and-differences-from-c)

---

## 1. Overview

Asomiya Bhasha 2.0 is a statically typed, compiled, imperative language with the expressive power of C11. A program is one or more UTF-8 source files (extension `.asb`). The compiler checks the whole program, translates it to a single C11 translation unit, and a C compiler (gcc or clang) produces a native executable.

Design rules that differ from C are deliberate and few:

- every variable without an initialiser starts at zero (`০`, `০.০`, `মিছা`, `খালি`);
- converting a floating-point value to an integer requires an explicit `হিচাপে` cast;
- a statement that computes a value and discards it (`x + ১`) is an error;
- `লিখা` prints numbers with Assamese digits and Booleans as `সত্য` / `মিছা`;
- blocks are closed by the keyword `শেষ`, not braces, and indentation is not significant;
- a program may be a script (top-level statements) or define the entry point `মূল`.

---

## 2. Lexical structure

### 2.1 Source text

Source files are UTF-8. Before tokenising, the compiler normalises the whole text to **Unicode NFC**. Because U+09DC ড়, U+09DD ঢ় and U+09DF য় are composition exclusions, NFC turns them into their decomposed forms (base letter + nukta U+09BC), so a keyword typed either way matches. A byte-order mark is ignored.

### 2.2 Line structure and separators

A **statement terminator** is a newline, a semicolon `;`, or the danda `।` (U+0964). Several terminators in a row are allowed.

Newlines are ignored while inside `( … )`, `[ … ]` or `{ … }`, so long argument lists and initialisers can span lines. Semicolons are never ignored; inside parentheses they separate the three parts of a C-style `প্ৰতিবাৰ`.

Spaces and tabs separate tokens and are otherwise insignificant. Indentation carries no meaning; blocks end with `শেষ`.

### 2.3 Comments

`#` starts a comment that runs to the end of the line.

```asb
লিখা "ক"   # এইটো মন্তব্য
```

### 2.4 Identifiers

```ebnf
identifier   = ident_start { ident_part } ;
ident_start  = "A"…"Z" | "a"…"z" | "_" | bengali_block_letter ;
ident_part   = ident_start | ascii_digit | assamese_digit | ZWNJ | ZWJ ;
bengali_block_letter = any code point U+0980…U+09FF except U+09E6…U+09EF ;
```

Identifiers may mix Assamese letters, Latin letters, digits and underscores (`ছাত্ৰ_১`, `total2`, `a1`). They cannot start with a digit. Zero-width joiner and non-joiner (U+200D, U+200C) are allowed inside an identifier. Identifiers are case-sensitive and compared after NFC normalisation. A word that matches a keyword (§2.5) is a keyword, not an identifier.

### 2.5 Keywords

Keyword matching is done after NFC, after replacing Bengali র (U+09B0) with Assamese ৰ (U+09F0), and after converting ASCII digits to Assamese digits. So `প্রতিবাৰ` = `প্ৰতিবাৰ` and `পূ32` = `পূ৩২`.

| Keyword | Gloss | Category | C equivalent |
| --- | --- | --- | --- |
| `পূৰ্ণ` | integer | type | `int32_t` |
| `পূ৮` `পূ১৬` `পূ৩২` `পূ৬৪` | signed n-bit integer | type | `int8_t` … `int64_t` |
| `দীঘল` | long | type | `int64_t` |
| `ধ৮` `ধ১৬` `ধ৩২` `ধ৬৪` | unsigned (ধনাত্মক) n-bit integer | type | `uint8_t` … `uint64_t` |
| `দশমিক`, `সংখ্যা` | decimal / number | type | `double` |
| `দশমিক৩২` | 32-bit decimal | type | `float` |
| `আখৰ` | character | type | `char` |
| `বুলিয়ান` | Boolean | type | `bool` |
| `শূন্য` | void | type | `void` |
| `বাক্য` | sentence (string) | type | `char *` |
| `ফাইল` | file | type | `FILE` |
| `কাজ` | work (function) | declaration, type | function |
| `গঠন` | structure | declaration | `struct` |
| `সংযোগ` | union | declaration | `union` |
| `গণনা` | enumeration | declaration | `enum` |
| `প্ৰকাৰ` | type (alias) | declaration | `typedef` |
| `স্থিৰ` | constant | qualifier | `const` |
| `বাহিৰৰ` | external | declaration | `extern` |
| `আমদানি` | import | declaration | — |
| `চি_অন্তৰ্ভুক্ত` | C include | declaration | `#include` |
| `যদি` … `থাকিলে` | if … then | statement | `if` |
| `নহলে` | otherwise | statement | `else` |
| `যেতিয়া` | while | statement | `while` |
| `কৰা` | do | statement | `do` |
| `প্ৰতিবাৰ` | each time | statement | `for` |
| `লৈকে` | up to | statement | — |
| `ক্ৰমে` | in steps of | statement | — |
| `ভাঙা` | break | statement | `break` |
| `আগবাঢ়া` | go ahead | statement | `continue` |
| `বাছক` | choose | statement | `switch` |
| `ক্ষেত্ৰ` | case | statement | `case` |
| `অন্যথা` | otherwise | statement | `default` |
| `উভতি` | return | statement | `return` |
| `শেষ` | end | block terminator | `}` |
| `লিখা` | write | statement | (§8) |
| `দেখুওৱা` | show | statement | (§8) |
| `সত্য` `মিছা` | true, false | literal | `true` `false` |
| `খালি` | empty | literal | `NULL` |
| `আৰু` `বা` `নহয়` | and, or, not | operator | `&&` `\|\|` `!` |
| `হিচাপে` | as | operator | cast |
| `আকাৰ` | size | operator | `sizeof` |
| `নতুন` | new | operator | `calloc` |

### 2.6 Literals

**Integer literals.** A sequence of decimal digits, ASCII `0–9` or Assamese `০–৯`, which may be mixed (`২1` is 21). Underscores between digits are ignored (`১_০০০_০০০`). The prefixes `0x` / `০x` (hexadecimal, digits and `a–f`) and `0b` / `০b` (binary) are supported. A literal has type `পূৰ্ণ` if its value fits in 32 signed bits, otherwise `পূ৬৪`, otherwise `ধ৬৪`; a larger value is an error. A minus sign is a unary operator, not part of the literal.

**Floating literals.** Digits, a `.`, digits, and an optional exponent `e±digits` (`৩.১৪`, `1.5e-3`). Both sides of the point need a digit. Type `দশমিক`.

**String literals.** Text in double quotes, on one line. Adjacent string literals are joined (`"ক" "খ"` is `"কখ"`). Type `বাক্য`. Escapes:

| Escape | Meaning |
| --- | --- |
| `\n` `\t` `\r` `\0` | newline, tab, carriage return, NUL |
| `\\` `\"` `\'` | backslash and quotes |
| `\xHH` | the code point with that hexadecimal value (0–FF) |
| `\u{H…}` | any Unicode code point, 1–6 hex digits |

**Character literals.** Exactly one code point in single quotes, after escapes. An ASCII character (`'A'`, `'\n'`) has type `আখৰ`. Any other code point (`'ক'`) has type `পূৰ্ণ` and the value of the Unicode code point; `লিখা 'ক'` prints the character.

**Boolean and null literals.** `সত্য`, `মিছা`, `খালি`.

### 2.7 Operators and punctuation

```
<<=  >>=  ...  ->  ++  --  +=  -=  *=  /=  %=  &=  |=  ^=  <<  >>  <=  >=  ==  !=  &&  ||
+  -  *  /  %  &  |  ^  ~  !  =  <  >  (  )  [  ]  {  }  ,  .  :  ?
```

The longest matching operator is taken. Any other character outside strings and comments is an error (`অচিনাক্ত চিহ্ন`).

---

## 3. Grammar

The grammar is written in EBNF: `{ x }` is zero or more, `[ x ]` is optional, `|` separates alternatives, terminals are in quotes. `NL` is a statement terminator (§2.2), `IDENT`, `INT`, `FLOAT`, `STRING` and `CHAR` are tokens from §2. Blank lines (`{ NL }`) may appear between any two statements or declarations and are omitted below for readability.

### 3.1 Program and declarations

```ebnf
program        = { top_level } EOF ;
top_level      = import | c_include | function | extern_func | struct_decl
               | enum_decl | type_alias | statement ;

import         = "আমদানি" STRING NL ;
c_include      = "চি_অন্তৰ্ভুক্ত" STRING NL ;

function       = "কাজ" IDENT "(" [ param { "," param } ] ")" [ "->" type ] NL
                   block "শেষ" NL ;
param          = type IDENT ;

extern_func    = "বাহিৰৰ" "কাজ" IDENT "(" [ ext_params ] ")" [ "->" type ]
                   [ "=" STRING ] NL ;
ext_params     = ext_param { "," ext_param } [ "," "..." ] | "..." ;
ext_param      = type [ IDENT ] ;

struct_decl    = ( "গঠন" | "সংযোগ" ) IDENT NL { field NL } "শেষ" NL ;
field          = type IDENT { "," IDENT } ;

enum_decl      = "গণনা" IDENT NL { enum_item ( "," | NL ) } "শেষ" NL ;
enum_item      = IDENT [ "=" expression ] ;

type_alias     = "প্ৰকাৰ" IDENT "=" type NL ;
```

### 3.2 Types

```ebnf
type           = base_type { "*" | dims } ;
base_type      = prim_type | IDENT | func_type ;
prim_type      = "পূৰ্ণ" | "পূ৮" | "পূ১৬" | "পূ৩২" | "পূ৬৪" | "দীঘল"
               | "ধ৮" | "ধ১৬" | "ধ৩২" | "ধ৬৪"
               | "দশমিক" | "সংখ্যা" | "দশমিক৩২"
               | "আখৰ" | "বুলিয়ান" | "শূন্য" | "বাক্য" | "ফাইল" ;
func_type      = "কাজ" "(" [ type [ IDENT ] { "," type [ IDENT ] } ] ")" [ "->" type ] ;
dims           = "[" [ expression ] "]" { "[" [ expression ] "]" } ;
```

Type suffixes are read left to right. `*` makes a pointer to the type so far. A group of consecutive dimensions `[a][b]` makes an array of `a` elements, each an array of `b` elements of the type so far; so `পূৰ্ণ[২][৩]` is two rows of three, indexed `m[r][c]` exactly as in C.

| Written | Meaning |
| --- | --- |
| `পূৰ্ণ*` | pointer to integer |
| `পূৰ্ণ[১০]` | array of 10 integers |
| `পূৰ্ণ*[৪]` | array of 4 pointers to integer |
| `পূৰ্ণ[৪]*` | pointer to an array of 4 integers |
| `বাক্য*` | pointer to string (`char **`) |
| `কাজ(পূৰ্ণ, পূৰ্ণ) -> পূৰ্ণ` | pointer to a function taking two integers and returning one |
| `কাজ(বাক্য)` | pointer to a function returning nothing |

### 3.3 Statements

```ebnf
block          = { statement } ;
statement      = var_decl NL | if_stmt | while_stmt | do_stmt | for_stmt | switch_stmt
               | "ভাঙা" NL | "আগবাঢ়া" NL | "উভতি" [ expression ] NL
               | ( "লিখা" | "দেখুওৱা" ) [ expression { "," expression } ] NL
               | expression NL ;

var_decl       = [ "স্থিৰ" ] type declarator { "," declarator } ;
declarator     = IDENT [ "=" initializer ] ;
initializer    = expression
               | "[" [ initializer { "," initializer } [ "," ] ] "]"
               | brace_init ;
brace_init     = "{" [ field_init { "," field_init } [ "," ] ] "}" ;
field_init     = [ IDENT ":" ] initializer ;

if_stmt        = "যদি" expression "থাকিলে" NL block
                 { "নহলে" "যদি" expression "থাকিলে" NL block }
                 [ "নহলে" NL block ]
                 "শেষ" NL ;
while_stmt     = "যেতিয়া" expression NL block "শেষ" NL ;
do_stmt        = "কৰা" NL block "শেষ" "যেতিয়া" expression NL ;
for_stmt       = "প্ৰতিবাৰ" ( range_for | c_for ) ;
range_for      = [ type ] IDENT "=" expression "লৈকে" expression
                 [ "ক্ৰমে" expression ] NL block "শেষ" NL ;
c_for          = "(" [ var_decl | expression ] ";" [ expression ] ";" [ expression ] ")" NL
                 block "শেষ" NL ;
switch_stmt    = "বাছক" expression NL
                 { "ক্ষেত্ৰ" expression { "," expression } [ ":" ] NL block }
                 [ "অন্যথা" [ ":" ] NL block ]
                 "শেষ" NL ;
```

A whole `যদি … নহলে যদি … নহলে …` chain is closed by **one** `শেষ`.

A line that begins with an identifier is a declaration when it has the shape `type IDENT` followed by `=`, `,` or the end of the statement (for example `বিন্দু p`, `বিন্দু* q = খালি`, `পূৰ্ণ[৩] ক`). Otherwise it is an expression statement (`x = ৫`, `ক(৫)`, `ক[i] = ০`, `i++`).

### 3.4 Expressions

```ebnf
expression     = assignment ;
assignment     = conditional [ assign_op assignment ] ;
assign_op      = "=" | "+=" | "-=" | "*=" | "/=" | "%=" | "&=" | "|=" | "^=" | "<<=" | ">>=" ;
conditional    = binary(1) [ "?" expression ":" conditional ] ;
binary(p)      = cast { binop(q) binary(q + 1) }        (* q ≥ p, left associative *)
cast           = unary { "হিচাপে" type } ;
unary          = ( "-" | "+" | "!" | "নহয়" | "~" | "*" | "&" | "++" | "--" ) unary
               | "আকাৰ" "(" ( type | expression ) ")"
               | postfix ;
postfix        = primary { "(" [ expression { "," expression } ] ")"
                         | "[" expression "]"
                         | ( "." | "->" ) IDENT
                         | "++" | "--" } ;
primary        = INT | FLOAT | STRING { STRING } | CHAR | "সত্য" | "মিছা" | "খালি"
               | IDENT [ brace_init ]
               | "নতুন" "(" type [ "," expression ] ")"
               | "(" expression ")" ;
```

### 3.5 Operator precedence

From tightest to loosest binding:

| Level | Operators | Associativity |
| --- | --- | --- |
| postfix | `()` `[]` `.` `->` `x++` `x--` | left |
| unary | `-` `+` `!`/`নহয়` `~` `*` `&` `++x` `--x` `আকাৰ` | right |
| cast | `হিচাপে` | left |
| 10 | `*` `/` `%` | left |
| 9 | `+` `-` | left |
| 8 | `<<` `>>` | left |
| 7 | `<` `>` `<=` `>=` | left |
| 6 | `==` `!=` | left |
| 5 | `&` | left |
| 4 | `^` | left |
| 3 | `\|` | left |
| 2 | `&&` / `আৰু` | left |
| 1 | `\|\|` / `বা` | left |
| conditional | `? :` | right |
| assignment | `=` `+=` … | right |

`হিচাপে` binds tighter than multiplication: `৭ হিচাপে দশমিক / ২` is `(৭ হিচাপে দশমিক) / ২` = 3.5. In a cast type, a following `*` is read as part of the type, so write `(x হিচাপে পূৰ্ণ) * ২` to multiply. `নহয়` is the same operator as `!` and binds as tightly: `নহয় (১ == ২)` needs the parentheses.

---

## 4. Types

### 4.1 Primitive types

| Keyword | Kind | Size | Range / values | Printed by `লিখা` as |
| --- | --- | --- | --- | --- |
| `পূ৮` | signed integer | 1 byte | −128 … 127 | Assamese digits |
| `পূ১৬` | signed integer | 2 | −32 768 … 32 767 | Assamese digits |
| `পূৰ্ণ`, `পূ৩২` | signed integer | 4 | −2 147 483 648 … 2 147 483 647 | Assamese digits |
| `পূ৬৪`, `দীঘল` | signed integer | 8 | −9.22 × 10¹⁸ … 9.22 × 10¹⁸ | Assamese digits |
| `ধ৮` | unsigned integer | 1 | 0 … 255 | Assamese digits |
| `ধ১৬` | unsigned integer | 2 | 0 … 65 535 | Assamese digits |
| `ধ৩২` | unsigned integer | 4 | 0 … 4 294 967 295 | Assamese digits |
| `ধ৬৪` | unsigned integer | 8 | 0 … 18 446 744 073 709 551 615 | Assamese digits |
| `দশমিক`, `সংখ্যা` | IEEE-754 binary64 | 8 | ≈ ±1.8 × 10³⁰⁸, 15–17 significant digits | up to 15 significant digits |
| `দশমিক৩২` | IEEE-754 binary32 | 4 | ≈ ±3.4 × 10³⁸ | converted to `দশমিক`, then as above |
| `আখৰ` | character (byte) | 1 | one byte; ASCII or one UTF-8 byte | the character |
| `বুলিয়ান` | Boolean | 1 | `সত্য`, `মিছা` | `সত্য` / `মিছা` |
| `শূন্য` | no value | — | — | not printable |
| `ফাইল` | opaque C `FILE` | — | used only as `ফাইল*` | address |

`বাক্য` is a name for `আখৰ*`: a pointer to the first byte of a NUL-terminated UTF-8 string. Assamese text uses three bytes per letter, so `দৈৰ্ঘ্য("অসম")` is 9.

### 4.2 Derived types

- **Pointer** `T*` holds the address of a `T`. `শূন্য*` is a generic pointer. The null pointer is `খালি`.
- **Array** `T[n]` holds `n` consecutive elements; `n` must be a positive integer constant expression (§7.10). In a declaration with an initialiser the size may be omitted (`পূৰ্ণ[] ক = [১, ২]`). In expressions an array converts to a pointer to its first element, except as the operand of `&`, `আকাৰ`, `দৈৰ্ঘ্য` and `লিখা`.
- **Structure** `গঠন` groups named fields; **union** `সংযোগ` overlays them in the same storage. A structure may contain a pointer to itself but not itself by value.
- **Enumeration** `গণনা` declares integer constants and a type that behaves as `পূৰ্ণ`. Members start at 0 and count up by one; `= expr` sets a value and the count continues from it.
- **Function pointer** `কাজ(T…) -> R`. A function name used as a value has function type and converts to a pointer to it.
- **Alias** `প্ৰকাৰ নাম = type` gives an existing type a new name. It does not create a distinct type.

### 4.3 Integer promotion and the usual arithmetic conversions

Before arithmetic, `আখৰ`, `বুলিয়ান`, enumeration types and integers narrower than 32 bits are promoted to `পূৰ্ণ`. For a binary operator on two arithmetic operands:

1. If either is floating, the result is `দশমিক` if either is `দশমিক`, else `দশমিক৩২`.
2. Otherwise, after promotion, if both have the same width the result has that width and is unsigned if either operand is unsigned.
3. Otherwise the result has the type of the wider operand.

These are C's rules for the 32- and 64-bit cases.

### 4.4 Implicit conversions (assignment, initialisation, arguments, return)

A value of type `S` may be stored into a place of type `D` without a cast when:

| D | S | Notes |
| --- | --- | --- |
| any | the same type | — |
| integer, `আখৰ`, `বুলিয়ান`, enum | integer, `আখৰ`, `বুলিয়ান`, enum | an integer **constant** outside D's range is an error |
| floating | any arithmetic type | — |
| integer type | floating | **error**: write `x হিচাপে পূৰ্ণ` |
| `T*` | `T*`, `T[n]` (array decay), `খালি` | — |
| `T*` | `U*` where T or U is `শূন্য` | as in C |
| `T*` | `U*` with T ≠ U | **error**: use `হিচাপে` |
| function pointer | a function with exactly the same parameter and return types | — |
| `বুলিয়ান` | pointer | true when not `খালি` |
| struct / union | the same struct / union | copied by value |
| array | — | arrays cannot be assigned; copy element by element or use `প্ৰতিলিপি` |

### 4.5 Explicit conversion: `হিচাপে`

`expr হিচাপে T` converts between any two arithmetic types (floating to integer truncates toward zero), between pointer types, between pointers and integers, from a function to a function pointer, and to `শূন্য` (discarding the value). Converting a struct, union or array is an error.

---

## 5. Declarations, scope and program structure

### 5.1 Variables

```asb
গঠন বিন্দু
    পূৰ্ণ x, y
শেষ
গঠন ছাত্ৰ
    বাক্য নাম
    পূৰ্ণ নম্বৰ
শেষ

পূৰ্ণ গণক                      # starts at ০
দশমিক পাই = ৩.১৪১৫৯
পূৰ্ণ x = ১, y = x + ১         # several declarators share the type
স্থিৰ পূৰ্ণ সৰ্বোচ্চ = ১০০        # cannot be assigned again
পূৰ্ণ[] মান = [৫, ২, ৯]          # size 3 inferred
আখৰ[৩২] নাম = "অসম"           # a modifiable string buffer
বিন্দু p = {x: ১, y: ২}         # named fields
বিন্দু q = {৩, ৪}               # positional fields
ছাত্ৰ[] শ্ৰেণী = [{"ৰিমা", ৮৮}, {"ৰাহুল", ৭২}]
```

A variable without an initialiser is zero. A `স্থিৰ` variable must be initialised. Array initialisers use `[ … ]`, structure initialisers `{ … }`; they may nest. Missing trailing elements or fields are zero. A string literal may initialise an `আখৰ` array if it fits including the terminating NUL.

### 5.2 Scope

Names live in nested scopes: the global scope, then one scope per function, and a new scope for every block (`যদি` branch, loop body, `বাছক` case, the header of a `প্ৰতিবাৰ`). A name is visible from its declaration to the end of its scope. Declaring the same name twice in one scope is an error; a declaration in an inner scope hides an outer one.

Types, functions, global variables and enumeration constants share the global namespace. The built-in names of §9 are global too and cannot be redeclared at global level.

Functions, structures, unions, enumerations and aliases may be used before their declaration in the file. Function bodies may use any global variable; top-level statements may use only global variables declared above them.

### 5.3 Functions

```asb
কাজ যোগ(পূৰ্ণ a, পূৰ্ণ b) -> পূৰ্ণ
    উভতি a + b
শেষ
```

Parameters are passed by value; structures are copied, arrays are passed as pointers to their first element (a parameter written `পূৰ্ণ[৩] ক` has type `পূৰ্ণ*`). Functions may be recursive and mutually recursive.

**Return type inference.** If `-> type` is omitted, the return type is the type of the expression in the first `উভতি expr` reached while checking the body in source order; with no such statement it is `শূন্য`. A recursive call checked before the first `উভতি expr` is an error asking for an explicit `-> type`. A function with a non-`শূন্য` return type whose body can end without `উভতি` produces a warning.

### 5.4 Program structure and entry point

A program runs in one of two modes:

- **Script mode** (no function named `মূল`): top-level statements run in source order when the program starts. Top-level variable declarations are global variables; a non-constant initialiser runs at the point where the declaration appears.
- **Main mode** (a function `মূল` is declared): only declarations may appear at top level. Non-constant global initialisers run in source order before `মূল` is called. `মূল` takes no parameters or `(পূৰ্ণ n, বাক্য* আৰ্গুমেণ্ট)` — the argument count and the arguments, with `আৰ্গুমেণ্ট[০]` the program name — and returns `পূৰ্ণ` (the process exit status) or `শূন্য` (exit status 0).

In both modes `প্ৰস্থান(n)` ends the program immediately with status `n`.

### 5.5 Modules: `আমদানি`

`আমদানি "path.asb"` includes the declarations of another file. The path is relative to the importing file. Each file is included at most once, however many times it is imported, so circular imports are harmless. An imported file may contain only declarations, including global variables; top-level statements in it are an error.

### 5.6 C interoperability

```asb
বাহিৰৰ কাজ puts(বাক্য) -> পূৰ্ণ                     # C function of the same name
বাহিৰৰ কাজ ঘনমূল(দশমিক) -> দশমিক = "cbrt"            # Assamese name for a C function
বাহিৰৰ কাজ ভুল_লিখা(ফাইল*, বাক্য, ...) -> পূৰ্ণ = "fprintf"   # variadic
চি_অন্তৰ্ভুক্ত "<ctype.h>"                            # emit #include in the generated C
বাহিৰৰ কাজ ডাঙৰ_আখৰ(পূৰ্ণ) -> পূৰ্ণ = "toupper"       # declared by <ctype.h>

puts("C-ৰ puts")
লিখা ঘনমূল(২৭.০), ডাঙৰ_আখৰ('a') হিচাপে আখৰ
```

`বাহিৰৰ কাজ` declares a C function. The string after `=` is its C name; without it the Asomiya name is used. Parameter names are optional. `...` makes the function variadic; extra arguments are checked only for not being structs. If the program has no `চি_অন্তৰ্ভুক্ত` and the function is not declared by the standard C headers the runtime includes, the compiler emits an `extern` prototype; otherwise the header supplies it. Libraries other than the C standard library and `libm` must be linked by building the generated C yourself (`asomiya c prog.asb -o prog.c`, then `cc prog.c -lfoo`).

---

## 6. Statements

**Expression statement.** Evaluates the expression for its effect. It must be an assignment, a call, or `++` / `--`; anything else is an error (`এই বিবৃতিৰ কোনো প্ৰভাৱ নাই`).

**`যদি`.** Evaluates each condition in turn and runs the first block whose condition is true; otherwise the `নহলে` block, if any. A condition may have any scalar type (number, `আখৰ`, `বুলিয়ান`, pointer, array): zero and `খালি` are false. Writing `=` as a condition produces a warning.

**`যেতিয়া`.** Repeats the block while the condition is true, testing before each pass.

**`কৰা … শেষ যেতিয়া c`.** Runs the block, then repeats it while `c` is true.

**Range `প্ৰতিবাৰ`.** `প্ৰতিবাৰ i = a লৈকে b ক্ৰমে s` declares a **new** variable `i`, local to the loop, and runs the block for `i = a, a+s, a+2s, …` while `i ≤ b` (if `s > 0`) or `i ≥ b` (if `s < 0`). The bound `b` and step `s` are evaluated once, before the first pass. The default step is 1, so `প্ৰতিবাৰ i = ৫ লৈকে ১` runs zero times; count down with `ক্ৰমে -১`. The variable's type is the given type, or the usual arithmetic conversion of the types of `a` and `b` (so floating ranges are allowed). A constant step of 0 is an error.

**C-style `প্ৰতিবাৰ`.** `প্ৰতিবাৰ (init; cond; update)` behaves exactly like C's `for`. Variables declared in `init` are local to the loop.

**`বাছক`.** Evaluates an integer, `আখৰ` or enumeration expression and runs the block of the matching `ক্ষেত্ৰ`, or `অন্যথা` if none matches. Case values must be distinct integer constants. Control **never falls through** from one case to the next.

**`ভাঙা`.** Leaves the innermost enclosing loop or `বাছক`. Inside a `বাছক` that is inside a loop, it leaves the `বাছক`, as in C.

**`আগবাঢ়া`.** Skips to the next pass of the innermost loop (for a C-style loop, to its update expression).

**`উভতি`.** Returns from the function, with a value if the function's type is not `শূন্য`. `উভতি` outside a function is an error; use `প্ৰস্থান`.

**`লিখা` / `দেখুওৱা`.** Print their arguments; see §8.

---

## 7. Expressions

### 7.1 Evaluation order

`আৰু` / `&&`, `বা` / `||` and `? :` evaluate their left operand first and evaluate the right operand only when needed (short-circuit). The order in which the operands of other operators and the arguments of a call are evaluated is unspecified, as in C.

### 7.2 Arithmetic

`+ - * /` apply the usual arithmetic conversions. Integer division truncates toward zero (`-৭ / ২` is `-৩`); `%` gives the remainder with the sign of the dividend (`-৭ % ৩` is `-১`) and requires integer operands. Division by a constant zero is a compile-time error; division by zero at run time and signed overflow are undefined behaviour (§12).

### 7.3 Bitwise operators

`& | ^ ~ << >>` require integer operands. Shifts have the promoted type of the left operand.

### 7.4 Comparison and logic

`== != < > <= >=` compare two arithmetic values, or two pointers (or a pointer and `খালি`), and produce `বুলিয়ান`. Comparing two `বাক্য` with `==` compares addresses and produces a warning; use `তুলনা(ক, খ) == ০`. `আৰু`, `বা`, `নহয়` accept any scalar operands and produce `বুলিয়ান`.

### 7.5 Pointers

`&x` gives the address of a variable, array element, field or function. `*p` reads or writes the value a pointer points to; dereferencing `শূন্য*` is an error. `p + n` and `p - n` move by `n` elements; `p - q` between pointers of the same type gives the element distance as `পূ৬৪`. `p[i]` means `*(p + i)`. `p->f` means `(*p).f`. Using `.` on a pointer, or `->` on a non-pointer, is an error that suggests the right operator.

### 7.6 Strings

`বাক্য` values cannot be joined with `+`; adding a string literal to anything is an error. Use `লিখা ক, খ` to print several values, or `যোগ_বাক্য(ক, খ)` to build a new heap string.

### 7.7 Assignment

`x = v` stores `v` into `x` (§4.4) and has the stored value, so `a = b = ৫` works. `x op= v` is `x = x op v` with `x` evaluated once. The left side must be a variable, array element, field or `*pointer`; it may not be a `স্থিৰ` variable or a whole array.

### 7.8 `আকাৰ`, `দৈৰ্ঘ্য`, `নতুন`

- `আকাৰ(T)` or `আকাৰ(expr)` gives the size in bytes, as `পূ৬৪`. The expression is not evaluated.
- `দৈৰ্ঘ্য(x)` gives, as `পূ৬৪`: for an array other than `আখৰ[]`, its number of elements (a constant); for `বাক্য` or `আখৰ[]`, the number of bytes before the terminating NUL.
- `নতুন(T)` allocates one zero-filled `T` on the heap and returns `T*`; `নতুন(T, n)` allocates `n` of them. Free the memory with `মুকলি(p)`. On failure the result is `খালি`.

### 7.9 Structure literals

`নাম{…}` creates a temporary structure value: `বিন্দু{৭, ৮}.y`, `উভতি বিন্দু{x: ০, y: ০}`.

### 7.10 Constant expressions

Integer constant expressions are needed for array sizes, enumeration values and case labels. They are built from integer, character and Boolean literals, enumeration constants, `স্থিৰ` integer variables with constant initialisers, unary `- + ~ !`, the binary arithmetic, bitwise, comparison and logical operators, and casts to integer types. Global variables are statically initialised when their initialiser is a constant expression, a floating literal, a string literal, `খালি`, a function name, or a `[…]` / `{…}` list of these.

---

## 8. Output formatting

`লিখা a, b, …` prints each argument, separated by one space, followed by a newline. `লিখা` with no arguments prints an empty line. `দেখুওৱা a, b, …` is the same but ends with a space instead of a newline, so repeated calls build one line.

| Type | Printed as |
| --- | --- |
| integers, enumerations | decimal with Assamese digits: `-১২৩` |
| `দশমিক`, `দশমিক৩২` | C `%.15g` with Assamese digits: `০.৩`, `৩.১৪১৫৯`, `১e+২০`; NaN as `অসংখ্যা`, infinity as `অসীম` / `-অসীম` |
| `বুলিয়ান` | `সত্য` or `মিছা` |
| `আখৰ` | the byte itself |
| non-ASCII character literal | the character (`লিখা 'ক'` → `ক`) |
| `বাক্য`, `আখৰ[]` | the text; a `খালি` string prints `খালি` |
| other pointers | the address in hexadecimal, or `খালি` |
| other arrays | `[১, ২, ৩]`, nested for multi-dimensional arrays |
| structures | `{x: ১, y: ২}` with field names, nested |
| unions, `শূন্য`, functions | compile-time error |

The `--ascii-digits` compiler option prints ASCII digits `0–9` instead. `ছপা(format, …)` is C's `printf`, unaffected by this table: it prints whatever the format string says, with ASCII digits.

---

## 9. Standard library

All of these are declared automatically. They are ordinary C or runtime functions.

### 9.1 Input and conversion

| Function | Type | Meaning | C |
| --- | --- | --- | --- |
| `পঢ়া()` | `-> বাক্য` | read one line from standard input (heap string without the newline; `খালি` at end of input) | runtime |
| `পঢ়া_পূৰ্ণ()` | `-> পূ৬৪` | read a line and convert it to an integer; Assamese digits accepted | runtime |
| `পঢ়া_দশমিক()` | `-> দশমিক` | read a line and convert it to a decimal | runtime |
| `সংখ্যালৈ(বাক্য)` | `-> পূ৬৪` | text to integer; Assamese digits accepted | runtime |
| `দশমিকলৈ(বাক্য)` | `-> দশমিক` | text to decimal | runtime |
| `বাক্যলৈ(পূ৬৪)` | `-> বাক্য` | integer to a heap string with Assamese digits | runtime |
| `ছপা(বাক্য ধৰণ, ...)` | `-> পূৰ্ণ` | formatted output | `printf` |

### 9.2 Memory

| Function | Type | C |
| --- | --- | --- |
| `সংৰক্ষণ(ধ৬৪ n)` | `-> শূন্য*` | `malloc` |
| `পুনৰ_সংৰক্ষণ(শূন্য* p, ধ৬৪ n)` | `-> শূন্য*` | `realloc` |
| `মুকলি(শূন্য* p)` | — | `free` |
| `প্ৰতিলিপি(শূন্য* গন্তব্য, শূন্য* উৎস, ধ৬৪ n)` | `-> শূন্য*` | `memcpy` |
| `ভৰোৱা(শূন্য* p, পূৰ্ণ মান, ধ৬৪ n)` | `-> শূন্য*` | `memset` |

### 9.3 Strings

| Function | Type | Meaning | C |
| --- | --- | --- | --- |
| `দৈৰ্ঘ্য(x)` | `-> পূ৬৪` | built-in, see §7.8 | — |
| `বাক্য_দৈৰ্ঘ্য(বাক্য)` | `-> পূ৬৪` | bytes before the NUL | `strlen` |
| `আখৰ_সংখ্যা(বাক্য)` | `-> পূ৬৪` | number of Unicode code points | runtime |
| `তুলনা(বাক্য, বাক্য)` | `-> পূৰ্ণ` | <0, 0, >0 by byte order | `strcmp` |
| `বাক্য_প্ৰতিলিপি(বাক্য)` | `-> বাক্য` | heap copy | runtime |
| `যোগ_বাক্য(বাক্য, বাক্য)` | `-> বাক্য` | new heap string ক + খ | runtime |

### 9.4 Mathematics (`দশমিক` in, `দশমিক` out)

`বৰ্গমূল` (sqrt), `ঘাত(x, y)` (pow), `পৰম` (fabs), `ছাইন` (sin), `কছাইন` (cos), `টেন` (tan), `লগ` (natural log), `লগ১০` (log10), `তল` (floor), `ওপৰ` (ceil), `ঘূৰণীয়া` (round, halves away from zero).

### 9.5 Process, time and random numbers

| Function | Type | C |
| --- | --- | --- |
| `প্ৰস্থান(পূৰ্ণ)` | — | `exit` |
| `যাদৃচ্ছিক()` | `-> পূৰ্ণ` | `rand` |
| `বীজ(ধ৩২)` | — | `srand` |
| `সময়()` | `-> পূ৬৪` | `time(NULL)` |

### 9.6 Files

| Function | Type | C |
| --- | --- | --- |
| `খোলা(বাক্য পথ, বাক্য ধৰণ)` | `-> ফাইল*` (`খালি` on failure) | `fopen` |
| `বন্ধ(ফাইল*)` | `-> পূৰ্ণ` | `fclose` |
| `ফাইলত_লিখা(ফাইল*, বাক্য)` | `-> পূৰ্ণ` | `fputs` |
| `ফাইলত_ছপা(ফাইল*, বাক্য ধৰণ, ...)` | `-> পূৰ্ণ` | `fprintf` |
| `ফাইলৰ_শাৰী(ফাইল*)` | `-> বাক্য` (`খালি` at end) | runtime |

Strings returned by `পঢ়া`, `ফাইলৰ_শাৰী`, `বাক্যলৈ`, `বাক্য_প্ৰতিলিপি` and `যোগ_বাক্য` are on the heap; free them with `মুকলি`.

---

## 10. Translation to C

This section is informative: it describes how the reference compiler works, not requirements on programs.

- The output is one C11 file: a header comment, the runtime (§9 helpers, all `static inline`), `#include`s from `চি_অন্তৰ্ভুক্ত`, `typedef`s for structures and unions, enumerations, structure bodies in dependency order, `extern` prototypes, function prototypes, globals, function bodies, and `main`.
- Every user name `x` becomes `a_x`, so it can never clash with a C keyword or library name. Assamese letters stay as UTF-8 (gcc ≥ 10 and clang accept them); `--ascii-names` writes `_uXXXX_` instead. External functions keep their C names.
- User functions are `static`. `main` initialises globals, runs the script statements or calls `a_মূল`, and returns the exit status.
- On Windows, `main` first switches the console to UTF-8 and re-reads the command-line arguments as UTF-8, so Assamese arguments and output work as on Linux and macOS. Standard output stays in text mode, so lines end with `\r\n` there.
- Each `লিখা` becomes calls to `asb_rt_print_*` chosen by the static type of each argument.
- Range loops become `for (T i = a, end = b; i <= end; i += s)`.
- The C compiler is called as `cc -std=c11 -O2 prog.c -lm` (`-O` and `-g` follow the command-line options).

```text
$ asomiya c examples/hello.asb | tail -12
int main(int argc, char **argv) {
    (void)argc; (void)argv;
    asb_rt_print_str("নমস্কাৰ বিশ্ব!");
    asb_rt_nl();
    …
```

---

## 11. Diagnostics

Every message gives `file:line:column`, the severity (`ত্ৰুটি` error, `সতৰ্কবাণী` warning), the message, the source line and a caret under the column. All errors in a file are reported together; a parse error stops at the first one. An expression that already produced an error does not produce follow-on errors.

### 11.1 Lexical and syntax errors

| Message (Assamese) | Meaning |
| --- | --- |
| `অচিনাক্ত চিহ্ন 'X' (U+XXXX)` | a character that is not part of the language |
| `বাক্য (string) বন্ধ কৰা হোৱা নাই` | string without its closing `"` on the same line |
| `'...'-ৰ ভিতৰত ঠিক এটা আখৰ থাকিব লাগে` | character literal with zero or several code points |
| `অচিনাক্ত escape '\X'` | unsupported escape sequence |
| `X প্ৰত্যাশিত, কিন্তু Y পোৱা গ'ল` | expected X, found Y |
| `'থাকিলে' প্ৰত্যাশিত (যদি ... থাকিলে)` | `যদি` without `থাকিলে` |
| `… block বন্ধ কৰিবলৈ 'শেষ' নাই` | a block runs to the end of the file (reported at the line that opened it) |
| `অপ্ৰত্যাশিত 'শেষ' — ইয়াৰ আগত কোনো block খোলা হোৱা নাই` | an extra `শেষ` |
| `বিবৃতিৰ শেষত শাৰী সলনি হ'ব লাগিছিল` | two statements on one line without `;` |
| `কাজৰ ভিতৰত আন কাজ ঘোষণা কৰিব নোৱাৰি` | nested function |

### 11.2 Semantic errors

| Message (Assamese) | Meaning |
| --- | --- |
| `অপৰিভাষিত নাম 'x' — আপুনি 'y' বুজাইছিল নেকি?` | unknown name, with the closest known name |
| `'x' এই পৰিসৰত … আগতেই ঘোষণা কৰা হৈছে` | duplicate declaration in one scope |
| `'S' মান 'D'-লৈ দিব নোৱাৰি` | value of type S cannot be stored as D (§4.4), with a hint |
| `দশমিকৰ পৰা পূৰ্ণলৈ নিবলৈ 'হিচাপে' লিখক` | float to integer needs a cast |
| `মান N 'T'-ৰ সীমাৰ (… … …) বাহিৰত` | constant outside the target type's range |
| `'op' 'A' আৰু 'B'-ৰ মাজত ব্যৱহাৰ কৰিব নোৱাৰি` | operator not defined for these types |
| `বাক্য '+' দি জোৰা নাযায়` | string concatenation with `+` |
| `'f'-এ Nটা আৰ্গুমেণ্ট লয়, কিন্তু Mটা দিয়া হৈছে` | wrong number of arguments |
| `এই বিবৃতিৰ কোনো প্ৰভাৱ নাই` | expression statement with no effect |
| `'P*' এটা সূচক; '.'-ৰ সলনি '->' লিখক` (and the reverse) | wrong member operator |
| `'S'-ত 'f' নামৰ ক্ষেত্ৰ নাই — আছে: …` | unknown field, listing the real ones |
| `'x' স্থিৰ; ইয়াৰ মান সলনি কৰিব নোৱাৰি` | assignment to a constant |
| `সূচী N তালিকাৰ সীমাৰ (০ … M) বাহিৰত` | constant index out of bounds |
| `শূন্যৰে হৰণ কৰিব নোৱাৰি` | division by constant zero |
| `তালিকাৰ আকাৰ এটা স্থিৰ পূৰ্ণ সংখ্যা হ'ব লাগিব` | non-constant array size |
| `'ভাঙা' কেৱল loop বা বাছকৰ ভিতৰত …`, `'আগবাঢ়া' কেৱল loop-ৰ ভিতৰত …` | misplaced break or continue |
| `'উভতি' কেৱল কাজৰ ভিতৰত …` | return outside a function |
| `'f'-ৰ ফেৰত প্ৰকাৰ এতিয়াও জনা নাই; … '-> প্ৰকাৰ' লিখক` | inference needs an explicit return type |
| `'S' নিজকেই মান হিচাপে ধাৰণ কৰে …; সূচক (*) ব্যৱহাৰ কৰক` | recursive struct by value |
| `ক্ষেত্ৰ N দুবাৰ আছে` | duplicate case label |
| `'মূল' কাজ থাকিলে শীৰ্ষ স্তৰত কেৱল ঘোষণা থাকিব পাৰে` | top-level statement in main mode |
| `আমদানি কৰা ফাইলত কেৱল ঘোষণা থাকিব পাৰে` | statement in an imported file |
| `সংযোগ 'U' গোটেইটো লিখিব নোৱাৰি` | printing a union |

### 11.3 Warnings

| Message | Meaning |
| --- | --- |
| `চৰ্তৰ ভিতৰত '=' আছে; তুলনাৰ বাবে '==' লিখক` | assignment used as a condition |
| `দুটা বাক্যৰ '==' তুলনাই ঠিকনা তুলনা কৰে …` | comparing string addresses |
| `'f' কাজৰ সকলো পথে মান ঘূৰাই নিদিয়ে` | a non-`শূন্য` function can end without returning |

If the C compiler fails on generated code, the CLI prints its output under `C কম্পাইলাৰ (cc) বিফল হ'ল`; that indicates a compiler bug and should be reported.

---

## 12. Undefined behaviour and differences from C

Asomiya Bhasha 2.0 inherits C's run-time model. The following are **not** checked at run time and have undefined behaviour, exactly as in C: reading or writing outside an array or allocation, dereferencing `খালি` or a freed pointer, freeing twice, signed integer overflow, integer division by zero, shifting by a negative amount or by at least the width of the type, and reading a union field other than the one last written (the reference compiler gives C's result).

Differences from C, all compile-time:

| C | Asomiya Bhasha 2.0 |
| --- | --- |
| uninitialised locals hold garbage | every variable starts at zero |
| `double` → `int` converts silently | requires `হিচাপে` |
| `x + 1;` is allowed | error: statement has no effect |
| `switch` cases fall through | no fall-through |
| `"a" + 1` is pointer arithmetic | error: strings are not joined with `+` |
| constant out-of-range values truncate | error |
| constant out-of-bounds index compiles | error |
| `goto`, labels, the preprocessor, bit-fields, VLAs, `static` locals | not provided |
| `sizeof` gives `size_t` | `আকাৰ` gives `পূ৬৪` |
| nested functions (GNU) | not allowed |
| `char` literal `'ক'` is an error | it is the code point, type `পূৰ্ণ` |

Planned additions are listed in [roadmap.md](roadmap.md).
