// js/script.js
(() => {
  const { Engine, Runner, Bodies, Composite, Events } = Matter;

  // ================= НАСТРОЙКИ =================

  // Динозавры от меньшего к большему. При слиянии двух одинаковых
  // получается следующий в списке.
 // const DINOS = [
 //   { name: 'Компсогнат',   desc: 'Самый маленький.',        r: 18,  color: '#b5d99c', points: 1 },
 //   { name: 'Птеранодон',   desc: 'Парит в небе.',          r: 25,  color: '#8ec5e8', points: 3 },
 //   { name: 'Велоцираптор', desc: 'Быстрый охотник.',        r: 32,  color: '#f5c96b', points: 6 },
 //   { name: 'Пахицефалозавр',    desc: 'Боньк.', r: 40,  color: '#9fd3a8', points: 10 },
 //   { name: 'Диллофозавр',  desc: 'Ночной кошмар.',      r: 48,  color: '#c9a7e0', points: 15 },
 //   { name: 'Тенонтозавр',   desc: 'Лошадка.',             r: 56,  color: '#d9a27a', points: 21 },
 //   { name: 'Карнотавр', desc: 'Динозавр бык.',      r: 64,  color: '#7fb3a6', points: 28 },
 //   { name: 'Кентрозавр',     desc: 'С костяными пластинами.', r: 72,  color: '#e88a7a', points: 36 },
 //   { name: 'Тираннозавр',    desc: 'Король ящеров.',          r: 82,  color: '#6fa3d6', points: 45 },
 //   { name: 'Трицератопс',  desc: 'Король мёртв, да здравствует король',          r: 92,  color: '#e6c94f', points: 55 },
 //   { name: 'Брахиозавр',   desc: 'Гигант.',                 r: 104, color: '#7bb662', points: 66 },
 // ];


  const DINOS = [
  { name: 'Компсогнат',       desc: 'Самый маленький.',          r: 18,  color: '#b5d99c', points: 1,  sprite: 'images/dino1.png' },
  { name: 'Птеранодон',       desc: 'Парит в небе.',             r: 25,  color: '#8ec5e8', points: 3,  sprite: 'images/dino2.png' },
  { name: 'Велоцираптор',     desc: 'Быстрый охотник.',          r: 32,  color: '#f5c96b', points: 6,  sprite: 'images/dino3.png' },
  { name: 'Пахицефалозавр',   desc: 'Боньк.',                    r: 40,  color: '#9fd3a8', points: 10, sprite: 'images/dino4.png' },
  { name: 'Диллофозавр',      desc: 'Ночной кошмар.',            r: 48,  color: '#c9a7e0', points: 15, sprite: 'images/dino5.png' },
  { name: 'Тенонтозавр',      desc: 'Лошадка.',                  r: 56,  color: '#d9a27a', points: 21, sprite: 'images/dino6.png' },
  { name: 'Карнотавр',        desc: 'Динозавр бык.',             r: 64,  color: '#7fb3a6', points: 28, sprite: 'images/dino7.png' },
  { name: 'Кентрозавр',       desc: 'С костяными пластинами.',   r: 72,  color: '#e88a7a', points: 36, sprite: 'images/dino8.png' },
  { name: 'Тираннозавр',      desc: 'Король ящеров.',            r: 82,  color: '#6fa3d6', points: 45, sprite: 'images/dino9.png' },
  { name: 'Трицератопс',      desc: 'Король мёртв, да здравствует король', r: 92, color: '#e6c94f', points: 55, sprite: 'images/dino10.png' },
  { name: 'Брахиозавр',       desc: 'Гигант.',                   r: 104, color: '#7bb662', points: 66, sprite: 'images/dino11.png' },
];

// Загрузка спрайтов
DINOS.forEach((d) => {
  d.img = new Image();
  d.img.src = d.sprite;
});

  const SPRITE_SCALE = 1.1; // множитель размера спрайта относительно радиуса; подгоните под картинки
  const MAX_LEVEL = DINOS.length - 1;
  const SPAWN_LEVELS = 5;          // в начале падают только уровни 0..4
  const DROP_COOLDOWN = 500;       // мс между бросками
  const GRACE_MS = 1500;           // мс, которые динозавр может находиться выше черты после броска
  const WALL = 60;                 // толщина невидимых стенок
  const BEST_KEY = 'dinoSuikaBest';

  // ================= DOM =================

  const el = {
    area: document.querySelector('.game-canvas-area'),
    limitImg: document.querySelector('.fruit-limit-dotted'),
    curScore: document.querySelector('.text-wrapper-7'),
    bestScore: document.querySelector('.text-wrapper-10'),
    status: document.querySelector('.text-wrapper-8'),
    nextName: document.querySelector('.text-wrapper-13'),
    nextDesc: document.querySelector('.text-wrapper-14'),
    preview: document.querySelector('.peach-preview'),
    restart: document.querySelector('.replay-button'),
  };

  // Canvas поверх игровой зоны
  const canvas = document.createElement('canvas');
  canvas.style.cssText =
    'position:absolute;inset:0;width:100%;height:100%;cursor:pointer;touch-action:none;';
  el.area.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  let W = 0;
  let H = 0;
  let limitY = 0;

  // ================= СОСТОЯНИЕ =================

  const engine = Engine.create();
  engine.gravity.y = 1;
  engine.positionIterations = 10;
  engine.velocityIterations = 8;

  let score = 0;
  let best = Number(localStorage.getItem(BEST_KEY)) || 0;
  let gameOver = false;
  let canDrop = true;
  let aimX = 0;
  let nextLevel = 0;
  const mergeQueue = [];

  // ================= УТИЛИТЫ =================

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const randomSpawnLevel = () => Math.floor(Math.random() * SPAWN_LEVELS);
  const fmt = (n) => n.toLocaleString('ru-RU');

  function measure() {
    W = el.area.clientWidth;
    H = el.area.clientHeight;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Координата черты-ограничителя внутри игровой зоны
    const areaRect = el.area.getBoundingClientRect();
    const limitRect = el.limitImg.getBoundingClientRect();
    limitY = limitRect.top - areaRect.top + limitRect.height / 2;
  }

  // ================= СТЕНЫ =================

  function addWalls() {
    const opts = { isStatic: true, friction: 0.8, label: 'wall' };
    Composite.add(engine.world, [
      Bodies.rectangle(W / 2, H + WALL / 2, W + WALL * 2, WALL, opts), // пол
      Bodies.rectangle(-WALL / 2, H / 2, WALL, H * 3, opts),           // левая стенка
      Bodies.rectangle(W + WALL / 2, H / 2, WALL, H * 3, opts),        // правая стенка
    ]);
  }

  // ================= ДИНОЗАВРЫ =================

  function createDino(level, x, y) {
    const d = DINOS[level];
    const body = Bodies.circle(x, y, d.r, {
      label: 'dino',
      restitution: 0.1,
      friction: 0.4,
      frictionStatic: 0.6,
    });
    body.dinoLevel = level;
    body.dropTime = performance.now();
    body.removed = false;
    Composite.add(engine.world, body);
    return body;
  }

  function drop() {
    if (gameOver || !canDrop) return;

    const level = nextLevel;
    const r = DINOS[level].r;
    const x = clamp(aimX, r + 1, W - r - 1);

    createDino(level, x, r + 2);

    canDrop = false;
    setTimeout(() => (canDrop = true), DROP_COOLDOWN);

    nextLevel = randomSpawnLevel();
    updatePreview();
  }

  // ================= СЛИЯНИЕ =================

  // Ищем столкновения двух одинаковых динозавров.
  // Саму замену делаем в afterUpdate, чтобы не менять мир прямо во время события.
  Events.on(engine, 'collisionStart', (event) => {
    for (const { bodyA: a, bodyB: b } of event.pairs) {
      if (a.label !== 'dino' || b.label !== 'dino') continue;
      if (a.removed || b.removed) continue;
      if (a.dinoLevel !== b.dinoLevel) continue;

      a.removed = true;
      b.removed = true;
      mergeQueue.push({ a, b });
    }
  });

  function processMerges() {
    while (mergeQueue.length) {
      const { a, b } = mergeQueue.shift();
      const level = a.dinoLevel;

      Composite.remove(engine.world, a);
      Composite.remove(engine.world, b);

      const x = (a.position.x + b.position.x) / 2;
      const y = (a.position.y + b.position.y) / 2;

      if (level === MAX_LEVEL) {
        // Два самых больших просто исчезают, даём очки
        addScore(DINOS[level].points * 2);
      } else {
        createDino(level + 1, x, y);
        addScore(DINOS[level + 1].points);
      }
    }
  }

  // ================= ПРОВЕРКА ПРОИГРЫША =================

  function checkGameOver(now) {
    for (const body of Composite.allBodies(engine.world)) {
      if (body.label !== 'dino' || body.removed) continue;

      const r = DINOS[body.dinoLevel].r;
      const settled = Math.hypot(body.velocity.x, body.velocity.y) < 0.5;
      const aboveLine = body.position.y - r < limitY;
      const graceOver = now - body.dropTime > GRACE_MS;

      if (aboveLine && settled && graceOver) {
        endGame();
        return;
      }
    }
  }

  function endGame() {
    gameOver = true;
    el.status.textContent = 'Игра окончена';
  }

  // ================= СЧЁТ И UI =================

  function addScore(points) {
    score += points;
    if (score > best) {
      best = score;
      localStorage.setItem(BEST_KEY, String(best));
    }
    updateScoreUI();
  }

  function updateScoreUI() {
    el.curScore.textContent = fmt(score);
    el.bestScore.textContent = fmt(best);
  }

 // function updatePreview() {
 //   const d = DINOS[nextLevel];
 //   el.nextName.textContent = d.name;
 //   el.nextDesc.textContent = d.desc;
 //   el.preview.style.backgroundColor = d.color;
//  }

  function updatePreview() {
  const d = DINOS[nextLevel];
  el.nextName.textContent = d.name;
  el.nextDesc.textContent = d.desc;
  el.preview.style.backgroundColor = 'transparent';
  el.preview.style.backgroundImage = `url("${d.sprite}")`;
  el.preview.style.backgroundSize = 'contain';
  el.preview.style.backgroundRepeat = 'no-repeat';
  el.preview.style.backgroundPosition = 'center';
}

function drawDino(d, x, y, r, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;

  // 1. Круг: заливка цветом динозавра (он совпадает с физическим телом)
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = d.color;
  ctx.fill();

  // 2. Спрайт поверх круга (если загружен)
  const hasSprite = d.img && d.img.complete && d.img.naturalWidth > 0;
  if (hasSprite) {
    const size = r * 2 * SPRITE_SCALE;
    ctx.drawImage(d.img, x - size / 2, y - size / 2, size, size);
  } else if (r >= 30) {
    // Запасной вариант: название, пока спрайт не загрузился
    ctx.fillStyle = '#455b3d';
    ctx.font = `700 ${Math.round(r * 0.28)}px Nunito, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(d.name, x, y);
  }

  // 3. Контур поверх всего, чтобы граница была видна и на спрайте
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(69, 91, 61, 0.6)';
  ctx.stroke();

  ctx.restore();
}

  function draw() {
    ctx.clearRect(0, 0, W, H);

    // Падающие динозавры
    for (const body of Composite.allBodies(engine.world)) {
      if (body.label !== 'dino') continue;
      const d = DINOS[body.dinoLevel];
      drawDino(d, body.position.x, body.position.y, d.r);
    }

    // "Призрак" следующего динозавра над полем + направляющая
    if (!gameOver) {
      const d = DINOS[nextLevel];
      const x = clamp(aimX, d.r + 1, W - d.r - 1);
      const y = d.r + 2;

      ctx.save();
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath();
      ctx.moveTo(x, y + d.r);
      ctx.lineTo(x, H);
      ctx.stroke();
      ctx.restore();

      drawDino(d, x, y, d.r, canDrop ? 0.6 : 0.3);
    }

    requestAnimationFrame(draw);
  }

  // ================= ИГРОВОЙ ЦИКЛ =================

  Events.on(engine, 'afterUpdate', () => {
    processMerges();
    if (!gameOver) checkGameOver(performance.now());
  });

  // ================= УПРАВЛЕНИЕ =================

  el.area.addEventListener('pointermove', (e) => {
    const rect = canvas.getBoundingClientRect();
    aimX = e.clientX - rect.left;
  });

  el.area.addEventListener('pointerdown', (e) => {
    const rect = canvas.getBoundingClientRect();
    aimX = e.clientX - rect.left;
    drop();
  });

  // Клавиатура: ← → двигать, пробел бросить
  window.addEventListener('keydown', (e) => {
    if (e.code === 'ArrowLeft') aimX -= 10;
    else if (e.code === 'ArrowRight') aimX += 10;
    else if (e.code === 'Space') { e.preventDefault(); drop(); }
  });

  el.restart.addEventListener('click', restart);

  function restart() {
    Composite.clear(engine.world, true); // true = оставить статические стены
    mergeQueue.length = 0;
    score = 0;
    gameOver = false;
    canDrop = true;
    el.status.textContent = 'Продолжай!';
    nextLevel = randomSpawnLevel();
    updateScoreUI();
    updatePreview();
  }

  // ================= СТАРТ =================

  function init() {
    measure();
    aimX = W / 2;
    addWalls();

    nextLevel = randomSpawnLevel();
    updatePreview();
    updateScoreUI();

    const runner = Runner.create();
    Runner.run(runner, engine);
    draw();
  }

  window.addEventListener('resize', measure);

  init();
})();