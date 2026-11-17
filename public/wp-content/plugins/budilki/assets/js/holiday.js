/* Budilki — счётчики праздников: сколько дней/часов/минут/секунд осталось до даты.
   Дата приходит из PHP (data-атрибуты #pnl-main), расчёт — по Date.now() без дрейфа. */
(function () {
	'use strict';

	var B = window.Budilki;
	var root = B ? B.root : null;
	if (!root) return;

	function pad2(n) { return (n < 10 ? '0' : '') + n; }

	/* ---------- страница праздника /timer/<слаг>/ ---------- */
	function initHoliday() {
		var counter = document.getElementById('holiday-counter');
		if (!counter) return;

		var dateLine = document.getElementById('holiday-date-line');
		var dateStr = root.getAttribute('data-holiday-date') || '';
		var fixed = root.getAttribute('data-holiday-fixed') === '1';
		var pinned = root.getAttribute('data-holiday-pinned') === '1';

		var target = new Date(dateStr + 'T00:00:00');
		if (isNaN(target.getTime())) {
			counter.textContent = '—';
			return;
		}

		function render() {
			var now = Date.now();
			var diff = target.getTime() - now;
			if (diff < 0) {
				if (!pinned && fixed) {
					// фиксированная дата уже прошла — перекат на следующий год
					target.setFullYear(target.getFullYear() + 1);
					diff = target.getTime() - now;
				} else {
					counter.textContent = '0 дн. 00:00:00';
					return;
				}
			}
			var days = Math.floor(diff / 86400000);
			var rem = diff % 86400000;
			var h = Math.floor(rem / 3600000);
			rem %= 3600000;
			var m = Math.floor(rem / 60000);
			var s = Math.floor((rem % 60000) / 1000);
			counter.textContent = days + ' дн. ' + pad2(h) + ':' + pad2(m) + ':' + pad2(s);
		}

		function renderDateLine() {
			if (!dateLine) return;
			var L = B.L || {};
			var wd = (L.dayNames || [])[target.getDay()] || '';
			var mo = (L.monthNames || [])[target.getMonth()] || '';
			dateLine.textContent = wd + ' – ' + target.getDate() + ' ' + mo + ' ' + target.getFullYear();
		}

		function tick() {
			var ms = Date.now() % 1000;
			if (ms < 350 || ms > 650) { setTimeout(tick, 50); return; }
			setTimeout(tick, 1000);
			render();
		}

		render();
		renderDateLine();
		tick();
	}

	/* ---------- хаб /prazdniki/: «N дн.» по data-date ---------- */
	function initHub() {
		var nodes = document.querySelectorAll('.bk-holiday-item[data-date]');
		if (!nodes.length) return;

		function render() {
			nodes.forEach(function (n) {
				var t = new Date(n.getAttribute('data-date') + 'T00:00:00');
				if (isNaN(t.getTime())) return;
				var diff = t.getTime() - Date.now();
				if (diff < 0) diff = 0;
				var days = Math.floor(diff / 86400000);
				var el = n.querySelector('.bk-holiday-days');
				if (el) el.textContent = days + ' дн.';
			});
		}

		render();
		// достаточно обновить раз в час; при загрузке значения уже актуальны
		setTimeout(render, 60 * 60 * 1000);
	}

	document.addEventListener('DOMContentLoaded', function () {
		initHoliday();
		initHub();
	});
})();
