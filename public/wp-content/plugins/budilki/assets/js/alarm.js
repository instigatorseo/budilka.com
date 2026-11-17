/* Budilki — будильник: установка, жизненный цикл, срабатывание, hash-API, история. */
(function () {
	'use strict';

	var B = window.Budilki;
	var L = B.L;
	var cfg = B.cfg;
	var audio = B.audio;
	var keepAwake = B.keepAwake;
	var clock = B.clock;

	var baseTitle = document.title;

	var state = {
		time: null,        // "HH:MM"
		title: L.titleDefault || 'Будильник',
		sound: 'classic',
		loop: false,
		enabled: false,
		targetMs: null,
		fired: false,
		fromLink: false,
	};

	var watchdog = null;
	var precise = null;
	var blinkTimer = null;
	var overdueTimer = null;
	var overdueStart = null;

	var el = {
		root: B.root,
		setBtn: document.getElementById('pnl-set-alarm'),
		row: document.getElementById('row-alarm'),
		rowTitle: document.getElementById('alarm-row-title'),
		rowTime: document.getElementById('alarm-row-time'),
		rowCountdown: document.getElementById('alarm-row-countdown'),
		cancelBtn: document.getElementById('btn-alarm-cancel'),
		form: document.getElementById('form-alarm'),
		dialog: document.getElementById('dialog-alarm'),
		dialogTitle: document.getElementById('dialog-alarm-title'),
		dialogTime: document.getElementById('dialog-alarm-time'),
		dialogOverdue: document.getElementById('dialog-alarm-overdue'),
		recent: document.getElementById('pnl-recent'),
		recentList: document.getElementById('recent-list'),
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
			var v = decodeURIComponent(kv.slice(i + 1).replace(/\+/g, ' '));
			out[k] = v;
		});
		return out;
	}

	function buildHash(o) {
		var parts = [];
		if (o.time) parts.push('time=' + o.time);
		if (o.title) parts.push('title=' + encodeURIComponent(o.title).replace(/%20/g, '+'));
		if (o.sound) parts.push('sound=' + o.sound);
		if (o.loop) parts.push('loop=1');
		if (typeof o.enabled !== 'undefined') parts.push('enabled=' + (o.enabled ? '1' : '0'));
		return parts.length ? '#' + parts.join('&') : '';
	}

	function writeHash(o) {
		location.replace(buildHash(o));
	}

	/* ---------- утилиты ---------- */
	function pad2(n) { return (n < 10 ? '0' : '') + n; }

	function parseTime(s) {
		var m = /^(\d{1,2}):(\d{2})$/.exec(s);
		if (!m) return null;
		var h = parseInt(m[1], 10), mm = parseInt(m[2], 10);
		if (h < 0 || h > 23 || mm < 0 || mm > 59) return null;
		return { h: h, m: mm };
	}

	function computeTarget(timeStr) {
		var t = parseTime(timeStr);
		if (!t) return null;
		var d = new Date();
		d.setHours(t.h, t.m, 0, 0);
		if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
		return d.getTime();
	}

	function fmtCountdown(ms) {
		ms = Math.max(0, Math.floor(ms / 1000));
		var h = Math.floor(ms / 3600), m = Math.floor((ms % 3600) / 60), s = ms % 60;
		return pad2(h) + ':' + pad2(m) + ':' + pad2(s);
	}

	function setTabTitle(t) { document.title = t; }

	function startBlink() {
		var on = '*** ' + state.time + ' - ' + (state.title || '').toUpperCase() + ' ***';
		var off = state.time + ' - ' + state.title;
		stopBlink();
		blinkTimer = setInterval(function () {
			document.title = (document.title === on) ? off : on;
		}, 1000);
	}

	function stopBlink() {
		if (blinkTimer) { clearInterval(blinkTimer); blinkTimer = null; }
	}

	/* ---------- заполнение формы ---------- */
	function fillTimeSelects() {
		var selH = document.getElementById('sel-hour');
		var selM = document.getElementById('sel-min');
		selH.innerHTML = ''; selM.innerHTML = '';
		var now = new Date();
		for (var h = 0; h < 24; h++) {
			var o = document.createElement('option');
			o.value = pad2(h); o.textContent = pad2(h);
			selH.appendChild(o);
		}
		for (var mm = 0; mm < 60; mm++) {
			var o2 = document.createElement('option');
			o2.value = pad2(mm); o2.textContent = pad2(mm);
			selM.appendChild(o2);
		}
		selH.value = pad2(now.getHours());
		selM.value = pad2(now.getMinutes());
	}

	function readForm() {
		return {
			time: document.getElementById('sel-hour').value + ':' + document.getElementById('sel-min').value,
			title: document.getElementById('inp-title').value.trim() || (L.titleDefault || 'Будильник'),
			sound: document.getElementById('sel-sound').value,
			loop: document.getElementById('chk-loop').checked,
		};
	}

	function prefillForm(o) {
		var t = parseTime(o.time);
		if (t) {
			document.getElementById('sel-hour').value = pad2(t.h);
			document.getElementById('sel-min').value = pad2(t.m);
		}
		document.getElementById('inp-title').value = o.title || (L.titleDefault || 'Будильник');
		document.getElementById('sel-sound').value = o.sound || 'classic';
		document.getElementById('chk-loop').checked = !!o.loop;
	}

	/* ---------- жизненный цикл ---------- */
	function onStart() {
		var o = readForm();
		state.time = o.time;
		state.title = o.title;
		state.sound = o.sound;
		state.loop = o.loop;
		state.fired = false;

		var target = computeTarget(state.time);
		if (!target) return;

		state.targetMs = target;
		state.enabled = true;

		audio.unlock();
		audio.stop();
		keepAwake.enable();

		saveRecent(o);
		saveAlarmHash();

		el.form.hidden = true;
		showRow();

		// двойной механизм запуска (§5.3.2)
		startPrecise(target);
		startWatchdog();

		cfg.set('alarmAudioCode', o.sound);
		cfg.set('alarmAudioLoop', o.loop);

		setTabTitle(state.time + ' - ' + state.title);
	}

	function startPrecise(target) {
		if (precise) clearTimeout(precise);
		var remaining = target - Date.now();
		precise = setTimeout(function () {
			if (Date.now() >= target) { fire(); }
			else { startPrecise(target); } // сработал раньше — пересчитать
		}, Math.max(0, remaining));
	}

	function startWatchdog() {
		stopWatchdog();
		watchdog = setInterval(function () {
			updateCountdown();
			if (state.enabled && !state.fired && Date.now() >= state.targetMs) fire();
		}, 1000);
	}

	function stopWatchdog() {
		if (watchdog) { clearInterval(watchdog); watchdog = null; }
		if (precise) { clearTimeout(precise); precise = null; }
	}

	function showRow() {
		el.row.hidden = false;
		el.rowTitle.textContent = state.title;
		el.rowTime.textContent = state.time;
		updateCountdown();
	}

	function updateCountdown() {
		if (!state.enabled || state.fired || !state.targetMs) return;
		el.rowCountdown.textContent = fmtCountdown(state.targetMs - Date.now());
	}

	function fire() {
		if (state.fired || !state.enabled) return;
		state.fired = true;
		stopWatchdog();

		// модалка
		el.dialogTitle.textContent = state.title;
		el.dialogTime.textContent = state.time;
		el.dialogOverdue.hidden = true;
		el.dialog.hidden = false;

		audio.play(state.sound, { loop: state.loop });
		if (navigator.vibrate) { try { navigator.vibrate([400, 200, 400]); } catch (e) {} }

		startBlink();

		// hash: enabled=0 — при F5 не пересрабатывает (§2.3.4)
		writeHash({ time: state.time, title: state.title, sound: state.sound, loop: state.loop, enabled: false });

		// просрочка после 60 с
		overdueStart = Date.now();
		overdueTimer = setInterval(function () {
			el.dialogOverdue.hidden = false;
			el.dialogOverdue.textContent = (L.overdue || 'Просрочено:') + ' ' + fmtCountdown(Date.now() - overdueStart);
		}, 1000);
		setTimeout(function () { el.dialogOverdue.hidden = false; }, 60000);
	}

	function onStop() {
		audio.stop();
		stopBlink();
		stopWatchdog();
		keepAwake.disable();
		if (overdueTimer) { clearInterval(overdueTimer); overdueTimer = null; }

		el.dialog.hidden = true;
		el.row.hidden = true;
		state.enabled = false;
		state.fired = false;
		state.targetMs = null;

		setTabTitle(baseTitle);
		clock.setTitle('');
	}

	function onCancel() {
		// отмена до срабатывания
		audio.stop();
		stopBlink();
		stopWatchdog();
		keepAwake.disable();
		state.enabled = false;
		state.fired = false;
		state.targetMs = null;
		state.fromLink = false;
		el.row.hidden = true;
		el.form.hidden = true;
		writeHash({});
		setTabTitle(baseTitle);
		clock.setTitle('');
	}

	/* ---------- история (alm0..alm9) ---------- */
	function loadRecent() {
		var out = [];
		for (var i = 0; i < 10; i++) {
			var v = null;
			try { v = localStorage.getItem('alm' + i); } catch (e) {}
			if (v) {
				try { out.push(JSON.parse(v)); } catch (e) {}
			}
		}
		return out;
	}

	function saveRecent(o) {
		var list = loadRecent();
		list = list.filter(function (x) { return !(x.time === o.time && x.title === o.title); });
		list.unshift(o);
		list = list.slice(0, 10);
		for (var i = 0; i < 10; i++) {
			try {
				if (i < list.length) localStorage.setItem('alm' + i, JSON.stringify(list[i]));
				else localStorage.removeItem('alm' + i);
			} catch (e) {}
		}
		renderRecent();
	}

	function renderRecent() {
		var list = loadRecent();
		if (!list.length) { el.recent.hidden = true; return; }
		el.recent.hidden = false;
		el.recentList.innerHTML = '';
		list.forEach(function (o, idx) {
			var div = document.createElement('div');
			div.className = 'bk-recent-item';
			var a = document.createElement('a');
			a.href = buildHash({ time: o.time, title: o.title, sound: o.sound, loop: o.loop });
			a.textContent = o.title + ' — ' + o.time;
			var t = document.createElement('span');
			t.className = 'bk-recent-time';
			t.textContent = o.time;
			var del = document.createElement('button');
			del.type = 'button';
			del.className = 'bk-btn';
			del.textContent = '×';
			del.setAttribute('aria-label', 'Удалить');
			del.addEventListener('click', function () { removeRecent(idx); });
			div.appendChild(a);
			div.appendChild(t);
			div.appendChild(del);
			el.recentList.appendChild(div);
		});
	}

	function removeRecent(idx) {
		var list = loadRecent();
		list.splice(idx, 1);
		for (var i = 0; i < 10; i++) {
			try {
				if (i < list.length) localStorage.setItem('alm' + i, JSON.stringify(list[i]));
				else localStorage.removeItem('alm' + i);
			} catch (e) {}
		}
		renderRecent();
	}

	function saveAlarmHash() {
		cfg.set('alarmHash', JSON.stringify({ time: state.time, title: state.title, sound: state.sound, loop: state.loop }));
	}

	function clearAlarmHash() {
		try { localStorage.removeItem('alarmHash'); } catch (e) {}
	}

	/* ---------- восстановление при загрузке ---------- */
	function restore() {
		var hash = parseHash();
		var linkTime = el.root.getAttribute('data-alarm-time') || '';

		if (hash.time) {
			state.time = hash.time;
			state.title = hash.title || (L.titleDefault || 'Будильник');
			state.sound = hash.sound || 'classic';
			state.loop = hash.loop === '1';
			state.fromLink = !!linkTime;
			prefillForm(state);
			if (hash.enabled !== '0') {
				// активировать при загрузке
				var target = computeTarget(state.time);
				if (target) {
					state.targetMs = target;
					state.enabled = true;
					state.fired = false;
					showRow();
					startPrecise(target);
					startWatchdog();
					setTabTitle(state.time + ' - ' + state.title);
					keepAwake.enable();
				}
			}
			clock.setTitle(state.title);
			return;
		}

		if (linkTime && /^\d{1,2}:\d{2}$/.test(linkTime)) {
			state.time = linkTime;
			state.fromLink = true;
			prefillForm(state);
			return;
		}

		var saved = null;
		try { saved = localStorage.getItem('alarmHash'); } catch (e) {}
		if (saved) {
			try {
				var o = JSON.parse(saved);
				if (o && o.time) {
					state.time = o.time;
					state.title = o.title || (L.titleDefault || 'Будильник');
					state.sound = o.sound || 'classic';
					state.loop = !!o.loop;
					var target = computeTarget(state.time);
					if (target) {
						state.targetMs = target;
						state.enabled = true;
						state.fired = false;
						prefillForm(state);
						showRow();
						startPrecise(target);
						startWatchdog();
						setTabTitle(state.time + ' - ' + state.title);
						keepAwake.enable();
					}
				}
			} catch (e) {}
		}
	}

	/* ---------- инициализация UI будильника ---------- */
	function init() {
		if (!el.setBtn) return; // страница без будильника (таймер/секундомер/время)
		fillTimeSelects();

		el.setBtn.addEventListener('click', function () {
			audio.unlock();
			audio.stop();
			el.form.hidden = false;
		});

		// степперы
		B.root.querySelectorAll('.bk-step').forEach(function (btn) {
			btn.addEventListener('click', function () {
				var field = this.getAttribute('data-field');
				var dir = parseInt(this.getAttribute('data-dir'), 10);
				var sel = document.getElementById(field === 'hour' ? 'sel-hour' : 'sel-min');
				var max = field === 'hour' ? 23 : 59;
				var v = (parseInt(sel.value, 10) + dir + (max + 1)) % (max + 1);
				sel.value = pad2(v);
			});
		});

		document.getElementById('btn-preview-sound').addEventListener('click', function () {
			audio.preview(document.getElementById('sel-sound').value);
		});
		document.getElementById('btn-alarm-test').addEventListener('click', function () {
			var o = readForm();
			audio.unlock();
			audio.play(o.sound, { loop: false });
			el.dialogTitle.textContent = o.title;
			el.dialogTime.textContent = o.time;
			el.dialogOverdue.hidden = true;
			el.dialog.hidden = false;
			// временное состояние, чтобы OK корректно остановил звук
			state.time = o.time; state.title = o.title; state.sound = o.sound; state.loop = false;
			state.enabled = false; state.fired = false;
		});
		document.getElementById('btn-alarm-cancel-form').addEventListener('click', function () {
			audio.stop();
			el.form.hidden = true;
		});
		document.getElementById('btn-alarm-start').addEventListener('click', onStart);
		document.getElementById('btn-alarm-ok').addEventListener('click', onStop);
		el.cancelBtn.addEventListener('click', onCancel);

		// Esc закрывает модалку, Enter = Старт
		document.addEventListener('keydown', function (e) {
			if (e.key === 'Escape') {
				if (!el.form.hidden) { audio.stop(); el.form.hidden = true; }
				else if (!el.dialog.hidden && !state.enabled) { onStop(); }
			}
			if (e.key === 'Enter' && !el.form.hidden) onStart();
		});

		renderRecent();
		restore();

		// worker + focus пересчитывают срабатывание
		B._tickHandlers.push(function () {
			if (state.enabled && !state.fired && Date.now() >= state.targetMs) fire();
		});
	}

	init();
})();
