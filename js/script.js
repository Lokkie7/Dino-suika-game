(() => {
  const { Engine, Runner, Bodies, Composite, Events } = Matter;

const SUPABASE_URL = 'https://xguggrjrlfztcyebdmrw.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_N6CPgWedpnQWcba2h_w9Cg_vdGj4pU3';

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

  // ================= НАСТРОЙКИ =================
  const DINOS = [
    {
      name: 'Компсогнат',
      desc: 'Самый маленький.',
      r: 17,
      color: '#e6de94',
      points: 1,
      sprite: 'images/dino1.webp'
    },
    {
      name: 'Птеранодон',
      desc: 'Парит в небе.',
      r: 23,
      color: '#cbd4c7',
      points: 3,
      sprite: 'images/dino2.webp'
    },
    {
      name: 'Велоцираптор',
      desc: 'Быстрый охотник.',
      r: 29,
      color: '#9db4f7',
      points: 6,
      sprite: 'images/dino3.webp'
    },
    {
      name: 'Пахицефалозавр',
      desc: 'Боньк.',
      r: 35,
      color: '#f2b29e',
      points: 10,
      sprite: 'images/dino4.webp'
    },
    {
      name: 'Диллофозавр',
      desc: 'Ночной кошмар.',
      r: 42,
      color: '#f4d1e8',
      points: 15,
      sprite: 'images/dino5.webp'
    },
    {
      name: 'Тенонтозавр',
      desc: 'Лошадка.',
      r: 48,
      color: '#ecd3ad',
      points: 21,
      sprite: 'images/dino6.webp'
    },
    {
      name: 'Карнотавр',
      desc: 'Динозавр бык.',
      r: 56,
      color: '#edb1ad',
      points: 28,
      sprite: 'images/dino7.webp'
    },
    {
      name: 'Кентрозавр',
      desc: 'С костяными пластинами.',
      r: 64,
      color: '#ede1b7',
      points: 36,
      sprite: 'images/dino8.webp'
    },
    {
      name: 'Тираннозавр',
      desc: 'Король ящеров.',
      r: 72,
      color: '#edc2af',
      points: 45,
      sprite: 'images/dino9.webp'
    },
    {
      name: 'Трицератопс',
      desc: 'Король мёртв, да здравствует король',
      r: 80,
      color: '#ecdbbb',
      points: 55,
      sprite: 'images/dino10.webp'
    },
    {
      name: 'Брахиозавр',
      desc: 'Гигант.',
      r: 88,
      color: '#eab7a1',
      points: 66,
      sprite: 'images/dino11.webp'
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



const SOUND_FILES = {
  drop: 'sounds/swist.mp3',
  land: 'sounds/stuk.mp3',
  merge: 'sounds/melon.mp3',
  bigMerge: 'sounds/troodon.mp3',
  countdown: 'sounds/click.mp3',
  gameOver: 'sounds/boom.mp3',
  restart: 'sounds/sword.mp3'
};

const SOUND_VOLUME = {
  drop: 0.1,
  land: 0.2,
  merge: 0.35,
  bigMerge: 0.65,
  countdown: 0.3,
  gameOver: 0.55,
  restart: 0.4
};

function playSound(name) {
  const src = SOUND_FILES[name];
  if (!src) return;

  const audio = new Audio(src);
  audio.volume = SOUND_VOLUME[name] ?? 0.5;

  audio.play().catch((error) => {
    // Автовоспроизведение может быть запрещено до действия игрока.
    console.warn(`Не удалось проиграть звук "${name}":`, error);
  });
}


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
    restart: document.querySelector('.replay-button'),
    countdown: document.querySelector('.danger-countdown')
  };

  const GAME_OVER_DELAY_MS = 3000;
  let dangerStartedAt = null;
  let lastCountdownSecond = null;
  let lastLandSoundAt = 0;
  const LAND_SOUND_COOLDOWN_MS = 120;


  if (
    !el.area ||
    !el.limitImg ||
    !el.curScore ||
    !el.bestScore ||
    !el.status ||
    !el.nextName ||
    !el.nextDesc ||
    !el.preview ||
    !el.restart ||
    !el.countdown
  ) {
    console.error('Не найдены необходимые элементы игры в HTML.');
    return;
  }

  // Canvas поверх игровой зоны
  const canvas = document.createElement('canvas');
  canvas.style.cssText = `
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  cursor: pointer;
  touch-action: none;
  -webkit-tap-highlight-color: transparent;
  -webkit-touch-callout: none;
  user-select: none;
  -webkit-user-select: none;
`;
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

const MAX_SUBMIT_SCORE = 10000;
let gameStartedAt = Date.now();
let scoreSubmitted = false;
  let canDrop = true;
  let aimX = 0;
  let nextLevel = 0;

  const mergeQueue = [];

  const leaderboard = {
  form: document.querySelector('#score-form'),
  name: document.querySelector('#player-name'),
  list: document.querySelector('#leaderboard-list'),
  message: document.querySelector('#leaderboard-message')
};

async function loadLeaderboard() {
  const { data, error } = await supabaseClient
    .from('scores')
    .select('player_name, score, duration_seconds, created_at')
    .order('score', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Не удалось загрузить таблицу:', error);
    leaderboard.message.textContent = 'Не удалось загрузить таблицу лидеров.';
    return;
  }

  leaderboard.list.replaceChildren();

  for (const entry of data) {
    const item = document.createElement('li');
    item.textContent = `${entry.player_name} — ${entry.score}`;
    leaderboard.list.appendChild(item);
  }
}

leaderboard.form.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (!gameOver) {
    leaderboard.message.textContent = 'Сначала закончи игру.';
    return;
  }

  if (scoreSubmitted) {
    leaderboard.message.textContent = 'Результат этой игры уже отправлен.';
    return;
  }

  const playerName = leaderboard.name.value.trim().slice(0, 20);

  if (!playerName) {
    leaderboard.message.textContent = 'Введите имя.';
    return;
  }

  if (
    !Number.isSafeInteger(score) ||
    score < 0 ||
    score > MAX_SUBMIT_SCORE
  ) {
    leaderboard.message.textContent = 'Этот результат не принимается. читер.';
    return;
  }

  const durationSeconds = Math.floor(
    (Date.now() - gameStartedAt) / 1000
  );

  if (durationSeconds < 10) {
    leaderboard.message.textContent =
      'Ах ты грёбаный читер.';
    return;
  }

  const { error } = await supabaseClient
    .from('scores')
    .insert({
      player_name: playerName,
      score,
      duration_seconds: durationSeconds
    });

  if (error) {
    console.error('Не удалось сохранить результат:', error);
    leaderboard.message.textContent =
      'Не получилось сохранить результат.';
    return;
  }

  scoreSubmitted = true;
  leaderboard.message.textContent = 'Результат сохранён!';
  await loadLeaderboard();
});

loadLeaderboard();



  // ================= УТИЛИТЫ =================
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const randomSpawnLevel = () => Math.floor(Math.random() * SPAWN_LEVELS);
  const fmt = (number) => number.toLocaleString('ru-RU');

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

//физика коробки

  function addWalls() {
    const options = {
      isStatic: true,
      friction: 0.1, //0.8
      restitution: 0.8,
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

//параметры физики

  const body = Bodies.circle(x, y, dino.r, {
  label: 'dino',
  restitution: 0.25, //0.1
  friction: 0.8, // 0.4
  frictionStatic: 0.12, // 0.6
  frictionAir: 0.015
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
    playSound('drop');
    canDrop = false;
    setTimeout(() => {
      canDrop = true;
    }, DROP_COOLDOWN);

    nextLevel = randomSpawnLevel();
    updatePreview();
  }

  // ================= СЛИЯНИЕ =================
Events.on(engine, 'collisionStart', (event) => {
  let hasDinoCollision = false;

  for (const { bodyA, bodyB } of event.pairs) {
    const a = bodyA;
    const b = bodyB;

    if (a.label !== 'dino' && b.label !== 'dino') {
      continue;
    }

    hasDinoCollision = true;

    // Слияние только двух динозавров одного уровня.
    if (
      a.label !== 'dino' ||
      b.label !== 'dino' ||
      a.removed ||
      b.removed ||
      a.dinoLevel !== b.dinoLevel
    ) {
      continue;
    }

    a.removed = true;
    b.removed = true;
    mergeQueue.push({ a, b });
  }

  // Тихий звук контакта, ограниченный кулдауном.
  const now = performance.now();

  if (
    hasDinoCollision &&
    now - lastLandSoundAt >= LAND_SOUND_COOLDOWN_MS
  ) {
    lastLandSoundAt = now;
    playSound('land');
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
  playSound('bigMerge');
  addScore(DINOS[level].points * 2);
} else {
  playSound('merge');
  createDino(level + 1, x, y);
  addScore(DINOS[level + 1].points);
}
    }
  }

  // ================= ПРОВЕРКА ПРОИГРЫША =================
function checkGameOver(now) {
  const bodies = Composite.allBodies(engine.world);

  const dinoAboveLine = bodies.some((body) => {
    if (body.label !== 'dino' || body.removed) return false;

    const graceOver = now - body.dropTime > GRACE_MS;
    if (!graceOver) return false;

    const radius = DINOS[body.dinoLevel].r;
    return body.position.y - radius < limitY;
  });

if (!dinoAboveLine) {
  dangerStartedAt = null;
  lastCountdownSecond = null;
  el.status.textContent = 'Продолжай!';
  el.countdown.textContent = '';
  el.countdown.classList.remove('is-active', 'is-urgent');
  return;
}

  if (dangerStartedAt === null) {
    dangerStartedAt = now;
    el.countdown.classList.add('is-active');
  }

  const remainingMs = GAME_OVER_DELAY_MS - (now - dangerStartedAt);

  if (remainingMs <= 0) {
    el.countdown.textContent = '';
    el.countdown.classList.remove('is-active', 'is-urgent');
    endGame();
    return;
  }

  const remainingSeconds = Math.ceil(remainingMs / 1000);

if (remainingSeconds !== lastCountdownSecond) {
  lastCountdownSecond = remainingSeconds;
  playSound('countdown');
}

el.status.textContent = `Игра окончится через ${remainingSeconds} сек.`;
el.countdown.textContent = String(remainingSeconds);
el.countdown.classList.toggle('is-urgent', remainingSeconds === 1);
}

function endGame() {
  if (gameOver) return;

  gameOver = true;
  playSound('gameOver');
  el.countdown.textContent = '';
  el.countdown.classList.remove('is-active', 'is-urgent');

  el.status.textContent = 'Игра окончена';
  leaderboard.message.textContent = 'Введите имя и отправьте результат.';
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
  playSound('restart');

  Composite.clear(engine.world, true);
  mergeQueue.length = 0;

  dangerStartedAt = null;
  score = 0;
  gameOver = false;
  canDrop = true;
  scoreSubmitted = false;
  gameStartedAt = Date.now();

  leaderboard.message.textContent = '';
  el.status.textContent = 'Продолжай!';
  el.countdown.textContent = '';
  el.countdown.classList.remove('is-active', 'is-urgent');
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