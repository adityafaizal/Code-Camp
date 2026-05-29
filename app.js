/* ============================================================
   app.js — Gym Member Transaction Tracker
   ============================================================
   Responsibilities:
     1. Handle form submission and validation
     2. Maintain the transactions array (in-memory state)
     3. Render the transaction list
     4. Calculate and display the total balance
     5. Draw / update the Chart.js pie chart
   ============================================================ */

'use strict';

/* ----------------------------------------------------------
   STATE
   transactions: array of { id, name, amount, category }
---------------------------------------------------------- */
let transactions = [];

/* Unique ID counter — simple incrementing integer */
let nextId = 1;

/* Chart.js instance (kept so we can update it in place) */
let spendingChart = null;

/* ----------------------------------------------------------
   DOM REFERENCES
   Cached once on load for performance
---------------------------------------------------------- */
const form          = document.getElementById('transactionForm');
const itemNameInput = document.getElementById('itemName');
const amountInput   = document.getElementById('amount');
const categoryInput = document.getElementById('category');
const errorMessage  = document.getElementById('errorMessage');
const totalBalance  = document.getElementById('totalBalance');
const transactionList = document.getElementById('transactionList');
const emptyState    = document.getElementById('emptyState');
const chartCanvas   = document.getElementById('spendingChart');
const chartPlaceholder = document.getElementById('chartPlaceholder');

/* ----------------------------------------------------------
   CATEGORY CONFIG
   Maps each category name to a display color used in both
   the transaction list border and the pie chart slices.
---------------------------------------------------------- */
const CATEGORY_COLORS = {
  Membership:  '#3498db',
  Equipment:   '#e67e22',
  Supplements: '#9b59b6',
  Classes:     '#e74c3c',
  Other:       '#95a5a6',
};

/* ----------------------------------------------------------
   VALIDATION
   Returns an array of error strings. Empty array = valid.
---------------------------------------------------------- */
function validateForm() {
  const errors = [];

  /* Clear previous invalid highlights */
  [itemNameInput, amountInput, categoryInput].forEach(el => el.classList.remove('invalid'));

  if (!itemNameInput.value.trim()) {
    errors.push('Item Name is required.');
    itemNameInput.classList.add('invalid');
  }

  const amountValue = parseFloat(amountInput.value);
  if (!amountInput.value.trim()) {
    errors.push('Amount is required.');
    amountInput.classList.add('invalid');
  } else if (isNaN(amountValue) || amountValue <= 0) {
    errors.push('Amount must be a positive number.');
    amountInput.classList.add('invalid');
  }

  if (!categoryInput.value) {
    errors.push('Category is required.');
    categoryInput.classList.add('invalid');
  }

  return errors;
}

/* ----------------------------------------------------------
   SHOW / HIDE ERROR MESSAGE
---------------------------------------------------------- */
function showError(messages) {
  errorMessage.innerHTML = messages.map(m => `• ${m}`).join('<br>');
  errorMessage.classList.add('visible');
}

function clearError() {
  errorMessage.textContent = '';
  errorMessage.classList.remove('visible');
  [itemNameInput, amountInput, categoryInput].forEach(el => el.classList.remove('invalid'));
}

/* ----------------------------------------------------------
   ADD TRANSACTION
   Creates a new transaction object and pushes it to state.
---------------------------------------------------------- */
function addTransaction(name, amount, category) {
  const transaction = {
    id: nextId++,
    name,
    amount,
    category,
  };
  transactions.push(transaction);
}

/* ----------------------------------------------------------
   DELETE TRANSACTION
   Removes the transaction with the given id from state.
---------------------------------------------------------- */
function deleteTransaction(id) {
  transactions = transactions.filter(t => t.id !== id);
}

/* ----------------------------------------------------------
   CALCULATE TOTAL BALANCE
   Sums all transaction amounts.
---------------------------------------------------------- */
function calculateTotal() {
  return transactions.reduce((sum, t) => sum + t.amount, 0);
}

/* ----------------------------------------------------------
   RENDER TOTAL BALANCE
   Formats the total as a dollar amount and updates the DOM.
---------------------------------------------------------- */
function renderBalance() {
  const total = calculateTotal();
  totalBalance.textContent = `$${total.toFixed(2)}`;
}

/* ----------------------------------------------------------
   RENDER TRANSACTION LIST
   Rebuilds the <ul> from the current transactions array.
---------------------------------------------------------- */
function renderTransactionList() {
  /* Remove all existing transaction items (keep emptyState li) */
  const existingItems = transactionList.querySelectorAll('.transaction-item');
  existingItems.forEach(item => item.remove());

  if (transactions.length === 0) {
    /* Show the empty state message */
    emptyState.style.display = 'block';
    return;
  }

  /* Hide the empty state message */
  emptyState.style.display = 'none';

  /* Build a list item for each transaction */
  transactions.forEach(t => {
    const li = document.createElement('li');
    li.className = `transaction-item category-${t.category.toLowerCase()}`;
    li.dataset.id = t.id;

    li.innerHTML = `
      <div class="transaction-info">
        <span class="transaction-name">${escapeHtml(t.name)}</span>
        <span class="transaction-category">${escapeHtml(t.category)}</span>
      </div>
      <span class="transaction-amount">$${t.amount.toFixed(2)}</span>
      <button
        class="btn-delete"
        aria-label="Delete transaction: ${escapeHtml(t.name)}"
        data-id="${t.id}"
      >✕</button>
    `;

    transactionList.appendChild(li);
  });
}

/* ----------------------------------------------------------
   RENDER CHART
   Builds category totals and updates (or creates) the pie chart.
---------------------------------------------------------- */
function renderChart() {
  if (transactions.length === 0) {
    /* Show placeholder, hide canvas */
    chartPlaceholder.style.display = 'flex';
    chartCanvas.style.display = 'none';

    /* Destroy existing chart instance if present */
    if (spendingChart) {
      spendingChart.destroy();
      spendingChart = null;
    }
    return;
  }

  /* Show canvas, hide placeholder */
  chartPlaceholder.style.display = 'none';
  chartCanvas.style.display = 'block';

  /* Aggregate amounts by category */
  const categoryTotals = {};
  transactions.forEach(t => {
    categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
  });

  const labels = Object.keys(categoryTotals);
  const data   = Object.values(categoryTotals);
  const colors = labels.map(label => CATEGORY_COLORS[label] || '#bdc3c7');

  if (spendingChart) {
    /* Update existing chart data without re-creating it */
    spendingChart.data.labels          = labels;
    spendingChart.data.datasets[0].data   = data;
    spendingChart.data.datasets[0].backgroundColor = colors;
    spendingChart.update();
  } else {
    /* Create the chart for the first time */
    spendingChart = new Chart(chartCanvas, {
      type: 'pie',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors,
          borderColor: '#fff',
          borderWidth: 2,
        }],
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              padding: 16,
              font: { size: 13 },
            },
          },
          tooltip: {
            callbacks: {
              /* Show dollar amount and percentage in tooltip */
              label(context) {
                const value = context.parsed;
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const pct   = ((value / total) * 100).toFixed(1);
                return ` $${value.toFixed(2)} (${pct}%)`;
              },
            },
          },
        },
      },
    });
  }
}

/* ----------------------------------------------------------
   REFRESH UI
   Single function that re-renders all dynamic parts of the UI.
   Call this after every state change.
---------------------------------------------------------- */
function refreshUI() {
  renderBalance();
  renderTransactionList();
  renderChart();
}

/* ----------------------------------------------------------
   ESCAPE HTML
   Prevents XSS when inserting user-supplied text into innerHTML.
---------------------------------------------------------- */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

/* ----------------------------------------------------------
   EVENT: Form Submit — Add Transaction
---------------------------------------------------------- */
form.addEventListener('submit', function (event) {
  event.preventDefault();
  clearError();

  /* Validate inputs */
  const errors = validateForm();
  if (errors.length > 0) {
    showError(errors);
    return;
  }

  /* Read values */
  const name     = itemNameInput.value.trim();
  const amount   = parseFloat(amountInput.value);
  const category = categoryInput.value;

  /* Add to state and refresh UI */
  addTransaction(name, amount, category);
  refreshUI();

  /* Reset the form fields */
  form.reset();
});

/* ----------------------------------------------------------
   EVENT: Click on Transaction List — Delete Transaction
   Uses event delegation so we only need one listener.
---------------------------------------------------------- */
transactionList.addEventListener('click', function (event) {
  const deleteBtn = event.target.closest('.btn-delete');
  if (!deleteBtn) return;

  const id = parseInt(deleteBtn.dataset.id, 10);
  deleteTransaction(id);
  refreshUI();
});

/* ----------------------------------------------------------
   INIT
   Run an initial render so the UI is in a clean state on load.
---------------------------------------------------------- */
refreshUI();
