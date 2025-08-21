const config = {
    type: Phaser.AUTO,
    parent: 'game-canvas',
    width: 360,
    height: 640,
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

const game = new Phaser.Game(config);
let bike, truck, road;
let cursors;
let speed = 85;
let ttc = 6.8;
let recordedData = [];
let isPlaying = false;
let isReplaying = false;
let lastUpdateTime = 0;
let ledGreen, ledYellow, ledRed;
let alertSound;

function preload() {
    // Create colored placeholders programmatically
    createPlaceholderTexture(this, 'road', 0x2a4b8d);
    createPlaceholderTexture(this, 'bike', 0xff5555);
    createPlaceholderTexture(this, 'truck', 0x44aa44);
    
    // Load LED assets
    this.load.image('led_green', 'assets/led_green.png');
    this.load.image('led_yellow', 'assets/led_yellow.png');
    this.load.image('led_red', 'assets/led_red.png');
    
    // Create silent audio placeholder
    this.load.audio('alert', [
        'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAAAA'
    ]);
}

function createPlaceholderTexture(scene, key, color) {
    // Create a temporary canvas
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    
    // Draw colored rectangle
    ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
    ctx.fillRect(0, 0, 128, 128);
    
    // Add key text
    ctx.fillStyle = '#ffffff';
    ctx.font = '20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(key, 64, 64);
    
    // Add to Phaser
    scene.textures.addBase64(key, canvas.toDataURL());
}

function create() {
    console.log("Creating game...");
    
    // Create road background
    road = this.add.tileSprite(180, 320, 360, 640, 'road');
    
    // Create bike
    bike = this.physics.add.sprite(180, 500, 'bike').setScale(0.4);
    bike.setCollideWorldBounds(true);
    
    // Create truck
    truck = this.physics.add.sprite(180, 100, 'truck').setScale(0.3);
    
    // Set up controls
    cursors = this.input.keyboard.createCursorKeys();
    
    // Set up LED elements
    ledGreen = document.getElementById('led-green');
    ledYellow = document.getElementById('led-yellow');
    ledRed = document.getElementById('led-red');
    
    // Set up sound
    alertSound = this.sound.add('alert');
    
    // Set up event listeners
    document.getElementById('speed-slider').addEventListener('input', function(e) {
        speed = parseInt(e.target.value);
        document.getElementById('speed-value').textContent = speed;
    });
    
    document.getElementById('play-btn').addEventListener('click', startSimulation);
    document.getElementById('stop-btn').addEventListener('click', stopSimulation);
    document.getElementById('replay-btn').addEventListener('click', replaySimulation);
    document.getElementById('export-btn').addEventListener('click', exportData);
    
    // Initialize TTC chart
    initTTCChart();
    
    // Add debug text to verify assets
    this.add.text(10, 10, 'MCAS Simulation Running', { 
        font: '16px Arial', 
        fill: '#ffffff' 
    });
}

function update(time, delta) {
    if (!isPlaying) return;
    
    const currentTime = Date.now();
    
    // Only update physics every 100ms for performance
    if (currentTime - lastUpdateTime > 100) {
        lastUpdateTime = currentTime;
        
        // Move truck toward bike
        const direction = new Phaser.Math.Vector2(
            bike.x - truck.x,
            bike.y - truck.y
        ).normalize();
        
        const speedInPixels = speed * 0.1;
        truck.x += direction.x * speedInPixels * (delta / 1000);
        truck.y += direction.y * speedInPixels * (delta / 1000);
        
        // Calculate TTC
        const distance = Phaser.Math.Distance.Between(bike.x, bike.y, truck.x, truck.y);
        ttc = distance / (speed * 0.2778); // Convert km/h to m/s
        
        // Update TTC display
        document.getElementById('ttc-value').textContent = ttc.toFixed(1);
        
        // Update LEDs based on TTC
        updateLEDs();
        
        // Record data
        if (!isReplaying) {
            recordedData.push({
                time: currentTime,
                speed: speed,
                ttc: ttc,
                bikeX: bike.x,
                bikeY: bike.y,
                truckX: truck.x,
                truckY: truck.y
            });
            updateTTCChart();
        }
        
        // Check for collision
        if (Phaser.Math.Distance.Between(bike.x, bike.y, truck.x, truck.y) < 50) {
            handleCollision();
        }
    }
    
    // Handle bike controls
    if (cursors.left.isDown) {
        bike.x -= 4;
    } else if (cursors.right.isDown) {
        bike.x += 4;
    }
    
    if (cursors.up.isDown) {
        bike.y -= 4;
    } else if (cursors.down.isDown) {
        bike.y += 4;
    }
}

// ... rest of the functions (updateLEDs, startSimulation, etc.) remain the same as previous version ...