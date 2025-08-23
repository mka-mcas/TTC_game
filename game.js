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
    this.load.image('road', 'assets/road.png');
    this.load.image('car', 'assets/car.png');
    this.load.image('truck', 'assets/truck.png'); // Malfunctioned truck
    this.load.image('car1', 'assets/car1.png'); // Different car type 1
    this.load.image('car2', 'assets/car2.png'); // Different car type 2
    this.load.image('van', 'assets/van.png'); // Van
    this.load.image('suv', 'assets/suv.png'); // SUV
  }

  create() {
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
    document.getElementById('speed-slider').addEventListener('input', (e) => {
      speed = parseInt(e.target.value);
    });

    document.getElementById('


