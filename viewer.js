// Просмотрщик утреннего выпуска «Нуар-мафии».
// Слайды и подписи берутся из issue.json. Другой выпуск можно открыть,
// указав файл в адресе страницы: index.html?issue=issue-2.json
//
// Вертикальная картинка показывается целиком, подпись — на полосе внизу.
// Горизонтальный кадр показывается в два этапа:
//   1) панорама — картинка во всю высоту экрана, камера едет от края до края;
//   2) кадр комикса — картинка уменьшается до ширины экрана, встаёт в рамку,
//      под ней появляется подпись.
(function () {
  'use strict';

  var FADE_MS = 500;          // уход в чёрное и выход из него — вместе около секунды
  var CAPTION_DELAY_MS = 250; // пауза между проявившейся картинкой и подписью
  var SWIPE_MIN_PX = 40;      // движение пальца короче этого считается тапом
  var PAN_MS = 7000;          // панорама по горизонтальному кадру от края до края
  var SHRINK_MS = 1500;       // переход от панорамы к кадру комикса
  var PANEL_MARGIN_PX = 16;   // поля слева и справа от кадра комикса
  var CAPTION_GAP_PX = 20;    // расстояние от кадра комикса до подписи

  var stage = document.getElementById('stage');
  var image = document.getElementById('slide-image');
  var frame = document.getElementById('frame');
  var caption = document.getElementById('caption');
  var captionText = document.getElementById('caption-text');
  var veil = document.getElementById('veil');
  var message = document.getElementById('message');

  var slides = [];
  var current = -1;
  var busy = false;
  var captionTimer = null;
  var motion = null; // текущая анимация картинки
  // Что сейчас на экране: 'still' — вертикальная картинка, 'pan' — панорама,
  // 'shrink' — переход к кадру комикса, 'panel' — кадр комикса.
  var phase = null;

  function wait(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function preload(index) {
    if (slides[index]) new Image().src = slides[index].image;
  }

  function stopMotion() {
    if (motion) motion.cancel();
    motion = null;
  }

  function isWide() {
    var w = image.naturalWidth;
    var h = image.naturalHeight;
    return w > h && w / h > stage.clientWidth / stage.clientHeight;
  }

  // Горизонтальный кадр лежит во всю высоту экрана от левого края,
  // а сдвиг и уменьшение задаются через transform.
  function geometry() {
    var stageW = stage.clientWidth;
    var stageH = stage.clientHeight;
    var fullW = stageH * image.naturalWidth / image.naturalHeight;
    var panelW = stageW - 2 * PANEL_MARGIN_PX;
    var scale = panelW / fullW;
    var panelH = stageH * scale;
    // Кадр и подпись под ним вместе стоят по центру экрана.
    var captionH = slides[current].caption ? CAPTION_GAP_PX + caption.offsetHeight : 0;
    var top = Math.max(PANEL_MARGIN_PX, (stageH - panelH - captionH) / 2);
    return {
      distance: fullW - stageW,
      panel: { x: PANEL_MARGIN_PX, y: top, w: panelW, h: panelH, scale: scale }
    };
  }

  function panTransform(x) {
    return 'translate(' + x + 'px, 0px) scale(1)';
  }

  function panelTransform(p) {
    return 'translate(' + p.x + 'px, ' + p.y + 'px) scale(' + p.scale + ')';
  }

  function showCaption() {
    clearTimeout(captionTimer);
    if (!slides[current].caption) return;
    captionTimer = setTimeout(function () { caption.classList.add('shown'); }, CAPTION_DELAY_MS);
  }

  // Этап 1: панорама. elapsed — откуда продолжить (после поворота экрана).
  function startPan(elapsed) {
    var g = geometry();
    var from = 0;
    var to = -g.distance;
    if (slides[current].pan === 'right-left') {
      from = -g.distance;
      to = 0;
    }
    phase = 'pan';
    stopMotion();
    motion = image.animate(
      [{ transform: panTransform(from) }, { transform: panTransform(to) }],
      { duration: PAN_MS, easing: 'ease-in-out', fill: 'forwards' }
    );
    if (elapsed) motion.currentTime = elapsed;
    motion.onfinish = shrink;
  }

  // Переход к кадру комикса — с того места, где сейчас камера.
  function shrink() {
    if (phase !== 'pan') return;
    phase = 'shrink';
    var fromX = new DOMMatrix(getComputedStyle(image).transform).e;
    var to = panelTransform(geometry().panel);
    stopMotion();
    image.style.transform = to;
    motion = image.animate(
      [{ transform: panTransform(fromX) }, { transform: to }],
      { duration: SHRINK_MS, easing: 'ease-in-out' }
    );
    motion.onfinish = function () {
      motion = null;
      showPanel();
      showCaption();
    };
  }

  // Этап 2: кадр комикса в рамке, подпись под ним.
  function showPanel() {
    phase = 'panel';
    stopMotion();
    var p = geometry().panel;
    image.style.transform = panelTransform(p);
    frame.style.left = p.x + 'px';
    frame.style.top = p.y + 'px';
    frame.style.width = p.w + 'px';
    frame.style.height = p.h + 'px';
    frame.classList.add('shown');
    caption.style.top = (p.y + p.h + CAPTION_GAP_PX) + 'px';
  }

  // asPanel — горизонтальный кадр сразу в виде кадра комикса (при возврате назад).
  async function show(index, asPanel) {
    if (busy || index < 0 || index >= slides.length || index === current) return;
    busy = true;

    clearTimeout(captionTimer);
    caption.classList.remove('shown');

    // Уходим в чёрное (на первом слайде экран и так чёрный).
    if (current !== -1) {
      veil.classList.remove('off');
      await wait(FADE_MS);
    }

    stopMotion();
    image.className = '';
    image.style.transform = '';
    frame.classList.remove('shown');
    caption.classList.remove('below');
    caption.style.top = '';

    var slide = slides[index];
    image.src = slide.image;
    image.alt = slide.title || '';
    try {
      await image.decode();
    } catch (e) {
      // Картинка не загрузилась — всё равно показываем подпись и идём дальше.
    }
    captionText.textContent = slide.caption || '';
    caption.classList.toggle('empty', !slide.caption);
    current = index;

    if (isWide()) {
      image.classList.add('wide');
      caption.classList.add('below');
      if (asPanel) showPanel(); else startPan();
    } else {
      phase = 'still';
    }

    // Выходим из чёрного, потом показываем подпись.
    veil.classList.add('off');
    await wait(FADE_MS);
    busy = false;

    if (phase === 'still' || phase === 'panel') showCaption();
    preload(index + 1);
  }

  // Тап (и свайп влево): во время панорамы — к кадру комикса, иначе — следующий слайд.
  function forward() {
    if (busy) return;
    if (phase === 'pan') shrink();
    else if (phase === 'shrink') motion.finish();
    else show(current + 1);
  }

  function back() {
    show(current - 1, true);
  }

  // Экран поменял размер (повернули телефон, Telegram развернул окно) —
  // пересчитываем положение картинки.
  window.addEventListener('resize', function () {
    if (phase === 'pan') startPan(motion ? motion.currentTime : 0);
    else if (phase === 'shrink') motion.finish();
    else if (phase === 'panel') showPanel();
  });

  var touchStart = null;

  stage.addEventListener('pointerdown', function (e) {
    if (!e.isPrimary || e.button !== 0) return;
    touchStart = { x: e.clientX, y: e.clientY };
  });

  stage.addEventListener('pointerup', function (e) {
    if (!touchStart || !e.isPrimary) return;
    var dx = e.clientX - touchStart.x;
    var dy = e.clientY - touchStart.y;
    touchStart = null;

    if (Math.abs(dx) >= SWIPE_MIN_PX && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) forward(); else back();
    } else if (Math.abs(dx) < SWIPE_MIN_PX && Math.abs(dy) < SWIPE_MIN_PX) {
      forward();
    }
  });

  stage.addEventListener('pointercancel', function () { touchStart = null; });

  // Клавиатура — для просмотра на компьютере.
  document.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') forward();
    if (e.key === 'ArrowLeft') back();
  });

  function fail(text) {
    message.textContent = text;
    message.hidden = false;
  }

  var issueUrl = new URLSearchParams(location.search).get('issue') || 'issue.json';

  fetch(issueUrl, { cache: 'no-cache' })
    .then(function (response) {
      if (!response.ok) throw new Error('ошибка ' + response.status);
      return response.json();
    })
    .then(function (issue) {
      slides = (issue.slides || []).filter(function (s) { return s && s.image; });
      if (!slides.length) throw new Error('в выпуске нет слайдов');
      if (issue.title) document.title = issue.title;
      preload(1);
      show(0);
    })
    .catch(function (error) {
      if (location.protocol === 'file:') {
        fail('Браузер не даёт читать выпуск прямо с диска. Откройте страницу двойным щелчком по файлу «Открыть выпуск.command».');
      } else {
        fail('Не удалось загрузить выпуск ' + issueUrl + ': ' + error.message);
      }
    });
})();
