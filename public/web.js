/**
 * Web Interface for Asomiya Bhasha
 */

class AsomiyaWeb {
    constructor() {
        this.codeInput = document.getElementById('codeInput');
        this.outputDiv = document.getElementById('output');
        this.runBtn = document.getElementById('runBtn');
        this.clearBtn = document.getElementById('clearBtn');
        this.exampleBtn = document.getElementById('exampleBtn');
        this.typingBtn = document.getElementById('typingBtn');
        this.typingPanel = document.getElementById('typingPanel');
        this.typingClose = document.getElementById('typingClose');
        this.typingKeys = document.getElementById('typingKeys');
        this.clearOutputBtn = document.getElementById('clearOutputBtn');
        this.modal = document.getElementById('exampleModal');
        this.closeModal = document.querySelector('.close');
        this.modalExamples = document.getElementById('modalExamples');
        this.sampleSearch = document.getElementById('sampleSearch');
        this.sampleCategory = document.getElementById('sampleCategory');
        this.sampleCount = document.getElementById('sampleCount');
        
        this.examples = {
            hello: `# সাধাৰণ হেল্ল'ৱৰ্ল্ড প্ৰ'গ্ৰাম
লিখা "নমস্কাৰ বিশ্ব!"
লিখা "অসমীয়া ভাষালৈ স্বাগতম!"

# চলক
সংখ্যা বয়স = ২৫
বাক্য নাম = "ইঞ্জিনিয়াৰ পঞ্চানন নাথ"

লিখা "মোৰ নাম " + নাম + " আৰু বয়স " + বয়স`,
            
            math: `# গণনাৰ উদাহৰণ
সংখ্যা a = ১০
সংখ্যা b = ৫

লিখা "যোগ: " + (a + b)
লিখা "বিয়োগ: " + (a - b)
লিখা "পূৰণ: " + (a * b)
লিখা "হৰণ: " + (a / b)

# জটিল গণনা
সংখ্যা ব্যাসাৰ্ধ = ৭
সংখ্যা পাই = ৩.১৪১৬
সংখ্যা কালি = পাই * ব্যাসাৰ্ধ * ব্যাসাৰ্ধ

লিখা "বৃত্তৰ কালি: " + কালি`,
            
            conditions: `# যদি/নহলে বিবৃতি
সংখ্যা নম্বৰ = ১৫

যদি নম্বৰ > ১০ থাকিলে
    লিখা "নম্বৰ ১০তকৈ ডাঙৰ"
নহলে
    লিখা "নম্বৰ ১০তকৈ সৰু বা সমান"
শেষ

# যেতিয়া লুপ
সংখ্যা গণক = ১

যেতিয়া গণক <= ৫
    লিখা "গণক: " + গণক
    গণক = গণক + ১
শেষ

লিখা "লুপ শেষ!"`,
            
            loop: `# যেতিয়া লুপৰ উদাহৰণ
সংখ্যা গণক = ১

লিখা "১ৰ পৰা ৫লৈ সংখ্যা:"

যেতিয়া গণক <= ৫
    লিখা গণক
    গণক = গণক + ১
শেষ

লিখা "লুপ শেষ কৰা হ'ল!"`,
            
            array: `# তালিকাৰ উদাহৰণ
তালিকা ফলসমূহ = ["আম", "কল", "লিচু", "কমলা"]

লিখা "ফলৰ তালিকা:"

সংখ্যা i = ০
যেতিয়া i < দৈৰ্ঘ্য(ফলসমূহ)
    লিখা (i + ১) + ". " + ফলসমূহ[i]
    i = i + ১
শেষ`
            ,

            function: `# ফাংচনৰ উদাহৰণ
কাজ যোগ(a, b)
    উভতি a + b
শেষ

লিখা "যোগফল: " + যোগ(২, ৩)`
        };

        this.sampleCatalog = this.buildSampleCatalog();
        
        this.init();
    }

    buildSampleCatalog() {
        const digits = value => String(value).replace(/[0-9]/g, digit => String.fromCharCode(0x09E6 + Number(digit)));
        const samples = [];
        const add = (category, title, code) => samples.push({ id: samples.length + 1, category, title, code });
        const greetings = ['নমস্কাৰ', 'স্বাগতম', 'শুভদিন', 'শুভসন্ধ্যা', 'শুভৰাত্ৰি', 'অসমলৈ স্বাগতম', 'আজিৰ দিনটো ভাল', 'আহক শিকোঁ', 'মই কোড লিখোঁ', 'অসমীয়া ভাষা'];
        greetings.forEach((message, index) => add('printing', `প্ৰিণ্ট ${index + 1}`, `লিখা "${message}!"`));
        const arithmetic = [['যোগ', '+', 10, 20], ['বিয়োগ', '-', 30, 8], ['পূৰণ', '*', 6, 7], ['হৰণ', '/', 40, 5], ['যোগ', '+', 12, 18], ['বিয়োগ', '-', 50, 17], ['পূৰণ', '*', 9, 9], ['হৰণ', '/', 81, 9], ['যোগ', '+', 7, 13], ['বিয়োগ', '-', 100, 45], ['পূৰণ', '*', 8, 12], ['হৰণ', '/', 64, 8], ['যোগ', '+', 25, 25], ['বিয়োগ', '-', 90, 30], ['পূৰণ', '*', 11, 3], ['হৰণ', '/', 72, 9], ['যোগ', '+', 14, 16], ['বিয়োগ', '-', 44, 19], ['পূৰণ', '*', 5, 15], ['হৰণ', '/', 100, 10]];
        arithmetic.forEach(([name, operator, left, right], index) => add('math', `গণনা ${index + 1}`, `# ${name}\nলিখা ${digits(left)} ${operator} ${digits(right)}`));
        for (let index = 1; index <= 10; index++) add('variables', `চলক ${index}`, `সংখ্যা মান = ${digits(index * 5)}\nলিখা "মান: " + মান`);
        ['==', '!=', '>', '>=', '<'].forEach((operator, index) => { const left = index + 3; const right = index % 2 === 0 ? left : left + 1; add('logic', `তুলনা ${index + 1}`, `লিখা ${digits(left)} ${operator} ${digits(right)}`); });
        for (let index = 1; index <= 5; index++) add('logic', `লজিক ${index}`, `বুলিয়ান ঠিক = ${index % 2 === 0 ? 'সত্য' : 'মিছা'}\nলিখা নহয় ঠিক\nলিখা ঠিক আৰু সত্য\nলিখা ঠিক বা মিছা`);
        for (let index = 1; index <= 10; index++) add('conditions', `শৰ্ত ${index}`, `সংখ্যা নম্বৰ = ${digits(index + 5)}\nযদি নম্বৰ > ১০ থাকিলে\n    লিখা "ডাঙৰ"\nনহলে\n    লিখা "সৰু"\nশেষ`);
        for (let index = 1; index <= 10; index++) add('loops', `যেতিয়া ${index}`, `সংখ্যা গণক = ১\nযেতিয়া গণক <= ${digits(index + 2)}\n    লিখা গণক\n    গণক = গণক + ১\nশেষ`);
        for (let index = 1; index <= 10; index++) add('loops', `প্ৰতিবাৰ ${index}`, `প্ৰতিবাৰ i = ১ লৈকে ${digits(index + 2)}\n    লিখা i\nশেষ`);
        for (let index = 1; index <= 10; index++) add('functions', `ফাংচন ${index}`, `কাজ যোগ(সংখ্যা a, সংখ্যা b)\n    উভতি a + b\nশেষ\nলিখা যোগ(${digits(index)}, ${digits(index + 1)})`);
        for (let index = 1; index <= 10; index++) add('arrays', `তালিকা ${index}`, `তালিকা মানসমূহ = [${digits(index)}, ${digits(index + 1)}, ${digits(index + 2)}]\nলিখা মানসমূহ[০]\nলিখা দৈৰ্ঘ্য(মানসমূহ)`);
        return samples;
    }
    
    init() {
        this.runBtn.addEventListener('click', () => this.runCode());
        this.clearBtn.addEventListener('click', () => this.clearCode());
        this.exampleBtn.addEventListener('click', () => this.openExampleModal());
        this.typingBtn.addEventListener('click', () => this.toggleTypingPanel());
        this.typingClose.addEventListener('click', () => this.closeTypingPanel());
        this.clearOutputBtn.addEventListener('click', () => this.clearOutput());
        this.renderTypingKeyboard();
        
        document.querySelectorAll('.example-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const example = card.dataset.example;
                this.loadExample(example);
            });
        });
        
        this.closeModal.addEventListener('click', () => this.closeExampleModal());
        
        window.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.closeExampleModal();
            }
        });
        
        this.modalExamples.addEventListener('click', (event) => {
            const example = event.target.closest('.modal-example');
            if (example) {
                this.loadSample(Number(example.dataset.sampleId));
                this.closeExampleModal();
            }
        });

        this.sampleSearch.addEventListener('input', () => this.renderSampleCatalog());
        this.sampleCategory.addEventListener('change', () => this.renderSampleCatalog());
        
        this.codeInput.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                this.runCode();
            }
        });
        
        document.getElementById('githubLink').addEventListener('click', (e) => {
            e.preventDefault();
            alert('GitHub repository coming soon!');
        });
        
        document.querySelectorAll('#docsLink, #footerDocsLink').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.showDocumentation();
            });
        });
        
        document.getElementById('aboutLink').addEventListener('click', (e) => {
            e.preventDefault();
            this.showAbout();
        });
        
        this.codeInput.addEventListener('input', () => this.updateLineNumbers());
        if (!this.codeInput.value.trim()) {
            this.codeInput.value = this.codeInput.textContent.trim();
        }
        this.updateLineNumbers();
    }

    renderTypingKeyboard() {
        const groups = [
            ['স্বৰ', ['অ', 'আ', 'ই', 'ঈ', 'উ', 'ঊ', 'এ', 'ঐ', 'ও', 'ঔ']],
            ['ব্যঞ্জন', ['ক', 'খ', 'গ', 'ঘ', 'ঙ', 'চ', 'ছ', 'জ', 'ঝ', 'ঞ', 'ট', 'ঠ', 'ড', 'ঢ', 'ণ', 'ত', 'থ', 'দ', 'ধ', 'ন', 'প', 'ফ', 'ব', 'ভ', 'ম', 'য', 'ৰ', 'ল', 'ৱ', 'শ', 'ষ', 'স', 'হ']],
            ['চিহ্ন', ['া', 'ি', 'ী', 'ু', 'ূ', 'ৃ', 'ে', 'ৈ', 'ো', 'ৌ', '্', 'ঁ', 'ং', 'ঃ', '়']],
            ['অঙ্ক', ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯']],
            ['শব্দ', ['লিখা', 'সংখ্যা', 'বাক্য', 'বুলিয়ান', 'তালিকা', 'যদি', 'নহলে', 'যেতিয়া', 'প্ৰতিবাৰ', 'কাজ', 'উভতি', 'সত্য', 'মিছা', 'শেষ']]
        ];

        this.typingKeys.replaceChildren();
        groups.forEach(([label, keys]) => {
            const group = document.createElement('div');
            group.className = 'typing-group';
            const heading = document.createElement('span');
            heading.className = 'typing-group-label';
            heading.textContent = label;
            const row = document.createElement('div');
            row.className = 'typing-row';
            keys.forEach(key => {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'typing-key';
                button.dataset.insert = key;
                button.textContent = key;
                row.appendChild(button);
            });
            group.append(heading, row);
            this.typingKeys.appendChild(group);
        });

        const controls = document.createElement('div');
        controls.className = 'typing-controls';
        [['Space', ' '], ['নতুন line', '\n'], ['পিছলৈ', 'BACKSPACE']].forEach(([label, value]) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'typing-key typing-control';
            button.dataset.insert = value;
            button.textContent = label;
            controls.appendChild(button);
        });
        this.typingKeys.appendChild(controls);
        this.typingKeys.addEventListener('click', event => {
            const button = event.target.closest('[data-insert]');
            if (button) this.insertTypingText(button.dataset.insert);
        });
    }

    toggleTypingPanel() {
        const isOpen = !this.typingPanel.hidden;
        this.typingPanel.hidden = isOpen;
        this.typingBtn.setAttribute('aria-expanded', String(!isOpen));
        if (!isOpen) this.codeInput.focus();
    }

    closeTypingPanel() {
        this.typingPanel.hidden = true;
        this.typingBtn.setAttribute('aria-expanded', 'false');
        this.codeInput.focus();
    }

    insertTypingText(text) {
        const start = this.codeInput.selectionStart;
        const end = this.codeInput.selectionEnd;
        const value = this.codeInput.value;
        let nextValue;
        let nextCursor;

        if (text === 'BACKSPACE') {
            if (start !== end) {
                nextValue = value.slice(0, start) + value.slice(end);
                nextCursor = start;
            } else {
                nextValue = value.slice(0, Math.max(0, start - 1)) + value.slice(end);
                nextCursor = Math.max(0, start - 1);
            }
        } else {
            nextValue = value.slice(0, start) + text + value.slice(end);
            nextCursor = start + text.length;
        }

        this.codeInput.value = nextValue;
        this.codeInput.focus();
        this.codeInput.setSelectionRange(nextCursor, nextCursor);
        this.updateLineNumbers();
    }
    
    async runCode() {
        const code = this.codeInput.value;
        
        if (!code.trim()) {
            this.showOutput('কোড খালি! অনুগ্ৰহ কৰি কিছুমান কোড লিখক।', 'error');
            return;
        }
        
        this.showOutput('কোড চলাই আছে...', 'info');
        
        try {
            const result = await this.simulateExecution(code);
            
            if (result.success) {
                this.showOutput(result.output, 'success');
            } else {
                this.showOutput(`ত্ৰুটি: ${result.error}`, 'error');
            }
        } catch (error) {
            this.showOutput(`চাৰ্ভাৰ ত্ৰুটি: ${error.message}`, 'error');
        }
    }
    
    simulateExecution(code) {
        return new Promise((resolve) => {
            setTimeout(() => {
                try {
                    const output = this.executeCode(code);
                    resolve({
                        success: true,
                        output: output
                    });
                } catch (error) {
                    resolve({
                        success: false,
                        error: error.message
                    });
                }
            }, 500);
        });
    }
    
    executeCode(code) {
        if (!window.AsomiyaRuntime || typeof window.AsomiyaRuntime.run !== 'function') {
            throw new Error("Canonical browser runtime load নহ'ল");
        }

        const inputProvider = () => window.prompt('ইনপুট দিয়ক:') || '';
        return window.AsomiyaRuntime.run(code, inputProvider).output;
    }
    
    evaluateExpression(expr, variables) {
        expr = expr.trim();

        if (this.isWrappedExpression(expr)) {
            return this.evaluateExpression(expr.slice(1, -1), variables);
        }

        if (variables[expr] !== undefined) {
            return variables[expr];
        }
        
        const lowPrecedenceOperator = this.findTopLevelOperator(expr, ['+', '-']);
        if (lowPrecedenceOperator) {
            const left = this.evaluateExpression(expr.slice(0, lowPrecedenceOperator.index), variables);
            const right = this.evaluateExpression(expr.slice(lowPrecedenceOperator.index + 1), variables);

            if (lowPrecedenceOperator.operator === '+' && (typeof left === 'string' || typeof right === 'string')) {
                return String(left) + String(right);
            }
            if (typeof left !== 'number' || typeof right !== 'number') {
                throw new Error('গণনাৰ বাবে সংখ্যা প্ৰয়োজন');
            }
            return lowPrecedenceOperator.operator === '+' ? left + right : left - right;
        }

        const highPrecedenceOperator = this.findTopLevelOperator(expr, ['*', '/']);
        if (highPrecedenceOperator) {
            const left = this.evaluateExpression(expr.slice(0, highPrecedenceOperator.index), variables);
            const right = this.evaluateExpression(expr.slice(highPrecedenceOperator.index + 1), variables);
            if (typeof left !== 'number' || typeof right !== 'number') {
                throw new Error('গণনাৰ বাবে সংখ্যা প্ৰয়োজন');
            }
            if (highPrecedenceOperator.operator === '/' && right === 0) {
                throw new Error('শূন্যৰে হৰণ কৰিব নোৱাৰি');
            }
            return highPrecedenceOperator.operator === '*' ? left * right : left / right;
        }

        if ((expr.startsWith('"') && expr.endsWith('"')) ||
            (expr.startsWith("'") && expr.endsWith("'"))) {
            return expr.substring(1, expr.length - 1);
        }

        const normalizedNumber = this.normalizeDigits(expr);
        if (/^-?(?:\d+\.?\d*|\.\d+)$/.test(normalizedNumber)) {
            return Number(normalizedNumber);
        }

        if (expr === 'সত্য') return true;
        if (expr === 'মিছা') return false;

        return expr;
    }

    normalizeDigits(value) {
        return value.replace(/[০-৯]/g, digit => String(digit.charCodeAt(0) - '০'.charCodeAt(0)));
    }

    isWrappedExpression(expr) {
        if (!expr.startsWith('(') || !expr.endsWith(')')) return false;
        let depth = 0;
        let quote = null;
        for (let i = 0; i < expr.length; i++) {
            const char = expr[i];
            if (quote) {
                if (char === quote && expr[i - 1] !== '\\') quote = null;
                continue;
            }
            if (char === '"' || char === "'") {
                quote = char;
            } else if (char === '(') {
                depth++;
            } else if (char === ')' && --depth === 0) {
                return i === expr.length - 1;
            }
        }
        return false;
    }

    findTopLevelOperator(expr, operators) {
        let depth = 0;
        let quote = null;
        let found = null;
        for (let i = 0; i < expr.length; i++) {
            const char = expr[i];
            if (quote) {
                if (char === quote && expr[i - 1] !== '\\') quote = null;
                continue;
            }
            if (char === '"' || char === "'") {
                quote = char;
            } else if (char === '(') {
                depth++;
            } else if (char === ')') {
                depth--;
            } else if (depth === 0 && operators.includes(char) && i > 0) {
                found = { operator: char, index: i };
            }
        }
        return found;
    }
    
    showOutput(message, type = 'normal', trustedMarkup = false) {
        let className = '';
        if (type === 'error') className = 'error';
        if (type === 'success') className = 'success';
        if (type === 'info') className = 'info';
        
        const output = document.createElement('div');
        output.className = className;
        if (trustedMarkup) {
            output.innerHTML = message;
        } else {
            output.textContent = message;
        }
        this.outputDiv.replaceChildren(output);
        
        this.outputDiv.scrollTop = this.outputDiv.scrollHeight;
    }
    
    clearCode() {
        if (confirm('আপুনি নিশ্চিত নেকি কোড পৰিষ্কাৰ কৰিবলৈ?')) {
            this.codeInput.value = '';
            this.updateLineNumbers();
        }
    }
    
    clearOutput() {
        this.outputDiv.innerHTML = `
            <div class="welcome-message">
                <p>অসমীয়া ভাষালৈ স্বাগতম!</p>
                <p>ওপৰৰ কোড সম্পাদনা কৰক আৰু "চলাওক" বুটাম টিপক।</p>
            </div>
        `;
    }
    
    openExampleModal() {
        this.renderSampleCatalog();
        this.modal.style.display = 'flex';
    }
    
    closeExampleModal() {
        this.modal.style.display = 'none';
    }
    
    loadExample(exampleName) {
        if (this.examples[exampleName]) {
            this.codeInput.value = this.examples[exampleName];
            this.updateLineNumbers();
            
            this.showOutput(`"${exampleName}" উদাহৰণ লোড কৰা হ'ল!`, 'success');
        }
    }

    loadSample(sampleId) {
        const sample = this.sampleCatalog.find(item => item.id === sampleId);
        if (!sample) return;
        this.codeInput.value = sample.code;
        this.updateLineNumbers();
        this.showOutput(`"${sample.title}" উদাহৰণ লোড কৰা হ'ল!`, 'success');
    }

    renderSampleCatalog() {
        const query = this.sampleSearch.value.trim().toLowerCase();
        const category = this.sampleCategory.value;
        const visibleSamples = this.sampleCatalog.filter(sample => {
            const matchesCategory = category === 'all' || sample.category === category;
            const matchesQuery = !query || `${sample.title} ${sample.code}`.toLowerCase().includes(query);
            return matchesCategory && matchesQuery;
        });
        this.sampleCount.textContent = `${visibleSamples.length} / ${this.sampleCatalog.length} samples`;
        this.modalExamples.replaceChildren(...visibleSamples.map(sample => {
            const card = document.createElement('div');
            card.className = 'modal-example';
            card.dataset.sampleId = sample.id;
            const title = document.createElement('h4');
            title.textContent = `${String(sample.id).padStart(3, '0')} · ${sample.title}`;
            const code = document.createElement('pre');
            code.textContent = sample.code;
            card.append(title, code);
            return card;
        }));
    }
    
    updateLineNumbers() {
        const lines = this.codeInput.value.split('\n').length;
        const lineNumbers = document.querySelector('.line-numbers');
        
        lineNumbers.innerHTML = '';
        for (let i = 1; i <= Math.max(lines, 10); i++) {
            const div = document.createElement('div');
            div.textContent = i;
            lineNumbers.appendChild(div);
        }
    }
    
    showDocumentation() {
        const docs = `
        <h3>সম্পূৰ্ণ ডকুমেন্টেচন</h3>
        <div class="docs-content">
            <h4>মূল সিনটেক্স</h4>
            <ul>
                <li><code>লিখা "মজ্জা"</code> - স্ক্ৰীনত মজ্জা দেখুৱাওক</li>
                <li><code>পঢ়া</code> - ইন্পুট লওক (REPL ত কাম কৰে)</li>
                <li><code># মন্তব্য</code> - মন্তব্য লিখক</li>
            </ul>
            
            <h4>ডাটা টাইপ</h4>
            <ul>
                <li><code>সংখ্যা</code> - সংখ্যা (যেনে: ১০, ৩.১৪)</li>
                <li><code>বাক্য</code> - স্ট্রিং (যেনে: "অসম")</li>
                <li><code>সত্য</code> - বুলিয়ান (সত্য/মিছা)</li>
                <li><code>তালিকা</code> - এৰে (যেনে: [১, ২, ৩])</li>
                <li><code>খালি</code> - নাল ভেলু</li>
            </ul>
            
            <h4>নিয়ন্ত্ৰণ প্ৰবাহ</h4>
            <ul>
                <li><code>যদি শৰ্ত থাকিলে ... নহলে ... শেষ</code> - কণ্ডিশ্যনেল</li>
                <li><code>যেতিয়া শৰ্ত ... শেষ</code> - হাইল লুপ</li>
                <li><code>প্রতিবাৰ চলক = আৰম্ভ পৰা অন্ত ... শেষ</code> - ফৰ লুপ</li>
            </ul>
            
            <h4>ফাংচন</h4>
            <ul>
                <li><code>কাজ নাম(পেৰাম) ... শেষ</code> - ফাংচন ডিফাইন</li>
                <li><code>উভতি মান</code> - ৰিটাৰ্ন ভেলু</li>
                <li><code>দৈৰ্ঘ্য(তালিকা)</code> - এৰে/স্ট্রিং লেন্থ</li>
            </ul>
        </div>
        `;
        
        this.showOutput(docs, 'info', true);
    }
    
    showAbout() {
        const about = `
        <h3>আমি সম্পৰ্কে</h3>
        <div class="about-content">
            <p><strong>অসমীয়া ভাষা</strong> হৈছে এটা সম্পূৰ্ণ অসমীয়া ভাষাত লিখা প্ৰ'গ্ৰামিং ভাষা।</p>
            
            <p><strong>উদ্দেশ্য:</strong></p>
            <ul>
                <li>অসমীয়া ভাষী ছাত্ৰ-ছাত্ৰীক প্ৰ'গ্ৰামিংৰ সৈতে পৰিচয় কৰোৱা</li>
                <li>মাতৃভাষাত কোডিং কৰাৰ আনন্দ উপভোগ কৰা</li>
                <li>স্থানীয় ডিজিটেল দক্ষতা বৃদ্ধি কৰা</li>
            </ul>
            
            <p><strong>বৈশিষ্ট্যসমূহ:</strong></p>
            <ul>
                <li>অসমীয়া কীৱৰ্ড আৰু সিনটেক্স</li>
                <li>সহজে শিকিব পৰা ডিজাইন</li>
                <li>ৱেব ব্ৰাউজাৰত চলিব পৰা</li>
                <li>কমাণ্ড লাইন ইণ্টাৰফেস (CLI)</li>
                <li>বিভিন্ন উদাহৰণ আৰু ডকুমেন্টেচন</li>
            </ul>
            
            <p><strong>সংস্কৰণ:</strong> 1.0.0</p>
            <p><strong>লাইচেন্স:</strong> MIT Open Source</p>
            <p><strong>Developed by:</strong> Er Panchanan Nath</p>
            <p><strong>Open source project by:</strong> Er Panchanan Nath</p>
            <p><strong>Original copyright:</strong> Er Panchanan Nath</p>
        </div>
        `;
        
        this.showOutput(about, 'info', true);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const asomiyaWeb = new AsomiyaWeb();
    window.asomiyaWeb = asomiyaWeb;
});