/**
 * Celestial Vanguard: Lunar Breach
 * Simplified Script for GitHub
 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startBtn = document.getElementById('start-btn');
const retryBtn = document.getElementById('retry-btn');
const menu = document.getElementById('menu');
const gameOverScreen = document.getElementById('game-over');
const hud = document.getElementById('hud');

// Game State
let gameState = 'MENU';
let currentStage = 'NEBULA';
let config = null;
let score = 0;
let lastTime = 0;

// SIMPLE IMAGE NAMES
const images = {};
const assetPaths = {
    nebula: 'nebula.png',
    moon: 'moon.png',
    spaceship: 'ship.png',
    astronaut: 'astro.png',
    alien: 'alien.png'
};

const keys = {};
const mouse = { x: 0, y: 0, down: false };
const joystick = { active: false, base: {x:0, y:0}, deltaX: 0, deltaY: 0 };

async function init() {
    try {
        const response = await fetch('config.json');
        config = await response.json();
        resize();
        window.addEventListener('resize', resize);
        loadAssets();
    } catch (e) { console.error(e); }
}

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

function loadAssets() {
    for (let key in assetPaths) {
        const img = new Image();
        img.src = assetPaths[key];
        images[key] = img;
    }
}

class Player {
    constructor() { this.reset(); }
    reset() {
        this.x = canvas.width / 2;
        this.y = canvas.height * 0.8;
        this.width = 60; this.height = 60;
        this.health = (currentStage === 'NEBULA') ? config.player.space.health : config.player.moon.health;
        this.lastShot = 0; this.rotation = 0;
    }
    update() {
        const stats = (currentStage === 'NEBULA') ? config.player.space : config.player.moon;
        let dx = 0, dy = 0;
        if (keys['w'] || keys['ArrowUp']) dy -= 1;
        if (keys['s'] || keys['ArrowDown']) dy += 1;
        if (keys['a'] || keys['ArrowLeft']) dx -= 1;
        if (keys['d'] || keys['ArrowRight']) dx += 1;
        if (joystick.active) { dx = joystick.deltaX; dy = joystick.deltaY; }
        this.x += dx * stats.speed; this.y += dy * stats.speed;
        this.x = Math.max(30, Math.min(canvas.width - 30, this.x));
        this.y = Math.max(30, Math.min(canvas.height - 30, this.y));
        if (mouse.down && Date.now() - this.lastShot > stats.fireRate) {
            this.shoot(); this.lastShot = Date.now();
        }
        if (currentStage === 'NEBULA') this.rotation = Math.atan2(mouse.y - this.y, mouse.x - this.x) + Math.PI/2;
    }
    shoot() {
        const angle = (currentStage === 'NEBULA') ? this.rotation - Math.PI/2 : -Math.PI/2;
        projectiles.push(new Projectile(this.x, this.y, angle, true));
    }
    draw() {
        ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.rotation);
        const img = (currentStage === 'NEBULA') ? images.spaceship : images.astronaut;
        if (img.complete) ctx.drawImage(img, -30, -30, 60, 60);
        else { ctx.fillStyle = 'white'; ctx.fillRect(-30, -30, 60, 60); }
        ctx.restore();
    }
}

class Enemy {
    constructor(type) {
        this.type = type;
        const stats = config.enemies[type];
        this.health = stats.health; this.speed = stats.speed;
        this.x = Math.random() * (canvas.width - 50); this.y = -50;
    }
    update() { this.y += this.speed; return this.y > canvas.height + 50; }
    draw() {
        ctx.save(); ctx.translate(this.x, this.y);
        if (this.type === 'alien' && images.alien.complete) {
            ctx.drawImage(images.alien, -25, -25, 50, 50);
        } else {
            ctx.fillStyle = (this.type === 'alien') ? '#00ff00' : '#ff0000';
            ctx.shadowBlur = 15; ctx.shadowColor = ctx.fillStyle;
            ctx.fillRect(-25, -25, 50, 50);
        }
        ctx.restore();
    }
}

class Projectile {
    constructor(x, y, angle, isPlayer) {
        this.x = x; this.y = y;
        this.vx = Math.cos(angle) * 10; this.vy = Math.sin(angle) * 10;
        this.isPlayer = isPlayer;
    }
    update() { this.x += this.vx; this.y += this.vy; return (this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height); }
    draw() {
        ctx.beginPath(); ctx.arc(this.x, this.y, 4, 0, Math.PI*2);
        ctx.fillStyle = this.isPlayer ? '#00f2ff' : '#ff3300';
        ctx.shadowBlur = 10; ctx.shadowColor = ctx.fillStyle;
        ctx.fill();
    }
}

let player = null, enemies = [], projectiles = [];

function loop() {
    if (gameState !== 'PLAYING') return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const bg = (currentStage === 'NEBULA') ? images.nebula : images.moon;
    if (bg.complete) ctx.drawImage(bg, 0, 0, canvas.width, canvas.height);
    player.update(); player.draw();
    if (Math.random() < 0.02) enemies.push(new Enemy(Math.random() > 0.3 ? 'alien' : 'robot'));
    projectiles = projectiles.filter(p => { const r = p.update(); if (!r) p.draw(); return !r; });
    enemies = enemies.filter(e => {
        const r = e.update();
        if (!r) {
            e.draw();
            if (Math.hypot(player.x - e.x, player.y - e.y) < 40) {
                player.health -= config.enemies[e.type].damage;
                updateHUD(); if (player.health <= 0) endGame(false); return false;
            }
            projectiles.forEach((p, i) => {
                if (p.isPlayer && Math.hypot(p.x - e.x, p.y - e.y) < 30) {
                    e.health -= 25; projectiles.splice(i, 1);
                    if (e.health <= 0) { score += config.enemies[e.type].score; updateHUD(); }
                }
            });
            return e.health > 0;
        }
        return !r;
    });
    if (currentStage === 'NEBULA' && score >= config.general.scoreToTransition) {
        currentStage = 'MOON'; player.reset(); updateHUD();
    }
    requestAnimationFrame(loop);
}

function updateHUD() {
    document.getElementById('health-val').innerText = Math.max(0, player.health);
    document.getElementById('score-val').innerText = score;
    document.getElementById('stage-name').innerText = `STAGE: ${currentStage}`;
}

function endGame(win) {
    gameState = 'GAMEOVER';
    gameOverScreen.classList.remove('hidden');
    hud.classList.add('hidden');
}

window.addEventListener('keydown', e => keys[e.key] = true);
window.addEventListener('keyup', e => keys[e.key] = false);
window.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
window.addEventListener('mousedown', () => mouse.down = true);
window.addEventListener('mouseup', () => mouse.down = false);

// Touch support
canvas.addEventListener('touchstart', e => {
    const t = e.touches[0];
    if (t.clientX < canvas.width / 2) {
        joystick.active = true; joystick.base.x = t.clientX; joystick.base.y = t.clientY;
    } else { mouse.down = true; }
});
canvas.addEventListener('touchmove', e => {
    if (joystick.active) {
        const t = e.touches[0];
        const dx = t.clientX - joystick.base.x; const dy = t.clientY - joystick.base.y;
        const dist = Math.min(60, Math.hypot(dx, dy)); const angle = Math.atan2(dy, dx);
        joystick.deltaX = (Math.cos(angle) * dist) / 60; joystick.deltaY = (Math.sin(angle) * dist) / 60;
    }
});
canvas.addEventListener('touchend', () => { joystick.active = false; mouse.down = false; });

startBtn.onclick = () => {
    menu.classList.add('hidden'); hud.classList.remove('hidden');
    gameState = 'PLAYING'; player = new Player(); loop();
};
retryBtn.onclick = () => location.reload();
init();
