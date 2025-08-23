// MCAS Hazard Detection Simulator - Phaser + Chart.js

let speed = 85; // initial speed
let distance = 150; // starting distance to obstacle
let braking = false;
let accelerating = false;
let chart; // Chart.js instance
let carVelocity = 0; // Car horizontal velocity
const CAR_SPEED = 5; // Speed of car movement left/right

class MCASScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MCASScene' });
  }

  preload() {
    this.load.image('road', 'assets/road.png');
    this.load.image('car', 'assets/car.png');
    this.load.image('obstacle', 'assets/obstacle.png');
  }

  create() {
    this.road = this.add.tileSprite(400, 300, 800, 600, 'road');
    this.car = this.add.sprite(400, 500, 'car').setScale(0.5);
    this.obstacle = this.add.sprite(400, 150, 'obstacle').setScale(0.4);

    // Keyboard controls
    this.cursors = this.input.keyboard.createCursorKeys();

    // Swipe controls for mobile
    let touchStartX = 0;
    this.input.on('pointerdown', (pointer) => {
      touchStartX = pointer.x;
    });

    this.input.on('pointerup', (pointer) => {
      const swipeDistance = pointer.x - touchStartX;
      const swipeThreshold = 50; // Minimum distance for a swipe

      if (Math.abs(swipeDistance) > swipeThreshold) {
        if (swipeDistance > 0) {
          // Swipe right
          carVelocity = CAR_SPEED;
        } else {
          // Swipe left
          carVelocity = -CAR_SPEED;
        }
        // Reset velocity after a short duration
        this.time.delayedCall(200, () => {
          carVelocity = 0;
        });
      }
    });

    // HUD update loop
    this.time.addEvent({
      delay: 100,
      loop: true,
      callback: () => {
        if (accelerating) speed = Math.min(speed + 1, 120);
        if (braking) speed = Math.max(speed - 2, 0);

        // distance decreases with speed
        distance -= speed * 0.05;
        if (distance < 20) distance = 20;

        let ttc = distance / (speed / 3.6);
        if (!isFinite(ttc)) ttc = 0;

        updateHUD(speed, ttc);
        updateLEDs(ttc);

        if (chart) {
          chart.data.labels.push('');
          chart.data.datasets[0].data.push(ttc);
          if (chart.data.labels.length > 20) {
            chart.data.labels.shift();
            chart.data.datasets[0].data.shift();
          }
          chart.update();
        }
      }
    });

    // Controls
    document.getElementById('speed-slider').addEventListener('input', (e) => {
      speed = parseInt(e.target.value);
    });

    document.getElementById('brake').addEventListener('mousedown', () => { braking = true; });
    document.getElementById('brake').addEventListener('mouseup', () => { braking = false; });

    document.getElementById('accelerate').addEventListener('mousedown', () => { accelerating = true; });
    document.getElementById('accelerate').addEventListener('mouseup', () => { accelerating = false; });

    document.getElementById('toggle-chart').addEventListener('click', toggleChart);
  }

  update() {
    this.road.tilePositionY -= speed * 0.2;

    // Handle keyboard input
    if (this.cursors.left.isDown) {
      carVelocity = -CAR_SPEED;
    } else if (this.cursors.right.isDown) {
      carVelocity = CAR_SPEED;
    } else if (!this.input.activePointer.isDown) { // Only reset if no touch input
      carVelocity *= 0.9; // Smooth deceleration
    }

    // Update car position
    this.car.x += carVelocity;

    // Keep car within bounds
    this.car.x = Phaser.Math.Clamp(this.car.x, 50, 750);
  }
}

// HUD Functions
function updateHUD(speed, ttc) {
  document.getElementById('speed-value').textContent = speed.toFixed(0);
  document.getElementById('ttc-value').textContent = ttc.toFixed(1);
}

function updateLEDs(ttc) {
  const green = document.getElementById('led-green');
  const yellow = document.getElementById('led-yellow');
  const red = document.getElementById('led-red');

  green.classList.add('inactive');
  yellow.classList.add('inactive');
  red.classList.add('inactive');

  if (ttc > 4) {
    green.classList.remove('inactive');
  } else if (ttc > 2) {
    yellow.classList.remove('inactive');
  } else {
    red.classList.remove('inactive');
  }
}

// Chart.js
function toggleChart() {
  const chartDiv = document.getElementById('ttc-chart');
  chartDiv.style.display = chartDiv.style.display === 'none' ? 'block' : 'none';

  if (!chart) {
    const ctx = document.getElementById('ttcCanvas').getContext('2d');
    chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [{
          label: 'Time-to-Collision (s)',
          data: [],
          borderWidth: 2,
          fill: false,
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: { beginAtZero: true }
        }
      }
    });
  }
}

// Phaser config
const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'game-container',
  scene: [MCASScene]
};

new Phaser.Game(config);
