<?php
// Минимальная тема для страниц-инструментов. Никакого сайдбара/шапки/футера.
add_action( 'after_setup_theme', function () {
	add_theme_support( 'title-tag' );
	add_theme_support( 'automatic-feed-links' );
	add_theme_support( 'post-thumbnails' );
} );

// На страницах-инструментах wp-admin-bar мешает вёрстке часов (spec §6.3.3).
add_filter( 'show_admin_bar', '__return_false' );

// Favicon (иначе 404 на /favicon.ico).
add_action( 'wp_head', function () {
	echo '<link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>%E2%8F%B0</text></svg>">' . "\n";
}, 1 );
