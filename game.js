// MCAS Hazard Detection Simulator - Phaser + Chart.js

let speed = 85; // initial speed
let distance = 150; // starting distance to closest obstacle
let braking = false;
let accelerating = false;
let chart; // Chart.js instance
let carVelocity = 0; // Car horizontal velocity
const CAR_SPEED = 5; // Speed of car movement left/right
const OBSTACLE_TYPES = ['truck', 'car1', 'car2', 'van', 'suv']; // 5 obstacle types

// Define custom scales for each obstacle type
const OBSTACLE_SCALES = {
  truck: 0.3, // Larger but scaled down more
  car1: 0.25,
  car2: 0.35,
  van: 0.25,
  suv: 0.25
};

class MCASScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MCASScene' });
  }

  preload() {
    // Add error handling for asset loading
    this.load.on('filecomplete', (key) => {
      console.log(`Loaded asset: ${key}`);
    });
    this.load.on('loaderror', (file) => {
      console.error(`Failed to load asset: ${file.key}`);
    });

    this.load.image('road', 'assets/road.png');
    this.load.image('car', 'assets/car.png');
    this.load.image('truck', 'assets/truck.png'); // Malfunctioned truck
    this.load.image('car1', 'assets/car1.png'); // Different car type 1
    this.load.image('car2', 'assets/car2.png'); // Different car type 2
    this.load.image('van', 'assets/van.png'); // Van
    this.load.image('suv', 'assets/suv.png'); // SUV
  }

  create() {
    // Check if game container exists
    if (!document.getElementById('game-container')) {
      console.error('Game container div not found!');
      return;
    }

    this.road = this.add.tileSprite(400, 300, 800, 600, 'road');
    this.car = this.add.sprite(400, 500, 'car').setScale(0.5);
    this.obstacles = this.add.group(); // Group to manage multiple obstacles

    // Keyboard controls
    this.cursors = this.input.keyboard.createCursorKeys();

    // Swipe controls for mobile
    let touchStartX = 0;
    this.input.on('pointerdown', (pointer) => {
      touchStartX = pointer.x;
    });

    this.input.on('pointerup', (pointer) => {
      const swipeDistance = pointer.x - touchStartX;
      const swipeThreshold = 50;

      if (Math.abs(swipeDistance) > swipeThreshold) {
        carVelocity = swipeDistance > 0 ? CAR_SPEED : -CAR_SPEED;
        this.time.delayedCall(200, () => {
          carVelocity = 0;
        });
      }
    });

    // Spawn obstacles periodically
    this.time.addEvent({
      delay: 2000, // Spawn every 2 seconds
      loop: true,
      callback: () => {
        this.spawnObstacle();
      }
    });

    // HUD update loop
    this.time.addEvent({
      delay: 100,
      loop: true,
      callback: () => {
        if (accelerating) speed = Math.min(speed + 1, 120);
        if (braking) speed = Math.max(speed - 2, 0);

        // Find closest obstacle for distance calculation
        distance = this.getClosestObstacleDistance();
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
    const speedSlider = document.getElementById('speed-slider');
    const brakeButton = document.getElementById('brake');
    const accelerateButton = document.getElementById('accelerate');
    const toggleChartButton = document.getElementById('toggle-chart');

    if (speedSlider) {
      speedSlider.addEventListener('input', (e) => {
        speed = parseInt(e.target.value);
      });
    } else {
      console.error('Speed slider not found in DOM');
    }

    if (brakeButton) {
      brakeButton.addEventListener('mousedown', () => { braking = true; });
      brakeButton.addEventListener('mouseup', () => { braking = false; });
    } else {
      console.error('Brake button not found in DOM');
    }

    if (accelerateButton) {
      accelerateButton.addEventListener('mousedown', () => { accelerating = true; });
      accelerateButton.addEventListener('mouseup', () => { accelerating = false; });
    } else {
      console.error('Accelerate button not found in DOM');
    }

    if (toggleChartButton) {
      toggleChartButton.addEventListener('click', toggleChart);
    } else {
      console.error('Toggle chart button not found in DOM');
    }
  }

  spawnObstacle() {
    const type = Phaser.Math.RND.pick(OBSTACLE_TYPES);
    let xPosition;
    let velocityY = speed * 0.2; // Default downward movement

    // Special case for malfunctioned truck
    if (type === 'truck' && Phaser.Math.Between(0, 100) < 20) { // 20% chance to be stopped
      xPosition = 150; // Left side
      velocityY = 0; // Stopped
    } else {
      xPosition = Phaser.Math.Between(100, 700); // Random lane position
    }

    const obstacle = this.obstacles.create(xPosition, -50, type).setScale(OBSTACLE_SCALES[type]);
    obstacle.setData('velocityY', velocityY);

    // Adjust position to ensure obstacle stays within bounds
    obstacle.x = Phaser.Math.Clamp(obstacle.x, 50 + obstacle.displayWidth / 2, 750 - obstacle.displayWidth / 2);
  }

  getClosestObstacleDistance() {
    let minDistance = 1000;
    this.obstacles.getChildren().forEach(obstacle => {
      const dist = obstacle.y - this.car.y;
      if (dist > 0 && dist < minDistance) {
        minDistance = dist;
      }
    });
    return minDistance;
  }

  update() {
    this.road.tilePositionY -= speed * 0.2;

    // Handle keyboard input
    if (this.cursors.left.isDown) {
      carVelocity = -CAR_SPEED;
    } else if (this.cursors.right.isDown) {
      carVelocity = CAR_SPEED;
    } else if (!this.input.activePointer.isDown) {
      carVelocity *= 0.9; // Smooth deceleration
    }

    // Update car position
    this.car.x += carVelocity;
    this.car.x = Phaser.Math.Clamp(this.car.x, 50, 750);

    // Update obstacles
    this.obstacles.getChildren().forEach(obstacle => {
      obstacle.y += obstacle.getData('velocityY');
      // Remove obstacles that go off-screen
      if (obstacle.y > 650) {
        obstacle.destroy();
      }
    });
  }
}

// HUD Functions
function updateHUD(speed, ttc) {
  const speedValue = document.getElementById('speed-value');
  const ttcValue = document.getElementById('ttc-value');
  if (speedValue) speedValue.textContent = speed.toFixed(0);
  else console.error('Speed value element not found');
  if (ttcValue) ttcValue.textContent = ttc.toFixed(1);
  else console.error('TTC value element not found');
}

function updateLEDs(ttc) {
  const green = document.getElementById('led-green');
  const yellow = document.getElementById('led-yellow');
  const red = document.getElementById('led-red');

  if (!green || !yellow || !red) {
    console.error('LED elements not found');
    return;
  }

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
  if (!chartDiv) {
    console.error('TTC chart div not found');
    return;
  }
  chartDiv.style.display = chartDiv.style.display === 'none' ? 'block' : 'none';

  if (!chart) {
    const canvas = document.getElementById('ttcCanvas');
    if (!canvas) {
      console.error('TTC canvas not found');
      return;
    }
    const ctx = canvas.getContext('2d');
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

try {
  new Phaser.Game(config);
} catch (error) {
  console.error('Failed to initialize Phaser game:', error);
}
