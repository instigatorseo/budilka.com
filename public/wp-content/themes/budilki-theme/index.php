<?php
// Blank full-width layout.
// Страницы-инструменты (с шорткодом [budilki ...]) рендерят свой каркас сами.
// Обычные страницы (/apps/, /contacts/, /terms/, /privacy/) получают минимальный
// каркас с навигацией здесь.
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

	$is_tool = has_shortcode( get_the_content(), 'budilki' );

	if ( $is_tool ) :
		the_content();
	else :
		?>
		<div class="bk-page">
			<header class="bk-page-header">
				<a class="bk-page-logo" href="/">Будильник<span>онлайн</span></a>
				<nav class="bk-page-nav">
					<a href="/">Будильник</a>
					<a href="/timer/">Таймер</a>
					<a href="/sekundomer/">Секундомер</a>
					<a href="/time/">Точное время</a>
					<a href="/apps/">Приложения</a>
					<a href="/contacts/">Контакты</a>
				</nav>
			</header>
			<main class="bk-page-main">
				<h1 class="bk-page-title"><?php the_title(); ?></h1>
				<div class="bk-page-content"><?php the_content(); ?></div>
			</main>
			<footer class="bk-page-footer">
				<a href="/apps/">Приложения</a> |
				<a href="/contacts/">Контакты</a> |
				<a href="/terms/">Условия использования</a> |
				<a href="/privacy/">Конфиденциальность</a> |
				<span>&copy; <?php echo esc_html( gmdate( 'Y' ) ); ?> Будильник онлайн</span>
			</footer>
		</div>
		<?php
	endif;
endwhile;
?>
<?php wp_footer(); ?>
</body>
</html>
