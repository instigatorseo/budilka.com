/* Budilki — точное время: часы + список городов со смещением (IANA-таймзоны). */
(function () {
	'use strict';

	var B = window.Budilki;
	var L = B.L;

	var el = {
		root: B.root,
		time: document.getElementById('time-time'),
		date: document.getElementById('time-date'),
		cities: document.getElementById('cities-list'),
		addBtn: document.getElementById('btn-add-city'),
		form: document.getElementById('form-city'),
		selCity: document.getElementById('sel-city'),
	};

	// Каталог городов (name, tz, slug для будущих страниц /time/<город>/)
	var CATALOG = [
		{ name: 'Калининград', tz: 'Europe/Kaliningrad' },
		{ name: 'Москва', tz: 'Europe/Moscow' },
		{ name: 'Самара', tz: 'Europe/Samara' },
		{ name: 'Екатеринбург', tz: 'Asia/Yekaterinburg' },
		{ name: 'Новосибирск', tz: 'Asia/Novosibirsk' },
		{ name: 'Петропавловск-Камчатский', tz: 'Asia/Kamchatka' },
		{ name: 'Алматы', tz: 'Asia/Almaty' },
		{ name: 'Минск', tz: 'Europe/Minsk' },
		{ name: 'Самарканд', tz: 'Asia/Samarkand' },
		{ name: 'Бишкек', tz: 'Asia/Bishkek' },
		{ name: 'Кишинев', tz: 'Europe/Chisinau' },
		{ name: 'Ереван', tz: 'Asia/Yerevan' },
		{ name: 'Киев', tz: 'Europe/Kiev' },
		{ name: 'Берлин', tz: 'Europe/Berlin' },
		{ name: 'Нью-Йорк', tz: 'America/New_York' },
		{ name: 'Лондон', tz: 'Europe/London' },
		{ name: 'Сидней', tz: 'Australia/Sydney' },
		{ name: 'Торонто', tz: 'America/Toronto' },
		{ name: 'Токио', tz: 'Asia/Tokyo' },
		{ name: 'Пекин', tz: 'Asia/Shanghai' },
		{ name: 'Дубай', tz: 'Asia/Dubai' },
	];

	var DEFAULT_CITIES = ['Москва', 'Минск', 'Лондон', 'Нью-Йорк', 'Токио'];

	var STORAGE_KEY = 'budilkiCities';
	var userCities = loadCities();

	function loadCities() {
		try {
			var v = localStorage.getItem(STORAGE_KEY);
			if (v) {
				var arr = JSON.parse(v);
				if (Array.isArray(arr) && arr.length) return arr;
			}
		} catch (e) {}
		return DEFAULT_CITIES.slice();
	}

	function saveCities() {
		try { localStorage.setItem(STORAGE_KEY, JSON.stringify(userCities)); } catch (e) {}
	}

	function byName(name) {
		for (var i = 0; i < CATALOG.length; i++) if (CATALOG[i].name === name) return CATALOG[i];
		return null;
	}

	/* ---------- время в таймзоне ---------- */
	function tzParts(tz, d) {
		if (!d) d = new Date();
		var fmt = new Intl.DateTimeFormat('ru-RU', {
			timeZone: tz, hour12: false,
			hour: '2-digit', minute: '2-digit', second: '2-digit'
		});
		var parts = fmt.formatToParts(d);
		var get = function (t) { for (var i = 0; i < parts.length; i++) if (parts[i].type === t) return parts[i].value; return '00'; };
		return { h: parseInt(get('hour'), 10), m: parseInt(get('minute'), 10), s: parseInt(get('second'), 10) };
	}

	function pad2(n) { return (n < 10 ? '0' : '') + n; }

	function tzTimeStr(tz, d) {
		var p = tzParts(tz, d);
		return pad2(p.h) + ':' + pad2(p.m) + ':' + pad2(p.s);
	}

	// смещение таймзоны относительно таймзоны пользователя, в часах (со знаком)
	function tzOffsetHours(tz, d) {
		if (!d) d = new Date();
		var p = tzParts(tz, d);
		var local = new Date(d.getTime());
		// UTC-представление нужной зоны через смещение
		var localHours = d.getHours();
		return (p.h - localHours + 24) % 24 > 12 ? (p.h - localHours + 24) % 24 - 24 : (p.h - localHours + 24) % 24;
	}

	/* ---------- отрисовка ---------- */
	function renderClock(d) {
		if (!d) d = new Date();
		var pad = pad2;
		el.time.textContent = pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
		var wd = (L.dayNames || [])[d.getDay()] || '';
		var mo = (L.monthNames || [])[d.getMonth()] || '';
		el.date.textContent = wd + ' – ' + d.getDate() + ' ' + mo + ' ' + d.getFullYear();
	}

	function renderCities() {
		el.cities.innerHTML = '';
		userCities.forEach(function (name, idx) {
			var c = byName(name);
			if (!c) return;
			var div = document.createElement('div');
			div.className = 'bk-city';

			var nm = document.createElement('span');
			nm.className = 'bk-city-name';
			var a = document.createElement('a');
			a.href = '/time/' + encodeURIComponent(name.toLowerCase()) + '/';
			a.textContent = name;
			nm.appendChild(a);

			var tm = document.createElement('span');
			tm.className = 'bk-city-time';
			tm.textContent = tzTimeStr(c.tz);

			var off = document.createElement('span');
			off.className = 'bk-city-offset';
			var h = tzOffsetHours(c.tz);
			off.textContent = (h === 0) ? 'Сегодня' : ('Сегодня, ' + (h > 0 ? '+' : '') + h + ' Ч');

			var del = document.createElement('button');
			del.type = 'button';
			del.className = 'bk-city-del';
			del.textContent = '×';
			del.setAttribute('aria-label', 'Удалить');
			del.addEventListener('click', function () {
				userCities.splice(idx, 1);
				saveCities();
				renderCities();
			});

			div.appendChild(nm);
			div.appendChild(tm);
			div.appendChild(off);
			div.appendChild(del);
			el.cities.appendChild(div);
		});
	}

	function fillCitySelect() {
		el.selCity.innerHTML = '';
		var available = CATALOG.filter(function (c) { return userCities.indexOf(c.name) === -1; });
		if (!available.length) {
			var o = document.createElement('option');
			o.value = ''; o.textContent = 'Все города добавлены';
			el.selCity.appendChild(o);
			return;
		}
		available.forEach(function (c) {
			var o = document.createElement('option');
			o.value = c.name; o.textContent = c.name;
			el.selCity.appendChild(o);
		});
	}

	function tick() {
		var ms = Date.now() % 1000;
		if (ms < 350 || ms > 650) { setTimeout(tick, 50); return; }
		setTimeout(tick, 1000);
		renderClock();
		// обновлять строки городов каждую секунду
		var nodes = el.cities.children;
		for (var i = 0; i < nodes.length; i++) {
			var name = userCities[i];
			var c = byName(name);
			if (!c) continue;
			var tm = nodes[i].querySelector('.bk-city-time');
			if (tm) tm.textContent = tzTimeStr(c.tz);
		}
	}

	/* ---------- инициализация ---------- */
	function init() {
		if (!el.time) return; // страница без времени

		el.addBtn.addEventListener('click', function () {
			fillCitySelect();
			el.form.hidden = false;
		});
		document.getElementById('btn-city-cancel').addEventListener('click', function () {
			el.form.hidden = true;
		});
		document.getElementById('btn-city-add').addEventListener('click', function () {
			var name = el.selCity.value;
			if (name && userCities.indexOf(name) === -1) {
				userCities.push(name);
				saveCities();
				renderCities();
			}
			el.form.hidden = true;
		});

		renderClock();
		renderCities();
		tick();
	}

	init();
})();
