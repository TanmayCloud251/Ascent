const choices = ['rock', 'paper', 'scissors'];
const icons = {
  rock: '✊',
  paper: '✋',
  scissors: '✌️'
};

const playerScoreEl = document.getElementById('player-score');
const computerScoreEl = document.getElementById('computer-score');
const playerHandEl = document.getElementById('player-hand');
const computerHandEl = document.getElementById('computer-hand');
const roundResultEl = document.getElementById('round-result');
const resetBtn = document.getElementById('reset-btn');
const choiceButtons = document.querySelectorAll('.choice-btn');

const STORAGE_KEY = 'rps_game_scores_v1';

let scores = { player: 0, computer: 0 };

function loadScores() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      scores = JSON.parse(saved);
      playerScoreEl.textContent = scores.player;
      computerScoreEl.textContent = scores.computer;
    }
  } catch (e) {
    console.warn('Failed to load scores:', e);
  }
}

function saveScores() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scores));
  } catch (e) {
    console.warn('Failed to save scores:', e);
  }
}

function getComputerChoice() {
  const randomIndex = Math.floor(Math.random() * choices.length);
  return choices[randomIndex];
}

function playRound(playerChoice) {
  const computerChoice = getComputerChoice();

  playerHandEl.textContent = icons[playerChoice];
  computerHandEl.textContent = icons[computerChoice];

  if (playerChoice === computerChoice) {
    roundResultEl.textContent = "It's a tie!";
    roundResultEl.className = 'round-result';
  } else if (
    (playerChoice === 'rock' && computerChoice === 'scissors') ||
    (playerChoice === 'paper' && computerChoice === 'rock') ||
    (playerChoice === 'scissors' && computerChoice === 'paper')
  ) {
    scores.player++;
    playerScoreEl.textContent = scores.player;
    roundResultEl.textContent = `You win! ${playerChoice} beats ${computerChoice}.`;
    roundResultEl.className = 'round-result win';
    saveScores();
  } else {
    scores.computer++;
    computerScoreEl.textContent = scores.computer;
    roundResultEl.textContent = `You lose! ${computerChoice} beats ${playerChoice}.`;
    roundResultEl.className = 'round-result lose';
    saveScores();
  }
}

function resetGame() {
  scores = { player: 0, computer: 0 };
  playerScoreEl.textContent = '0';
  computerScoreEl.textContent = '0';
  playerHandEl.textContent = '❓';
  computerHandEl.textContent = '❓';
  roundResultEl.textContent = 'Choose your move to start!';
  roundResultEl.className = 'round-result';
  saveScores();
}

choiceButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const choice = btn.dataset.choice;
    playRound(choice);
  });
});

resetBtn.addEventListener('click', resetGame);
loadScores();
