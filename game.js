// Phaser game configuration
const config = {
    type: Phaser.AUTO,
    width: 360,
    height: 640,
    parent: 'game-container',
    scene: { preload, create, update },
    physics: { default: 'arcade', arcade: { debug: false } }
};

let game = new Phaser.Game(config);

let playerCar, obstacles, speed, ttcData;

function preload() {
    // Load game assets (replace with your asset paths)
    this.load.image('car', 'assets/car.png');
    this.load.image('obstacle', 'assets/obstacle.png');
}

function create() {
    // Initialize game objects
    playerCar = this.physics.add.sprite(180, 540, 'car').setScale(0.5);
    playerCar.setCollideWorldBounds(true);

    obstacles = this.physics.add.group({
        key: 'obstacle',
        repeat: 2,
        setXY: { x: 100, y: -100, stepX: 80, stepY: -150 }
    });

    // Initialize HUD and controls
    const speedSlider = document.getElementById('speed-slider');
    const speedValue = document.getElementById('speed-value');
    const brakeButton = document.getElementById('brake');
    const accelerateButton = document.getElementById('accelerate');
    const toggleChartButton = document.getElementById('toggle-chart');
    const ttcChart = document.getElementById('ttc-chart');
    const ttcValue = document.getElementById('ttc-value');
    const ledGreen = document.getElementById('led-green');
    const ledYellow = document.getElementById('led-yellow');
    const ledRed = document.getElementById('led-red');

    speed = parseInt(speedSlider.value);
    ttcData = [];

    // Event listeners for controls
    speedSlider.addEventListener('input', () => {
        speed = parseInt(speedSlider.value);
        speedValue.textContent = speed;
        playerCar.setVelocityY(-speed * 3); // Rough km/h to pixels/s conversion
    });

    brakeButton.addEventListener('click', () => {
        speed = Math.max(0, speed - 10);
        speedSlider.value = speed;
        speedValue.textContent = speed;
        playerCar.setVelocityY(-speed * 3);
    });

    accelerateButton.addEventListener('click', () => {
        speed = Math.min(120, speed + 10);
        speedSlider.value = speed;
        speedValue.textContent = speed;
        playerCar.setVelocityY(-speed * 3);
    });

    toggleChartButton.addEventListener('click', () => {
        ttcChart.style.display = ttcChart.style.display === 'none' ? 'block' : 'none';
    });

    // Initialize TTC chart
    const ctx = document.createElement('canvas');
    ttcChart.appendChild(ctx);
    const chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: Array(6).fill().map((_, i) => `${i}s`),
            datasets: [{
                label: 'TTC (s)',
                data: ttcData,
                borderColor: '#64ffda',
                fill: false
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    // Update chart data
    this.time.addEvent({
        delay: 1000,
        callback: () => {
            ttcData.push(parseFloat(ttcValue.textContent));
            if (ttcData.length > 6) ttcData.shift();
            chart.data.datasets[0].data = ttcData;
            chart.update();
        },
        loop: true
    });

    // Collision detection
    this.physics.add.overlap(playerCar, obstacles, (car, obstacle) => {
        // Handle collision (e.g., game over or warning)
        ledRed.classList.add('blink');
        this.time.delayedCall(2000, () => ledRed.classList.remove('blink'));
    });
}

function update() {
    // Move obstacles
    obstacles.children.iterate(obstacle => {
        obstacle.y += 2; // Move obstacles down
        if (obstacle.y > 640) {
            obstacle.y = -50;
            obstacle.x = Phaser.Math.Between(50, 310);
        }
    });

    // Calculate TTC (time-to-collision)
    let closestObstacle = null;
    let minDistance = Infinity;
    obstacles.children.iterate(obstacle => {
        const distance = playerCar.y - obstacle.y;
        if (distance > 0 && distance < minDistance) {
            minDistance = distance;
            closestObstacle = obstacle;
        }
    });

    const ttc = minDistance / (speed / 3.6 || 1); // Avoid division by zero
    document.getElementById('ttc-value').textContent = ttc.toFixed(1);

    // Update LED indicators based on TTC
    document.getElementById('led-green').classList.toggle('inactive', ttc < 5);
    document.getElementById('led-yellow').classList.toggle('inactive', ttc >= 5 || ttc < 3);
    document.getElementById('led-red').classList.toggle('inactive', ttc >= 3);
}
