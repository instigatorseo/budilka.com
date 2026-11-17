<?php
/**
 * Каталог праздников — единый источник для шорткодов holiday/holidays-hub
 * и для генератора SEO-страниц (spec §8). Дату добавляют здесь, без кода.
 *
 * Поля записи: slug, name, date (MM-DD для фиксированных, false для подвижных),
 * fixed (bool), wiki (URL Википедии).
 * Подвижные даты считаются функциями ниже (православная пасхалия и производные).
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

function budilki_holidays() {
	return array(
		array( 'slug' => 'novyy-god',             'name' => 'Новый год',                    'date' => '01-01', 'fixed' => true,  'wiki' => 'https://ru.wikipedia.org/wiki/Новый_год' ),
		array( 'slug' => 'rozhdestvo',            'name' => 'Рождество Христово',           'date' => '01-07', 'fixed' => true,  'wiki' => 'https://ru.wikipedia.org/wiki/Рождество_Христово' ),
		array( 'slug' => 'staryy-novyy-god',      'name' => 'Старый Новый год',             'date' => '01-14', 'fixed' => true,  'wiki' => 'https://ru.wikipedia.org/wiki/Старый_Новый_год' ),
		array( 'slug' => 'kreshchenie',           'name' => 'Крещение Господне',            'date' => '01-19', 'fixed' => true,  'wiki' => 'https://ru.wikipedia.org/wiki/Крещение_Господне' ),
		array( 'slug' => 'tatyanin-den',          'name' => 'Татьянин день',                'date' => '01-25', 'fixed' => true,  'wiki' => 'https://ru.wikipedia.org/wiki/Татьянин_день' ),
		array( 'slug' => 'den-svyatogo-valentina','name' => 'День святого Валентина',       'date' => '02-14', 'fixed' => true,  'wiki' => 'https://ru.wikipedia.org/wiki/День_святого_Валентина' ),
		array( 'slug' => '23-fevralya',           'name' => 'День защитника Отечества',     'date' => '02-23', 'fixed' => true,  'wiki' => 'https://ru.wikipedia.org/wiki/День_защитника_Отечества' ),
		array( 'slug' => 'maslenitsa',            'name' => 'Масленица',                     'date' => false,   'fixed' => false, 'wiki' => 'https://ru.wikipedia.org/wiki/Масленица' ),
		array( 'slug' => '8-marta',               'name' => 'Международный женский день',    'date' => '03-08', 'fixed' => true,  'wiki' => 'https://ru.wikipedia.org/wiki/Международный_женский_день' ),
		array( 'slug' => 'verbnoe-voskresene',    'name' => 'Вербное воскресенье',           'date' => false,   'fixed' => false, 'wiki' => 'https://ru.wikipedia.org/wiki/Вербное_воскресенье' ),
		array( 'slug' => 'den-kosmonavtiki',      'name' => 'День космонавтики',             'date' => '04-12', 'fixed' => true,  'wiki' => 'https://ru.wikipedia.org/wiki/День_космонавтики' ),
		array( 'slug' => 'paskha',                'name' => 'Пасха',                         'date' => false,   'fixed' => false, 'wiki' => 'https://ru.wikipedia.org/wiki/Пасха' ),
		array( 'slug' => '1-maya',                'name' => 'Праздник Весны и Труда',        'date' => '05-01', 'fixed' => true,  'wiki' => 'https://ru.wikipedia.org/wiki/Первое_мая_(праздник)' ),
		array( 'slug' => 'den-pobedy',            'name' => 'День Победы',                   'date' => '05-09', 'fixed' => true,  'wiki' => 'https://ru.wikipedia.org/wiki/День_Победы' ),
		array( 'slug' => 'den-rossii',            'name' => 'День России',                   'date' => '06-12', 'fixed' => true,  'wiki' => 'https://ru.wikipedia.org/wiki/День_России' ),
		array( 'slug' => 'nachalo-leta',          'name' => 'Начало лета',                   'date' => '06-01', 'fixed' => true,  'wiki' => 'https://ru.wikipedia.org/wiki/Лето' ),
		array( 'slug' => 'den-znaniy',            'name' => 'День знаний',                   'date' => '09-01', 'fixed' => true,  'wiki' => 'https://ru.wikipedia.org/wiki/День_знаний' ),
		array( 'slug' => 'den-uchitelya',         'name' => 'День учителя',                  'date' => '10-05', 'fixed' => true,  'wiki' => 'https://ru.wikipedia.org/wiki/День_учителя' ),
		array( 'slug' => 'den-ottsa',             'name' => 'День отца',                     'date' => false,   'fixed' => false, 'wiki' => 'https://ru.wikipedia.org/wiki/День_отца' ),
		array( 'slug' => 'khellouin',             'name' => 'Хэллоуин',                      'date' => '10-31', 'fixed' => true,  'wiki' => 'https://ru.wikipedia.org/wiki/Хэллоуин' ),
		array( 'slug' => 'den-narodnogo-edinstva','name' => 'День народного единства',       'date' => '11-04', 'fixed' => true,  'wiki' => 'https://ru.wikipedia.org/wiki/День_народного_единства' ),
		array( 'slug' => 'den-materi',            'name' => 'День матери',                   'date' => false,   'fixed' => false, 'wiki' => 'https://ru.wikipedia.org/wiki/День_матери' ),
	);
}

function budilki_find_holiday( $slug ) {
	foreach ( budilki_holidays() as $h ) {
		if ( $h['slug'] === $slug ) {
			return $h;
		}
	}
	return null;
}

/** Диапазон годов для блока ссылок и страниц /timer/<слаг>/<год>/ (spec §8.4). */
function budilki_holiday_year_range() {
	return range( 2026, 2035 );
}

/** Православная Пасха (пасхалия Мефодия), возвращает unix-метку. */
function budilki_orthodox_easter_ts( $year ) {
	$a = $year % 4;
	$b = $year % 7;
	$c = $year % 19;
	$d = ( 19 * $c + 15 ) % 30;
	$e = ( 2 * $a + 4 * $b - $d + 34 ) % 7;
	$month = (int) floor( ( $d + $e + 114 ) / 31 );
	$day   = ( ( $d + $e + 114 ) % 31 ) + 1;
	$julian = mktime( 0, 0, 0, $month, $day, $year );
	return $julian + 13 * 86400; // юлианский → григорианский (1900–2099)
}

function budilki_nth_sunday( $year, $month, $n ) {
	$t     = mktime( 0, 0, 0, $month, 1, $year );
	$dow   = (int) date( 'w', $t ); // 0 = воскресенье
	$first = 1 + ( ( 7 - $dow ) % 7 );
	$day   = $first + 7 * ( $n - 1 );
	return sprintf( '%04d-%02d-%02d', $year, $month, $day );
}

function budilki_last_sunday( $year, $month ) {
	$t   = mktime( 0, 0, 0, $month + 1, 0, $year ); // последний день месяца
	$dow = (int) date( 'w', $t );
	$day = (int) date( 'j', $t ) - $dow;
	return sprintf( '%04d-%02d-%02d', $year, $month, $day );
}

/** Дата праздника (Y-m-d) в конкретном году — фиксированная или вычисляемая. */
function budilki_holiday_date_for_year( $slug, $year ) {
	$h = budilki_find_holiday( $slug );
	if ( ! $h ) {
		return $year . '-01-01';
	}
	switch ( $slug ) {
		case 'paskha':
			return date( 'Y-m-d', budilki_orthodox_easter_ts( $year ) );
		case 'maslenitsa':
			return date( 'Y-m-d', budilki_orthodox_easter_ts( $year ) - 49 * 86400 );
		case 'verbnoe-voskresene':
			return date( 'Y-m-d', budilki_orthodox_easter_ts( $year ) - 7 * 86400 );
		case 'den-ottsa':
			return budilki_nth_sunday( $year, 10, 3 );
		case 'den-materi':
			return budilki_last_sunday( $year, 11 );
	}
	return $year . '-' . $h['date'];
}

/** Ближайшая будущая дата праздника: array( Y-m-d, год ). */
function budilki_holiday_next( $h ) {
	$today = current_time( 'Y-m-d' );
	$y     = (int) current_time( 'Y' );
	for ( $k = 0; $k < 3; $k++ ) {
		$d = budilki_holiday_date_for_year( $h['slug'], $y + $k );
		if ( $d >= $today ) {
			return array( $d, $y + $k );
		}
	}
	$d = budilki_holiday_date_for_year( $h['slug'], $y );
	return array( $d, $y );
}

/** «1 января 2027» — для хаба и строки даты. */
function budilki_short_date_ru( $ymd ) {
	static $m = null;
	if ( null === $m ) {
		$m = array( 1 => 'января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря' );
	}
	$t = strtotime( $ymd );
	return (int) date( 'j', $t ) . ' ' . $m[ (int) date( 'n', $t ) ] . ' ' . date( 'Y', $t );
}

/**
 * SEO-текст страницы праздника. Уникальные тексты — в includes/holiday-texts.json
 * (архитектура «данные без кода», spec §8).
 */
function budilki_holiday_text( $h ) {
	static $texts = null;
	if ( null === $texts ) {
		$texts = array();
		$file  = __DIR__ . '/holiday-texts.json';
		if ( file_exists( $file ) ) {
			$raw = @file_get_contents( $file );
			$dec = $raw ? json_decode( $raw, true ) : null;
			if ( is_array( $dec ) ) {
				$texts = $dec;
			}
		}
	}

	$name = $h['name'];
	$src  = '';
	if ( ! empty( $h['wiki'] ) ) {
		$src = '<a href="' . esc_url( $h['wiki'] ) . '" target="_blank" rel="noopener">Подробнее о празднике</a>.';
	}

	if ( isset( $texts[ $h['slug'] ]['paras'] ) ) {
		$out = '';
		foreach ( $texts[ $h['slug'] ]['paras'] as $p ) {
			$out .= '<p>' . esc_html( $p ) . '</p>';
		}
		if ( $src ) {
			$out .= '<p>' . $src . '</p>';
		}
		return $out;
	}

	return '<p>На этой странице — онлайн-счётчик, который показывает, сколько дней, часов, минут и секунд осталось до праздника «' . esc_html( $name ) . '».</p>'
		. '<p>Счётчик обновляется каждую секунду. Откройте страницу в нужный день, чтобы точно узнать, когда наступит ' . esc_html( $name ) . '. ' . $src . '</p>';
}
