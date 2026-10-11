// Карта Нью-Аркхейма в мини-приложении.
// Картинка карты — чёрно-белая. Подсветка районов и метки рисуются кодом поверх неё,
// данные берутся из map.json: районы, кварталы, постоянные точки и заведения сета.
// Заведения меняются каждый сет — перед сетом поправьте список "venues" в map.json.
(function () {
  'use strict';

  var ZOOM = 2;                 // во сколько раз приближает кнопка «＋»
  var LABEL_DIVIDER = 42;       // размер текста меток = ширина карты / это число
  var LABEL_MIN_PX = 8;
  var LABEL_MAX_PX = 12;
  var COLUMNS = 'ABCDE';

  var viewport = document.getElementById('viewport');
  var map = document.getElementById('map');
  var image = document.getElementById('map-image');
  var tint = document.getElementById('tint');
  var labels = document.getElementById('labels');
  var zoomButton = document.getElementById('zoom');
  var tintButton = document.getElementById('toggle-tint');
  var labelsButton = document.getElementById('toggle-labels');
  var sheet = document.getElementById('sheet');
  var sheetTitle = document.getElementById('sheet-title');
  var sheetText = document.getElementById('sheet-text');
  var message = document.getElementById('message');

  var data = null;
  var zoomed = false;
  var selected = null;
  var venueLabels = [];

  function percentX(px) { return (px / data.imageWidth * 100) + '%'; }
  function percentY(px) { return (px / data.imageHeight * 100) + '%'; }

  // Прямоугольник квартала в пикселях исходной картинки.
  function cellBox(code) {
    var c = COLUMNS.indexOf(code.charAt(0));
    var r = parseInt(code.slice(1), 10) - 1;
    var x = data.columns[c];
    var y = data.rows[r];
    return { x0: x[0], x1: x[1], y0: y[0], y1: y[1] };
  }

  function venuesIn(code) {
    return data.venues.filter(function (v) { return v.cell === code; });
  }

  function addLabel(text, x, y, extraClass) {
    var el = document.createElement('div');
    el.className = 'label' + (extraClass ? ' ' + extraClass : '');
    el.textContent = text;
    el.style.left = percentX(x);
    el.style.top = percentY(y);
    labels.appendChild(el);
    return el;
  }

  function build() {
    Object.keys(data.cells).forEach(function (code) {
      var cell = data.cells[code];
      var district = data.districts[cell.district] || {};
      var b = cellBox(code);

      // Зона квартала: подсветка и нажатие.
      var zone = document.createElement('div');
      zone.className = 'cell';
      zone.dataset.code = code;
      zone.style.left = percentX(b.x0);
      zone.style.top = percentY(b.y0);
      zone.style.width = percentX(b.x1 - b.x0);
      zone.style.height = percentY(b.y1 - b.y0);
      if (district.color) {
        var fill = document.createElement('div');
        fill.className = 'fill';
        fill.style.background = district.color;
        zone.appendChild(fill);
      }
      zone.addEventListener('click', function (e) {
        e.stopPropagation();
        select(code, zone);
      });
      tint.appendChild(zone);

      // Метки: код квартала в углу, постоянная точка и заведения в середине.
      addLabel(code, b.x0 + 6, b.y0 + 6, 'code');
      var midX = (b.x0 + b.x1) / 2;
      var h = b.y1 - b.y0;
      // Метки — в нижней части квартала, чтобы не закрывать неон мэрии и участка.
      if (cell.place) addLabel(cell.place, midX, b.y0 + h * 0.84);
      venuesIn(code).forEach(function (v, i) {
        var el = addLabel('', midX, b.y0 + h * (cell.place ? 0.62 - i * 0.18 : 0.8 - i * 0.18), 'venue');
        venueLabels.push({ el: el, venue: v });
      });
    });
    updateVenueText();
  }

  // Издалека у заведения видно только тип, вблизи — название.
  function updateVenueText() {
    venueLabels.forEach(function (item) {
      item.el.textContent = zoomed ? item.venue.name : (data.venueTypes[item.venue.type] || item.venue.name);
    });
  }

  function select(code, zone) {
    if (selected) selected.classList.remove('selected');
    if (selected === zone) {
      closeSheet();
      return;
    }
    selected = zone;
    zone.classList.add('selected');

    var cell = data.cells[code];
    var district = data.districts[cell.district] || {};
    var lines = [];
    if (cell.place) lines.push(cell.place);
    venuesIn(code).forEach(function (v) { lines.push(v.name); });
    if (!lines.length) lines.push('Жилые дома, ничего примечательного.');

    sheetTitle.textContent = code + ' · ' + (district.name || '');
    sheetText.textContent = lines.join('\n');
    sheet.hidden = false;
  }

  function closeSheet() {
    if (selected) selected.classList.remove('selected');
    selected = null;
    sheet.hidden = true;
  }

  // Карта целиком на экране; при приближении — вдвое шире, экран прокручивается.
  function layout() {
    if (!data) return;
    var fitW = Math.min(viewport.clientWidth, viewport.clientHeight * data.imageWidth / data.imageHeight);
    var w = Math.floor(fitW * (zoomed ? ZOOM : 1));
    map.style.width = w + 'px';
    var size = Math.max(LABEL_MIN_PX, Math.min(LABEL_MAX_PX, w / LABEL_DIVIDER));
    map.style.setProperty('--label-size', size.toFixed(1) + 'px');
  }

  function toggleZoom() {
    // Приближаем к середине того, что сейчас видно.
    var cx = (viewport.scrollLeft + viewport.clientWidth / 2) / map.offsetWidth;
    var cy = (viewport.scrollTop + viewport.clientHeight / 2) / Math.max(1, map.offsetHeight);
    zoomed = !zoomed;
    zoomButton.textContent = zoomed ? '－' : '＋';
    zoomButton.setAttribute('aria-label', zoomed ? 'Отдалить' : 'Приблизить');
    layout();
    updateVenueText();
    viewport.scrollLeft = cx * map.offsetWidth - viewport.clientWidth / 2;
    viewport.scrollTop = cy * map.offsetHeight - viewport.clientHeight / 2;
  }

  function toggle(button, className) {
    var on = !button.classList.contains('on');
    button.classList.toggle('on', on);
    button.setAttribute('aria-pressed', String(on));
    map.classList.toggle(className, !on);
  }

  function showMessage(text) {
    message.textContent = text;
    message.hidden = false;
  }

  zoomButton.addEventListener('click', toggleZoom);
  tintButton.addEventListener('click', function () { toggle(tintButton, 'no-tint'); });
  labelsButton.addEventListener('click', function () { toggle(labelsButton, 'no-labels'); });
  sheet.addEventListener('click', closeSheet);
  viewport.addEventListener('click', closeSheet);
  window.addEventListener('resize', layout);

  fetch('map.json', { cache: 'no-cache' })
    .then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    })
    .then(function (json) {
      data = json;
      document.getElementById('title').textContent = data.title || 'Нью-Аркхейм';
      image.onload = function () {
        layout();
        build();
      };
      image.onerror = function () { showMessage('Не удалось загрузить карту.'); };
      image.src = data.image;
    })
    .catch(function () {
      showMessage('Не удалось загрузить карту. Попробуйте открыть заново.');
    });
})();
