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
    { name: 'Компсогнат', desc: 'Самый маленький.', r: 18, color: '#e6de94', points: 1, sprite: 'images/dino1.webp' },
    { name: 'Птеранодон', desc: 'Парит в небе.', r: 25, color: '#cbd4c7', points: 3, sprite: 'images/dino2.webp' },
    { name: 'Велоцираптор', desc: 'Быстрый охотник.', r: 32, color: '#9db4f7', points: 6, sprite: 'images/dino3.webp' },
    { name: 'Пахицефалозавр', desc: 'Боньк.', r: 40, color: '#f2b29e', points: 10, sprite: 'images/dino4.webp' },
    { name: 'Диллофозавр', desc: 'Ночной кошмар.', r: 48, color: '#f4d1e8', points: 15, sprite: 'images/dino5.webp' },
    { name: 'Тенонтозавр', desc: 'Лошадка.', r: 56, color: '#ecd3ad', points: 21, sprite: 'images/dino6.webp' },
    { name: 'Карнотавр', desc: 'Динозавр бык.', r: 64, color: '#edb1ad', points: 28, sprite: 'images/dino7.webp' },
    { name: 'Кентрозавр', desc: 'С костяными пластинами.', r: 72, color: '#ede1b7', points: 36, sprite: 'images/dino8.webp' },
    { name: 'Тираннозавр', desc: 'Король ящеров.', r: 82, color: '#edc2af', points: 45, sprite: 'images/dino9.webp' },
    { name: 'Трицератопс', desc: 'Король мёртв, да здравствует король', r: 92, color: '#ecdbbb', points: 55, sprite: 'images/dino10.webp' },
    { name: 'Брахиозавр', desc: 'Гигант.', r: 106, color: '#eab7a1', points: 66, sprite: 'images/dino11.webp' }
  ];

  const SPRITE_SCALE = 0.9;
  const MAX_LEVEL = DINOS.length - 1;
  const SPAWN_LEVELS = 5;
  const DROP_COOLDOWN = 500;
  const GRACE_MS = 1500;
  const BEST_KEY = 'dinoSuikaBest';
  const GAME_OVER_DELAY_MS = 3000;
  const MAX_SUBMIT_SCORE = 100000;

  // Фиксированные логические координаты физического мира.
  const WORLD_WIDTH = 500;
  const WORLD_HEIGHT = 640;
  const WALL = 60;
  const DPR_LIMIT = 2;

  // Звуки drop и land удалены - проверка лага
  const SOUND_FILES = {
    merge: 'sounds/melon.mp3',
    bigMerge: 'sounds/troodon.mp3',
    countdown: 'sounds/click.mp3',
    gameOver: 'sounds/boom.mp3',
    restart: 'sounds/sword.mp3'
  };

  const SOUND_VOLUME = {
    merge: 0.35,
    bigMerge: 0.65,
    countdown: 0.3,
    gameOver: 1,
    restart: 0.4
  };

  const audioPool = {};

  for (const [name, src] of Object.entries(SOUND_FILES)) {
    const audio = new Audio(src);
    audio.preload = 'auto';
    audioPool[name] = audio;
  }

function playSound(name) {
  const source = audioPool[name];
  if (!source) return;

  const audio = source.cloneNode();
  audio.volume = SOUND_VOLUME[name] ?? 0.5;

  audio.play().catch((error) => {
    if (error.name !== 'AbortError') {
      console.warn(`Не удалось проиграть звук "${name}":`, error);
    }
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

  const leaderboard = {
    form: document.querySelector('#score-form'),
    name: document.querySelector('#player-name'),
    list: document.querySelector('#leaderboard-list'),
    message: document.querySelector('#leaderboard-message')
  };

  if (
    !window.supabase ||
    !el.area ||
    !el.limitImg ||
    !el.curScore ||
    !el.bestScore ||
    !el.status ||
    !el.nextName ||
    !el.nextDesc ||
    !el.preview ||
    !el.restart ||
    !el.countdown ||
    !leaderboard.form ||
    !leaderboard.name ||
    !leaderboard.list ||
    !leaderboard.message
  ) {
    console.error('Не найдены необходимые элементы игры в HTML или библиотека Supabase.');
    return;
  }

  // ================= ФИЗИКА И CANVAS =================
  const engine = Engine.create();
  engine.gravity.y = 1;
  engine.positionIterations = 10;
  engine.velocityIterations = 8;

  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = [
    'position:absolute',
    'inset:0',
    'display:block',
    'width:100%',
    'height:100%',
    'cursor:pointer',
    'touch-action:none',
    '-webkit-tap-highlight-color:transparent',
    '-webkit-touch-callout:none',
    'user-select:none',
    '-webkit-user-select:none'
  ].join(';');

  el.area.appendChild(canvas);

  const ctx = canvas.getContext('2d');

  if (!ctx) {
    console.error('Не удалось создать Canvas 2D-контекст.');
    return;
  }

  DINOS.forEach((dino) => {
    dino.img = new Image();
    dino.img.onload = () => {
      // Новый кадр появится в следующем requestAnimationFrame.
    };
    dino.img.src = dino.sprite;
  });

  let W = 0;
  let H = 0;
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;
  let limitY = 0;

  let wallBodies = [];

  let score = 0;
  let best = Number(localStorage.getItem(BEST_KEY)) || 0;
  let gameOver = false;
  let gameStartedAt = Date.now();
  let scoreSubmitted = false;
  let canDrop = true;
  let aimX = WORLD_WIDTH / 2;
  let nextLevel = 0;

  let dangerStartedAt = null;
  let lastCountdownSecond = null;

  let resizeFrame = 0;


  const mergeQueue = [];

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const randomSpawnLevel = () => Math.floor(Math.random() * SPAWN_LEVELS);
  const fmt = (number) => number.toLocaleString('ru-RU');

  function getDpr() {
    return Math.min(window.devicePixelRatio || 1, DPR_LIMIT);
  }

  function setCanvasSize() {
    const dpr = getDpr();
    const pixelWidth = Math.max(1, Math.round(W * dpr));
    const pixelHeight = Math.max(1, Math.round(H * dpr));

    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
  }

  function getLimitY() {
    const areaRect = el.area.getBoundingClientRect();
    const limitRect = el.limitImg.getBoundingClientRect();
    const cssY = limitRect.top - areaRect.top + limitRect.height / 2;

    return clamp((cssY - offsetY) / scale, 0, WORLD_HEIGHT);
  }

  function createWalls() {
    const options = {
      isStatic: true,
      friction: 0.1,
      restitution: 0.8,
      label: 'wall'
    };

    return [
      Bodies.rectangle(
        WORLD_WIDTH / 2,
        WORLD_HEIGHT + WALL / 2,
        WORLD_WIDTH + WALL * 2,
        WALL,
        options
      ),
      Bodies.rectangle(
        -WALL / 2,
        WORLD_HEIGHT / 2,
        WALL,
        WORLD_HEIGHT * 3,
        options
      ),
      Bodies.rectangle(
        WORLD_WIDTH + WALL / 2,
        WORLD_HEIGHT / 2,
        WALL,
        WORLD_HEIGHT * 3,
        options
      )
    ];
  }

  function measure() {
    const nextW = el.area.clientWidth;
    const nextH = el.area.clientHeight;

    if (!nextW || !nextH) return;

    // При resize меняется только отображение.
    // Позиции, скорости и физические тела не преобразуются.
    W = nextW;
    H = nextH;

    scale = Math.min(W / WORLD_WIDTH, H / WORLD_HEIGHT);
    offsetX = (W - WORLD_WIDTH * scale) / 2;
    offsetY = (H - WORLD_HEIGHT * scale) / 2;

    setCanvasSize();

    limitY = getLimitY();
    aimX = clamp(
      aimX,
      DINOS[nextLevel].r,
      WORLD_WIDTH - DINOS[nextLevel].r
    );
  }

  // ================= ДИНОЗАВРЫ =================
  function createDino(level, x, y) {
    const dino = DINOS[level];

    const body = Bodies.circle(x, y, dino.r, {
      label: 'dino',
      restitution: 0.25,
      friction: 0.8,
      frictionStatic: 0.12,
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
    const x = clamp(aimX, radius, WORLD_WIDTH - radius);

    createDino(level, x, radius + 2);

    canDrop = false;
    window.setTimeout(() => {
      canDrop = true;
    }, DROP_COOLDOWN);

    nextLevel = randomSpawnLevel();
    updatePreview();

    aimX = clamp(
      aimX,
      DINOS[nextLevel].r,
      WORLD_WIDTH - DINOS[nextLevel].r
    );
  }

  // Обработчик и ставит одинаковые динозавры в очередь слияния.
  Events.on(engine, 'collisionStart', (event) => {
    for (const { bodyA, bodyB } of event.pairs) {
      const a = bodyA;
      const b = bodyB;

      if (a.label !== 'dino' && b.label !== 'dino') continue;

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
  });

  function processMerges() {
  while (mergeQueue.length) {
    const { a, b } = mergeQueue.shift();
    const level = a.dinoLevel;

    Composite.remove(engine.world, a);
    Composite.remove(engine.world, b);

    const nextLevel = level === MAX_LEVEL ? 0 : level + 1;
    const radius = DINOS[nextLevel].r;

    const x = clamp(
      (a.position.x + b.position.x) / 2,
      radius,
      WORLD_WIDTH - radius
    );

    const y = clamp(
      (a.position.y + b.position.y) / 2,
      radius,
      WORLD_HEIGHT - radius
    );

    createDino(nextLevel, x, y);

    const points = level === MAX_LEVEL
      ? DINOS[level].points * 2
      : DINOS[level + 1].points;

    addScore(points);
    playSound(level === MAX_LEVEL ? 'bigMerge' : 'merge');
  }
}

  // ================= ПРОВЕРКА ПРОИГРЫША =================
  function checkGameOver(now) {
    const bodies = Composite.allBodies(engine.world);

    const dinoAboveLine = bodies.some((body) => {
      if (body.label !== 'dino' || body.removed) return false;
      if (now - body.dropTime <= GRACE_MS) return false;

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
  }

  // ================= ОТРИСОВКА =================
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
    if (!W || !H) {
      window.requestAnimationFrame(draw);
      return;
    }

    const dpr = getDpr();

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.setTransform(
      dpr * scale,
      0,
      0,
      dpr * scale,
      dpr * scale * offsetX,
      dpr * scale * offsetY
    );

    for (const body of Composite.allBodies(engine.world)) {
      if (body.label !== 'dino' || body.removed) continue;
      drawDino(body);
    }

    if (!gameOver) {
      const dino = DINOS[nextLevel];
      const x = clamp(aimX, dino.r, WORLD_WIDTH - dino.r);
      const y = dino.r + 2;

      ctx.save();
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath();
      ctx.moveTo(x, y + dino.r);
      ctx.lineTo(x, WORLD_HEIGHT);
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

    window.requestAnimationFrame(draw);
  }

  // ================= ИГРОВОЙ ЦИКЛ =================
  Events.on(engine, 'afterUpdate', () => {
    processMerges();

    if (!gameOver) {
      checkGameOver(performance.now());
    }
  });

  // ================= УПРАВЛЕНИЕ =================
  function pointerToWorldX(event) {
    const rect = canvas.getBoundingClientRect();
    const cssX = event.clientX - rect.left;
    const worldX = (cssX - offsetX) / scale;

    return clamp(
      worldX,
      DINOS[nextLevel].r,
      WORLD_WIDTH - DINOS[nextLevel].r
    );
  }

  el.area.addEventListener('pointermove', (event) => {
    aimX = pointerToWorldX(event);
  });

  el.area.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    aimX = pointerToWorldX(event);
    drop();
  });

  window.addEventListener('keydown', (event) => {
    if (event.code === 'ArrowLeft') {
      aimX = clamp(
        aimX - 10,
        DINOS[nextLevel].r,
        WORLD_WIDTH - DINOS[nextLevel].r
      );
    } else if (event.code === 'ArrowRight') {
      aimX = clamp(
        aimX + 10,
        DINOS[nextLevel].r,
        WORLD_WIDTH - DINOS[nextLevel].r
      );
    } else if (event.code === 'Space' && !event.repeat) {
      event.preventDefault();
      drop();
    }
  });

  // ================= ТАБЛИЦА ЛИДЕРОВ =================
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
      leaderboard.message.textContent = 'Ах ты грёбаный читер.';
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
      leaderboard.message.textContent = 'Не получилось сохранить результат.';
      return;
    }

    scoreSubmitted = true;
    leaderboard.message.textContent = 'Результат сохранён!';
    await loadLeaderboard();
  });

  // ================= РЕСТАРТ =================
  function restart() {
    playSound('restart');

    Composite.clear(engine.world, true);
    mergeQueue.length = 0;

    wallBodies = createWalls();
    Composite.add(engine.world, wallBodies);

    dangerStartedAt = null;
    lastCountdownSecond = null;
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
    aimX = clamp(
      aimX,
      DINOS[nextLevel].r,
      WORLD_WIDTH - DINOS[nextLevel].r
    );

    updateScoreUI();
    updatePreview();
  }

  el.restart.addEventListener('click', restart);

  // ================= RESIZE И ПОВОРОТ =================
  function scheduleMeasure() {
    if (resizeFrame) {
      window.cancelAnimationFrame(resizeFrame);
    }

    resizeFrame = window.requestAnimationFrame(() => {
      resizeFrame = 0;
      measure();
    });
  }

  window.addEventListener('resize', scheduleMeasure, { passive: true });
  window.addEventListener('orientationchange', scheduleMeasure, { passive: true });

  if ('ResizeObserver' in window) {
    const resizeObserver = new ResizeObserver(scheduleMeasure);
    resizeObserver.observe(el.area);
  }

  // ================= СТАРТ =================
  function init() {
    measure();

    wallBodies = createWalls();
    Composite.add(engine.world, wallBodies);

    aimX = WORLD_WIDTH / 2;
    nextLevel = randomSpawnLevel();

    updatePreview();
    updateScoreUI();

    const runner = Runner.create();
    Runner.run(runner, engine);

    window.requestAnimationFrame(draw);
    loadLeaderboard();
  }

  init();
  //=============ТЕСТИРОВАНИЕ==============
  //window.testGameSound = (name = 'merge') => playSound(name);

  //window.spawnBiggestDino = () => {
  //const level = DINOS.length - 1;
  //const radius = DINOS[level].r;
  //const x = clamp(aimX, radius, WORLD_WIDTH - radius);

  //return createDino(level, x, radius + 2);
//};



})();
