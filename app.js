/**
 * FlowFinance — app.js (API version, using D1/Pages Functions)
 */
function app() {
  return {
    page: 'dashboard',
    showOnboard: false,
    showAddTxn: false,
    showAddBudget: false,
    showAddCat: false,
    editingTxn: null,

    transactions: [],
    budgets: [],
    categories: [],
    settings: {
      name: '',
      currency: 'NGN',
      incomeTarget: 0,
    },

    search: '',
    fCat: '',
    fType: '',
    fPer: 'month',

    form: {
      amount: '',
      type: 'expense',
      category: '',
      date: '',
      description: '',
      recurring: false,
      frequency: 'monthly',
    },
    bForm: { category: '', limit: '' },
    cForm: { name: '', icon: '📦', type: 'expense' },

    _charts: {},

    async init() {
      const token = getToken();
      if (!token) { window.location.replace('login.html'); return; }

      // Fetch all user data
      try {
        const [txRes, bdRes, catRes, setRes] = await Promise.all([
          fetch('/api/transactions', { headers: { Authorization: `Bearer ${token}` } }),
          fetch('/api/budgets',       { headers: { Authorization: `Bearer ${token}` } }),
          fetch('/api/categories',    { headers: { Authorization: `Bearer ${token}` } }),
          fetch('/api/settings',      { headers: { Authorization: `Bearer ${token}` } })
        ]);

        this.transactions = await txRes.json();
        this.budgets      = await bdRes.json();
        this.categories   = await catRes.json();
        const sett = await setRes.json();
        if (sett && sett.name) {
          this.settings.name         = sett.name;
          this.settings.currency     = sett.currency || 'NGN';
          this.settings.incomeTarget = sett.income_target || 0;
        } else {
          // Fallback if no settings row (shouldn't happen)
          const user = JSON.parse(localStorage.getItem('ff_user') || '{}');
          this.settings.name = user.name || '';
        }
      } catch (e) {
        console.error('Failed to load data', e);
      }

      // Onboarding check (still need local flag)
      if (!localStorage.getItem('ff_ob')) this.showOnboard = true;

      this.form.date     = this.today();
      this.form.category = this.categories.find(c => c.type === 'expense')?.id || 'food';

      this.$nextTick(() => this.renderCharts());

      document.addEventListener('keydown', e => {
        const tag = e.target.tagName;
        const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag);
        if (e.key === 'n' && !typing && !this.showAddTxn && !this.showOnboard) this.openAddTxn();
      });

      this.$watch('page', () => this.$nextTick(() => this.renderCharts()));
    },

    completeOnboard(name, currency, income) {
      this.settings.name         = name;
      this.settings.currency     = currency;
      this.settings.incomeTarget = parseFloat(income) || 0;
      this.saveSett(); // calls API
      localStorage.setItem('ff_ob', '1');
      this.showOnboard = false;
      this.$nextTick(() => this.renderCharts());
    },

    async saveSett() {
      const token = getToken();
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: this.settings.name,
          currency: this.settings.currency,
          incomeTarget: this.settings.incomeTarget
        })
      });
    },

    openAddTxn() {
      this.editingTxn = null;
      this.resetForm();
      this.showAddTxn = true;
    },
    resetForm() {
      this.form = {
        amount: '',
        type: 'expense',
        category: this.categories.find(c => c.type === 'expense')?.id || 'food',
        date: this.today(),
        description: '',
        recurring: false,
        frequency: 'monthly',
      };
    },

    async saveTxn() {
      if (!this.form.amount || parseFloat(this.form.amount) <= 0) return;
      const token = getToken();
      if (this.editingTxn) {
        await fetch(`/api/transactions/${this.editingTxn.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ ...this.form, amount: parseFloat(this.form.amount) })
        });
      } else {
        await fetch('/api/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ ...this.form, amount: parseFloat(this.form.amount) })
        });
      }
      this.showAddTxn = false;
      this.resetForm();
      await this.reloadData();
      this.$nextTick(() => this.renderCharts());
    },

    editTxn(t) {
      this.editingTxn = t;
      this.form = { ...t, amount: t.amount.toString() };
      this.showAddTxn = true;
    },

    async delTxn(id) {
      if (!confirm('Delete this transaction?')) return;
      const token = getToken();
      await fetch(`/api/transactions/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      await this.reloadData();
      this.$nextTick(() => this.renderCharts());
    },

    async saveBudget() {
      if (!this.bForm.category || !this.bForm.limit) return;
      const token = getToken();
      await fetch('/api/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ category: this.bForm.category, limit: parseFloat(this.bForm.limit) })
      });
      this.showAddBudget = false;
      this.bForm = { category: '', limit: '' };
      await this.reloadData();
    },
    async delBudget(id) {
      const token = getToken();
      await fetch(`/api/budgets/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      await this.reloadData();
    },

    async saveCat() {
      if (!this.cForm.name || !this.cForm.icon) return;
      const token = getToken();
      await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(this.cForm)
      });
      this.showAddCat = false;
      this.cForm = { name: '', icon: '📦', type: 'expense' };
      await this.reloadData();
    },
    async delCat(id) {
      const token = getToken();
      await fetch(`/api/categories/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      await this.reloadData();
    },

    async clearAll() {
      if (!confirm('Clear ALL data? Cannot be undone.')) return;
      const token = getToken();
      // Delete all user data via API (you need an endpoint for this)
      await Promise.all([
        fetch('/api/transactions/clear', { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/budgets/clear',      { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/categories/clear',   { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/settings',           { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
      ]);
      localStorage.removeItem('ff_ob');
      window.location.reload();
    },

    async reloadData() {
      const token = getToken();
      const [txRes, bdRes, catRes] = await Promise.all([
        fetch('/api/transactions', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/budgets',       { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/categories',    { headers: { Authorization: `Bearer ${token}` } })
      ]);
      this.transactions = await txRes.json();
      this.budgets      = await bdRes.json();
      this.categories   = await catRes.json();
    },

    /* The rest of the app (helpers, charts, insights) stays exactly the same. */
    defCats() { /* … keep original … */ },
    csym() { /* … */ },
    fnum(n) { /* … */ },
    fdate(d) { /* … */ },
    today() { /* … */ },
    todayStr() { /* … */ },
    initials() { /* … */ },
    getCat(id) { /* … */ },
    ccol(id) { /* … */ },
    expCats() { /* … */ },
    recTxns() { /* … */ },
    recInc() { /* … */ },
    recExp() { /* … */ },
    totInc() { /* … */ },
    totExp() { /* … */ },
    netBal() { /* … */ },
    mthTxns() { /* … */ },
    mthInc() { /* … */ },
    mthExp() { /* … */ },
    savRate() { /* … */ },
    fTxns() { /* … */ },
    fInc() { /* … */ },
    fExp() { /* … */ },
    ptitle() { /* … */ },
    psub() { /* … */ },
    l6m() { /* … */ },
    mdata() { /* … */ },
    topDay() { /* … */ },
    avgDaily() { /* … */ },
    topCat() { /* … */ },
    momChg() { /* … */ },
    heatmap() { /* … */ },
    insights() { /* … */ },
    chartCols: ['#10b981', '#f43f5e', '#38bdf8', '#a78bfa', '#fbbf24', '#fb7185', '#22d3ee', '#34d399', '#f97316'],
    destroyChart(id) { /* … */ },
    renderCharts() { /* … */ },
    rCF() { /* … */ },
    rDN() { /* … */ },
    rTR() { /* … */ },
    rCB() { /* … */ },
    exportCSV() { /* … */ },
    bspent(b) { /* … */ },
    bpct(b) { /* … */ },
    overCount() { /* … */ },
  };
}
