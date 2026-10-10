// Просмотрщик утреннего выпуска «Нуар-мафии».
// Слайды и подписи берутся из issue.json. Другой выпуск можно открыть,
// указав файл в адресе страницы: index.html?issue=issue-2.json
(function () {
  'use strict';

  var FADE_MS = 500;          // уход в чёрное и выход из него — вместе около секунды
  var CAPTION_DELAY_MS = 250; // пауза между проявившейся картинкой и подписью
  var SWIPE_MIN_PX = 40;      // движение пальца короче этого считается тапом

  var stage = document.getElementById('stage');
  var image = document.getElementById('slide-image');
  var caption = document.getElementById('caption');
  var captionText = document.getElementById('caption-text');
  var veil = document.getElementById('veil');
  var message = document.getElementById('message');

  var slides = [];
  var current = -1;
  var busy = false;
  var captionTimer = null;

  function wait(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function preload(index) {
    if (slides[index]) new Image().src = slides[index].image;
  }

  async function show(index) {
    if (busy || index < 0 || index >= slides.length || index === current) return;
    busy = true;

    clearTimeout(captionTimer);
    caption.classList.remove('shown');

    // Уходим в чёрное (на первом слайде экран и так чёрный).
    if (current !== -1) {
      veil.classList.remove('off');
      await wait(FADE_MS);
    }

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

    // Выходим из чёрного, потом показываем подпись.
    veil.classList.add('off');
    await wait(FADE_MS);
    busy = false;

    if (slide.caption) {
      captionTimer = setTimeout(function () { caption.classList.add('shown'); }, CAPTION_DELAY_MS);
    }
    preload(index + 1);
  }

  function next() { show(current + 1); }
  function prev() { show(current - 1); }

  // Тап — вперёд. Свайп влево — вперёд, свайп вправо — назад.
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
      if (dx < 0) next(); else prev();
    } else if (Math.abs(dx) < SWIPE_MIN_PX && Math.abs(dy) < SWIPE_MIN_PX) {
      next();
    }
  });

  stage.addEventListener('pointercancel', function () { touchStart = null; });

  // Клавиатура — для просмотра на компьютере.
  document.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') next();
    if (e.key === 'ArrowLeft') prev();
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
