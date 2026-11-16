const board = document.getElementById('game-board');
const cells = document.querySelectorAll('.cell');
const turnIndicator = document.getElementById('turn-indicator');
const statusText = document.getElementById('game-status');
const restartBtn = document.getElementById('restart-btn');
const xWinsEl = document.getElementById('x-wins');
const oWinsEl = document.getElementById('o-wins');
const tiesCountEl = document.getElementById('ties-count');

const STORAGE_KEY = 'tictactoe_stats_v1';

let currentPlayer = 'X';
let boardState = ['', '', '', '', '', '', '', '', ''];
let isGameActive = true;
let stats = { x: 0, o: 0, ties: 0 };

const winningConditions = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
  [0, 4, 8], [2, 4, 6]             // diagonals
];

function loadStats() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      stats = JSON.parse(saved);
      xWinsEl.textContent = stats.x;
      oWinsEl.textContent = stats.o;
      tiesCountEl.textContent = stats.ties;
    }
  } catch (e) {
    console.warn('Failed to load stats:', e);
  }
}

function saveStats() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch (e) {
    console.warn('Failed to save stats:', e);
  }
}

function handleCellClick(e) {
  const cell = e.target;
  const index = parseInt(cell.dataset.index);

  if (boardState[index] !== '' || !isGameActive) return;

  boardState[index] = currentPlayer;
  cell.textContent = currentPlayer;
  cell.classList.add(currentPlayer.toLowerCase());

  checkWinner();
}

function checkWinner() {
  let roundWon = false;
  let winningLine = [];

  for (let i = 0; i < winningConditions.length; i++) {
    const [a, b, c] = winningConditions[i];
    if (boardState[a] && boardState[a] === boardState[b] && boardState[a] === boardState[c]) {
      roundWon = true;
      winningLine = [a, b, c];
      break;
    }
  }

  if (roundWon) {
    statusText.textContent = `Player ${currentPlayer} Wins!`;
    winningLine.forEach(idx => cells[idx].classList.add('win'));
    isGameActive = false;
    if (currentPlayer === 'X') stats.x++;
    else stats.o++;
    updateStatsDisplay();
    saveStats();
    return;
  }

  if (!boardState.includes('')) {
    statusText.textContent = 'Game Ended in a Draw!';
    isGameActive = false;
    stats.ties++;
    updateStatsDisplay();
    saveStats();
    return;
  }

  currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
  turnIndicator.textContent = `Player ${currentPlayer}'s Turn`;
  turnIndicator.style.color = currentPlayer === 'X' ? 'var(--color-x)' : 'var(--color-o)';
}

function updateStatsDisplay() {
  xWinsEl.textContent = stats.x;
  oWinsEl.textContent = stats.o;
  tiesCountEl.textContent = stats.ties;
}

function restartGame() {
  currentPlayer = 'X';
  boardState = ['', '', '', '', '', '', '', '', ''];
  isGameActive = true;
  statusText.textContent = '';
  turnIndicator.textContent = "Player X's Turn";
  turnIndicator.style.color = 'var(--color-x)';

  cells.forEach(cell => {
    cell.textContent = '';
    cell.className = 'cell';
  });
}

cells.forEach(cell => cell.addEventListener('click', handleCellClick));
restartBtn.addEventListener('click', restartGame);
loadStats();
