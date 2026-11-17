/* Budilki — таймер: обратный отсчёт, пауза/сброс, срабатывание, hash-API. */
(function () {
	'use strict';

	var B = window.Budilki;
	var L = B.L;
	var cfg = B.cfg;
	var audio = B.audio;
	var keepAwake = B.keepAwake;

	var baseTitle = document.title;

	var state = {
		durationMs: 0,
		remainingMs: 0,
		running: false,
		targetMs: null,
		title: 'Таймер',
		sound: 'classic',
		loop: false,
		showMessage: true,
		fired: false,
	};

	var watchdog = null;
	var precise = null;
	var blinkTimer = null;

	var el = {
		root: B.root,
		setBtn: document.getElementById('pnl-set-timer'),
		time: document.getElementById('timer-time'),
		title: document.getElementById('timer-title'),
		controls: document.getElementById('timer-controls'),
		resetBtn: document.getElementById('btn-timer-reset'),
		pauseBtn: document.getElementById('btn-timer-pause'),
		row: document.getElementById('row-timer'),
		rowTitle: document.getElementById('timer-row-title'),
		rowCountdown: document.getElementById('timer-row-countdown'),
		cancelBtn: document.getElementById('btn-timer-cancel'),
		form: document.getElementById('form-timer'),
		dialog: document.getElementById('dialog-timer'),
		dialogTitle: document.getElementById('dialog-timer-title'),
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

	function buildHash(o) {
		var parts = [];
		if (o.countdown) parts.push('countdown=' + o.countdown);
		if (o.title) parts.push('title=' + encodeURIComponent(o.title).replace(/%20/g, '+'));
		if (o.sound) parts.push('sound=' + o.sound);
		if (o.loop) parts.push('loop=1');
		if (typeof o.enabled !== 'undefined') parts.push('enabled=' + (o.enabled ? '1' : '0'));
		return parts.length ? '#' + parts.join('&') : '';
	}

	function writeHash(o) { location.replace(buildHash(o)); }

	/* ---------- утилиты ---------- */
	function pad2(n) { return (n < 10 ? '0' : '') + n; }

	// ЧЧ:ММ:СС если есть часы, иначе ММ:СС
	function fmtDuration(ms) {
		ms = Math.max(0, Math.floor(ms / 1000));
		var h = Math.floor(ms / 3600), m = Math.floor((ms % 3600) / 60), s = ms % 60;
		if (h > 0) return pad2(h) + ':' + pad2(m) + ':' + pad2(s);
		return pad2(m) + ':' + pad2(s);
	}

	function durationToHMS(ms) {
		var total = Math.floor(ms / 1000);
		return { h: Math.floor(total / 3600), m: Math.floor((total % 3600) / 60), s: total % 60 };
	}

	function startBlink(onTitle) {
		var on = '*** ' + (onTitle || state.title).toUpperCase() + ' ***';
		stopBlink();
		blinkTimer = setInterval(function () {
			document.title = (document.title === on) ? onTitle : on;
		}, 1000);
	}

	function stopBlink() {
		if (blinkTimer) { clearInterval(blinkTimer); blinkTimer = null; }
	}

	/* ---------- заполнение формы ---------- */
	function fillSelects() {
		var selH = document.getElementById('timer-sel-hour');
		var selM = document.getElementById('timer-sel-min');
		var selS = document.getElementById('timer-sel-sec');
		selH.innerHTML = ''; selM.innerHTML = ''; selS.innerHTML = '';
		for (var h = 0; h <= 99; h++) {
			var o = document.createElement('option');
			o.value = pad2(h); o.textContent = pad2(h);
			selH.appendChild(o);
		}
		for (var m = 0; m < 60; m++) {
			var o2 = document.createElement('option');
			o2.value = pad2(m); o2.textContent = pad2(m);
			selM.appendChild(o2);
		}
		for (var s = 0; s < 60; s++) {
			var o3 = document.createElement('option');
			o3.value = pad2(s); o3.textContent = pad2(s);
			selS.appendChild(o3);
		}
		selH.value = '00';
		selM.value = '05';
		selS.value = '00';
	}

	function readForm() {
		var h = parseInt(document.getElementById('timer-sel-hour').value, 10);
		var m = parseInt(document.getElementById('timer-sel-min').value, 10);
		var s = parseInt(document.getElementById('timer-sel-sec').value, 10);
		return {
			durationMs: (h * 3600 + m * 60 + s) * 1000,
			title: document.getElementById('timer-inp-title').value.trim() || 'Таймер',
			sound: document.getElementById('timer-sel-sound').value,
			loop: document.getElementById('timer-chk-loop').checked,
			showMessage: document.getElementById('timer-chk-message').checked,
		};
	}

	function prefillForm(o) {
		var hms = durationToHMS(o.durationMs);
		document.getElementById('timer-sel-hour').value = pad2(hms.h);
		document.getElementById('timer-sel-min').value = pad2(hms.m);
		document.getElementById('timer-sel-sec').value = pad2(hms.s);
		document.getElementById('timer-inp-title').value = o.title || 'Таймер';
		document.getElementById('timer-sel-sound').value = o.sound || 'classic';
		document.getElementById('timer-chk-loop').checked = !!o.loop;
		document.getElementById('timer-chk-message').checked = o.showMessage !== false;
	}

	/* ---------- жизненный цикл ---------- */
	function render() {
		if (state.running) {
			var ms = state.targetMs - Date.now();
			if (ms <= 0) ms = 0;
			state.remainingMs = ms;
			el.time.textContent = fmtDuration(ms);
			el.rowCountdown.textContent = fmtDuration(ms);
		} else {
			el.time.textContent = fmtDuration(state.remainingMs);
		}
	}

	function onStart() {
		var o = readForm();
		if (o.durationMs <= 0) return;

		state.durationMs = o.durationMs;
		state.remainingMs = o.durationMs;
		state.title = o.title;
		state.sound = o.sound;
		state.loop = o.loop;
		state.showMessage = o.showMessage;
		state.fired = false;

		audio.unlock();
		audio.stop();
		keepAwake.enable();

		state.targetMs = Date.now() + state.durationMs;
		state.running = true;

		el.form.hidden = true;
		el.controls.hidden = false;
		el.row.hidden = false;
		el.rowTitle.textContent = state.title;
		el.title.textContent = state.title;
		el.pauseBtn.textContent = 'Стоп';

		writeHash({ countdown: fmtDuration(state.durationMs), title: state.title, sound: state.sound, loop: state.loop, enabled: true });
		setTabTitle(fmtDuration(state.remainingMs) + ' - ' + state.title);

		startWatchdog();
		render();
	}

	function startWatchdog() {
		stopWatchdog();
		watchdog = setInterval(function () {
			if (!state.running) return;
			render();
			if (state.targetMs - Date.now() <= 0) fire();
		}, 1000);
	}

	function stopWatchdog() {
		if (watchdog) { clearInterval(watchdog); watchdog = null; }
	}

	function fire() {
		if (state.fired) return;
		state.fired = true;
		state.running = false;
		stopWatchdog();

		audio.play(state.sound, { loop: state.loop });
		if (navigator.vibrate) { try { navigator.vibrate([400, 200, 400]); } catch (e) {} }

		if (state.showMessage) {
			el.dialogTitle.textContent = state.title;
			el.dialog.hidden = false;
			startBlink(state.title);
		} else {
			onStop();
			return;
		}

		writeHash({ countdown: fmtDuration(state.durationMs), title: state.title, sound: state.sound, loop: state.loop, enabled: false });
	}

	function onStop() {
		audio.stop();
		stopBlink();
		stopWatchdog();
		keepAwake.disable();

		state.running = false;
		state.fired = false;
		state.remainingMs = state.durationMs;
		state.targetMs = null;

		el.dialog.hidden = true;
		el.controls.hidden = true;
		el.row.hidden = true;
		el.pauseBtn.textContent = 'Стоп';
		el.title.textContent = '';

		el.time.textContent = fmtDuration(state.durationMs);
		setTabTitle(baseTitle);
	}

	function onPause() {
		if (!state.running) return;
		state.remainingMs = Math.max(0, state.targetMs - Date.now());
		state.running = false;
		stopWatchdog();
		el.pauseBtn.textContent = 'Старт';
		render();
	}

	function onResume() {
		if (state.running || state.fired) return;
		if (state.remainingMs <= 0) return;
		state.targetMs = Date.now() + state.remainingMs;
		state.running = true;
		el.pauseBtn.textContent = 'Стоп';
		startWatchdog();
		render();
	}

	function onReset() {
		stopWatchdog();
		state.running = false;
		state.fired = false;
		state.remainingMs = state.durationMs;
		state.targetMs = null;
		el.time.textContent = fmtDuration(state.durationMs);
		el.pauseBtn.textContent = 'Стоп';
		el.controls.hidden = true;
		el.row.hidden = true;
		el.title.textContent = '';
		writeHash({});
		setTabTitle(baseTitle);
		audio.stop();
	}

	function setTabTitle(t) { document.title = t; }

	/* ---------- восстановление при загрузке ---------- */
	function restore() {
		var hash = parseHash();
		var linkDuration = el.root.getAttribute('data-duration') || '';

		if (hash.countdown) {
			// countdown=HH:MM:SS или MM:SS
			var parts = hash.countdown.split(':').map(Number);
			var ms = 0;
			if (parts.length === 3) ms = (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
			else if (parts.length === 2) ms = (parts[0] * 60 + parts[1]) * 1000;
			if (ms > 0) {
				state.durationMs = ms;
				state.remainingMs = ms;
				state.title = hash.title || 'Таймер';
				state.sound = hash.sound || 'classic';
				state.loop = hash.loop === '1';
				state.showMessage = true;
				prefillForm(state);
				el.title.textContent = state.title;
				el.time.textContent = fmtDuration(ms);
				if (hash.enabled !== '0') {
					state.targetMs = Date.now() + ms;
					state.running = true;
					el.controls.hidden = false;
					el.row.hidden = false;
					el.rowTitle.textContent = state.title;
					startWatchdog();
					keepAwake.enable();
					setTabTitle(fmtDuration(ms) + ' - ' + state.title);
				}
				return;
			}
		}

		if (linkDuration && parseInt(linkDuration, 10) > 0) {
			var dms = parseInt(linkDuration, 10) * 1000;
			state.durationMs = dms;
			state.remainingMs = dms;
			prefillForm(state);
			el.time.textContent = fmtDuration(dms);
			return;
		}

		// дефолт — показать 00:05 (5 минут) на циферблате
		state.durationMs = 5 * 60 * 1000;
		state.remainingMs = state.durationMs;
		el.time.textContent = fmtDuration(state.durationMs);
	}

	/* ---------- инициализация ---------- */
	function init() {
		if (!el.setBtn) return; // страница без таймера

		fillSelects();

		el.setBtn.addEventListener('click', function () {
			audio.unlock();
			audio.stop();
			el.form.hidden = false;
		});

		// степперы (час/мин/сек)
		B.root.querySelectorAll('.bk-step').forEach(function (btn) {
			btn.addEventListener('click', function () {
				var field = this.getAttribute('data-field');
				var dir = parseInt(this.getAttribute('data-dir'), 10);
				var sel = document.getElementById('timer-sel-' + field);
				var max = field === 'hour' ? 99 : 59;
				var v = (parseInt(sel.value, 10) + dir + (max + 1)) % (max + 1);
				sel.value = pad2(v);
			});
		});

		document.getElementById('btn-timer-preview').addEventListener('click', function () {
			audio.preview(document.getElementById('timer-sel-sound').value);
		});
		document.getElementById('btn-timer-test').addEventListener('click', function () {
			var o = readForm();
			audio.unlock();
			audio.play(o.sound, { loop: false });
			el.dialogTitle.textContent = o.title;
			el.dialog.hidden = false;
			state.title = o.title; state.sound = o.sound; state.fired = false; state.running = false;
		});
		document.getElementById('btn-timer-cancel-form').addEventListener('click', function () {
			audio.stop();
			el.form.hidden = true;
		});
		document.getElementById('btn-timer-start').addEventListener('click', onStart);
		document.getElementById('btn-timer-ok').addEventListener('click', onStop);
		document.getElementById('btn-timer-cancel').addEventListener('click', onReset);

		el.pauseBtn.addEventListener('click', function () {
			if (state.running) onPause();
			else onResume();
		});
		el.resetBtn.addEventListener('click', onReset);

		document.addEventListener('keydown', function (e) {
			if (e.key === 'Escape') {
				if (!el.form.hidden) { audio.stop(); el.form.hidden = true; }
				else if (!el.dialog.hidden) onStop();
			}
			if (e.key === 'Enter' && !el.form.hidden) onStart();
		});

		restore();

		B._tickHandlers.push(function () {
			if (state.running && !state.fired && state.targetMs - Date.now() <= 0) fire();
		});
	}

	init();
})();
