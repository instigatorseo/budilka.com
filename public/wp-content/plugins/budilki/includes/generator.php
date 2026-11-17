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
		$content = '[budilki tool="city" city="' . $c['name'] . '"]' . "\n\n" . budilki_city_text( $c );

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
 * Уникальный SEO-текст страницы города (2 абзаца, имя/страна/часовой пояс вставлены).
 * Финальные уникальные тексты — после этапа SEO-исследования (spec §8).
 */
function budilki_city_text( $c ) {
	return '<p>На этой странице показано точное время в городе ' . $c['name'] . ' (' . $c['country'] . '). Часы обновляются каждую секунду и учитывают часовой пояс ' . $c['tz'] . '.</p>'
		. '<p>Сравните время в ' . $c['name'] . ' с другими городами и часовыми поясами на странице <a href="/time/">точное время онлайн</a>.</p>';
}
