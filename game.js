const config = {
    type: Phaser.AUTO,
    width: 400,
    height: 600,
    physics: {
        default: 'arcade',
        arcade: {
            debug: false,
        }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

const game = new Phaser.Game(config);

let car;
let cursors;
let obstacles;
let lanes = [100, 200, 300]; // three lane x-positions
let speed = 200;

function preload() {
    this.load.image('road', 'assets/road.png');
    this.load.image('car', 'assets/car.png');
    this.load.image('obstacle', 'assets/obstacle.png');
}

function create() {
    // Road background
    this.add.image(200, 300, 'road').setDisplaySize(400, 600);

    // Car
    car = this.physics.add.sprite(200, 500, 'car');
    car.setCollideWorldBounds(true);
    car.setScale(0.5);

    // Obstacles group
    obstacles = this.physics.add.group();

    // Timer to add obstacles
    this.time.addEvent({
        delay: 1500,
        callback: addObstacle,
        callbackScope: this,
        loop: true
    });

    // Controls
    cursors = this.input.keyboard.createCursorKeys();

    // Collision check
    this.physics.add.overlap(car, obstacles, hitObstacle, null, this);
}

function update() {
    car.setVelocityX(0);
    car.setVelocityY(0);

    if (cursors.left.isDown) {
        car.setVelocityX(-speed);
    }
    if (cursors.right.isDown) {
        car.setVelocityX(speed);
    }
    if (cursors.up.isDown) {
        car.setVelocityY(-speed);
    }
    if (cursors.down.isDown) {
        car.setVelocityY(speed / 2); // braking slower
    }

    // Remove obstacles that go off screen
    obstacles.children.iterate(function (child) {
        if (child.y > 650) {
            child.destroy();
        }
    });
}

function addObstacle() {
    // Pick random lane
    let laneX = Phaser.Utils.Array.GetRandom(lanes);

    let obs = obstacles.create(laneX, -50, 'obstacle');
    obs.setVelocityY(150);
    obs.setScale(0.5);
}

function hitObstacle(car, obs) {
    this.physics.pause();
    car.setTint(0xff0000);
    alert("Game Over!");
}
