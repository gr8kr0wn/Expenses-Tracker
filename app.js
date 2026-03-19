/**
 * ============================================================
 *  FlowFinance — app.js
 *  Alpine.js application logic for the Smart Money OS
 *
 *  Sections:
 *   1.  App factory (app())
 *   2.  Default categories
 *   3.  Lifecycle: init()
 *   4.  Onboarding
 *   5.  localStorage persistence
 *   6.  Transaction CRUD
 *   7.  Budget CRUD
 *   8.  Category CRUD
 *   9.  Computed helpers (currency, formatting, filters)
 *  10.  Analytics computations
 *  11.  AI Insights generator
 *  12.  Chart rendering (Chart.js)
 *  13.  CSV export
 * ============================================================
 */

function app() {
  return {

    /* ──────────────────────────────────────────────────────────
       STATE
    ────────────────────────────────────────────────────────── */

    // Active page / view
    page: 'dashboard',

    // Modal visibility flags
    showOnboard:    false,
    showAddTxn:     false,
    showAddBudget:  false,
    showAddCat:     false,

    // Currently editing (null = create new)
    editingTxn: null,

    // Core data collections (persisted to localStorage)
    transactions: [],
    budgets:      [],
    categories:   [],

    // User preferences
    settings: {
      name:          '',
      currency:      'NGN',
      incomeTarget:  0,
    },

    // Filter state — Transactions page
    search: '',
    fCat:   '',      // category filter
    fType:  '',      // income | expense
    fPer:   'month', // today | week | month | 3m | ''

    // Form models
    form: {
      amount:      '',
      type:        'expense',
      category:    '',
      date:        '',
      description: '',
      recurring:   false,
      frequency:   'monthly',
    },

    bForm: { category: '', limit: '' },  // budget form
    cForm: { name: '', icon: '📦', type: 'expense' }, // category form

    // Chart.js instances (keyed by short id)
    _charts: {},


    /* ──────────────────────────────────────────────────────────
       2. DEFAULT CATEGORIES
    ────────────────────────────────────────────────────────── */

    defCats() {
      return [
        // Expense categories
        { id: 'food',          name: 'Food & Dining',     icon: '🍔', type: 'expense', default: true },
        { id: 'transport',     name: 'Transport',          icon: '🚗', type: 'expense', default: true },
        { id: 'bills',         name: 'Bills & Utilities',  icon: '💡', type: 'expense', default: true },
        { id: 'shopping',      name: 'Shopping',           icon: '🛍️', type: 'expense', default: true },
        { id: 'health',        name: 'Health',             icon: '💊', type: 'expense', default: true },
        { id: 'entertainment', name: 'Entertainment',      icon: '🎬', type: 'expense', default: true },
        { id: 'education',     name: 'Education',          icon: '📚', type: 'expense', default: true },
        { id: 'others',        name: 'Others',             icon: '📦', type: 'expense', default: true },
        // Income categories
        { id: 'salary',        name: 'Salary',             icon: '💼', type: 'income',  default: true },
        { id: 'freelance',     name: 'Freelance',          icon: '💻', type: 'income',  default: true },
        { id: 'investment',    name: 'Investment',         icon: '📈', type: 'income',  default: true },
        { id: 'gift',          name: 'Gift / Bonus',       icon: '🎁', type: 'income',  default: true },
      ];
    },


    /* ──────────────────────────────────────────────────────────
       3. LIFECYCLE — init()
       Called automatically by Alpine via x-init="init()"
    ────────────────────────────────────────────────────────── */

    init() {
      // ── Rehydrate from localStorage ────────────────────────
      const ss = localStorage.getItem('ff_s');
      const st = localStorage.getItem('ff_t');
      const sb = localStorage.getItem('ff_b');
      const sc = localStorage.getItem('ff_c');
      const ob = localStorage.getItem('ff_ob');

      this.settings     = ss ? JSON.parse(ss) : { name: '', currency: 'NGN', incomeTarget: 0 };
      this.transactions = st ? JSON.parse(st) : [];
      this.budgets      = sb ? JSON.parse(sb) : [];
      this.categories   = sc ? JSON.parse(sc) : this.defCats();

      // Show onboarding if this is a fresh session
      if (!ob) this.showOnboard = true;

      // Set sensible form defaults
      this.form.date     = this.today();
      this.form.category = this.categories.find(c => c.type === 'expense')?.id || 'food';

      // Initial chart render
      this.$nextTick(() => this.renderCharts());

      // ── Global keyboard shortcut: "N" → add transaction ───
      document.addEventListener('keydown', e => {
        const tag = e.target.tagName;
        const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag);
        if (e.key === 'n' && !isTyping && !this.showAddTxn && !this.showOnboard) {
          this.openAddTxn();
        }
      });

      // Re-render charts whenever the active page changes
      this.$watch('page', () => this.$nextTick(() => this.renderCharts()));
    },


    /* ──────────────────────────────────────────────────────────
       4. ONBOARDING
    ────────────────────────────────────────────────────────── */

    /**
     * Called when the user completes the 3-step onboarding wizard.
     * Saves profile, marks onboarding as done, closes modal.
     */
    completeOnboard(name, currency, income) {
      this.settings.name          = name;
      this.settings.currency      = currency;
      this.settings.incomeTarget  = parseFloat(income) || 0;
      this.saveSett();
      localStorage.setItem('ff_ob', '1');
      this.showOnboard = false;
      this.$nextTick(() => this.renderCharts());
    },


    /* ──────────────────────────────────────────────────────────
       5. LOCALSTORAGE PERSISTENCE
    ────────────────────────────────────────────────────────── */

    saveSett()    { localStorage.setItem('ff_s', JSON.stringify(this.settings));     },
    saveTxns()    { localStorage.setItem('ff_t', JSON.stringify(this.transactions)); },
    saveBudgets() { localStorage.setItem('ff_b', JSON.stringify(this.budgets));      },
    saveCats()    { localStorage.setItem('ff_c', JSON.stringify(this.categories));   },


    /* ──────────────────────────────────────────────────────────
       6. TRANSACTION CRUD
    ────────────────────────────────────────────────────────── */

    /** Open the add/edit modal in "create" mode */
    openAddTxn() {
      this.editingTxn = null;
      this.resetForm();
      this.showAddTxn = true;
    },

    /** Reset form to blank defaults */
    resetForm() {
      this.form = {
        amount:      '',
        type:        'expense',
        category:    this.categories.find(c => c.type === 'expense')?.id || 'food',
        date:        this.today(),
        description: '',
        recurring:   false,
        frequency:   'monthly',
      };
    },

    /** Save (create or update) a transaction */
    saveTxn() {
      if (!this.form.amount || parseFloat(this.form.amount) <= 0) return;

      if (this.editingTxn) {
        // Update existing
        const idx = this.transactions.findIndex(t => t.id === this.editingTxn.id);
        if (idx !== -1) {
          this.transactions[idx] = {
            ...this.editingTxn,
            ...this.form,
            amount: parseFloat(this.form.amount),
          };
        }
        this.editingTxn = null;
      } else {
        // Create new
        this.transactions.push({
          id:        Date.now().toString(),
          ...this.form,
          amount:    parseFloat(this.form.amount),
          createdAt: new Date().toISOString(),
        });
      }

      this.saveTxns();
      this.showAddTxn = false;
      this.resetForm();
      this.$nextTick(() => this.renderCharts());
    },

    /** Open modal pre-populated with an existing transaction */
    editTxn(t) {
      this.editingTxn = t;
      this.form = { ...t, amount: t.amount.toString() };
      this.showAddTxn = true;
    },

    /** Delete a transaction by id (with confirmation) */
    delTxn(id) {
      if (!confirm('Delete this transaction?')) return;
      this.transactions = this.transactions.filter(t => t.id !== id);
      this.saveTxns();
      this.$nextTick(() => this.renderCharts());
    },


    /* ──────────────────────────────────────────────────────────
       7. BUDGET CRUD
    ────────────────────────────────────────────────────────── */

    /** Create or update a budget for a category */
    saveBudget() {
      if (!this.bForm.category || !this.bForm.limit) return;

      const entry = {
        id:       Date.now().toString(),
        category: this.bForm.category,
        limit:    parseFloat(this.bForm.limit),
      };

      const existing = this.budgets.findIndex(b => b.category === this.bForm.category);
      if (existing !== -1) {
        this.budgets[existing] = entry;   // overwrite existing budget for same category
      } else {
        this.budgets.push(entry);
      }

      this.saveBudgets();
      this.showAddBudget = false;
      this.bForm = { category: '', limit: '' };
    },

    /** Delete a budget by id */
    delBudget(id) {
      this.budgets = this.budgets.filter(b => b.id !== id);
      this.saveBudgets();
    },

    /** Amount spent in the current month for a given budget */
    bspent(b) {
      const now = new Date();
      return this.transactions
        .filter(t => {
          const d = new Date(t.date);
          return (
            t.category  === b.category &&
            t.type      === 'expense'  &&
            d.getMonth()     === now.getMonth() &&
            d.getFullYear()  === now.getFullYear()
          );
        })
        .reduce((s, t) => s + t.amount, 0);
    },

    /** Usage percentage (0–100+) for a budget */
    bpct(b) {
      return b.limit > 0 ? Math.round((this.bspent(b) / b.limit) * 100) : 0;
    },

    /** Count of budgets currently at or over 100% */
    overCount() {
      return this.budgets.filter(b => this.bpct(b) >= 100).length;
    },


    /* ──────────────────────────────────────────────────────────
       8. CATEGORY CRUD
    ────────────────────────────────────────────────────────── */

    /** Create a custom category */
    saveCat() {
      if (!this.cForm.name || !this.cForm.icon) return;
      this.categories.push({
        id:      'c' + Date.now(),
        name:    this.cForm.name,
        icon:    this.cForm.icon,
        type:    this.cForm.type,
        default: false,
      });
      this.saveCats();
      this.showAddCat = false;
      this.cForm = { name: '', icon: '📦', type: 'expense' };
    },

    /** Delete a custom category */
    delCat(id) {
      this.categories = this.categories.filter(c => c.id !== id);
      this.saveCats();
    },

    /** Wipe everything and reload (used in Settings) */
    clearAll() {
      if (!confirm('Clear ALL data? Cannot be undone.')) return;
      ['ff_s','ff_t','ff_b','ff_c','ff_ob'].forEach(k => localStorage.removeItem(k));
      location.reload();
    },


    /* ──────────────────────────────────────────────────────────
       9. COMPUTED HELPERS
    ────────────────────────────────────────────────────────── */

    /** Currency symbol for the active currency setting */
    csym() {
      const map = { NGN: '₦', USD: '$', GBP: '£', EUR: '€', GHS: '₵', KES: 'KSh', ZAR: 'R' };
      return map[this.settings.currency] || '₦';
    },

    /**
     * Smart number formatter:
     *  ≥ 1,000,000 → "1.2M"
     *  ≥ 1,000     → "45.3K"
     *  otherwise   → "999"
     */
    fnum(n) {
      if (n === undefined || n === null || isNaN(n)) return '0';
      if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
      if (n >= 1_000)     return (n / 1_000).toFixed(1)     + 'K';
      return parseFloat(n).toFixed(0);
    },

    /** Formats a date string (YYYY-MM-DD) to "12 Mar 2025" */
    fdate(d) {
      if (!d) return '';
      return new Date(d).toLocaleDateString('en-GB', {
        day:   '2-digit',
        month: 'short',
        year:  'numeric',
      });
    },

    /** Returns today's date as YYYY-MM-DD (used as default form value) */
    today() {
      return new Date().toISOString().split('T')[0];
    },

    /** Long date string for the top bar */
    todayStr() {
      return new Date().toLocaleDateString('en-GB', {
        weekday: 'short',
        day:     'numeric',
        month:   'long',
        year:    'numeric',
      });
    },

    /** 1–2 character initials from the user's name */
    initials() {
      const n = this.settings.name || 'U';
      return n.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    },

    /** Look up a category object by id; returns a fallback if not found */
    getCat(id) {
      return this.categories.find(c => c.id === id) || { icon: '📦', name: 'Unknown', type: 'expense' };
    },

    /**
     * Returns a soft rgba background colour for a category icon bubble.
     * Custom categories fall back to a neutral grey.
     */
    ccol(id) {
      const map = {
        food:          'rgba(251,191,36,.15)',
        transport:     'rgba(56,189,248,.15)',
        bills:         'rgba(244,63,94,.15)',
        shopping:      'rgba(167,139,250,.15)',
        health:        'rgba(52,211,153,.15)',
        entertainment: 'rgba(251,113,133,.15)',
        education:     'rgba(16,185,129,.15)',
        salary:        'rgba(16,185,129,.15)',
        freelance:     'rgba(79,195,247,.15)',
        investment:    'rgba(167,139,250,.15)',
        gift:          'rgba(251,191,36,.15)',
        others:        'rgba(100,116,139,.15)',
      };
      return map[id] || 'rgba(100,116,139,.15)';
    },

    /** Expense-only categories (for budget form dropdown) */
    expCats() { return this.categories.filter(c => c.type === 'expense'); },

    // ── Aggregate helpers ──────────────────────────────────

    recTxns()  { return this.transactions.filter(t => t.recurring); },
    recInc()   { return this.recTxns().filter(t => t.type === 'income' ).reduce((s, t) => s + t.amount, 0); },
    recExp()   { return this.recTxns().filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0); },

    totInc()   { return this.transactions.filter(t => t.type === 'income' ).reduce((s, t) => s + t.amount, 0); },
    totExp()   { return this.transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0); },
    netBal()   { return this.totInc() - this.totExp(); },

    /** Transactions for the current calendar month */
    mthTxns() {
      const now = new Date(), y = now.getFullYear(), m = now.getMonth();
      return this.transactions.filter(t => {
        const d = new Date(t.date);
        return d.getFullYear() === y && d.getMonth() === m;
      });
    },
    mthInc()  { return this.mthTxns().filter(t => t.type === 'income' ).reduce((s, t) => s + t.amount, 0); },
    mthExp()  { return this.mthTxns().filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0); },

    /** Savings rate for the current month (0–100) */
    savRate() {
      const inc = this.mthInc();
      if (!inc) return 0;
      return Math.max(0, Math.round(((inc - this.mthExp()) / inc) * 100));
    },

    // ── Filtered transactions (Transactions page) ──────────

    /** Returns transactions matching all active filter criteria */
    fTxns() {
      let txns = [...this.transactions];

      // Text search across description + category name
      if (this.search) {
        const q = this.search.toLowerCase();
        txns = txns.filter(t =>
          (t.description || '').toLowerCase().includes(q) ||
          this.getCat(t.category).name.toLowerCase().includes(q)
        );
      }

      if (this.fCat)  txns = txns.filter(t => t.category === this.fCat);
      if (this.fType) txns = txns.filter(t => t.type     === this.fType);

      if (this.fPer) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        txns = txns.filter(t => {
          const d = new Date(t.date);
          if (this.fPer === 'today') return d >= today;
          if (this.fPer === 'week')  return d >= new Date(+today - 7  * 86_400_000);
          if (this.fPer === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
          if (this.fPer === '3m')    return d >= new Date(+today - 90 * 86_400_000);
          return true;
        });
      }

      return txns;
    },

    fInc() { return this.fTxns().filter(t => t.type === 'income' ).reduce((s, t) => s + t.amount, 0); },
    fExp() { return this.fTxns().filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0); },

    // ── Page title + subtitle ───────────────────────────────

    ptitle() {
      return {
        dashboard:    'Dashboard',
        transactions: 'Transactions',
        analytics:    'Analytics',
        budgets:      'Budgets & Categories',
        recurring:    'Recurring',
        settings:     'Settings',
      }[this.page] || 'FlowFinance';
    },

    psub() {
      const n = this.settings.name ? ', ' + this.settings.name.split(' ')[0] : '';
      return {
        dashboard:    `Welcome back${n}. Here's your financial snapshot.`,
        transactions: 'All your income and expense records.',
        analytics:    'Deep insights into your spending behaviour.',
        budgets:      'Control your spending with category limits.',
        recurring:    'Automated income and expense tracking.',
        settings:     'Manage your account and preferences.',
      }[this.page] || '';
    },


    /* ──────────────────────────────────────────────────────────
       10. ANALYTICS COMPUTATIONS
    ────────────────────────────────────────────────────────── */

    /** Returns metadata for the last 6 calendar months */
    l6m() {
      const months = [], now = new Date();
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push({
          y: d.getFullYear(),
          m: d.getMonth(),
          l: d.toLocaleString('default', { month: 'short' }),
        });
      }
      return months;
    },

    /** Aggregated income + expenses per month for the last 6 months */
    mdata() {
      return this.l6m().map(mo => {
        const txns = this.transactions.filter(t => {
          const d = new Date(t.date);
          return d.getFullYear() === mo.y && d.getMonth() === mo.m;
        });
        return {
          l:   mo.l,
          inc: txns.filter(t => t.type === 'income' ).reduce((s, t) => s + t.amount, 0),
          exp: txns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
        };
      });
    },

    /** Day-of-week name with highest total spending (all time) */
    topDay() {
      const days   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
      const totals = Array(7).fill(0);
      this.transactions
        .filter(t => t.type === 'expense')
        .forEach(t => { totals[new Date(t.date).getDay()] += t.amount; });
      return days[totals.indexOf(Math.max(...totals))] || '-';
    },

    /** Average daily spend this month */
    avgDaily() {
      const dom = new Date().getDate();
      return dom > 0 ? Math.round(this.mthExp() / dom) : 0;
    },

    /** Top spending category this month (icon + name) */
    topCat() {
      const now  = new Date();
      const bycat = {};
      this.transactions
        .filter(t => {
          const d = new Date(t.date);
          return t.type === 'expense' &&
                 d.getMonth()    === now.getMonth() &&
                 d.getFullYear() === now.getFullYear();
        })
        .forEach(t => { bycat[t.category] = (bycat[t.category] || 0) + t.amount; });

      const top = Object.entries(bycat).sort((a, b) => b[1] - a[1])[0];
      if (!top) return '-';
      const cat = this.getCat(top[0]);
      return cat.icon + ' ' + cat.name;
    },

    /** Month-over-month expense change percentage */
    momChg() {
      const now   = new Date();
      const pm    = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prev  = this.transactions
        .filter(t => {
          const d = new Date(t.date);
          return t.type === 'expense' &&
                 d.getMonth()    === pm.getMonth() &&
                 d.getFullYear() === pm.getFullYear();
        })
        .reduce((s, t) => s + t.amount, 0);
      const curr = this.mthExp();
      if (!prev) return 0;
      return Math.round(((curr - prev) / prev) * 100);
    },

    /**
     * Returns an array of 7 objects (Mon–Sun) with:
     *  - name:      day label
     *  - total:     total expense amount for that day of week this month
     *  - intensity: 0.04–0.44 (used as rgba alpha for heatmap cells)
     */
    heatmap() {
      const days   = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
      const totals = {};
      days.forEach(d => (totals[d] = 0));

      this.mthTxns()
        .filter(t => t.type === 'expense')
        .forEach(t => {
          const label = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(t.date).getDay()];
          totals[label] = (totals[label] || 0) + t.amount;
        });

      const max = Math.max(...Object.values(totals), 1);
      return days.map(d => ({
        name:      d,
        total:     totals[d] || 0,
        intensity: ((totals[d] || 0) / max) * 0.4 + 0.04,
      }));
    },


    /* ──────────────────────────────────────────────────────────
       11. AI INSIGHTS GENERATOR
       Rule-based smart cards for the Dashboard
    ────────────────────────────────────────────────────────── */

    insights() {
      const ins = [];
      const sv  = this.savRate();
      const mm  = this.momChg();
      const tc  = this.topCat();

      // ── Savings rate ───────────────────────────────────────
      if (sv >= 30) {
        ins.push({
          icon:  '🎉',
          title: 'Excellent savings rate!',
          text:  `You're saving ${sv}% of your income this month. That's top-tier financial discipline.`,
        });
      } else if (sv > 0) {
        ins.push({
          icon:  '💡',
          title: 'Savings opportunity',
          text:  `Your savings rate is ${sv}%. Aim for 20–30% to build a strong emergency fund.`,
        });
      } else {
        ins.push({
          icon:  '⚠️',
          title: 'Expenses exceed income',
          text:  'Your spending this month is higher than your income. Review your top categories urgently.',
        });
      }

      // ── Month-over-month change ────────────────────────────
      if (mm > 20) {
        ins.push({
          icon:  '📈',
          title: 'Spending spiked',
          text:  `Your spending jumped ${mm}% vs last month. ${tc} is your biggest category right now.`,
        });
      } else if (mm < -10) {
        ins.push({
          icon:  '📉',
          title: 'Spending reduced!',
          text:  `Great discipline — your expenses dropped ${Math.abs(mm)}% compared to last month.`,
        });
      }

      // ── Budget alerts ──────────────────────────────────────
      const overBudget = this.budgets.filter(b => this.bpct(b) >= 80);
      if (overBudget.length > 0) {
        ins.push({
          icon:  '🎯',
          title: 'Budget alert',
          text:  `${overBudget.length} budget${overBudget.length > 1 ? 's are' : ' is'} at or near the limit. Head to the Budgets page.`,
        });
      }

      // ── Recurring costs awareness ──────────────────────────
      if (this.recExp() > 0) {
        ins.push({
          icon:  '🔁',
          title: 'Recurring costs',
          text:  `${this.csym()}${this.fnum(this.recExp())} goes to recurring expenses monthly. Review subscriptions periodically.`,
        });
      }

      // ── Default: prompt to start adding transactions ───────
      if (ins.length === 0) {
        ins.push({
          icon:  '🚀',
          title: 'Start tracking',
          text:  'Add transactions to unlock AI-powered insights about your spending behaviour.',
        });
      }

      return ins.slice(0, 4); // show max 4 cards
    },


    /* ──────────────────────────────────────────────────────────
       12. CHART RENDERING  (Chart.js 4)
    ────────────────────────────────────────────────────────── */

    /** Shared colour palette for all charts */
    chartCols: [
      '#10b981', '#f43f5e', '#38bdf8', '#a78bfa',
      '#fbbf24', '#fb7185', '#22d3ee', '#34d399', '#f97316',
    ],

    /** Safely destroy a chart instance before re-creating it */
    destroyChart(id) {
      if (this._charts[id]) {
        this._charts[id].destroy();
        delete this._charts[id];
      }
    },

    /** Route which charts to render based on the active page */
    renderCharts() {
      this.$nextTick(() => {
        if (this.page === 'dashboard' || this.page === 'analytics') {
          this.rCF(); // Cashflow bar chart
          this.rDN(); // Spending donut chart
        }
        if (this.page === 'analytics') {
          this.rTR(); // Spending trend line chart
          this.rCB(); // Category horizontal bar chart
        }
      });
    },

    // ── Individual chart renderers ─────────────────────────

    /** Monthly Cashflow — grouped bar (Income vs Expenses) */
    rCF() {
      const el = document.getElementById('chartCF');
      if (!el) return;
      this.destroyChart('cf');
      const d = this.mdata();
      this._charts.cf = new Chart(el, {
        type: 'bar',
        data: {
          labels: d.map(x => x.l),
          datasets: [
            {
              label:           'Income',
              data:            d.map(x => x.inc),
              backgroundColor: 'rgba(16,185,129,.7)',
              borderRadius:    6,
              borderSkipped:   false,
            },
            {
              label:           'Expenses',
              data:            d.map(x => x.exp),
              backgroundColor: 'rgba(244,63,94,.7)',
              borderRadius:    6,
              borderSkipped:   false,
            },
          ],
        },
        options: {
          responsive:          true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: {
              grid:  { color: 'rgba(255,255,255,.04)' },
              ticks: { color: '#64748b', font: { family: 'DM Sans' } },
            },
            y: {
              grid:  { color: 'rgba(255,255,255,.04)' },
              ticks: {
                color:    '#64748b',
                font:     { family: 'DM Sans' },
                callback: v => this.csym() + this.fnum(v),
              },
            },
          },
        },
      });
    },

    /** Spending Breakdown — doughnut chart with custom HTML legend */
    rDN() {
      const el = document.getElementById('chartDN');
      if (!el) return;
      this.destroyChart('dn');

      const now   = new Date();
      const bycat = {};
      this.transactions
        .filter(t => {
          const d = new Date(t.date);
          return t.type === 'expense' &&
                 d.getMonth()    === now.getMonth() &&
                 d.getFullYear() === now.getFullYear();
        })
        .forEach(t => { bycat[t.category] = (bycat[t.category] || 0) + t.amount; });

      const ent = Object.entries(bycat).sort((a, b) => b[1] - a[1]).slice(0, 6);
      const tot = ent.reduce((s, e) => s + e[1], 0);
      if (!ent.length) return;

      this._charts.dn = new Chart(el, {
        type: 'doughnut',
        data: {
          labels:   ent.map(e => this.getCat(e[0]).icon + ' ' + this.getCat(e[0]).name),
          datasets: [{
            data:            ent.map(e => e[1]),
            backgroundColor: this.chartCols,
            borderWidth:     0,
            hoverOffset:     4,
          }],
        },
        options: {
          responsive:          true,
          maintainAspectRatio: false,
          cutout:              '72%',
          plugins: { legend: { display: false } },
        },
      });

      // Inject custom HTML legend
      const leg = document.getElementById('dnLeg');
      if (leg) {
        leg.innerHTML = ent.map((e, i) => `
          <div style="display:flex;align-items:center;justify-content:space-between;font-size:12px">
            <span style="display:flex;align-items:center;gap:6px;color:#94a3b8">
              <span style="width:8px;height:8px;border-radius:2px;background:${this.chartCols[i]};display:inline-block"></span>
              ${this.getCat(e[0]).name}
            </span>
            <span style="font-family:DM Mono;color:#e2e8f4">
              ${this.csym()}${this.fnum(e[1])}
              <span style="color:#64748b">${tot ? Math.round((e[1] / tot) * 100) : 0}%</span>
            </span>
          </div>
        `).join('');
      }
    },

    /** Spending Trend — filled area line chart */
    rTR() {
      const el = document.getElementById('chartTR');
      if (!el) return;
      this.destroyChart('tr');
      const d = this.mdata();
      this._charts.tr = new Chart(el, {
        type: 'line',
        data: {
          labels:   d.map(x => x.l),
          datasets: [{
            label:                'Expenses',
            data:                 d.map(x => x.exp),
            borderColor:          '#f43f5e',
            backgroundColor:      'rgba(244,63,94,.08)',
            fill:                 true,
            tension:              0.4,
            pointBackgroundColor: '#f43f5e',
            pointRadius:          4,
          }],
        },
        options: {
          responsive:          true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: {
              grid:  { color: 'rgba(255,255,255,.04)' },
              ticks: { color: '#64748b' },
            },
            y: {
              grid:  { color: 'rgba(255,255,255,.04)' },
              ticks: { color: '#64748b', callback: v => this.csym() + this.fnum(v) },
            },
          },
        },
      });
    },

    /** Category Breakdown — horizontal bar chart */
    rCB() {
      const el = document.getElementById('chartCB');
      if (!el) return;
      this.destroyChart('cb');

      const now   = new Date();
      const bycat = {};
      this.transactions
        .filter(t => {
          const d = new Date(t.date);
          return t.type === 'expense' &&
                 d.getMonth()    === now.getMonth() &&
                 d.getFullYear() === now.getFullYear();
        })
        .forEach(t => { bycat[t.category] = (bycat[t.category] || 0) + t.amount; });

      const ent = Object.entries(bycat).sort((a, b) => b[1] - a[1]).slice(0, 7);
      if (!ent.length) return;

      this._charts.cb = new Chart(el, {
        type: 'bar',
        data: {
          labels:   ent.map(e => this.getCat(e[0]).icon + ' ' + this.getCat(e[0]).name),
          datasets: [{
            data:            ent.map(e => e[1]),
            backgroundColor: this.chartCols,
            borderRadius:    6,
            borderSkipped:   false,
          }],
        },
        options: {
          indexAxis:           'y',
          responsive:          true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: {
              grid:  { color: 'rgba(255,255,255,.04)' },
              ticks: { color: '#64748b', callback: v => this.csym() + this.fnum(v) },
            },
            y: {
              grid:  { display: false },
              ticks: { color: '#94a3b8', font: { size: 12 } },
            },
          },
        },
      });
    },


    /* ──────────────────────────────────────────────────────────
       13. CSV EXPORT
    ────────────────────────────────────────────────────────── */

    exportCSV() {
      const headers = ['Date', 'Type', 'Category', 'Description', 'Amount', 'Currency', 'Recurring'];
      const rows    = this.transactions.map(t => [
        t.date,
        t.type,
        this.getCat(t.category).name,
        t.description || '',
        t.amount,
        this.settings.currency,
        t.recurring ? 'Yes' : 'No',
      ]);

      const csv = [headers, ...rows]
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');

      const a = document.createElement('a');
      a.href     = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
      a.download = `flowfinance_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
    },

  }; // end return
} // end app()
