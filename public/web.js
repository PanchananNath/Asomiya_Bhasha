/**
 * Asomiya Bhasha 2.1 playground.
 * ▶ চলাওক compiles the program to WebAssembly with the same compiler as the
 * CLI and runs it in a Web Worker (worker.js), with a time limit and the
 * text of the input box as standard input. The C and LLVM IR buttons show
 * the code the native back ends would generate.
 * To run a program natively:  node src/cli.js program.asb
 */

const RUN_TIMEOUT_MS = 10000;
const MAX_OUTPUT = 1024 * 1024;
const asDigits = n => String(n).replace(/[0-9]/g, d => '০১২৩৪৫৬৭৮৯'[d]);

const KEYBOARD = [
    ['স্বৰ', ['অ', 'আ', 'ই', 'ঈ', 'উ', 'ঊ', 'ঋ', 'এ', 'ঐ', 'ও', 'ঔ']],
    ['ব্যঞ্জন', ['ক', 'খ', 'গ', 'ঘ', 'ঙ', 'চ', 'ছ', 'জ', 'ঝ', 'ঞ', 'ট', 'ঠ', 'ড', 'ঢ', 'ণ', 'ত', 'থ', 'দ', 'ধ', 'ন', 'প', 'ফ', 'ব', 'ভ', 'ম', 'য', 'ৰ', 'ল', 'ৱ', 'শ', 'ষ', 'স', 'হ', 'ক্ষ', 'ড়', 'ঢ়', 'য়', 'ৎ']],
    ['চিহ্ন', ['া', 'ি', 'ী', 'ু', 'ূ', 'ৃ', 'ে', 'ৈ', 'ো', 'ৌ', '্', 'ঁ', 'ং', 'ঃ', '়']],
    ['অংক', ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯']],
    ['প্ৰকাৰ', ['পূৰ্ণ', 'পূ৬৪', 'দশমিক', 'আখৰ', 'বাক্য', 'বুলিয়ান', 'শূন্য', 'গঠন', 'গণনা', 'স্থিৰ']],
    ['শব্দ', ['লিখা', 'দেখুওৱা', 'যদি', 'থাকিলে', 'নহলে', 'যেতিয়া', 'প্ৰতিবাৰ', 'লৈকে', 'ক্ৰমে', 'বাছক', 'ক্ষেত্ৰ', 'কাজ', 'উভতি', 'শেষ', 'সত্য', 'মিছা', 'খালি', 'আৰু', 'বা', 'নহয়', 'নতুন', 'মুকলি', 'হিচাপে']],
    ['চিন', ['->', '*', '&', '[', ']', '{', '}', '(', ')', '"', ',', '==', '!=', '<=', '>=']],
];

const STARTERS = {
    hello: 'লিখা "নমস্কাৰ অসম!"\nপূৰ্ণ বছৰ = ২০২৬\nলিখা "এইটো", বছৰ, "চন"',
    struct: 'গঠন বিন্দু\n    পূৰ্ণ x, y\nশেষ\n\nবিন্দু p = {x: ৩, y: ৪}\nলিখা p, p.x * p.x + p.y * p.y',
    pointer: 'কাজ সলনি(পূৰ্ণ* ক, পূৰ্ণ* খ)\n    পূৰ্ণ t = *ক\n    *ক = *খ\n    *খ = t\nশেষ\n\nপূৰ্ণ a = ৩, b = ৭\nসলনি(&a, &b)\nলিখা a, b',
    function: 'কাজ ফেক্ট(পূ৬৪ n) -> পূ৬৪\n    যদি n <= ১ থাকিলে\n        উভতি ১\n    শেষ\n    উভতি n * ফেক্ট(n - ১)\nশেষ\n\nলিখা ফেক্ট(২০)',
};

class AsomiyaWeb {
    constructor() {
        const $ = id => document.getElementById(id);
        this.codeInput = $('codeInput');
        this.outputDiv = $('output');
        this.modal = $('exampleModal');
        this.modalExamples = $('modalExamples');
        this.sampleSearch = $('sampleSearch');
        this.sampleCategory = $('sampleCategory');
        this.sampleCount = $('sampleCount');
        this.typingPanel = $('typingPanel');
        this.typingBtn = $('typingBtn');
        this.typingKeys = $('typingKeys');
        this.runtime = window.AsomiyaRuntime || null;
        this.samples = (this.runtime && this.runtime.samples) || [];
        this.loadedSample = null;
        this.lastCode = { text: '', name: 'program.c' };
        this.worker = null;
        this.init();
    }

    init() {
        const on = (id, ev, fn) => { const el = document.getElementById(id); if (el) el.addEventListener(ev, fn); };
        on('runBtn', 'click', () => this.run());
        on('cBtn', 'click', () => this.showCode('c'));
        on('llBtn', 'click', () => this.showCode('llvm'));
        on('stopBtn', 'click', () => this.stop('ব্যৱহাৰকাৰীয়ে ৰখালে'));
        on('clearBtn', 'click', () => this.clearCode());
        on('exampleBtn', 'click', () => this.openExampleModal());
        on('typingBtn', 'click', () => this.toggleTypingPanel());
        on('typingClose', 'click', () => this.closeTypingPanel());
        on('clearOutputBtn', 'click', () => this.clearOutput());
        on('docsLink', 'click', e => { e.preventDefault(); this.showDocumentation(); });
        on('footerDocsLink', 'click', e => { e.preventDefault(); this.showDocumentation(); });
        on('aboutLink', 'click', e => { e.preventDefault(); this.showAbout(); });

        document.querySelectorAll('.example-card').forEach(card => card.addEventListener('click', () => this.loadStarter(card.dataset.example)));
        const close = document.querySelector('#exampleModal .close');
        if (close) close.addEventListener('click', () => this.closeExampleModal());
        window.addEventListener('click', e => { if (e.target === this.modal) this.closeExampleModal(); });
        this.modalExamples.addEventListener('click', e => {
            const card = e.target.closest('.modal-example');
            if (card) { this.loadSample(Number(card.dataset.sampleId)); this.closeExampleModal(); }
        });
        this.sampleSearch.addEventListener('input', () => this.renderSampleCatalog());
        this.sampleCategory.addEventListener('change', () => this.renderSampleCatalog());
        this.codeInput.addEventListener('keydown', e => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); this.run(); }
            if (e.key === 'Tab') { e.preventDefault(); this.insertText('    '); }
        });
        this.codeInput.addEventListener('input', () => this.updateLineNumbers());

        this.fillCategories();
        this.renderTypingKeyboard();
        this.updateLineNumbers();
        if (!this.runtime) this.showMessage("কম্পাইলাৰ (runtime.js) load নহ'ল। 'npm run build' চলাওক।", 'error');
    }

    fillCategories() {
        const cats = (this.runtime && this.runtime.categories) || {};
        this.sampleCategory.replaceChildren(new Option('সকলো বিভাগ', 'all'), ...Object.entries(cats).map(([k, v]) => new Option(v, k)));
    }

    // ---- running (WebAssembly in a worker) --------------------------------
    run() {
        const code = this.codeInput.value;
        if (!code.trim()) { this.showMessage("ক'ড খালি! অনুগ্ৰহ কৰি কিছু ক'ড লিখক।", 'error'); return; }
        if (!this.runtime) { this.showMessage("কম্পাইলাৰ load নহ'ল।", 'error'); return; }
        if (this.worker) this.stop(null);
        let res;
        try {
            res = this.runtime.compileWasm(code);
        } catch (err) {
            this.showMessage(`কম্পাইলাৰৰ আভ্যন্তৰীণ ত্ৰুটি: ${err.message}`, 'error');
            return;
        }
        if (!res.success) {
            this.outputDiv.replaceChildren(this.block('error', `✗ ${asDigits(res.errors)}টা ভুল পোৱা গ'ল`), this.pre(res.diagnostics, 'diag'));
            return;
        }
        const parts = [];
        if (res.warnings) parts.push(this.pre(res.diagnostics, 'diag warn'));
        const out = this.pre('', 'program-output');
        const status = this.block('run-status', '⏳ চলি আছে…');
        parts.push(out, status);
        this.outputDiv.replaceChildren(...parts);

        const sample = this.loadedSample && this.loadedSample.code === code ? this.loadedSample : null;
        let stdout = '', total = 0;
        const append = (text, isErr) => {
            if (!text) return;
            total += text.length;
            if (total > MAX_OUTPUT) { this.stop('ফলাফল ১ MB-তকৈ ডাঙৰ হ\'ল; প্ৰ\'গ্ৰামটো ৰখোৱা হ\'ল'); return; }
            if (isErr) { const sp = document.createElement('span'); sp.className = 'stderr'; sp.textContent = text; out.append(sp); }
            else { stdout += text; out.append(text); }
        };
        let worker;
        try {
            worker = new Worker('worker.js');
        } catch (err) {
            status.textContent = `✗ Web Worker আৰম্ভ কৰিব নোৱাৰিলোঁ: ${err.message}`;
            status.className = 'run-status bad';
            return;
        }
        this.worker = worker;
        this.setRunning(true);
        this.runStatus = status;
        this.timer = setTimeout(() => this.stop(`সময় শেষ (${asDigits(RUN_TIMEOUT_MS / 1000)} ছেকেণ্ড) — অসীম loop নেকি?`), RUN_TIMEOUT_MS);
        worker.onmessage = ev => {
            const m = ev.data;
            if (m.type === 'out') append(m.text, false);
            else if (m.type === 'err') append(m.text, true);
            else if (m.type === 'done') {
                this.finish();
                if (m.error && !out.textContent.includes(m.error)) append(`\nচলাওঁতে ভুল (runtime error): ${m.error}\n`, true);
                const ok = m.status === 0 && !m.error;
                status.className = `run-status ${ok ? 'ok' : 'bad'}`;
                status.textContent = `${ok ? '✓' : '✗'} শেষ হ'ল — exit ${asDigits(m.status)} · ${asDigits(Math.round(m.ms))} ms · WebAssembly`;
                if (sample) {
                    const badge = document.createElement('div');
                    const same = stdout === sample.expected;
                    badge.className = same ? 'match' : 'match miss';
                    badge.textContent = same ? '✓ প্ৰত্যাশিত ফলৰ সৈতে মিলিছে' : 'প্ৰত্যাশিত ফলৰ সৈতে নিমিলে (ইনপুট বা সময়ৰ ওপৰত নিৰ্ভৰ কৰিব পাৰে)';
                    status.after(badge);
                }
            }
        };
        worker.onerror = ev => {
            this.finish();
            status.className = 'run-status bad';
            status.textContent = `✗ worker ত্ৰুটি: ${ev.message || 'অজ্ঞাত'}`;
        };
        const bytes = res.wasm;
        const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
        worker.postMessage({ wasm: buf, stdin: document.getElementById('stdinInput').value, args: [] }, [buf]);
    }

    finish() {
        clearTimeout(this.timer);
        if (this.worker) this.worker.terminate();
        this.worker = null;
        this.setRunning(false);
    }
    stop(reason) {
        if (!this.worker) return;
        this.finish();
        if (reason && this.runStatus) { this.runStatus.className = 'run-status bad'; this.runStatus.textContent = `■ ${reason}`; }
    }
    setRunning(on) {
        const run = document.getElementById('runBtn'), stop = document.getElementById('stopBtn');
        if (run) run.disabled = on;
        if (stop) stop.hidden = !on;
    }

    // ---- C / LLVM IR view ---------------------------------------------------
    showCode(target) {
        const code = this.codeInput.value;
        if (!code.trim()) { this.showMessage("ক'ড খালি! অনুগ্ৰহ কৰি কিছু ক'ড লিখক।", 'error'); return; }
        if (!this.runtime) { this.showMessage("কম্পাইলাৰ load নহ'ল।", 'error'); return; }
        let res;
        try {
            res = this.runtime.translate(code, { target });
        } catch (err) {
            this.showMessage(`কম্পাইলাৰৰ আভ্যন্তৰীণ ত্ৰুটি: ${err.message}`, 'error');
            return;
        }
        if (!res.success) {
            this.outputDiv.replaceChildren(this.block('error', `✗ ${asDigits(res.errors)}টা ভুল পোৱা গ'ল`), this.pre(res.diagnostics, 'diag'));
            return;
        }
        const isC = target !== 'llvm';
        this.lastCode = { text: res.text, name: isC ? 'program.c' : 'program.ll' };
        const parts = [this.block('success', isC ? "✓ কোনো ভুল নাই — C11 ক'ড" : '✓ কোনো ভুল নাই — LLVM IR')];
        if (res.warnings) parts.push(this.pre(res.diagnostics, 'diag warn'));
        if (isC) {
            parts.push(this.block('label', "চলাবলৈ:  gcc program.c -o program -lm    ·    C ক'ড (runtime বাদ দি):"));
            parts.push(this.pre(res.c.split('/* ---- end of runtime ---- */').pop().trim(), 'c-code'));
        } else {
            parts.push(this.block('label', 'নিজৰ কম্পিউটাৰত:  asomiya build --backend llvm program.asb   (runtime C-ৰ সৈতে link হয়)'));
            parts.push(this.pre(res.ll, 'c-code'));
        }
        const actions = document.createElement('div');
        actions.className = 'output-actions';
        actions.append(
            this.button('কপি কৰক', 'fa-copy', () => navigator.clipboard && navigator.clipboard.writeText(this.lastCode.text)),
            this.button(`${this.lastCode.name} ডাউনলোড`, 'fa-download', () => this.download(this.lastCode.name, this.lastCode.text)),
            this.button('program.asb ডাউনলোড', 'fa-download', () => this.download('program.asb', code)),
        );
        parts.push(actions);
        this.outputDiv.replaceChildren(...parts);
    }

    block(cls, text) { const d = document.createElement('div'); d.className = cls === 'label' ? 'output-label' : cls; d.textContent = text; return d; }
    pre(text, cls) { const p = document.createElement('pre'); p.className = cls; p.textContent = text; return p; }
    button(label, icon, fn) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'btn small-btn';
        const i = document.createElement('i'); i.className = `fas ${icon}`;
        b.append(i, ' ' + label);
        b.addEventListener('click', fn);
        return b;
    }
    download(name, text) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
        a.download = name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }
    showMessage(text, cls = 'info') { this.outputDiv.replaceChildren(this.block(cls, text)); }

    // ---- editor helpers ----------------------------------------------------
    insertText(text) {
        const el = this.codeInput;
        const { selectionStart: s, selectionEnd: e, value } = el;
        if (text === 'BACKSPACE') {
            const from = s !== e ? s : Math.max(0, s - 1);
            el.value = value.slice(0, from) + value.slice(e);
            el.setSelectionRange(from, from);
        } else {
            el.value = value.slice(0, s) + text + value.slice(e);
            el.setSelectionRange(s + text.length, s + text.length);
        }
        el.focus();
        this.updateLineNumbers();
    }

    renderTypingKeyboard() {
        this.typingKeys.replaceChildren();
        for (const [label, keys] of KEYBOARD) {
            const group = document.createElement('div'); group.className = 'typing-group';
            const heading = document.createElement('span'); heading.className = 'typing-group-label'; heading.textContent = label;
            const row = document.createElement('div'); row.className = 'typing-row';
            for (const key of keys) {
                const b = document.createElement('button');
                b.type = 'button'; b.className = 'typing-key'; b.dataset.insert = key; b.textContent = key;
                row.appendChild(b);
            }
            group.append(heading, row);
            this.typingKeys.appendChild(group);
        }
        const controls = document.createElement('div'); controls.className = 'typing-controls';
        for (const [label, value] of [['Space', ' '], ['Tab', '    '], ['নতুন শাৰী', '\n'], ['পিছলৈ', 'BACKSPACE']]) {
            const b = document.createElement('button');
            b.type = 'button'; b.className = 'typing-key typing-control'; b.dataset.insert = value; b.textContent = label;
            controls.appendChild(b);
        }
        this.typingKeys.appendChild(controls);
        this.typingKeys.addEventListener('click', e => { const b = e.target.closest('[data-insert]'); if (b) this.insertText(b.dataset.insert); });
    }

    toggleTypingPanel() {
        const open = !this.typingPanel.hidden;
        this.typingPanel.hidden = open;
        this.typingBtn.setAttribute('aria-expanded', String(!open));
        if (!open) this.codeInput.focus();
    }
    closeTypingPanel() { this.typingPanel.hidden = true; this.typingBtn.setAttribute('aria-expanded', 'false'); this.codeInput.focus(); }

    updateLineNumbers() {
        const n = Math.max(this.codeInput.value.split('\n').length, 10);
        const box = document.querySelector('.line-numbers');
        box.replaceChildren(...Array.from({ length: n }, (_, i) => { const d = document.createElement('div'); d.textContent = i + 1; return d; }));
    }

    clearCode() {
        if (confirm("আপুনি নিশ্চিত নেকি ক'ড পৰিষ্কাৰ কৰিবলৈ?")) { this.codeInput.value = ''; this.loadedSample = null; this.updateLineNumbers(); }
    }
    clearOutput() {
        this.stop(null);
        this.outputDiv.innerHTML = '<div class="welcome-message"><p>অসমীয়া ভাষা ২.১লৈ স্বাগতম!</p><p>ক\'ড লিখি ▶ চলাওক টিপক।</p></div>';
    }

    // ---- samples -----------------------------------------------------------
    loadStarter(name) {
        if (!STARTERS[name]) return;
        this.codeInput.value = STARTERS[name];
        this.loadedSample = null;
        this.updateLineNumbers();
        this.run();
    }
    loadSample(id) {
        const s = this.samples.find(x => x.id === id);
        if (!s) return;
        this.codeInput.value = s.code;
        this.loadedSample = s;
        this.updateLineNumbers();
        this.run();
    }
    openExampleModal() { this.renderSampleCatalog(); this.modal.style.display = 'flex'; }
    closeExampleModal() { this.modal.style.display = 'none'; }
    renderSampleCatalog() {
        const q = this.sampleSearch.value.trim().toLowerCase();
        const cat = this.sampleCategory.value;
        const visible = this.samples.filter(s => (cat === 'all' || s.category === cat) && (!q || `${s.title} ${s.code}`.toLowerCase().includes(q)));
        this.sampleCount.textContent = `${visible.length} / ${this.samples.length} samples`;
        this.modalExamples.replaceChildren(...visible.map(s => {
            const card = document.createElement('div');
            card.className = 'modal-example'; card.dataset.sampleId = s.id;
            const h = document.createElement('h4'); h.textContent = `${String(s.id).padStart(3, '0')} · ${s.title}`;
            const pre = document.createElement('pre'); pre.textContent = s.code;
            card.append(h, pre);
            return card;
        }));
    }

    // ---- help --------------------------------------------------------------
    showDocumentation() {
        const text = [
            'অসমীয়া ভাষা ২.১ — চমু সহায়',
            '',
            'প্ৰকাৰ:  পূৰ্ণ (৩২-বিট)  পূ৮ পূ১৬ পূ৩২ পূ৬৪  ধ৮ ধ১৬ ধ৩২ ধ৬৪ (চিহ্নহীন)',
            '         দশমিক  দশমিক৩২  আখৰ  বুলিয়ান  বাক্য  শূন্য  ফাইল',
            '         T* (সূচক)  T[n] (তালিকা)  কাজ(T, U) -> R (কাজৰ সূচক)',
            'ঘোষণা:   পূৰ্ণ x = ৫     স্থিৰ পূৰ্ণ N = ১০     পূৰ্ণ[] ক = [১, ২, ৩]',
            'গঠন:     গঠন নাম … শেষ      সংযোগ নাম … শেষ      গণনা নাম … শেষ',
            'কাজ:     কাজ নাম(পূৰ্ণ a) -> পূৰ্ণ … উভতি a … শেষ',
            'চৰ্ত:    যদি c থাকিলে … নহলে যদি c থাকিলে … নহলে … শেষ',
            'বাছক:    বাছক x / ক্ষেত্ৰ ১, ২ / অন্যথা / শেষ',
            'লুপ:     যেতিয়া c … শেষ     প্ৰতিবাৰ i = ১ লৈকে ১০ [ক্ৰমে ২] … শেষ',
            '         প্ৰতিবাৰ (পূৰ্ণ i = ০; i < n; i++) … শেষ     কৰা … শেষ যেতিয়া c',
            '         ভাঙা (break)   আগবাঢ়া (continue)',
            'সূচক:    &x  *p  p->ক্ষেত্ৰ  নতুন(T, n)  মুকলি(p)  আকাৰ(T)  x হিচাপে T',
            'লজিক:    আৰু (&&)  বা (||)  নহয় (!)',
            'আউটপুট:  লিখা a, b (শেষত নতুন শাৰী)   দেখুওৱা a (শেষত space)   ছপা("%d", x)',
            'ইনপুট:   পঢ়া()  পঢ়া_পূৰ্ণ()  পঢ়া_দশমিক()',
            '',
            '',
            'এই playground-এ প্ৰ\'গ্ৰাম WebAssembly হিচাপে চলায় (সূচক ৪ বাইট, গতিকে আকাৰ() native-তকৈ বেলেগ হ\'ব পাৰে)।',
            'ইনপুট বাকচৰ লিখা পঢ়া()-এ পায়। ফাইলবোৰ (খোলা/বন্ধ) কেৱল এই চলোৱাৰ সময়লৈ মেমৰিত থাকে।',
            '',
            'সম্পূৰ্ণ বিৱৰণ: docs/spec.md (ভাষাৰ নিৰ্দিষ্টকৰণ আৰু ব্যাকৰণ)',
        ].join('\n');
        this.outputDiv.replaceChildren(this.pre(text, 'help'));
    }
    showAbout() {
        const text = [
            'অসমীয়া ভাষা ২.১',
            'অসমীয়া লিপিত লিখা, C-ৰ সমান ক্ষমতাৰ এটা compiled programming language।',
            'তিনিটা back end: C11 (gcc/clang), LLVM IR (DWARF debug তথ্যসহ), আৰু WebAssembly (browser আৰু Node.js)।',
            '',
            `সংস্কৰণ: ${(this.runtime && this.runtime.VERSION) || '2.1.0'}   ·   লাইচেন্স: MIT`,
            'Developed and open sourced by Er Panchanan Nath',
            'https://github.com/PanchananNath/Asomiya_Bhasha',
        ].join('\n');
        this.outputDiv.replaceChildren(this.pre(text, 'help'));
    }
}

document.addEventListener('DOMContentLoaded', () => { window.asomiyaWeb = new AsomiyaWeb(); });
