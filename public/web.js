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
        this.clearOutputBtn = document.getElementById('clearOutputBtn');
        this.modal = document.getElementById('exampleModal');
        this.closeModal = document.querySelector('.close');
        
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
        
        this.init();
    }
    
    init() {
        this.runBtn.addEventListener('click', () => this.runCode());
        this.clearBtn.addEventListener('click', () => this.clearCode());
        this.exampleBtn.addEventListener('click', () => this.openExampleModal());
        this.clearOutputBtn.addEventListener('click', () => this.clearOutput());
        
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
        
        document.querySelectorAll('.modal-example').forEach(example => {
            example.addEventListener('click', (e) => {
                const exampleName = example.dataset.fullExample;
                this.loadExample(exampleName);
                this.closeExampleModal();
            });
        });
        
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
        const lines = code.split('\n');
        let output = '';
        let variables = {};
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            if (!line || line.startsWith('#')) {
                continue;
            }
            
            if (line.startsWith('লিখা')) {
                const expression = line.substring(4).trim();
                const value = this.evaluateExpression(expression, variables);
                output += value + '\n';
                continue;
            }
            
            if (line.startsWith('সংখ্যা') || line.startsWith('বাক্য')) {
                const parts = line.split('=');
                const decl = parts[0].trim();
                const varName = decl.split(' ')[1];
                
                if (parts.length > 1) {
                    const value = this.evaluateExpression(parts[1].trim(), variables);
                    variables[varName] = value;
                } else {
                    variables[varName] = null;
                }
                continue;
            }
            
            if (line.includes('=') && !line.startsWith('যদি') && !line.startsWith('যেতিয়া')) {
                const parts = line.split('=');
                const varName = parts[0].trim();
                const value = this.evaluateExpression(parts[1].trim(), variables);
                variables[varName] = value;
                continue;
            }
        }
        
        return output;
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