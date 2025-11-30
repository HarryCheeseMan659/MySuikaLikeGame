// ========================================================
// Final full game.js (uses assets/ball1.png ... ball9.png)
// cloud.png, lineup.png, sounds in assets/sounds/
// ========================================================

// CONFIG
const USE_PLACEHOLDER_ART = false; // set true to use placeholder circles if a PNG fails to load

const BALL_TYPES = [
    { radius: 16, color: "#ff5555", img: "ball1.png" },
    { radius: 20, color: "#ff8855", img: "assets/ball2.png" },
    { radius: 24, color: "#ffaa55", img: "assets/ball3.png" },
    { radius: 28, color: "#55ff55", img: "assets/ball4.png" },
    { radius: 32, color: "#55ffaa", img: "assets/ball5.png" },
    { radius: 36, color: "#5599ff", img: "assets/ball6.png" },
    { radius: 40, color: "#5555ff", img: "assets/ball7.png" },
    { radius: 48, color: "#ffff55", img: "assets/ball8.png" },
    { radius: 60, color: "#ff55ff", img: "assets/ball9.png" }
];

// STATE
let score = 0;
let nextBallType = BALL_TYPES[0];
let gameOver = false;
let gameStarted = false;

// CANVAS & HiDPI
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const CSS_W = 500, CSS_H = 700;
canvas.width = CSS_W * (window.devicePixelRatio || 1);
canvas.height = CSS_H * (window.devicePixelRatio || 1);
canvas.style.width = CSS_W + "px";
canvas.style.height = CSS_H + "px";
ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);

// SOUNDS (in assets/sounds/)
const sounds = {
    drop: new Audio("assets/sounds/drop.wav"),
    merge: new Audio("assets/sounds/removefruits.wav"),
    maxMerge: new Audio("assets/sounds/magic.wav")
};
sounds.drop.volume = 0.35;
sounds.merge.volume = 0.55;
sounds.maxMerge.volume = 0.75;

// safe play wrapper
function playSound(sound) {
    if (!sound || !gameStarted) return;
    try {
        sound.currentTime = 0;
        sound.play().catch(e => console.log("Audio play blocked:", e));
    } catch (e) { console.log("Audio error:", e); }
}

// PARTICLES
const particles = [];
function spawnParticles(x, y, color, count = 12, speed = 2.6, life = 36) {
    for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = Math.random() * speed;
        particles.push({
            x, y,
            vx: Math.cos(a) * v,
            vy: Math.sin(a) * v,
            r: Math.random() * 3 + 1.5,
            color,
            life
        });
    }
}
function updateAndDrawParticles(ctx) {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05; // tiny gravity on particles
        p.life--;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
        if (p.life <= 0) particles.splice(i, 1);
    }
}

// MATTER SETUP
const { Engine, World, Bodies, Events, Composite } = Matter;
const engine = Engine.create();
const world = engine.world;
engine.gravity.y = 1; // standard gravity

// CONTAINER (visual & physics aligned; 12% smaller earlier)
const container = {
    x: CSS_W / 2,
    y: CSS_H / 2,
    width: 422,
    height: 598
};
const wallThickness = 20;
const walls = [
    Bodies.rectangle(container.x, container.y + container.height / 2 - wallThickness / 2, container.width, wallThickness, { isStatic: true }), // bottom
    Bodies.rectangle(container.x - container.width / 2 + wallThickness / 2, container.y, wallThickness, container.height, { isStatic: true }), // left
    Bodies.rectangle(container.x + container.width / 2 - wallThickness / 2, container.y, wallThickness, container.height, { isStatic: true }) // right
];
World.add(world, walls);

// HELPER: clamp x inside container given radius
function clampX(x, radius) {
    const left = container.x - container.width / 2 + radius + 4;
    const right = container.x + container.width / 2 - radius - 4;
    return Math.min(Math.max(x, left), right);
}

// IMAGE LOADING (ball PNGs)
const loadedImages = {};
function loadImages() {
    const promises = BALL_TYPES.map(t => {
        return new Promise(res => {
            if (!t.img) return res();
            const img = new Image();
            img.src = t.img;
            img.onload = () => { loadedImages[t.img] = img; res(); };
            img.onerror = () => { console.warn("Failed to load", t.img); res(); };
        });
    });
    return Promise.all(promises);
}

// SPAWN BALL (Matter body)
function spawnBall(type, x, y) {
    const options = { restitution: 0.05, friction: 0.12, frictionAir: 0.02, label: "ball" };
    const b = Bodies.circle(x, y, type.radius, options);
    b.ballType = type;
    b.isMerged = false;
    World.add(world, b);
    return b;
}

// NEXT BALL PREVIEW (tiny img inside cloud)
function chooseNextBall() {
    nextBallType = BALL_TYPES[Math.floor(Math.random() * BALL_TYPES.length)];
    const nextEl = document.getElementById("nextBallImg");
    if (nextEl) {
        if (!USE_PLACEHOLDER_ART && loadedImages[nextBallType.img]) {
            nextEl.src = nextBallType.img;
            nextEl.style.display = "inline-block";
        } else {
            // small canvas fallback
            const tmp = document.createElement("canvas");
            tmp.width = 40; tmp.height = 40;
            const tctx = tmp.getContext("2d");
            tctx.clearRect(0, 0, 40, 40);
            tctx.fillStyle = nextBallType.color;
            tctx.beginPath();
            tctx.arc(20, 20, Math.min(nextBallType.radius, 18), 0, Math.PI * 2);
            tctx.fill();
            nextEl.src = tmp.toDataURL();
            nextEl.style.display = "inline-block";
        }
    }
}
chooseNextBall();

// HOVER PREVIEW tracking
let mouseX = container.x;
canvas.addEventListener("mousemove", e => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    mouseX = clampX(mx, nextBallType.radius);
});

// Debounce spawn
let lastSpawnTime = 0;
const SPAWN_DEBOUNCE = 140; // ms

canvas.addEventListener("click", e => {
    const now = Date.now();
    if (now - lastSpawnTime < SPAWN_DEBOUNCE) return;
    lastSpawnTime = now;

    if (gameOver) return;
    if (!gameStarted) gameStarted = true;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const safeX = clampX(clickX, nextBallType.radius);
    const spawnY = container.y - container.height / 2 + nextBallType.radius + 8; // safe spawn inside top
    spawnBall(nextBallType, safeX, spawnY);
    playSound(sounds.drop);
    chooseNextBall();
});

// MERGE HANDLING
Events.on(engine, "collisionStart", event => {
    const pairs = event.pairs;
    for (const pair of pairs) {
        const a = pair.bodyA;
        const b = pair.bodyB;
        if (!a.ballType || !b.ballType) continue;
        if (a.isMerged || b.isMerged) continue;
        if (a.ballType !== b.ballType) continue;

        const idx = BALL_TYPES.indexOf(a.ballType);
        a.isMerged = true; b.isMerged = true;
        const cx = (a.position.x + b.position.x) / 2;
        const cy = (a.position.y + b.position.y) / 2;

        World.remove(world, a);
        World.remove(world, b);

        if (idx === BALL_TYPES.length - 1) {
            // largest: disappear, bonus points, particles, sound
            score += 30;
            document.getElementById("scoreText").textContent = score;
            playSound(sounds.maxMerge);
            ["#ff55ff", "#ff88ff", "#ffccff", "#ff55aa"].forEach(c => spawnParticles(cx, cy, c, 8, 3.5, 48));
        } else {
            // spawn next at collision point
            const newT = BALL_TYPES[idx + 1];
            spawnBall(newT, cx, cy);
            score += 10;
            document.getElementById("scoreText").textContent = score;
            playSound(sounds.merge);
            spawnParticles(cx, cy, a.ballType.color, 12, 2.6, 36);
        }
    }
});

// DRAWING
function drawContainer() {
    ctx.save();
    ctx.strokeStyle = "#888";
    ctx.lineWidth = 4;
    ctx.strokeRect(container.x - container.width / 2, container.y - container.height / 2, container.width, container.height);
    ctx.restore();
}

function drawBall(body) {
    ctx.save();
    ctx.translate(body.position.x, body.position.y);
    ctx.rotate(body.angle);

    const type = body.ballType;
    if (!USE_PLACEHOLDER_ART && loadedImages[type.img]) {
        ctx.drawImage(loadedImages[type.img], -type.radius, -type.radius, type.radius * 2, type.radius * 2);
    } else {
        ctx.beginPath();
        ctx.arc(0, 0, type.radius, 0, Math.PI * 2);
        ctx.fillStyle = type.color;
        ctx.fill();
    }

    // outline
    ctx.beginPath();
    ctx.arc(0, 0, type.radius, 0, Math.PI * 2);
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(0,0,0,0.7)";
    ctx.stroke();

    ctx.restore();
}

function drawHoverPreview() {
    if (gameOver) return;
    const px = mouseX;
    const py = container.y - container.height / 2 + nextBallType.radius + 8;
    ctx.save();
    ctx.translate(px, py);

    if (!USE_PLACEHOLDER_ART && loadedImages[nextBallType.img]) {
        ctx.globalAlpha = 0.55;
        ctx.drawImage(loadedImages[nextBallType.img], -nextBallType.radius, -nextBallType.radius, nextBallType.radius * 2, nextBallType.radius * 2);
        ctx.globalAlpha = 1;
    } else {
        ctx.globalAlpha = 0.55;
        ctx.beginPath();
        ctx.arc(0, 0, nextBallType.radius, 0, Math.PI * 2);
        ctx.fillStyle = nextBallType.color;
        ctx.fill();
        ctx.globalAlpha = 1;
    }

    ctx.beginPath();
    ctx.arc(0, 0, nextBallType.radius, 0, Math.PI * 2);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(0,0,0,0.7)";
    ctx.stroke();

    ctx.restore();
}

// GAME OVER CHECK: ball top exceeds container top
function checkGameOver() {
    if (gameOver) return;
    const bodies = Composite.allBodies(world);
    for (const b of bodies) {
        if (b.ballType) {
            if (b.position.y - b.ballType.radius < container.y - container.height / 2 + 2) {
                gameOver = true;
                setTimeout(() => alert("Game Over! Final Score: " + score), 10);
                break;
            }
        }
    }
}

// RENDER
function draw() {
    // Clear logical CSS area
    ctx.clearRect(0, 0, CSS_W, CSS_H);

    // Draw container
    drawContainer();

    // Hover preview
    drawHoverPreview();

    // Draw balls
    const bodies = Composite.allBodies(world);
    for (const b of bodies) {
        if (b.ballType) drawBall(b);
    }

    // Particles
    updateAndDrawParticles(ctx);

    // Game over check
    if (!gameOver) checkGameOver();
}

// LOOP
function loop() {
    if (!gameOver) Engine.update(engine, 1000 / 60);
    draw();
    requestAnimationFrame(loop);
}

// STARTUP: load images then start
loadImages().then(() => {
    chooseNextBall();
    // initial UI score
    const scoreEl = document.getElementById("scoreText");
    if (scoreEl) scoreEl.textContent = score;

    loop();
});
