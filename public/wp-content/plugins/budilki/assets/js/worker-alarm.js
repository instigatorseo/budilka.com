/* Worker надёжности (§5.3.3): раз в 700 мс шлёт метку времени.
   Главный поток по каждой метке сверяет Date.now() >= targetMs. */
setInterval(function () {
	self.postMessage({ t: Date.now() });
}, 700);
