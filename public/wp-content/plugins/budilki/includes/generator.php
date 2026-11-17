<?php
/**
 * Генератор SEO-страниц (spec §6.4).
 * Создаёт страницы через wp_insert_post, идемпотентно (get_page_by_path — антидубль).
 * Данные берутся из budilki_cities() (единый каталог) и, позже, из каталогов
 * праздников/лендингов.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Создаёт страницы городов /time/<город>/.
 * Родитель — страница /time/ (post_parent).
 * Возвращает число созданных страниц.
 */
function budilki_generate_city_pages() {
	$parent = get_page_by_path( 'time' );
	if ( ! $parent ) {
		$parent_id = wp_insert_post( array(
			'post_title'   => 'Точное время',
			'post_name'    => 'time',
			'post_content' => '[budilki tool="time"]',
			'post_status'  => 'publish',
			'post_type'    => 'page',
		) );
	} else {
		$parent_id = $parent->ID;
	}

	$created = 0;
	foreach ( budilki_cities() as $c ) {
		$slug = sanitize_title( $c['name'] );
		$path = 'time/' . $slug;

		$title   = 'Точное время в городе ' . $c['name'] . ', ' . $c['country'];
		$content = '[budilki tool="city" city="' . $c['name'] . '"]';

		$existing = get_page_by_path( $path );
		if ( $existing ) {
			// обновить title/content (идемпотентность + самовосстановление)
			wp_update_post( array(
				'ID'           => $existing->ID,
				'post_title'   => $title,
				'post_content' => $content,
			) );
			continue;
		}

		wp_insert_post( array(
			'post_title'   => $title,
			'post_name'    => $slug,
			'post_parent'  => $parent_id,
			'post_content' => $content,
			'post_status'  => 'publish',
			'post_type'    => 'page',
		) );
		$created++;
	}

	return $created;
}

/**
 * Генератор лендингов будильника /будильник-на-H-MM/ (spec §6.4).
 */
function budilki_generate_alarm_pages() {
	$created = 0;
	foreach ( budilki_preset_times() as $t ) {
		$slug  = sanitize_title( 'будильник-на-' . str_replace( ':', '-', $t ) );
		$h     = (int) $t;
		$part  = ( $h < 12 ) ? 'утра' : 'дня';
		$title = 'Будильник на ' . $t . ' ' . $part;

		$content = '[budilki tool="alarm" time="' . $t . '"]';

		$existing = get_page_by_path( $slug );
		if ( $existing ) {
			wp_update_post( array(
				'ID'           => $existing->ID,
				'post_title'   => $title,
				'post_content' => $content,
			) );
			continue;
		}

		wp_insert_post( array(
			'post_title'   => $title,
			'post_name'    => $slug,
			'post_content' => $content,
			'post_status'  => 'publish',
			'post_type'    => 'page',
		) );
		$created++;
	}
	return $created;
}

/**
 * Генератор лендингов таймера /таймер-на-N-…/ (spec §6.4).
 */
function budilki_generate_timer_pages() {
	$created = 0;
	foreach ( budilki_timer_landings() as $l ) {
		$slug  = sanitize_title( $l['slug'] );
		$title = 'Таймер на ' . $l['label'] . ' - Таймер онлайн';

		$content = '[budilki tool="timer" duration="' . $l['seconds'] . '"]';

		$existing = get_page_by_path( $slug );
		if ( $existing ) {
			wp_update_post( array(
				'ID'           => $existing->ID,
				'post_title'   => $title,
				'post_content' => $content,
			) );
			continue;
		}

		wp_insert_post( array(
			'post_title'   => $title,
			'post_name'    => $slug,
			'post_content' => $content,
			'post_status'  => 'publish',
			'post_type'    => 'page',
		) );
		$created++;
	}
	return $created;
}

/**
 * Генератор праздников: хаб /prazdniki/, страницы /timer/<слаг>/ и /timer/<слаг>/<год>/ (spec §8).
 */
function budilki_generate_holiday_pages() {
	// хаб /prazdniki/
	$hub = get_page_by_path( 'prazdniki' );
	if ( $hub ) {
		wp_update_post( array(
			'ID'           => $hub->ID,
			'post_title'   => 'Праздники в России',
			'post_content' => '[budilki tool="holidays-hub"]',
		) );
	} else {
		wp_insert_post( array(
			'post_title'   => 'Праздники в России',
			'post_name'    => 'prazdniki',
			'post_content' => '[budilki tool="holidays-hub"]',
			'post_status'  => 'publish',
			'post_type'    => 'page',
		) );
	}

	$timer    = get_page_by_path( 'timer' );
	$timer_id = $timer ? $timer->ID : 0;

	$created = 0;
	foreach ( budilki_holidays() as $h ) {
		$slug = $h['slug'];
		$next = budilki_holiday_next( $h );

		$title   = 'Когда ' . $h['name'] . ' ' . $next[1] . ' - Таймер обратного отсчета онлайн';
		$content = '[budilki tool="holiday" slug="' . $slug . '" date="' . $next[0] . '" fixed="' . ( $h['fixed'] ? '1' : '0' ) . '"]';

		$existing = get_page_by_path( 'timer/' . $slug );
		if ( $existing ) {
			wp_update_post( array(
				'ID'           => $existing->ID,
				'post_title'   => $title,
				'post_content' => $content,
			) );
		} else {
			wp_insert_post( array(
				'post_title'   => $title,
				'post_name'    => $slug,
				'post_parent'  => $timer_id,
				'post_content' => $content,
				'post_status'  => 'publish',
				'post_type'    => 'page',
			) );
			$created++;
		}

		// страницы по годам /timer/<слаг>/<год>/
		$parent    = get_page_by_path( 'timer/' . $slug );
		$parent_id = $parent ? $parent->ID : $timer_id;
		foreach ( budilki_holiday_year_range() as $y ) {
			$yd       = budilki_holiday_date_for_year( $slug, $y );
			$ytitle   = 'Сколько дней до ' . $y . ' года - ' . $h['name'];
			$ycontent = '[budilki tool="holiday" slug="' . $slug . '" date="' . $yd . '" pinned="1"]';

			$yexist = budilki_find_child_by_name( $parent_id, (string) $y );
			if ( $yexist ) {
				wp_update_post( array(
					'ID'           => $yexist->ID,
					'post_title'   => $ytitle,
					'post_content' => $ycontent,
				) );
				// wp_update_post повторно прогоняет wp_unique_post_slug и добавляет «-2»
				// к числовому слагу — восстанавливаем голый год.
				budilki_force_post_name( $yexist->ID, (string) $y );
				continue;
			}

			$id = wp_insert_post( array(
				'post_title'   => $ytitle,
				'post_parent'  => $parent_id,
				'post_content' => $ycontent,
				'post_status'  => 'publish',
				'post_type'    => 'page',
			) );
			if ( $id && ! is_wp_error( $id ) ) {
				// WordPress запрещает «голый» числовой слаг и добавляет -2,
				// поэтому выставляем пост-name вручную (spec §8.4: /timer/<слаг>/<год>/).
				budilki_force_post_name( $id, (string) $y );
			}
			$created++;
		}
	}
	return $created;
}

/**
 * Найти дочернюю страницу по родителю и post_name (надёжнее get_page_by_path
 * для числовых слагов годов).
 */
function budilki_find_child_by_name( $parent_id, $name ) {
	global $wpdb;
	$id = (int) $wpdb->get_var(
		$wpdb->prepare(
			"SELECT ID FROM {$wpdb->posts} WHERE post_type = 'page' AND post_parent = %d AND post_name = %s LIMIT 1",
			(int) $parent_id,
			(string) $name
		)
	);
	return $id ? get_post( $id ) : null;
}

/** Принудительно задать post_name, обходя числовой запрет wp_unique_post_slug. */
function budilki_force_post_name( $post_id, $slug ) {
	global $wpdb;
	$wpdb->update( $wpdb->posts, array( 'post_name' => $slug ), array( 'ID' => (int) $post_id ) );
	clean_post_cache( (int) $post_id );
}
