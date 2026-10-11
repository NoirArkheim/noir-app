// Связь с Telegram — и только она. Просмотрщик от этого файла не зависит:
// в обычном браузере или если Telegram недоступен здесь просто ничего не происходит.
(function () {
  'use strict';

  var BLACK = '#000000';

  function setup() {
    var tg = window.Telegram && window.Telegram.WebApp;
    if (!tg || tg.platform === 'unknown') return; // открыто не в Telegram

    // Ссылка t.me/NewArkheimBot?startapp=map открывает сразу карту.
    var start = tg.initDataUnsafe && tg.initDataUnsafe.start_param;
    if (start === 'map' && !/map\.html$/.test(location.pathname)) {
      location.replace('map.html' + location.hash);
      return;
    }

    try {
      tg.ready();
      tg.expand();

      // Тёмная тема: чёрные шапка и фон вокруг страницы.
      if (tg.isVersionAtLeast('6.1')) {
        tg.setHeaderColor(BLACK);
        tg.setBackgroundColor(BLACK);
      }
      if (tg.isVersionAtLeast('7.10')) {
        tg.setBottomBarColor(BLACK);
      }
      // Чтобы случайный вертикальный жест не сворачивал мини-приложение.
      if (tg.isVersionAtLeast('7.7')) {
        tg.disableVerticalSwipes();
      }
    } catch (e) {
      // Старая версия Telegram — работаем без этих настроек.
    }
  }

  var script = document.createElement('script');
  script.src = 'https://telegram.org/js/telegram-web-app.js';
  script.async = true;
  script.onload = setup;
  document.head.appendChild(script);
})();
