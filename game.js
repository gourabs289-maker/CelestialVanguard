/**
 * CELESTIAL VANGUARD: LUNAR BREACH - PROFESSIONAL EDITION
 * Features: 3D-Tilt, Procedural Audio, Fire-Laser VFX, 10-HP Elites
 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const hud = document.getElementById('hud');
const startBtn = document.getElementById('start-btn');
const menu = document.getElementById('menu');

// --- AUDIO ENGINE (Professional Procedural Sounds) ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(freq, type, duration, vol) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(10, audioCtx.currentTime + duration);
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime + duration);
}

const sounds = {
    laser: () => playSound(800, 'sawtooth', 0.15, 0.1),
    explosion: () => playSound(100, 'square', 0.4, 0.2),
    hit: () => playSound(400, 'sine', 0.05, 0.1),
    stageUp: () => {
        playSound(440, 'triangle', 0.5, 0.2);
        setTimeout(() => playSound(880, 'triangle', 0.5, 0.2), 100);
    }
};

// --- CONFIG & ASSETS ---
let config = {
    player: { space: { speed: 6, fireRate: 120 }, moon: { speed: 4, fireRate: 200 } },
    enemies: { alien: { hp: 30, speed: 2.5 }, elite: { hp: 250, speed: 1.2 } }
};

const assetPaths = {
    nebula: 'nebula.png.png',
    moon: 'moon.png.png',
    spaceship: 'spaceship.png.png',
    astronaut: 'astronaut.png.png',
    alien: 'alien.png.png'
};

const images = {};
function loadAssets() {
    for (let key in assetPaths) {
        const img = new Image();
        img.src = assetPaths[key];
        images[key] = img;
    }
}

// --- GAME STATE ---
let gameState = 'MENU';
let currentStage = 'NEBULA';
let score = 0;
let distance = 0;
let particles = [];
let projectiles = [];
let enemies = [];
let player = null;
const keys = {};
const mouse = { x: 0, y: 0, down: false };
const joystick = { active: false, deltaX: 0, deltaY: 0 };

// --- PARTICLE SYSTEM ---
class Particle {
    constructor(x, y, color) {
        this.x = x; this.y = y;
        this.color = color;
        this.vx = (Math.random() - 0.5) * 8;
        this.vy = (Math.random() - 0.5) * 8;
        this.life = 1.0;
        this.size = Math.random() * 4 + 2;
    }
    update() {
        this.x += this.vx; this.y += this.vy;
        this.life -= 0.03;
    }
    draw() {
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10; ctx.shadowColor = this.color;
        ctx.fillRect(this.x, this.y, this.size, this.size);
        ctx.globalAlpha = 1;
    }
}

function createExplosion(x, y, color) {
    for (let i = 0; i < 15; i++) particles.push(new Particle(x, y, color));
    sounds.explosion();
}

// --- PLAYER ---
class Player {
    constructor() {
        this.x = canvas.width / 2; this.y = canvas.height * 0.8;
        this.health = 100;
        this.tilt = 0;
        this.lastShot = 0;
    }
    update() {
        let dx = 0, dy = 0;
        if (keys['w']) dy -= 1; if (keys['s']) dy += 1;
        if (keys['a']) dx -= 1; if (keys['d']) dx += 1;
        if (joystick.active) { dx = joystick.deltaX; dy = joystick.deltaY; }

        this.tilt = dx * 0.2; // 3D-Tilt Effect
        this.x += dx * 6; this.y += dy * 6;
        this.x = Math.max(40, Math.min(canvas.width - 40, this.x));
        this.y = Math.max(40, Math.min(canvas.height - 40, this.y));

        if (mouse.down && Date.now() - this.lastShot > 150) {
            this.shoot(); this.lastShot = Date.now();
        }
    }
    shoot() {
        projectiles.push(new Projectile(this.x, this.y, true));
        sounds.laser();
    }
    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.transform(1, 0, this.tilt, 1, 0, 0); // 3D-Skew
        const img = (currentStage === 'NEBULA') ? images.spaceship : images.astronaut;
        if (img && img.complete) ctx.drawImage(img, -40, -40, 80, 80);
        else { ctx.fillStyle = 'white'; ctx.fillRect(-30, -30, 60, 60); }
        ctx.restore();
    }
}

// --- ENEMIES & BOSSES ---
class Enemy {
    constructor(isElite) {
        this.isElite = isElite;
        this.hp = isElite ? 250 : 30; // Elite takes 10 hits (25 damage per hit)
        this.maxHp = this.hp;
        this.x = Math.random() * (canvas.width - 60) + 30;
        this.y = -100;
        this.speed = isElite ? 1.5 : 3;
        this.size = isElite ? 80 : 50;
    }
    update() {
        this.y += this.speed;
        return this.y > canvas.height + 100;
    }
    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        if (!this.isElite && images.alien && images.alien.complete) {
            ctx.drawImage(images.alien, -this.size/2, -this.size/2, this.size, this.size);
        } else {
            ctx.fillStyle = this.isElite ? '#ff3300' : '#00ff00';
            ctx.shadowBlur = 20; ctx.shadowColor = ctx.fillStyle;
            ctx.fillRect(-this.size/2, -this.size/2, this.size, this.size);
        }
        
        // HP Bar for Elite
        if (this.isElite) {
            ctx.fillStyle = '#444'; ctx.fillRect(-40, -60, 80, 8);
            ctx.fillStyle = '#ff0000'; ctx.fillRect(-40, -60, (this.hp/this.maxHp) * 80, 8);
            ctx.strokeStyle = 'white'; ctx.strokeRect(-40, -60, 80, 8);
        }
        ctx.restore();
    }
}

// --- PROJECTILES (Fire-Laser) ---
class Projectile {
    constructor(x, y, isPlayer) {
        this.x = x; this.y = y;
        this.isPlayer = isPlayer;
        this.vy = isPlayer ? -12 : 8;
    }
    update() { this.y += this.vy; return this.y < -50 || this.y > canvas.height + 50; }
    draw() {
        // Glowing Fire Laser Effect
        const grad = ctx.createLinearGradient(this.x, this.y, this.x, this.y + 20);
        grad.addColorStop(0, '#fff'); grad.addColorStop(0.5, '#ffcc00'); grad.addColorStop(1, '#ff3300');
        ctx.fillStyle = grad;
        ctx.shadowBlur = 15; ctx.shadowColor = '#ff3300';
        ctx.fillRect(this.x - 3, this.y, 6, 25);
    }
}

// --- MAIN ENGINE ---
function loop() {
    if (gameState !== 'PLAYING') return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Parallax Adventure Background
    distance += 2;
    const bg = (currentStage === 'NEBULA') ? images.nebula : images.moon;
    if (bg && bg.complete) {
        const offset = (distance % canvas.height);
        ctx.drawImage(bg, 0, offset, canvas.width, canvas.height);
        ctx.drawImage(bg, 0, offset - canvas.height, canvas.width, canvas.height);
    }

    player.update(); player.draw();

    // Spawning
    if (Math.random() < 0.02) enemies.push(new Enemy(Math.random() > 0.85));

    projectiles = projectiles.filter(p => {
        const r = p.update(); if (!r) p.draw(); return !r;
    });

    particles = particles.filter(p => {
        p.update(); p.draw(); return p.life > 0;
    });

    enemies = enemies.filter(e => {
        const r = e.update();
        if (!r) {
            e.draw();
            // Hit detection
            projectiles.forEach((p, i) => {
                if (p.isPlayer && Math.hypot(p.x - e.x, p.y - e.y) < e.size/2) {
                    e.hp -= 25; projectiles.splice(i, 1);
                    sounds.hit();
                    if (e.hp <= 0) {
                        createExplosion(e.x, e.y, e.isElite ? 'orange' : 'green');
                        score += e.isElite ? 500 : 50;
                        updateHUD();
                    }
                }
            });
            // Collision with Player
            if (Math.hypot(player.x - e.x, player.y - e.y) < 40) {
                player.health -= 10; updateHUD();
                createExplosion(player.x, player.y, 'red');
                if (player.health <= 0) location.reload();
                return false;
            }
            return e.hp > 0;
        }
        return !r;
    });

    if (currentStage === 'NEBULA' && score >= 2000) {
        currentStage = 'MOON'; sounds.stageUp(); updateHUD();
    }

    requestAnimationFrame(loop);
}

function updateHUD() {
    document.getElementById('health-val').innerText = player.health;
    document.getElementById('score-val').innerText = score;
    document.getElementById('stage-name').innerText = `DISTANCE: ${distance}m | ${currentStage}`;
}

// --- CONTROLS ---
window.addEventListener('keydown', e => keys[e.key.toLowerCase()] = true);
window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);
window.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
window.addEventListener('mousedown', () => { mouse.down = true; if(audioCtx.state === 'suspended') audioCtx.resume(); });
window.addEventListener('mouseup', () => mouse.down = false);

startBtn.onclick = () => {
    menu.style.display = 'none'; hud.classList.remove('hidden');
    gameState = 'PLAYING'; player = new Player(); loop();
};

resize(); window.onresize = resize; loadAssets();
function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
