// Get DOM Elements
const gameOverModal = document.getElementById('game-over-modal');
const restartGameBtn = document.getElementById('restart-game-btn');
const scoreDisplay = document.getElementById('score-display');
const finalScoreDisplay = document.getElementById('final-score');
const gameOverTitle = document.getElementById('game-over-title'); // For player name
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game Over Image display
const gameOverDisplayImage = document.getElementById('game-over-display-image');

// --- Custom Assets (from source.js) ---
let birdImg = new Image();
let pipeImg = new Image();
let gameOverImg = new Image();
let backgroundMusic = new Audio();
let crashSound = new Audio();

// --- Game Variables ---
let bird, pipes, score, gameRunning, gameOver, frameCount, animationFrameId;
let particles = []; // For feathers
let clouds = []; // For background clouds
let playerName = sessionStorage.getItem('playerName') || 'Player'; // Get name

// Virtual resolution (game logic runs in this coordinate space)
const VIRTUAL_WIDTH = 400;
const VIRTUAL_HEIGHT = 600;

// Canvas scaling to fit viewport while preserving aspect ratio
let SCALE = 1;
let OFFSET_X = 0;
let OFFSET_Y = 0;

// --- Game Constants (Easier Level) ---
const BIRD_X = 50;
// Reduced bird size for better fit on small screens
const BIRD_WIDTH = 28;
const BIRD_HEIGHT = 21;
const GRAVITY = 0.3; // Slower fall
const FLAP_STRENGTH = -7.5;
const PIPE_WIDTH = 48; // narrower pipes for less visual bleed
// spawnTimer provides stable spacing between pipe spawns (frames)
let spawnTimer = 0;
const PIPE_GAP = 200; // Bigger gap
const PIPE_SPEED = 1.8; // Slower pipes
// Number of frames between new pipe spawns (larger = more horizontal space)
const PIPE_INTERVAL = 160;

// Resize canvas to viewport and compute transform scale/offset
function resizeCanvas() {
    // Fullscreen canvas in device pixels
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Compute scale to fit virtual resolution inside actual canvas
    SCALE = Math.min(canvas.width / VIRTUAL_WIDTH, canvas.height / VIRTUAL_HEIGHT);

    // Center the virtual viewport inside the canvas
    OFFSET_X = (canvas.width - VIRTUAL_WIDTH * SCALE) / 2;
    OFFSET_Y = (canvas.height - VIRTUAL_HEIGHT * SCALE) / 2;
}

// Ensure canvas resizes with the window
window.addEventListener('resize', () => {
    resizeCanvas();
});

// --- Asset Loading Logic ---
function loadAssets() {
    // Show a loading message
    ctx.fillStyle = '#70c5ce';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
    ctx.font = "20px 'Press Start 2P'";
    ctx.textAlign = 'center';
    ctx.fillText('Loading Assets...', canvas.width / 2, canvas.height / 2);

    // This array maps our new objects to the URLs in source.js
    const assetsToLoad = [
        { obj: birdImg, src: gameAssets.birdImage, type: 'image' },
        { obj: pipeImg, src: gameAssets.pipeImage, type: 'image' },
        { obj: gameOverImg, src: gameAssets.gameOverImage, type: 'image' },
        { obj: backgroundMusic, src: gameAssets.musicSound, type: 'audio' },
        { obj: crashSound, src: gameAssets.crashSound, type: 'audio' }
    ];

    const promises = assetsToLoad.map(asset => {
        return new Promise((resolve, reject) => {
            // Set up load/error handlers
            if (asset.type === 'image') {
                asset.obj.onload = () => resolve();
            } else if (asset.type === 'audio') {
                asset.obj.oncanplaythrough = () => resolve();
                asset.obj.onerror = () => {
                    console.warn(`Could not load audio: ${asset.src}`);
                    resolve(); // Resolve anyway so game doesn't break
                };
                if (asset.src.includes('your-site.com')) {
                    console.warn(`Placeholder audio URL detected: ${asset.src}`);
                    resolve(); // Don't try to load placeholder
                    return;
                }
                if (asset.src === gameAssets.musicSound) {
                    asset.obj.loop = true;
                }
            }
            asset.obj.onerror = () => {
                console.error(`Failed to load asset: ${asset.src}`);
                reject(new Error(`Failed to load ${asset.src}`));
            };
            
            // Set the source to start loading
            // For audio, don't block the full asset loading; allow game to start immediately
            try {
                asset.obj.src = asset.src;
            } catch (e) {
                console.warn('Failed to assign src for', asset.src, e);
                resolve();
            }
        });
    });

    return Promise.all(promises);
}

// --- Game Functions ---

function startGame() {
    // Reset game state
    bird = {
        x: BIRD_X,
        y: VIRTUAL_HEIGHT / 2 - BIRD_HEIGHT / 2,
        width: BIRD_WIDTH,
        height: BIRD_HEIGHT,
        velocity: 0
    };
    pipes = [];
    particles = []; // Clear feathers
    clouds = []; // Clear clouds
    score = 0;
    gameRunning = true;
    gameOver = false;
    frameCount = 0;
    spawnTimer = 0;
    
    scoreDisplay.innerText = score;
    
    // Hide game over modal if it's open
    gameOverModal.classList.add('hidden');

    // Add initial clouds
    if (clouds.length === 0) {
        for(let i = 0; i < 5; i++) {
            generateCloud(true); // true = start at random x
        }
    }

    // Create a few initial pipes so the player doesn't wait for the first one.
    // Pipes are spaced using the spawn interval and pipe speed so they feel consistent.
    const initialPipes = 3;
    for (let i = 0; i < initialPipes; i++) {
        const spacing = PIPE_INTERVAL * PIPE_SPEED; // approximate horizontal distance in virtual coords
        const xPos = VIRTUAL_WIDTH + i * spacing + 50; // offset a bit so first pipe isn't too close
        generatePipe(xPos);
    }

    // Play background music
    backgroundMusic.currentTime = 0;
    backgroundMusic.play().catch(e => console.warn("Music play failed. User may need to interact first."));

    // Start game loop
    gameLoop();
}

function endGame() {
    gameRunning = false;
    gameOver = true;
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }
    
    backgroundMusic.pause();
    crashSound.currentTime = 0; 
    crashSound.play().catch(e => console.warn("Crash sound failed."));
    
    // Set final score and show name
    finalScoreDisplay.innerText = score;
    gameOverTitle.innerText = `Game Over, ${playerName}!`; // Show name

    // Prefer the preloaded image, but fall back to the asset URL so the image
    // can still be shown if assets are still loading in background.
    if (gameOverImg && gameOverImg.complete && gameOverImg.naturalWidth > 0) {
        gameOverDisplayImage.src = gameOverImg.src;
        gameOverDisplayImage.classList.remove('hidden');
    } else if (gameAssets && gameAssets.gameOverImage) {
        gameOverDisplayImage.src = gameAssets.gameOverImage; // fallback to URL
        gameOverDisplayImage.classList.remove('hidden');
    } else {
        gameOverDisplayImage.classList.add('hidden');
    }
    
    gameOverModal.classList.remove('hidden');
}

function flap() {
    if (gameRunning) {
        bird.velocity = FLAP_STRENGTH;
        createFeathers(3);
    }
}

// --- Cloud Functions ---
function generateCloud(randomX = false) {
    clouds.push({
        x: randomX ? Math.random() * VIRTUAL_WIDTH : VIRTUAL_WIDTH + Math.random() * 100,
        y: Math.random() * (VIRTUAL_HEIGHT / 2), // Top half
        size: Math.random() * 25 + 20, // 20-45
        speed: Math.random() * 0.4 + 0.1 // 0.1-0.5
    });
}

function updateClouds() {
    for (let i = clouds.length - 1; i >= 0; i--) {
        let c = clouds[i];
        c.x -= c.speed;
        if (c.x + c.size * 3 < 0) { // Remove if off-screen
            clouds.splice(i, 1);
        }
    }
    // Add new cloud occasionally
    if (gameRunning && Math.random() < 0.005) {
        generateCloud();
    }
}

function drawClouds() {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'; // Semi-transparent white
    for (let c of clouds) {
        ctx.beginPath();
        // Draw 3 overlapping ellipses
        ctx.ellipse(c.x, c.y, c.size * 1.2, c.size * 0.8, 0, 0, 2 * Math.PI);
        ctx.ellipse(c.x + c.size * 0.8, c.y + 5, c.size, c.size * 0.7, 0, 0, 2 * Math.PI);
        ctx.ellipse(c.x - c.size * 0.7, c.y + 8, c.size * 0.9, c.size * 0.6, 0, 0, 2 * Math.PI);
        ctx.fill();
    }
}

// --- Feather Functions ---
function createFeathers(amount) {
    for (let i = 0; i < amount; i++) {
        particles.push({
            x: bird.x, 
            y: bird.y + bird.height / 2,
            size: Math.random() * 3 + 2, 
            speedX: Math.random() * -2 - 1,
            speedY: (Math.random() - 0.5) * 2,
            life: 30, 
            color: 'white'
        });
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.speedX;
        p.y += p.speedY;
        p.life--;
        if (p.life <= 0) {
            particles.splice(i, 1);
        }
    }
}

function drawParticles() {
    for (let p of particles) {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life / 30; // Fade out
        ctx.fillRect(p.x, p.y, p.size, p.size);
        ctx.globalAlpha = 1.0; // Reset alpha
    }
}

// --- Game Object Functions ---
// generatePipe(xOverride) - create a pipe at optional x position (virtual coords).
function generatePipe(xOverride) {
    const minHeight = 80; // ensure pipes never start too close to top/bottom
    const maxHeight = VIRTUAL_HEIGHT - PIPE_GAP - minHeight;
    const topPipeHeight = Math.floor(Math.random() * (maxHeight - minHeight + 1)) + minHeight;
    
    const startX = (typeof xOverride === 'number') ? xOverride : VIRTUAL_WIDTH;

    pipes.push({
        x: startX,
        topHeight: topPipeHeight,
        bottomY: topPipeHeight + PIPE_GAP,
        passed: false
    });
}

function updateBird() {
    bird.velocity += GRAVITY;
    bird.y += bird.velocity;

    if (bird.y + bird.height > VIRTUAL_HEIGHT) {
        bird.y = VIRTUAL_HEIGHT - bird.height;
        bird.velocity = 0;
        endGame();
    }
    if (bird.y < 0) {
        bird.y = 0;
        bird.velocity = 0;
    }
}

function updatePipes() {
    // Use a dedicated spawnTimer to avoid clustering and ensure stable spawn spacing
    spawnTimer++;
    if (spawnTimer >= PIPE_INTERVAL) {
        generatePipe();
        spawnTimer = 0;
    }

    for (let i = pipes.length - 1; i >= 0; i--) {
        let pipe = pipes[i];
        pipe.x -= PIPE_SPEED; 

        if (!pipe.passed && pipe.x + PIPE_WIDTH < bird.x) {
            score++;
            scoreDisplay.innerText = score;
            pipe.passed = true;
        }

        if (pipe.x + PIPE_WIDTH < 0) {
            pipes.splice(i, 1);
        }
    }
}

function checkCollisions() {
    for (let pipe of pipes) {
        const birdRect = { x: bird.x, y: bird.y, width: bird.width, height: bird.height };
        const topPipeRect = { x: pipe.x, y: 0, width: PIPE_WIDTH, height: pipe.topHeight };
        const bottomPipeRect = { x: pipe.x, y: pipe.bottomY, width: PIPE_WIDTH, height: VIRTUAL_HEIGHT - pipe.bottomY };

        if (isColliding(birdRect, topPipeRect) || isColliding(birdRect, bottomPipeRect)) {
            endGame();
            return;
        }
    }
}

function isColliding(rect1, rect2) {
    return (
        rect1.x < rect2.x + rect2.width &&
        rect1.x + rect1.width > rect2.x &&
        rect1.y < rect2.y + rect2.height &&
        rect1.y + rect1.height > rect2.y
    );
}

// --- Draw Functions ---
function drawBird() {
    ctx.save();
    ctx.translate(bird.x + bird.width / 2, bird.y + bird.height / 2);
    let rotation = Math.max(Math.min(bird.velocity * 4, 25), -90) * (Math.PI / 180);
    ctx.rotate(rotation);
    ctx.drawImage(birdImg, -bird.width / 2, -bird.height / 2, bird.width, bird.height);
    ctx.restore();
}

function drawPipes() {
    for (let pipe of pipes) {
        ctx.drawImage(pipeImg, pipe.x, 0, PIPE_WIDTH, pipe.topHeight);
        ctx.drawImage(pipeImg, pipe.x, pipe.bottomY, PIPE_WIDTH, VIRTUAL_HEIGHT - pipe.bottomY);
    }
}

// --- Main Game Loop ---
function gameLoop() {
    if (!gameRunning) return;
    // Update game logic
    updateClouds();
    updateBird();
    updatePipes();
    updateParticles();

    // Clear full canvas (device coords)
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0); // reset any transform
    ctx.fillStyle = '#70c5ce'; // Classic sky blue
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Apply scaling transform so all drawing uses virtual coordinates
    ctx.translate(OFFSET_X, OFFSET_Y);
    ctx.scale(SCALE, SCALE);

    // Draw (in virtual coords)
    drawClouds(); // Draw clouds behind pipes
    drawPipes();
    drawParticles();
    drawBird();

    // Check for collisions
    checkCollisions();

    // Restore to device coords for any UI overlays
    ctx.restore();

    // Request next frame
    animationFrameId = requestAnimationFrame(gameLoop);
}

// --- Event Listeners ---
restartGameBtn.addEventListener('click', startGame);

window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        flap();
    }
});
window.addEventListener('click', flap);
window.addEventListener('touchstart', (e) => {
    e.preventDefault();
    flap();
});

// --- Start the process ---
// When the game.html page loads, prepare canvas, start the game immediately
// and load assets in the background so the game isn't blocked by network delays.
window.onload = () => {
    // Compute initial canvas size/scale
    resizeCanvas();

    // Start the game loop immediately so players see the game without waiting
    // for all assets to download. Images and audio will populate as they load.
    startGame();

    // Load assets in background; when they finish, just log or update if needed
    loadAssets()
        .then(() => {
            console.log("All assets loaded in background.");
        })
        .catch(error => {
            console.error("Failed to load some assets:", error);
            // Show a small warning in console; don't block the game
        });
};