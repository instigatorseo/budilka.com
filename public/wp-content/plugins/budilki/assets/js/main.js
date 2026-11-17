/* Budilki — общее: часы, настройки, звук (Web Audio), keep-awake, шаринг.
   Нативный JS, без jQuery. Все строки — из BudilkiLang. */
(function () {
	'use strict';

	var L = window.BudilkiLang || {};
	var root = document.getElementById('pnl-main');

	/* ---------- Конфиг (localStorage) ---------- */
	var DEFAULTS = {
		clock12hour: false,
		clockDateVisible: true,
		clockSecondsVisible: true,
		themeNightMode: false,
		themeColorId: 0,
		themeDigitalFont: false,
		alarmFontSizeId: 7, // индекс в FONT_SIZES
		alarmAudioCode: 'classic',
		alarmAudioLoop: false,
	};

	var cfg = {
		get: function (k) {
			var v = null;
			try { v = localStorage.getItem(k); } catch (e) {}
			if (v === null || v === '') return DEFAULTS[k];
			if (typeof DEFAULTS[k] === 'boolean') return v === '1' || v === 'true';
			if (typeof DEFAULTS[k] === 'number') return parseInt(v, 10) || 0;
			return v;
		},
		set: function (k, v) {
			try { localStorage.setItem(k, typeof v === 'boolean' ? (v ? '1' : '0') : String(v)); } catch (e) {}
		},
		apply: function () {
			root.classList.toggle('night', cfg.get('themeNightMode'));
			root.classList.toggle('digital', cfg.get('themeDigitalFont'));
			root.classList.remove('color-1', 'color-2', 'color-3', 'color-4');
			var c = cfg.get('themeColorId');
			if (c >= 1 && c <= 4) root.classList.add('color-' + c);
			cfg.syncNightIcon();
			cfg.syncColorSwatches();
			clock.render();
		},

		syncColorSwatches: function () {
			var c = cfg.get('themeColorId');
			root.querySelectorAll('.bk-swatch').forEach(function (b) {
				b.classList.toggle('active', parseInt(b.getAttribute('data-color'), 10) === c);
			});
		},

		syncNightIcon: function () {
			var nb = root.querySelector('.bk-night-toggle');
			if (!nb) return;
			var night = cfg.get('themeNightMode');
			nb.textContent = night ? '☀' : '☾'; // солнце (выключить) / луна (включить)
			nb.setAttribute('aria-label', night ? 'Включить дневной режим' : 'Включить ночной режим');
			nb.setAttribute('title', night ? 'Дневной режим' : 'Ночной режим');
		},
	};

	/* ---------- Часы ---------- */
	var FONT_SIZES = [40, 48, 56, 64, 72, 80, 88, 96, 112, 128, 144, 168];

	var clock = {
		elTime: document.getElementById('clock-time'),
		elHm: document.getElementById('clock-hm'),
		elSec: document.getElementById('clock-sec'),
		elAmpm: document.getElementById('clock-ampm'),
		elDate: document.getElementById('clock-date'),
		elTitle: document.getElementById('clock-title'),
		lastDay: '',
		lastHour: -1,

		init: function () {
			if (!this.elTime) return;
			this.tick();
		},

		tick: function () {
			var ms = Date.now() % 1000;
			if (ms < 350 || ms > 650) {
				setTimeout(function () { clock.tick(); }, 50);
				return;
			}
			setTimeout(function () { clock.tick(); }, 1000);
			clock.render(new Date());
		},

		render: function (d) {
			if (!this.elTime) return;
			if (!d) d = new Date();
			var h = d.getHours();
			var m = d.getMinutes();
			var s = d.getSeconds();
			var twelve = cfg.get('clock12hour');
			var ampm = '';
			var hh = h;

			if (twelve) {
				ampm = h >= 12 ? 'PM' : 'AM';
				hh = h % 12;
				if (hh === 0) hh = 12;
			}

			var pad = function (n) { return (n < 10 ? '0' : '') + n; };

			this.elHm.textContent = pad(hh) + ':' + pad(m);
			this.elSec.textContent = cfg.get('clockSecondsVisible') ? ':' + pad(s) : '';
			this.elAmpm.textContent = ampm;
			this.elDate.style.display = cfg.get('clockDateVisible') ? '' : 'none';
			this.elDate.textContent = this.formatDate(d);

			// автоподгонка размера
			var stored = FONT_SIZES[cfg.get('alarmFontSizeId')] || 96;
			var fit = this.fitSize();
			var size = Math.min(stored, fit);
			this.elTime.style.fontSize = size + 'px';
		},

		formatDate: function (d) {
			var wd = (L.dayNames || [])[d.getDay()] || '';
			var mo = (L.monthNames || [])[d.getMonth()] || '';
			return wd + ' – ' + d.getDate() + ' ' + mo + ' ' + d.getFullYear();
		},

		fitSize: function () {
			var width = root.clientWidth - 32;
			if (width <= 0) width = 320;
			// ~0.62 ширины символа от размера шрифта
			var chars = cfg.get('clock12hour') ? 8 : 8;
			var byWidth = Math.floor(width / (chars * 0.62));
			return Math.max(FONT_SIZES[0], byWidth);
		},

		setFontLevel: function (delta) {
			if (!this.elTime) return;
			var idx = cfg.get('alarmFontSizeId') + delta;
			idx = Math.max(0, Math.min(FONT_SIZES.length - 1, idx));
			cfg.set('alarmFontSizeId', idx);
			this.render();
		},

		setTitle: function (t) { this.elTitle.textContent = t || ''; },
	};

	/* ---------- Звук (Web Audio, синтез) ---------- */
	var SOUNDS = {
		classic: { notes: [[880, .22], [880, .22], [880, .22], [0, .12], [880, .22], [880, .22], [880, .22]] },
		happy: { notes: [[523, .14], [659, .14], [784, .14], [1047, .32]] },
		piano: { notes: [[659, .28], [784, .28], [880, .55]] },
		bells: { notes: [[1319, .28], [1047, .28], [1319, .28], [1047, .28]] },
		rooster: { notes: [[392, .18], [523, .18], [659, .18], [784, .3]] },
		birds: { chirp: true },
	};

	var audio = {
		_ctx: null,
		_stopToken: 0,
		_loop: false,
		_autostop: null,
		_customEl: null,

		unlock: function () {
			if (!this._ctx) {
				var AC = window.AudioContext || window.webkitAudioContext;
				if (AC) this._ctx = new AC();
			}
			if (this._ctx && this._ctx.state === 'suspended') this._ctx.resume();
		},

		play: function (code, opts) {
			opts = opts || {};
			this.unlock();
			this.stop();
			this._loop = !!opts.loop;
			var self = this;
			if (this._autostop) clearTimeout(this._autostop);
			this._autostop = setTimeout(function () { self.stop(); }, 600000); // 10 мин автостоп
			this._schedule(code);
		},

		_schedule: function (code) {
			var token = ++this._stopToken;
			var s = SOUNDS[code] || SOUNDS.classic;
			if (s.chirp) {
				this._scheduleChirp(token);
				return;
			}
			var ctx = this._ctx;
			if (!ctx) return;
			var t0 = ctx.currentTime + 0.05;
			var total = 0;
			s.notes.forEach(function (n) {
				var f = n[0], dur = n[1];
				if (f > 0) {
					var o = ctx.createOscillator();
					var g = ctx.createGain();
					o.type = 'square';
					o.frequency.value = f;
					g.gain.setValueAtTime(0.0001, t0 + total);
					g.gain.exponentialRampToValueAtTime(0.25, t0 + total + 0.02);
					g.gain.exponentialRampToValueAtTime(0.0001, t0 + total + dur);
					o.connect(g); g.connect(ctx.destination);
					o.start(t0 + total); o.stop(t0 + total + dur + 0.05);
				}
				total += dur;
			});
			if (this._loop) {
				var self = this;
				setTimeout(function () { if (self._stopToken === token && self._loop) self._schedule(code); }, (total * 1000) + 80);
			}
		},

		_scheduleChirp: function (token) {
			var ctx = this._ctx;
			if (!ctx) return;
			var t0 = ctx.currentTime + 0.05;
			var step = 0.09, total = 0;
			for (var i = 0; i < 4; i++) {
				var o = ctx.createOscillator();
				var g = ctx.createGain();
				o.type = 'sine';
				o.frequency.setValueAtTime(1800, t0 + total);
				o.frequency.linearRampToValueAtTime(2800, t0 + total + step / 2);
				o.frequency.linearRampToValueAtTime(1800, t0 + total + step);
				g.gain.setValueAtTime(0.0001, t0 + total);
				g.gain.exponentialRampToValueAtTime(0.2, t0 + total + 0.02);
				g.gain.exponentialRampToValueAtTime(0.0001, t0 + total + step);
				o.connect(g); g.connect(ctx.destination);
				o.start(t0 + total); o.stop(t0 + total + step + 0.02);
				total += step + 0.06;
			}
			if (this._loop) {
				var self = this;
				setTimeout(function () { if (self._stopToken === token && self._loop) self._scheduleChirp(token); }, total * 1000);
			}
		},

		preview: function (code) {
			this.play(code, { loop: false });
		},

		stop: function () {
			this._stopToken++;
			this._loop = false;
			if (this._autostop) { clearTimeout(this._autostop); this._autostop = null; }
			if (this._customEl) {
				this._customEl.pause();
				this._customEl.currentTime = 0;
			}
		},

		playCustom: function (dataUrl, loop) {
			this.stop();
			if (!this._customEl) {
				this._customEl = document.createElement('audio');
				this._customEl.loop = !!loop;
			}
			this._customEl.loop = !!loop;
			this._customEl.src = dataUrl;
			var p = this._customEl.play();
			if (p) p.catch(function () {});
			var self = this;
			if (this._autostop) clearTimeout(this._autostop);
			this._autostop = setTimeout(function () { self.stop(); }, 600000);
		},
	};

	/* ---------- Keep-awake: Wake Lock + Worker + тихий шум ---------- */
	var keepAwake = {
		_wakeLock: null,
		_sentinel: null,
		_worker: null,
		_noiseCtx: null,

		enable: function () {
			this._startWakeLock();
			this._startWorker();
			this._startNoise();
			document.addEventListener('visibilitychange', this._onVisible);
			window.addEventListener('focus', this._onVisible);
		},

		disable: function () {
			this._stopWakeLock();
			this._stopWorker();
			this._stopNoise();
			document.removeEventListener('visibilitychange', this._onVisible);
			window.removeEventListener('focus', this._onVisible);
		},

		_startWakeLock: function () {
			if (!('wakeLock' in navigator)) return;
			var self = this;
			navigator.wakeLock.request('screen').then(function (s) {
				self._sentinel = s;
				self._sentinel.addEventListener('release', function () { self._sentinel = null; });
			}).catch(function () {});
		},

		_stopWakeLock: function () {
			if (this._sentinel) { try { this._sentinel.release(); } catch (e) {} this._sentinel = null; }
		},

		_startWorker: function () {
			var url = (window.BUDILKI && window.BUDILKI.workerUrl) || null;
			if (!url || !window.Worker) return;
			try {
				this._worker = new Worker(url);
				var self = this;
				this._worker.onmessage = function () {
					var h = window.Budilki && window.Budilki._tickHandlers;
					if (h) h.forEach(function (fn) { fn(); });
				};
			} catch (e) { this._worker = null; }
		},

		_stopWorker: function () {
			if (this._worker) { this._worker.terminate(); this._worker = null; }
		},

		_startNoise: function () {
			if (this._noiseCtx) return;
			var AC = window.AudioContext || window.webkitAudioContext;
			if (!AC) return;
			try {
				var ctx = new AC();
				var len = ctx.sampleRate * 1;
				var buf = ctx.createBuffer(1, len, ctx.sampleRate);
				var data = buf.getChannelData(0);
				for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * 0.002;
				var src = ctx.createBufferSource();
				src.buffer = buf;
				src.loop = true;
				var g = ctx.createGain();
				g.gain.value = 0.001;
				src.connect(g); g.connect(ctx.destination);
				src.start();
				this._noiseCtx = ctx;
			} catch (e) { this._noiseCtx = null; }
		},

		_stopNoise: function () {
			if (this._noiseCtx) { try { this._noiseCtx.close(); } catch (e) {} this._noiseCtx = null; }
		},

		_onVisible: function () {
			if (document.visibilityState === 'visible') {
				keepAwake._startWakeLock();
				var h = window.Budilki && window.Budilki._tickHandlers;
				if (h) h.forEach(function (fn) { fn(); });
			}
		},
	};

	/* ---------- UI: панели, модалки, шаринг, fullscreen ---------- */
	var ui = {
		openModal: function (id) {
			var el = document.getElementById(id);
			if (el) el.hidden = false;
		},
		closeModal: function (id) {
			var el = document.getElementById(id);
			if (el) el.hidden = true;
		},
		openSide: function (id) {
			var el = document.getElementById(id);
			if (el) el.hidden = false;
		},
		closeSide: function (id) {
			var el = document.getElementById(id);
			if (el) el.hidden = true;
		},
		init: function () {
			// dropdown «Утилиты»
			var dd = root.querySelector('.bk-dropdown');
			if (dd) {
				var trig = dd.querySelector('.bk-dropdown-trigger');
				trig.addEventListener('click', function (e) {
					e.stopPropagation();
					dd.classList.toggle('open');
				});
				document.addEventListener('click', function () { dd.classList.remove('open'); });
			}

			// шаринг
			var shareUrl = document.getElementById('share-url');
			root.querySelector('.bk-open-share').addEventListener('click', function () {
				shareUrl.value = location.href;
				ui.openSide('pnl-share');
			});
			document.getElementById('btn-share-copy').addEventListener('click', function () {
				shareUrl.select();
				try { document.execCommand('copy'); } catch (e) {}
			});
			document.getElementById('btn-share-embed').addEventListener('click', function () {
				var code = '<iframe src="' + location.href.split('#')[0] + '" width="480" height="360" frameborder="0"></iframe>';
				document.getElementById('embed-code').value = code;
				ui.openModal('form-embed');
			});
			document.getElementById('btn-embed-copy').addEventListener('click', function () {
				var ta = document.getElementById('embed-code');
				ta.select();
				try { document.execCommand('copy'); } catch (e) {}
			});

			// закрытие боковых панелей и модалок
			root.querySelectorAll('.bk-side-close, .bk-side-backdrop').forEach(function (el) {
				el.addEventListener('click', function () {
					el.closest('.bk-side').hidden = true;
				});
			});
			root.querySelectorAll('.bk-modal-close, .bk-modal-backdrop').forEach(function (el) {
				el.addEventListener('click', function () {
					el.closest('.bk-modal').hidden = true;
				});
			});

			// настройки
			root.querySelector('.bk-open-settings').addEventListener('click', function () {
				ui.syncSettingsForm();
				ui.openSide('pnl-settings');
			});

			// кнопка дневного/ночного режима
			var nightBtn = root.querySelector('.bk-night-toggle');
			if (nightBtn) {
				nightBtn.addEventListener('click', function () {
					cfg.set('themeNightMode', !cfg.get('themeNightMode'));
					cfg.apply();
				});
			}
			document.getElementById('set-ampm').addEventListener('change', function () { cfg.set('clock12hour', this.checked); cfg.apply(); });
			document.getElementById('set-date').addEventListener('change', function () { cfg.set('clockDateVisible', this.checked); cfg.apply(); });
			document.getElementById('set-seconds').addEventListener('change', function () { cfg.set('clockSecondsVisible', this.checked); cfg.apply(); });
			document.getElementById('set-night').addEventListener('change', function () { cfg.set('themeNightMode', this.checked); cfg.apply(); });
			document.getElementById('set-digital').addEventListener('change', function () { cfg.set('themeDigitalFont', this.checked); cfg.apply(); });
			root.querySelectorAll('.bk-swatch').forEach(function (b) {
				b.addEventListener('click', function () {
					cfg.set('themeColorId', parseInt(b.getAttribute('data-color'), 10));
					cfg.apply();
				});
			});

			// A± и fullscreen
			root.querySelector('.bk-font-minus').addEventListener('click', function () { clock.setFontLevel(-1); });
			root.querySelector('.bk-font-plus').addEventListener('click', function () { clock.setFontLevel(1); });
			root.querySelector('.bk-fullscreen').addEventListener('click', function () {
				if (document.fullscreenElement) document.exitFullscreen();
				else document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
			});

			// preload
			cfg.apply();
		},

		syncSettingsForm: function () {
			document.getElementById('set-ampm').checked = cfg.get('clock12hour');
			document.getElementById('set-date').checked = cfg.get('clockDateVisible');
			document.getElementById('set-seconds').checked = cfg.get('clockSecondsVisible');
			document.getElementById('set-night').checked = cfg.get('themeNightMode');
			document.getElementById('set-digital').checked = cfg.get('themeDigitalFont');
			cfg.syncColorSwatches();
		},
	};

	/* ---------- Публичный API ---------- */
	window.Budilki = {
		root: root,
		cfg: cfg,
		clock: clock,
		audio: audio,
		keepAwake: keepAwake,
		ui: ui,
		sounds: SOUNDS,
		L: L,
		init: function () {
			ui.init();
			clock.init();
		},
		// инструменты (alarm/timer/…) регистрируют сюда свои проверки по worker-тику
		_tickHandlers: [],
	};

	document.addEventListener('DOMContentLoaded', function () {
		window.Budilki.init();
	});
})();
