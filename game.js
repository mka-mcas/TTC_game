let car;
let cursors;
let obstacles;
let lanes = [200, 400, 600]; // X positions of 3 lanes
let currentLane = 1; // Start in middle lane
let speed = 2; // forward/back speed

class MyGame extends Phaser.Scene {
    constructor() {
        super();
    }

    preload() {
        // Load assets
        this.load.image('car', 'assets/car.png');          // player vehicle
        this.load.image('obstacle', 'assets/obstacle.png'); // obstacles
        this.load.image('road', 'assets/road.png');        // optional background
    }

    create() {
        // Background road (optional, if you have one)
        if (this.textures.exists('road')) {
            this.add.image(400, 300, 'road').setDisplaySize(800, 600);
        } else {
            this.cameras.main.setBackgroundColor('#2c3e50'); // dark road color
        }

        // Player car
        car = this.physics.add.sprite(lanes[currentLane], 500, 'car');
        car.setCollideWorldBounds(true);
        car.setScale(0.5); // adjust to fit lane

        // Keyboard input
        cursors = this.input.keyboard.createCursorKeys();

        // Obstacles group
        obstacles = this.physics.add.group();

        // Spawn obstacle every 1.5 seconds
        this.time.addEvent({
            delay: 1500,
            callback: () => {
                let laneIndex = Phaser.Math.Between(0, lanes.length - 1);
                let obstacle = obstacles.create(lanes[laneIndex], -50, 'obstacle');
                obstacle.setVelocityY(200); // falling speed
                obstacle.setScale(0.5);
            },
            loop: true
        });

        // Collision detection
        this.physics.add.collider(car, obstacles, this.handleCollision, null, this);
    }

    update() {
        // Lane switching
        if (Phaser.Input.Keyboard.JustDown(cursors.left) && currentLane > 0) {
            currentLane--;
            car.x = lanes[currentLane];
        }
        if (Phaser.Input.Keyboard.JustDown(cursors.right) && currentLane < lanes.length - 1) {
            currentLane++;
            car.x = lanes[currentLane];
        }

        // Speed control (forward/back)
        if (cursors.up.isDown) {
            car.y -= speed; // move up
        }
        if (cursors.down.isDown) {
            car.y += speed; // move down
        }

        // Keep car inside screen vertically
        if (car.y < 100) car.y = 100;
        if (car.y > 550) car.y = 550;
    }

    handleCollision(car, obstacle) {
        this.physics.pause();
        car.setTint(0xff0000);
        console.log("💥 Collision detected!");
    }
}

const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    physics: { default: 'arcade' },
    scene: MyGame
};

const game = new Phaser.Game(config);
