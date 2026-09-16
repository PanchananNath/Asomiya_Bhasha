# অসমীয়া ভাষা (Asomiya Bhasha)

অসমীয়া নাম, কীৱৰ্ড আৰু সংখ্যাৰে লিখিব পৰা এটা সৰু শিক্ষামূলক programming language prototype। Runtime-টো Node.js-ত চলে আৰু lexer, parser, AST আৰু interpreter-ৰে গঠিত।

**Developed by:** Er Panchanan Nath  
**Open source project by:** Er Panchanan Nath  
**Original copyright:** Er Panchanan Nath

## বৰ্তমান অৱস্থা

Core interpreter milestone সম্পূৰ্ণ:

- Assamese আৰু ASCII identifier, underscore, আৰু Assamese/ASCII সংখ্যা
- সংখ্যা, বাক্য, বুলিয়ান আৰু তালিকা
- `লিখা`, variable declaration, assignment আৰু comments
- arithmetic, comparison, logical আৰু unary operators
- `যদি`, `নহলে`, `নহলে যদি`, `যেতিয়া`
- `প্ৰতিবাৰ চলক = আৰম্ভ লৈকে শেষ` range loop
- functions, typed parameters, `উভতি`
- input provider-সহ `পঢ়া()` আৰু `দৈৰ্ঘ্য()` builtin
- array indexing আৰু list element assignment
- CLI, REPL, file execution আৰু example programs

এইটো এতিয়াও prototype। Node.js runtime-টোৱেই সম্পূৰ্ণ canonical interpreter। Web page-টো বৰ্তমান limited browser demonstration; ই full interpreter bundle নোহোৱালৈকে Node runtime-ৰ সকলো feature সমৰ্থন নকৰে।

## প্ৰয়োজনীয়তা

- Node.js 14 বা তাৰ পিছৰ version
- npm, Node.js-ৰ সৈতে অন্তৰ্ভুক্ত
- Git, GitHub-ৰ পৰা clone কৰিবলৈ

Node.js version check কৰক:

```powershell
node --version
npm --version
```

এই project-টো Python project নহয়। JavaScript dependencies-ৰ authoritative source হৈছে `package.json` আৰু `package-lock.json`।

## Installation

### Windows আৰু macOS/Linux

Repository clone কৰি project folder-ত যাওক:

```powershell
git clone https://github.com/PanchananNath/Asomiya_Bhasha.git
cd asomiya-bhasha
```

Dependencies install কৰক:

```bash
npm ci
```

`package-lock.json` নথকা fresh checkout-ত `npm install` ব্যৱহাৰ কৰিব পাৰি। Windows-ত `setup.sh` Bash script-ৰ সলনি ওপৰৰ commands ব্যৱহাৰ কৰক। macOS/Linux-ত optional automated setup:

```bash
chmod +x setup.sh
./setup.sh
```

### Configuration

এই prototype-ৰ বাবে কোনো `.env` file বা external service configuration প্ৰয়োজন নাই।

- Source files UTF-8 encoding-ত save কৰিব লাগে।
- CLI-এ local files execute কৰে।
- `npm run web`-এ `public` folder-ৰ development server `http://localhost:8080`-ত আৰম্ভ কৰে। Port ব্যস্ত থাকিলে `npx live-server public --port=8081` ব্যৱহাৰ কৰক।
- `পঢ়া()` ব্যৱহাৰ কৰা JavaScript program-ত input provider দিব লাগে; details [docs/syntax.md](docs/syntax.md)-ত আছে।

## Quick Start

```bash
node src/cli.js examples/hello.asm
npm test
```

REPL:

```bash
node src/cli.js --repl
```

Web demo:

```bash
npm run web
```

তাৰ পিছত `http://localhost:8080` খোলক।

## Reproduce From A Clean System

The following sequence reproduces the current project on a new machine:

```bash
git clone https://github.com/PanchananNath/Asomiya_Bhasha.git
cd asomiya-bhasha
npm ci
npm test
node src/cli.js examples/hello.asm
```

Expected test result:

```text
21 tests passed
0 tests failed
```

Run a new program:

```bash
node src/cli.js path/to/program.asm
```

Run the web playground:

```bash
npm run web
```

The Node.js interpreter is the canonical runtime. The browser page is a limited demonstration and currently does not implement every Node.js language feature.

## Free Vercel Deployment

The browser playground can be hosted for free on Vercel as a static web application. The Vercel configuration uses [public](public) as the website output directory.

This is not a Python application. [vercel.json](vercel.json) explicitly disables framework detection and configures Vercel to serve the static `public` directory.

### Deploy from the Vercel dashboard

1. Sign in at [vercel.com](https://vercel.com) with your GitHub account.
2. Select **Add New Project**.
3. Import `PanchananNath/Asomiya_Bhasha`.
4. Keep the project root at the repository root.
5. Use the detected Vercel configuration from [vercel.json](vercel.json).
6. Deploy the project.

Vercel will publish a URL similar to:

```text
https://asomiya-bhasha.vercel.app
```

The exact URL is assigned by Vercel and may be different.

### Deploy from the terminal

Install or run the Vercel CLI with `npx`:

```bash
npx vercel
```

Follow the prompts to sign in, link the project, and create a preview deployment. For a production deployment:

```bash
npx vercel --prod
```

If Vercel asks whether to connect the Git repository automatically, choose `No` for a local-only deployment. You can connect the repository later when automatic GitHub deployments are desired.

No environment variables or external services are required for the static playground. The Vercel deployment hosts the browser demonstration only; CLI execution, tests, and the canonical Node.js interpreter continue to run locally.

### Current deployment

The current production playground is available at:

<https://asomiya-bhasha.vercel.app>

The Vercel project uses manual CLI deployments. After local changes are verified, deploy the latest version with:

```powershell
npx vercel --prod
```

The GitHub repository is not connected to automatic Vercel deployments at this time.

## ভাষাৰ উদাহৰণ

```asm
সংখ্যা বয়স = ২৫
বাক্য নাম = "ইঞ্জিনিয়াৰ পঞ্চানন নাথ"

লিখা "নমস্কাৰ " + নাম

যদি বয়স >= ১৮ থাকিলে
	লিখা "প্ৰাপ্তবয়স্ক"
নহলে
	লিখা "শিশু"
শেষ

সংখ্যা i = ১
যেতিয়া i <= ৩
	লিখা i
	i = i + ১
শেষ
```

Supported keywords include `লিখা`, `সংখ্যা`, `বাক্য`, `বুলিয়ান`, `তালিকা`, `সত্য`, `মিছা`, `যদি`, `নহলে`, `যেতিয়া`, `কাজ`, `উভতি`, `দৈৰ্ঘ্য`, `আৰু`, `বা`, `নহয়`, `খালি`, and `শেষ`.

Detailed syntax notes are in [docs/syntax.md](docs/syntax.md). Runnable samples are in [examples](examples).

Input can be provided through the JavaScript API:

```js
const asomiya = new AsomiyaBhasha({ input: () => "অসম" });
asomiya.run(`বাক্য নাম = পঢ়া()
লিখা নাম`);
```

## Project Structure

| Path | Purpose |
| --- | --- |
| [src/lexer.js](src/lexer.js) | Source code to tokens |
| [src/parser.js](src/parser.js) | Tokens to AST |
| [src/ast.js](src/ast.js) | AST node definitions |
| [src/interpreter.js](src/interpreter.js) | AST execution |
| [src/index.js](src/index.js) | JavaScript API and file runner |
| [src/cli.js](src/cli.js) | CLI and REPL |
| [tests/test.js](tests/test.js) | Regression tests and example checks |
| [public](public) | Browser demonstration |
| [docs/syntax.md](docs/syntax.md) | Assamese and English syntax guide |
| [LICENSE](LICENSE) | MIT license and copyright notice |

## JavaScript API

```js
const AsomiyaBhasha = require('./src');

const result = new AsomiyaBhasha().run(`লিখা "নমস্কাৰ"`);

if (result.success) {
	console.log(result.output);
}
```

Each `run()` call uses a fresh interpreter environment, so separate programs and REPL commands are isolated from one another.

## Development Roadmap

1. Add a proper test runner and focused lexer/parser/interpreter tests.
2. Improve source line and column information in errors.
3. Bundle the canonical runtime for the browser and remove the separate demonstration evaluator.
4. Add more collection operations and standard-library functions.

## GitHub Publication

To publish a local checkout for the first time:

```bash
git init
git add .
git commit -m "Initial Asomiya Bhasha interpreter"
git branch -M main
git remote add origin https://github.com/PanchananNath/Asomiya_Bhasha.git
git push -u origin main
```

Do not commit `node_modules`; it is excluded by [.gitignore](.gitignore). Anyone cloning the repository should run `npm ci` before using the CLI, tests, or web playground.

## License

MIT. Copyright (c) Er Panchanan Nath.
