(() => {
  const { Engine, Runner, Bodies, Composite, Events } = Matter;

  // ================= НАСТРОЙКИ =================
  const DINOS = [
    {
      name: 'Компсогнат',
      desc: 'Самый маленький.',
      r: 18,
      color: '#b5d99c',
      points: 1,
      sprite: 'images/dino1.png'
    },
    {
      name: 'Птеранодон',
      desc: 'Парит в небе.',
      r: 25,
      color: '#8ec5e8',
      points: 3,
      sprite: 'images/dino2.png'
    },
    {
      name: 'Велоцираптор',
      desc: 'Быстрый охотник.',
      r: 32,
      color: '#f5c96b',
      points: 6,
      sprite: 'images/dino3.png'
    },
    {
      name: 'Пахицефалозавр',
      desc: 'Боньк.',
      r: 40,
      color: '#9fd3a8',
      points: 10,
      sprite: 'images/dino4.png'
    },
    {
      name: 'Диллофозавр',
      desc: 'Ночной кошмар.',
      r: 48,
      color: '#c9a7e0',
      points: 15,
      sprite: 'images/dino5.png'
    },
    {
      name: 'Тенонтозавр',
      desc: 'Лошадка.',
      r: 56,
      color: '#d9a27a',
      points: 21,
      sprite: 'images/dino6.png'
    },
    {
      name: 'Карнотавр',
      desc: 'Динозавр бык.',
      r: 64,
      color: '#7fb3a6',
      points: 28,
      sprite: 'images/dino7.png'
    },
    {
      name: 'Кентрозавр',
      desc: 'С костяными пластинами.',
      r: 72,
      color: '#e88a7a',
      points: 36,
      sprite: 'images/dino8.png'
    },
    {
      name: 'Тираннозавр',
      desc: 'Король ящеров.',
      r: 82,
      color: '#6fa3d6',
      points: 45,
      sprite: 'images/dino9.png'
    },
    {
      name: 'Трицератопс',
      desc: 'Король мёртв, да здравствует король',
      r: 92,
      color: '#e6c94f',
      points: 55,
      sprite: 'images/dino10.png'
    },
    {
      name: 'Брахиозавр',
      desc: 'Гигант.',
      r: 104,
      color: '#7bb662',
      points: 66,
      sprite: 'images/dino11.png'
    }
  ];

  // Загрузка спрайтов
  DINOS.forEach((dino) => {
    dino.img = new Image();
    dino.img.src = dino.sprite;
  });

  const SPRITE_SCALE = 0.9;
  const MAX_LEVEL = DINOS.length - 1;
  const SPAWN_LEVELS = 5;
  const DROP_COOLDOWN = 500;
  const GRACE_MS = 1500;
  const WALL = 60;
  const BEST_KEY = 'dinoSuikaBest';

  const mergeSound = new Audio('sounds/melon.mp3');mergeSound.volume = 0.5; // Громкость от 0 до 1

  // ================= DOM =================
  const el = {
    area: document.querySelector('.game-canvas-area'),
    limitImg: document.querySelector('.dino-limit-dotted'),
    curScore: document.querySelector('.text-wrapper-7'),
    bestScore: document.querySelector('.text-wrapper-10'),
    status: document.querySelector('.text-wrapper-8'),
    nextName: document.querySelector('.text-wrapper-13'),
    nextDesc: document.querySelector('.text-wrapper-14'),
    preview: document.querySelector('.dino-preview'),
    restart: document.querySelector('.replay-button')
  };

  if (
    !el.area ||
    !el.limitImg ||
    !el.curScore ||
    !el.bestScore ||
    !el.status ||
    !el.nextName ||
    !el.nextDesc ||
    !el.preview ||
    !el.restart
  ) {
    console.error('Не найдены необходимые элементы игры в HTML.');
    return;
  }

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
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const randomSpawnLevel = () => Math.floor(Math.random() * SPAWN_LEVELS);
  const fmt = (number) => number.toLocaleString('ru-RU');

  function playMergeSound() {
  mergeSound.currentTime = 0; // Начать звук сначала
  mergeSound.play().catch((error) => {
    console.warn('Не удалось проиграть звук слияния:', error);
  });
}

  function measure() {
    W = el.area.clientWidth;
    H = el.area.clientHeight;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const areaRect = el.area.getBoundingClientRect();
    const limitRect = el.limitImg.getBoundingClientRect();

    limitY = limitRect.top - areaRect.top + limitRect.height / 2;
  }

  // ================= СТЕНЫ =================
  function addWalls() {
    const options = {
      isStatic: true,
      friction: 0.8,
      label: 'wall'
    };

    Composite.add(engine.world, [
      Bodies.rectangle(
        W / 2,
        H + WALL / 2,
        W + WALL * 2,
        WALL,
        options
      ),
      Bodies.rectangle(
        -WALL / 2,
        H / 2,
        WALL,
        H * 3,
        options
      ),
      Bodies.rectangle(
        W + WALL / 2,
        H / 2,
        WALL,
        H * 3,
        options
      )
    ]);
  }

  // ================= ДИНОЗАВРЫ =================
  function createDino(level, x, y) {
    const dino = DINOS[level];

    const body = Bodies.circle(x, y, dino.r, {
      label: 'dino',
      restitution: 0.1,
      friction: 0.4,
      frictionStatic: 0.6
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
    const radius = DINOS[level].r;
    const x = clamp(aimX, radius + 1, W - radius - 1);

    createDino(level, x, radius + 2);

    canDrop = false;
    setTimeout(() => {
      canDrop = true;
    }, DROP_COOLDOWN);

    nextLevel = randomSpawnLevel();
    updatePreview();
  }

  // ================= СЛИЯНИЕ =================
  Events.on(engine, 'collisionStart', (event) => {
    for (const { bodyA, bodyB } of event.pairs) {
      const a = bodyA;
      const b = bodyB;

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

      playMergeSound();

      Composite.remove(engine.world, a);
      Composite.remove(engine.world, b);

      const x = (a.position.x + b.position.x) / 2;
      const y = (a.position.y + b.position.y) / 2;

      if (level === MAX_LEVEL) {
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

      const radius = DINOS[body.dinoLevel].r;
      const settled = Math.hypot(body.velocity.x, body.velocity.y) < 0.5;
      const aboveLine = body.position.y - radius < limitY;
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

  function updatePreview() {
    const dino = DINOS[nextLevel];

    el.nextName.textContent = dino.name;
    el.nextDesc.textContent = dino.desc;
    el.preview.style.backgroundColor = 'transparent';
    el.preview.style.backgroundImage = `url("${dino.sprite}")`;
    el.preview.style.backgroundSize = 'contain';
    el.preview.style.backgroundRepeat = 'no-repeat';
    el.preview.style.backgroundPosition = 'center';
  }

  // Поворачиваем Canvas так же, как повернулось физическое тело Matter.js
  function drawDino(body, alpha = 1) {
    const dino = DINOS[body.dinoLevel];
    const radius = dino.r;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(body.position.x, body.position.y);
    ctx.rotate(body.angle);

    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fillStyle = dino.color;
    ctx.fill();

    const hasSprite =
      dino.img &&
      dino.img.complete &&
      dino.img.naturalWidth > 0;

    if (hasSprite) {
      const size = radius * 2 * SPRITE_SCALE;
      ctx.drawImage(dino.img, -size / 2, -size / 2, size, size);
    } else if (radius >= 30) {
      ctx.fillStyle = '#455b3d';
      ctx.font = `700 ${Math.round(radius * 0.28)}px Nunito, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(dino.name, 0, 0);
    }

    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(69, 91, 61, 0.6)';
    ctx.stroke();

    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    // Падающие динозавры
    for (const body of Composite.allBodies(engine.world)) {
      if (body.label !== 'dino' || body.removed) continue;
      drawDino(body);
    }

    // «Призрак» следующего динозавра и направляющая
    if (!gameOver) {
      const dino = DINOS[nextLevel];
      const x = clamp(aimX, dino.r + 1, W - dino.r - 1);
      const y = dino.r + 2;

      ctx.save();
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath();
      ctx.moveTo(x, y + dino.r);
      ctx.lineTo(x, H);
      ctx.stroke();
      ctx.restore();

      drawDino(
        {
          dinoLevel: nextLevel,
          position: { x, y },
          angle: 0
        },
        canDrop ? 0.6 : 0.3
      );
    }

    requestAnimationFrame(draw);
  }

  // ================= ИГРОВОЙ ЦИКЛ =================
  Events.on(engine, 'afterUpdate', () => {
    processMerges();

    if (!gameOver) {
      checkGameOver(performance.now());
    }
  });

  // ================= УПРАВЛЕНИЕ =================
  el.area.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    aimX = event.clientX - rect.left;
  });

  el.area.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    aimX = event.clientX - rect.left;
    drop();
  });

  window.addEventListener('keydown', (event) => {
    if (event.code === 'ArrowLeft') {
      aimX -= 10;
    } else if (event.code === 'ArrowRight') {
      aimX += 10;
    } else if (event.code === 'Space') {
      event.preventDefault();
      drop();
    }
  });

  el.restart.addEventListener('click', restart);

  function restart() {
    Composite.clear(engine.world, true);
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