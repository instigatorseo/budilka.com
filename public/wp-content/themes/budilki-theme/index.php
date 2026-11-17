<?php
// Blank full-width layout. Вся страница — вывод the_content() (шорткод [budilki ...]).
// Шапка/меню/футер сайта рендерятся самим шорткодом (см. spec_budilki.md §6.2).
?>
<!doctype html>
<html <?php language_attributes(); ?>>
<head>
	<meta charset="<?php bloginfo( 'charset' ); ?>">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>
<?php
while ( have_posts() ) :
	the_post();
	the_content();
endwhile;
?>
<?php wp_footer(); ?>
</body>
</html>
