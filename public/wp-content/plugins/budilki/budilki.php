<?php
/**
 * Plugin Name: Budilki
 * Description: Онлайн-будильник (клон budilki.ru). Весь функционал через шорткод [budilki tool="alarm"].
 * Version: 1.0.0
 * Author: budilka.local
 * License: GPL-2.0-or-later
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'BUDILKI_VER', '1.0.0' );
define( 'BUDILKI_DIR', plugin_dir_path( __FILE__ ) );
define( 'BUDILKI_URL', plugin_dir_url( __FILE__ ) );

/**
 * Список звуков. Код => { name }.
 * Звук синтезируется в браузере (Web Audio), файлы оригинала не копируются.
 */
function budilki_sounds() {
	return array(
		'classic'   => array( 'name' => 'Классический' ),
		'happy'     => array( 'name' => 'Веселая' ),
		'piano'     => array( 'name' => 'Рояль' ),
		'bells'     => array( 'name' => 'Колокол' ),
		'birds'     => array( 'name' => 'Птички' ),
		'rooster'   => array( 'name' => 'Петух' ),
	);
}

function budilki_sound_options_html() {
	$out = '';
	foreach ( budilki_sounds() as $code => $s ) {
		$out .= '<option value="' . esc_attr( $code ) . '">' . esc_html( $s['name'] ) . '</option>';
	}
	return $out;
}

/** Ссылки «Поставить будильник на определённое время» (§2.1.5). */
function budilki_preset_times() {
	return array( '4:00', '4:30', '5:00', '5:15', '5:30', '5:45', '6:00', '6:15', '6:30', '6:45', '7:00', '7:15', '7:30', '7:45', '8:00', '8:15', '8:30', '8:45', '9:00', '10:00', '11:00', '12:00', '13:00', '14:00' );
}

add_action( 'init', function () {
	add_shortcode( 'budilki', 'budilki_shortcode' );
} );

/**
 * Подключение ассетов только на страницах со шорткодом (spec §6.3.1).
 */
add_action( 'wp_enqueue_scripts', function () {
	if ( ! is_singular() ) {
		return;
	}
	$post = get_post();
	if ( ! $post || ! has_shortcode( $post->post_content, 'budilki' ) ) {
		return;
	}

	$css = BUDILKI_DIR . 'assets/css/style.css';
	$v   = filemtime( $css );

	wp_enqueue_style( 'budilki', BUDILKI_URL . 'assets/css/style.css', array(), $v );

	wp_enqueue_script( 'budilki-lang', BUDILKI_URL . 'assets/js/lang.js', array(), $v, false );
	wp_enqueue_script( 'budilki-main', BUDILKI_URL . 'assets/js/main.js', array( 'budilki-lang' ), $v, true );
	wp_enqueue_script( 'budilki-alarm', BUDILKI_URL . 'assets/js/alarm.js', array( 'budilki-main' ), $v, true );
	wp_enqueue_script( 'budilki-timer', BUDILKI_URL . 'assets/js/timer.js', array( 'budilki-main' ), $v, true );

	wp_add_inline_script(
		'budilki-main',
		'window.BUDILKI = ' . wp_json_encode(
			array(
				'workerUrl' => BUDILKI_URL . 'assets/js/worker-alarm.js',
			)
		) . ';',
		'before'
	);
} );

function budilki_shortcode( $atts ) {
	$atts = shortcode_atts(
		array(
			'tool'     => 'alarm',
			'time'     => '',   // HH:MM — предустановка будильника
			'duration' => '',   // секунды — предустановка таймера
		),
		$atts,
		'budilki'
	);

	$tool = sanitize_key( $atts['tool'] );

	switch ( $tool ) {
		case 'alarm':
			$time = preg_match( '/^\d{1,2}:\d{2}$/', (string) $atts['time'] ) ? $atts['time'] : '';
			return budilki_render_alarm( $time );

		case 'timer':
			$duration = ( ctype_digit( (string) $atts['duration'] ) && (int) $atts['duration'] > 0 )
				? (int) $atts['duration']
				: '';
			return budilki_render_timer( $duration );

		case 'stopwatch':
			return budilki_render_shell( 'stopwatch', '<div class="budilki-stub">Секундомер — в разработке.</div>' );

		case 'time':
			return budilki_render_shell( 'time', '<div class="budilki-stub">Точное время — в разработке.</div>' );

		default:
			return '<div class="budilki-stub">Неизвестный инструмент: ' . esc_html( $tool ) . '</div>';
	}
}

/**
 * Общий каркас страницы-инструмента: шапка, переключатель, панели, футер.
 * $body — центральная часть (часы + модалки) конкретного инструмента.
 * $attrs — дополнительные data-атрибуты на #pnl-main.
 */
function budilki_render_shell( $tool, $body, $attrs = '' ) {
	$tools = array(
		'alarm'     => array( 'href' => '/', 'label' => 'Будильник' ),
		'timer'     => array( 'href' => '/timer/', 'label' => 'Таймер' ),
		'stopwatch' => array( 'href' => '/sekundomer/', 'label' => 'Секундомер' ),
		'time'      => array( 'href' => '/time/', 'label' => 'Точное время' ),
	);

	$nav = '';
	foreach ( $tools as $key => $t ) {
		$active = ( $key === $tool ) ? ' active' : '';
		$nav   .= '<a href="' . esc_attr( $t['href'] ) . '" class="bk-tool' . $active . '">' . esc_html( $t['label'] ) . '</a>';
	}

	ob_start();
	?>
	<div id="pnl-main" class="budilki" data-utc="<?php echo esc_attr( (string) time() ); ?>"<?php echo $attrs; ?>>

		<header class="bk-header">
			<a class="bk-logo" href="/">Будильник<span>онлайн</span></a>
			<nav class="bk-nav">
				<a href="/prazdniki/">Праздники</a>
				<div class="bk-dropdown">
					<span class="bk-dropdown-trigger">Утилиты</span>
					<div class="bk-dropdown-menu">
						<a href="/">Будильник</a>
						<a href="/timer/">Таймер</a>
						<a href="/sekundomer/">Секундомер</a>
						<a href="/time/">Точное время</a>
					</div>
				</div>
				<a href="/apps/">Приложения</a>
				<button type="button" class="bk-btn-icon bk-open-settings" aria-label="Настройки" title="Настройки">&#9881;</button>
			</nav>
		</header>

		<nav class="bk-tools" aria-label="Инструменты"><?php echo $nav; ?></nav>

		<noscript>
			<div class="bk-noscript">Для корректной работы часов необходимо включить JavaScript.</div>
		</noscript>

		<!-- Панель инструментов -->
		<div id="pnl-tools" class="bk-toolbar">
			<button type="button" class="bk-btn bk-open-share">Поделиться</button>
			<button type="button" class="bk-btn bk-font-minus" aria-label="Уменьшить шрифт">A&minus;</button>
			<button type="button" class="bk-btn bk-font-plus" aria-label="Увеличить шрифт">A+</button>
			<button type="button" class="bk-btn bk-fullscreen" aria-label="Во весь экран">&#9974;</button>
		</div>

		<?php echo $body; ?>

		<footer class="bk-footer">
			<a href="/apps/">Приложения</a> |
			<a href="/contacts/">Контакты</a> |
			<a href="/terms/">Условия использования</a> |
			<a href="/privacy/">Конфиденциальность</a> |
			<span>&copy; <?php echo esc_html( gmdate( 'Y' ) ); ?> Будильник онлайн</span>
		</footer>

		<!-- Панель «Поделиться» -->
		<div id="pnl-share" class="bk-side" aria-hidden="true" hidden>
			<div class="bk-side-backdrop"></div>
			<div class="bk-side-box">
				<h3>Поделиться</h3>
				<input type="text" id="share-url" class="bk-input" readonly>
				<button type="button" id="btn-share-copy" class="bk-btn">Копировать</button>
				<button type="button" id="btn-share-embed" class="bk-btn">HTML-код</button>
				<button type="button" class="bk-btn bk-side-close">Закрыть</button>
			</div>
		</div>

		<!-- Панель «Настройки» -->
		<div id="pnl-settings" class="bk-side" aria-hidden="true" hidden>
			<div class="bk-side-backdrop"></div>
			<div class="bk-side-box">
				<h3>Настройки</h3>
				<div class="bk-form">
					<label class="bk-check"><input type="checkbox" id="set-ampm"> 12-часовой формат (AM/PM)</label>
					<label class="bk-check"><input type="checkbox" id="set-date"> Показать дату</label>
					<label class="bk-check"><input type="checkbox" id="set-seconds"> Показать секунды</label>
					<label class="bk-check"><input type="checkbox" id="set-night"> Ночной режим</label>
					<label class="bk-check"><input type="checkbox" id="set-digital"> Цифровой шрифт</label>
					<div class="bk-form-row">
						<label>Цвет</label>
						<select id="set-color" class="bk-select">
							<option value="0">Белый</option>
							<option value="1">Голубой</option>
							<option value="2">Зелёный</option>
							<option value="3">Оранжевый</option>
							<option value="4">Розовый</option>
						</select>
					</div>
					<button type="button" class="bk-btn bk-side-close">Закрыть</button>
				</div>
			</div>
		</div>

		<!-- Модалка embed-кода -->
		<div id="form-embed" class="bk-modal" role="dialog" hidden>
			<div class="bk-modal-backdrop"></div>
			<div class="bk-modal-box">
				<h3 class="bk-modal-title">HTML-код для вставки</h3>
				<textarea id="embed-code" class="bk-textarea" rows="5" readonly></textarea>
				<button type="button" id="btn-embed-copy" class="bk-btn">Копировать</button>
				<button type="button" class="bk-btn bk-modal-close">Закрыть</button>
			</div>
		</div>
	</div>
	<?php
	return ob_get_clean();
}

function budilki_render_alarm( $time ) {
	$preset_links = '';
	foreach ( budilki_preset_times() as $t ) {
		$slug          = 'будильник-на-' . str_replace( ':', '-', $t );
		$preset_links .= '<a href="/' . esc_attr( $slug ) . '/">' . esc_html( $t ) . '</a>';
	}

	$data_time = $time ? ' data-alarm-time="' . esc_attr( $time ) . '"' : '';

	ob_start();
	?>
	<div id="pnl-clock" class="bk-clock">
		<div id="clock-title" class="bk-clock-title"></div>
		<div id="clock-time" class="bk-clock-time"><span id="clock-hm">00:00</span><span id="clock-sec">:00</span><span id="clock-ampm"></span></div>
		<div id="clock-date" class="bk-clock-date"></div>
	</div>

	<button type="button" id="pnl-set-alarm" class="bk-btn bk-btn-primary bk-btn-big">Поставить будильник</button>

	<!-- Строка состояния будильника -->
	<div id="row-alarm" class="bk-alarm-row" hidden>
		<div class="bk-alarm-row-info">
			<div id="alarm-row-title" class="bk-alarm-row-title">Будильник</div>
			<div id="alarm-row-time" class="bk-alarm-row-time">16:50</div>
			<div id="alarm-row-countdown" class="bk-alarm-row-countdown">00:05:32</div>
		</div>
		<button type="button" id="btn-alarm-cancel" class="bk-btn bk-btn-danger">Выключить будильник</button>
	</div>

	<!-- Ссылки на предустановки -->
	<div id="pnl-links" class="bk-links">
		<h2 class="bk-h2">Поставить будильник на определённое время</h2>
		<div class="bk-links-grid"><?php echo $preset_links; ?></div>
	</div>

	<!-- Последние использованные -->
	<div id="pnl-recent" class="bk-recent" hidden>
		<h2 class="bk-h2">Последние использованные</h2>
		<div id="recent-list" class="bk-recent-list"></div>
	</div>

	<!-- SEO-текст -->
	<div id="pnl-description" class="bk-description">
		<h2 class="bk-h2">Как пользоваться онлайн будильником</h2>
		<p>Выберите время, при желании — звук и заголовок, и нажмите «Старт». Будильник зазвенит точно в заданную минуту, даже если вкладка находится в фоне.</p>
		<p>Пока будильник установлен, страницу нельзя закрывать: срабатывание работает, только пока открыта вкладка браузера.</p>
	</div>

	<!-- Модалка установки будильника -->
	<div id="form-alarm" class="bk-modal" role="dialog" aria-modal="true" aria-labelledby="form-alarm-title" hidden>
		<div class="bk-modal-backdrop"></div>
		<div class="bk-modal-box">
			<h3 id="form-alarm-title" class="bk-modal-title">Установка будильника</h3>
			<div class="bk-form">
				<div class="bk-form-row">
					<label>Час</label>
					<div class="bk-stepper">
						<button type="button" class="bk-step" data-field="hour" data-dir="-1">&minus;</button>
						<select id="sel-hour" class="bk-select"></select>
						<button type="button" class="bk-step" data-field="hour" data-dir="1">+</button>
					</div>
					<label>Мин</label>
					<div class="bk-stepper">
						<button type="button" class="bk-step" data-field="min" data-dir="-1">&minus;</button>
						<select id="sel-min" class="bk-select"></select>
						<button type="button" class="bk-step" data-field="min" data-dir="1">+</button>
					</div>
				</div>
				<div class="bk-form-row">
					<label>Звук</label>
					<select id="sel-sound" class="bk-select"><?php echo budilki_sound_options_html(); ?></select>
					<button type="button" id="btn-preview-sound" class="bk-btn">&#9654; Прослушать</button>
				</div>
				<div class="bk-form-row">
					<label class="bk-check"><input type="checkbox" id="chk-loop"> Повторить (зациклить)</label>
				</div>
				<div class="bk-form-row">
					<label>Заголовок</label>
					<input type="text" id="inp-title" class="bk-input" value="Будильник" maxlength="120">
				</div>
				<div class="bk-form-actions">
					<button type="button" id="btn-alarm-test" class="bk-btn">Тест</button>
					<button type="button" id="btn-alarm-cancel-form" class="bk-btn">Отмена</button>
					<button type="button" id="btn-alarm-start" class="bk-btn bk-btn-primary">Старт</button>
				</div>
			</div>
		</div>
	</div>

	<!-- Диалог срабатывания -->
	<div id="dialog-alarm" class="bk-modal" role="dialog" aria-modal="true" hidden>
		<div class="bk-modal-backdrop"></div>
		<div class="bk-modal-box bk-modal-ring">
			<div class="bk-ring-icon">&#9200;</div>
			<div id="dialog-alarm-title" class="bk-ring-title">Будильник</div>
			<div id="dialog-alarm-time" class="bk-ring-time">16:50</div>
			<div id="dialog-alarm-overdue" class="bk-ring-overdue" hidden></div>
			<button type="button" id="btn-alarm-ok" class="bk-btn bk-btn-primary bk-btn-big">OK</button>
		</div>
	</div>
	<?php
	return budilki_render_shell( 'alarm', ob_get_clean(), $data_time );
}

function budilki_render_timer( $duration ) {
	$data_duration = $duration ? ' data-duration="' . esc_attr( (string) $duration ) . '"' : '';

	ob_start();
	?>
	<div id="pnl-clock" class="bk-clock">
		<div id="timer-title" class="bk-clock-title"></div>
		<div id="timer-time" class="bk-clock-time">00:00</div>
	</div>

	<button type="button" id="pnl-set-timer" class="bk-btn bk-btn-primary bk-btn-big">Установить таймер</button>

	<!-- Управление таймером -->
	<div id="timer-controls" class="bk-toolbar" hidden>
		<button type="button" id="btn-timer-reset" class="bk-btn">Сброс</button>
		<button type="button" id="btn-timer-pause" class="bk-btn">Стоп</button>
	</div>

	<!-- Строка состояния таймера -->
	<div id="row-timer" class="bk-alarm-row" hidden>
		<div class="bk-alarm-row-info">
			<div id="timer-row-title" class="bk-alarm-row-title">Таймер</div>
			<div id="timer-row-countdown" class="bk-alarm-row-countdown">00:00:00</div>
		</div>
		<button type="button" id="btn-timer-cancel" class="bk-btn bk-btn-danger">Выключить таймер</button>
	</div>

	<!-- SEO-текст -->
	<div id="pnl-description" class="bk-description">
		<h2 class="bk-h2">Как пользоваться онлайн таймером</h2>
		<p>Задайте длительность, выберите звук и заголовок, нажмите «Старт». Таймер отсчитает время и подаст сигнал.</p>
	</div>

	<!-- Модалка установки таймера -->
	<div id="form-timer" class="bk-modal" role="dialog" aria-modal="true" aria-labelledby="form-timer-title" hidden>
		<div class="bk-modal-backdrop"></div>
		<div class="bk-modal-box">
			<h3 id="form-timer-title" class="bk-modal-title">Установка таймера</h3>
			<div class="bk-form">
				<div class="bk-form-row">
					<label>Час</label>
					<div class="bk-stepper">
						<button type="button" class="bk-step" data-field="hour" data-dir="-1">&minus;</button>
						<select id="timer-sel-hour" class="bk-select"></select>
						<button type="button" class="bk-step" data-field="hour" data-dir="1">+</button>
					</div>
					<label>Мин</label>
					<div class="bk-stepper">
						<button type="button" class="bk-step" data-field="min" data-dir="-1">&minus;</button>
						<select id="timer-sel-min" class="bk-select"></select>
						<button type="button" class="bk-step" data-field="min" data-dir="1">+</button>
					</div>
					<label>Сек</label>
					<div class="bk-stepper">
						<button type="button" class="bk-step" data-field="sec" data-dir="-1">&minus;</button>
						<select id="timer-sel-sec" class="bk-select"></select>
						<button type="button" class="bk-step" data-field="sec" data-dir="1">+</button>
					</div>
				</div>
				<div class="bk-form-row">
					<label>Звук</label>
					<select id="timer-sel-sound" class="bk-select"><?php echo budilki_sound_options_html(); ?></select>
					<button type="button" id="btn-timer-preview" class="bk-btn">&#9654; Прослушать</button>
				</div>
				<div class="bk-form-row">
					<label class="bk-check"><input type="checkbox" id="timer-chk-loop"> Повторить (зациклить)</label>
				</div>
				<div class="bk-form-row">
					<label>Заголовок</label>
					<input type="text" id="timer-inp-title" class="bk-input" value="Таймер" maxlength="120">
				</div>
				<div class="bk-form-row">
					<label class="bk-check"><input type="checkbox" id="timer-chk-message" checked> Показать сообщение</label>
				</div>
				<div class="bk-form-actions">
					<button type="button" id="btn-timer-test" class="bk-btn">Тест</button>
					<button type="button" id="btn-timer-cancel-form" class="bk-btn">Отмена</button>
					<button type="button" id="btn-timer-start" class="bk-btn bk-btn-primary">Старт</button>
				</div>
			</div>
		</div>
	</div>

	<!-- Диалог срабатывания таймера -->
	<div id="dialog-timer" class="bk-modal" role="dialog" aria-modal="true" hidden>
		<div class="bk-modal-backdrop"></div>
		<div class="bk-modal-box bk-modal-ring">
			<div class="bk-ring-icon">&#9202;</div>
			<div id="dialog-timer-title" class="bk-ring-title">Таймер</div>
			<div id="dialog-timer-msg" class="bk-ring-time">Время вышло</div>
			<button type="button" id="btn-timer-ok" class="bk-btn bk-btn-primary bk-btn-big">OK</button>
		</div>
	</div>
	<?php
	return budilki_render_shell( 'timer', ob_get_clean(), $data_duration );
}
