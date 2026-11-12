const rates = {
  USD: 1.0,
  EUR: 0.92,
  GBP: 0.79,
  JPY: 155.2,
  CAD: 1.38
};

const amountInput = document.getElementById('amount-input');
const fromCurrency = document.getElementById('from-currency');
const toCurrency = document.getElementById('to-currency');
const swapBtn = document.getElementById('swap-btn');
const rateDisplay = document.getElementById('rate-display');
const resultDisplay = document.getElementById('result-display');
const historyList = document.getElementById('history-list');

const STORAGE_KEY = 'currency_converter_history_v1';

function calculateConversion() {
  const amount = parseFloat(amountInput.value) || 0;
  const from = fromCurrency.value;
  const to = toCurrency.value;

  const rate = (rates[to] / rates[from]);
  const result = (amount * rate).toFixed(2);

  rateDisplay.textContent = `1 ${from} = ${rate.toFixed(4)} ${to}`;
  resultDisplay.textContent = `${result} ${to}`;

  if (amount > 0) {
    saveToHistory(`${amount} ${from} → ${result} ${to}`);
  }
}

function saveToHistory(entry) {
  try {
    const history = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    const updated = [entry, ...history.filter(h => h !== entry)].slice(0, 5);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    renderHistory();
  } catch (e) {
    console.warn('LocalStorage error:', e);
  }
}

function renderHistory() {
  try {
    const history = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    historyList.innerHTML = '';
    history.forEach(item => {
      const li = document.createElement('li');
      li.textContent = item;
      historyList.appendChild(li);
    });
  } catch (e) {
    console.warn('Failed to render history:', e);
  }
}

function swapCurrencies() {
  const temp = fromCurrency.value;
  fromCurrency.value = toCurrency.value;
  toCurrency.value = temp;
  calculateConversion();
}

amountInput.addEventListener('input', calculateConversion);
fromCurrency.addEventListener('change', calculateConversion);
toCurrency.addEventListener('change', calculateConversion);
swapBtn.addEventListener('click', swapCurrencies);

// Initial execution
calculateConversion();
renderHistory();
