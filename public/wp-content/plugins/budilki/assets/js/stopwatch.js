/* Budilki — секундомер: точность до сотых, круги, hash-API (#start=…&laps=…). */
(function () {
	'use strict';

	var B = window.Budilki;
	var L = B.L;

	var baseTitle = document.title;

	var state = {
		startMs: null,     // Date.now() в момент старта (последнего)
		accumMs: 0,        // накопленное время до пауз
		running: false,
		laps: [],          // массив { lap, total } в мс
	};

	var raf = null;

	var el = {
		root: B.root,
		time: document.getElementById('stopwatch-time'),
		btnReset: document.getElementById('btn-sw-reset'),
		btnStart: document.getElementById('btn-sw-start'),
		btnLap: document.getElementById('btn-sw-lap'),
		pnlLaps: document.getElementById('pnl-laps'),
		lapsBody: document.getElementById('laps-body'),
	};

	/* ---------- hash-API ---------- */
	function parseHash() {
		var s = location.hash.replace(/^#/, '');
		var out = {};
		if (!s) return out;
		s.split('&').forEach(function (kv) {
			var i = kv.indexOf('=');
			if (i < 0) { out[decodeURIComponent(kv)] = ''; return; }
			var k = decodeURIComponent(kv.slice(0, i));
			out[k] = decodeURIComponent(kv.slice(i + 1).replace(/\+/g, ' '));
		});
		return out;
	}

	function writeHash() {
		if (!state.running && state.accumMs === 0 && !state.laps.length) {
			location.replace(location.pathname);
			return;
		}
		var parts = [];
		parts.push('start=' + (state.startMs ? state.startMs : ''));
		parts.push('accum=' + state.accumMs);
		if (state.laps.length) parts.push('laps=' + state.laps.map(function (l) { return l.total; }).join('.'));
		location.replace('#' + parts.join('&'));
	}

	/* ---------- форматирование ---------- */
	function pad2(n) { return (n < 10 ? '0' : '') + n; }

	// формат 00:00.00 (по умолчанию). При >=1 часа — ЧЧ:ММ:СС.00
	function fmt(ms) {
		ms = Math.max(0, ms);
		var totalSec = Math.floor(ms / 1000);
		var centi = Math.floor((ms % 1000) / 10);
		var h = Math.floor(totalSec / 3600);
		var m = Math.floor((totalSec % 3600) / 60);
		var s = totalSec % 60;
		var main = (h > 0 ? pad2(h) + ':' : '') + pad2(m) + ':' + pad2(s);
		return main + '.' + pad2(centi);
	}

	function currentMs() {
		if (state.running) return state.accumMs + (Date.now() - state.startMs);
		return state.accumMs;
	}

	/* ---------- отрисовка ---------- */
	function render() {
		el.time.textContent = fmt(currentMs());
		document.title = fmt(currentMs()) + ' - Секундомер';
	}

	function renderLaps() {
		el.lapsBody.innerHTML = '';
		if (!state.laps.length) { el.pnlLaps.hidden = true; return; }
		el.pnlLaps.hidden = false;
		state.laps.forEach(function (lap, i) {
			var tr = document.createElement('tr');
			var tdLap = document.createElement('td');
			tdLap.textContent = i + 1;
			var tdTime = document.createElement('td');
			tdTime.textContent = fmt(lap.lap);
			var tdTotal = document.createElement('td');
			tdTotal.textContent = fmt(lap.total);
			tr.appendChild(tdLap);
			tr.appendChild(tdTime);
			tr.appendChild(tdTotal);
			el.lapsBody.appendChild(tr);
		});
	}

	function loop() {
		render();
		raf = requestAnimationFrame(loop);
	}

	function startLoop() {
		if (raf) cancelAnimationFrame(raf);
		raf = requestAnimationFrame(loop);
	}

	function stopLoop() {
		if (raf) { cancelAnimationFrame(raf); raf = null; }
	}

	/* ---------- управление ---------- */
	function onStart() {
		if (state.running) return;
		state.startMs = Date.now();
		state.running = true;
		el.btnStart.textContent = 'Стоп';
		el.btnReset.disabled = false;
		el.btnLap.hidden = false;
		startLoop();
	}

	function onStop() {
		if (!state.running) return;
		state.accumMs += Date.now() - state.startMs;
		state.running = false;
		state.startMs = null;
		el.btnStart.textContent = 'Старт';
		el.btnLap.hidden = true;
		stopLoop();
		render();
		document.title = fmt(state.accumMs) + ' - Секундомер';
		writeHash();
	}

	function onReset() {
		state.accumMs = 0;
		state.startMs = null;
		state.running = false;
		state.laps = [];
		el.btnStart.textContent = 'Старт';
		el.btnReset.disabled = true;
		el.btnLap.hidden = true;
		stopLoop();
		renderLaps();
		render();
		document.title = baseTitle;
		location.replace(location.pathname);
	}

	function onLap() {
		if (!state.running) return;
		var total = currentMs();
		var lastTotal = state.laps.length ? state.laps[state.laps.length - 1].total : 0;
		state.laps.push({ lap: total - lastTotal, total: total });
		renderLaps();
		writeHash();
	}

	/* ---------- восстановление из hash ---------- */
	function restore() {
		var hash = parseHash();
		if (hash.start || hash.accum || hash.laps) {
			var accum = parseInt(hash.accum, 10) || 0;
			var start = parseInt(hash.start, 10) || 0;
			state.accumMs = accum;
			if (start > 0) {
				state.startMs = start;
				state.running = true;
			}
			if (hash.laps) {
				state.laps = hash.laps.split('.').map(function (v) {
					return parseInt(v, 10);
				}).filter(function (v) { return !isNaN(v); }).map(function (total, i, arr) {
					var prev = i > 0 ? arr[i - 1] : 0;
					return { lap: total - prev, total: total };
				});
			}
			renderLaps();
			render();
			el.btnReset.disabled = false;
			if (state.running) {
				el.btnStart.textContent = 'Стоп';
				el.btnLap.hidden = false;
				startLoop();
			} else {
				el.btnStart.textContent = 'Старт';
			}
			return;
		}
		render();
	}

	/* ---------- инициализация ---------- */
	function init() {
		if (!el.time) return; // страница без секундомера

		el.btnStart.addEventListener('click', function () {
			if (state.running) onStop();
			else onStart();
		});
		el.btnReset.addEventListener('click', onReset);
		el.btnLap.addEventListener('click', onLap);

		// при скрытии вкладки обновить hash с текущим состоянием
		document.addEventListener('visibilitychange', function () {
			if (document.visibilityState === 'hidden' && state.running) writeHash();
		});

		restore();
	}

	init();
})();
