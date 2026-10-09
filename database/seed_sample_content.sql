-- Sample content from the original prototype. Run AFTER migrations/001_init.sql. Safe to skip.
/*M!999999\- enable the sandbox mode */ 

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

/*!40000 ALTER TABLE `settings` DISABLE KEYS */;
INSERT INTO `settings` (`key`, `value`, `updated_at`) VALUES ('about.html','<p>hey, i\'m dominion. i design and build <b>business intelligence</b> tools, the kind that sit on top of <b>ERP</b>, <b>POS</b> and <b>CRM</b> platforms. at this stage of my career, my focus is building intelligent software that helps businesses understand their own numbers.</p><p>every business piles up transactions, records and statistics. i turn that into charts, highs and lows, and insights people can act on. alongside this i do <b>product design</b> and <b>full-stack development</b>, and i teach <b>data analysis</b>. before that i was a lead customer support specialist at boardgame art, and a financial analyst at <a href=\"https://manstarlimited.com\">manstar</a>, a uk e-commerce brand.</p><p>love,<br>dominion</p>','2026-10-08 07:21:29');
INSERT INTO `settings` (`key`, `value`, `updated_at`) VALUES ('about.image_media_id','','2026-10-08 07:21:29');
INSERT INTO `settings` (`key`, `value`, `updated_at`) VALUES ('about.name','Dominion Abiodun','2026-10-08 07:21:29');
INSERT INTO `settings` (`key`, `value`, `updated_at`) VALUES ('about.role','Product designer · Developer · Data analyst','2026-10-08 07:21:29');
INSERT INTO `settings` (`key`, `value`, `updated_at`) VALUES ('footprint.contact_label','Contact','2026-10-08 07:21:29');
INSERT INTO `settings` (`key`, `value`, `updated_at`) VALUES ('footprint.show_count','0','2026-10-08 07:21:29');
INSERT INTO `settings` (`key`, `value`, `updated_at`) VALUES ('footprint.text','Clients and companies I have worked with around the world.','2026-10-08 07:21:29');
INSERT INTO `settings` (`key`, `value`, `updated_at`) VALUES ('footprint.title','Our Global Footprint','2026-10-08 07:21:29');
INSERT INTO `settings` (`key`, `value`, `updated_at`) VALUES ('hero.bio_html','<p>hey, i\'m dominion. i build <b>business intelligence</b> tools on top of <b>ERP</b>, <b>POS</b> and <b>CRM</b> systems, turning business data into charts, stats and insights. i also work across <b>product design</b>, <b>software development</b> and <b>data analysis</b>.</p>','2026-10-08 07:21:29');
INSERT INTO `settings` (`key`, `value`, `updated_at`) VALUES ('hero.cta_label','See my work','2026-10-08 07:21:29');
INSERT INTO `settings` (`key`, `value`, `updated_at`) VALUES ('hero.cta_target','#work','2026-10-08 07:21:29');
INSERT INTO `settings` (`key`, `value`, `updated_at`) VALUES ('hero.mouse_target','#/playground','2026-10-08 07:21:29');
INSERT INTO `settings` (`key`, `value`, `updated_at`) VALUES ('hero.reach_text','You can reach me on the following channels.','2026-10-08 07:21:29');
INSERT INTO `settings` (`key`, `value`, `updated_at`) VALUES ('hero.screen_video_media_id','','2026-10-08 07:21:29');
INSERT INTO `settings` (`key`, `value`, `updated_at`) VALUES ('site.contact_email','hello@example.com','2026-10-08 07:21:29');
INSERT INTO `settings` (`key`, `value`, `updated_at`) VALUES ('site.copyright','Copyright 2026.','2026-10-08 07:21:29');
INSERT INTO `settings` (`key`, `value`, `updated_at`) VALUES ('site.default_theme','system','2026-10-08 07:21:29');
INSERT INTO `settings` (`key`, `value`, `updated_at`) VALUES ('site.name','Dominion','2026-10-08 07:21:29');
INSERT INTO `settings` (`key`, `value`, `updated_at`) VALUES ('site.owner','Dominion Abiodun','2026-10-08 07:21:29');
INSERT INTO `settings` (`key`, `value`, `updated_at`) VALUES ('work.all_label','All','2026-10-08 07:21:29');
INSERT INTO `settings` (`key`, `value`, `updated_at`) VALUES ('work.title','Selected Work','2026-10-08 07:21:29');
/*!40000 ALTER TABLE `settings` ENABLE KEYS */;

/*!40000 ALTER TABLE `laptop_buttons` DISABLE KEYS */;
INSERT INTO `laptop_buttons` (`id`, `slug`, `label`, `hover_text`, `target`, `color`, `sort_order`, `is_active`) VALUES (1,'about','About','Read About Me','#/about','cyan',0,1);
INSERT INTO `laptop_buttons` (`id`, `slug`, `label`, `hover_text`, `target`, `color`, `sort_order`, `is_active`) VALUES (2,'work','Work','Selected Work','#work','mustard',1,1);
INSERT INTO `laptop_buttons` (`id`, `slug`, `label`, `hover_text`, `target`, `color`, `sort_order`, `is_active`) VALUES (3,'clients','Clients','Where I\'ve Worked','#globe','red',2,1);
/*!40000 ALTER TABLE `laptop_buttons` ENABLE KEYS */;

/*!40000 ALTER TABLE `social_channels` DISABLE KEYS */;
INSERT INTO `social_channels` (`id`, `name`, `icon_key`, `url`, `icon_media_id`, `sort_order`, `is_active`) VALUES (1,'LinkedIn','linkedin','https://linkedin.com',NULL,0,1);
INSERT INTO `social_channels` (`id`, `name`, `icon_key`, `url`, `icon_media_id`, `sort_order`, `is_active`) VALUES (2,'X','x','https://x.com',NULL,1,1);
INSERT INTO `social_channels` (`id`, `name`, `icon_key`, `url`, `icon_media_id`, `sort_order`, `is_active`) VALUES (3,'WhatsApp','whatsapp','https://wa.me/2340000000',NULL,2,1);
INSERT INTO `social_channels` (`id`, `name`, `icon_key`, `url`, `icon_media_id`, `sort_order`, `is_active`) VALUES (4,'Email','email','mailto:hello@example.com',NULL,3,1);
INSERT INTO `social_channels` (`id`, `name`, `icon_key`, `url`, `icon_media_id`, `sort_order`, `is_active`) VALUES (5,'Facebook','facebook','https://facebook.com',NULL,4,1);
/*!40000 ALTER TABLE `social_channels` ENABLE KEYS */;

/*!40000 ALTER TABLE `categories` DISABLE KEYS */;
INSERT INTO `categories` (`id`, `name`, `slug`, `sort_order`, `is_active`) VALUES (1,'Mobile App','mobile-app',0,1);
INSERT INTO `categories` (`id`, `name`, `slug`, `sort_order`, `is_active`) VALUES (2,'Website','website',1,1);
INSERT INTO `categories` (`id`, `name`, `slug`, `sort_order`, `is_active`) VALUES (3,'Web App','web-app',2,1);
INSERT INTO `categories` (`id`, `name`, `slug`, `sort_order`, `is_active`) VALUES (4,'Data','data',3,1);
INSERT INTO `categories` (`id`, `name`, `slug`, `sort_order`, `is_active`) VALUES (5,'Articles','articles',4,1);
INSERT INTO `categories` (`id`, `name`, `slug`, `sort_order`, `is_active`) VALUES (6,'Photography','photography',5,1);
INSERT INTO `categories` (`id`, `name`, `slug`, `sort_order`, `is_active`) VALUES (7,'Product Design','product-design',6,1);
/*!40000 ALTER TABLE `categories` ENABLE KEYS */;

/*!40000 ALTER TABLE `projects` DISABLE KEYS */;
INSERT INTO `projects` (`id`, `title`, `slug`, `client`, `category_id`, `year`, `role`, `summary`, `overview`, `content`, `cover_media_id`, `video_media_id`, `accent_a`, `accent_b`, `is_featured`, `is_published`, `sort_order`, `created_at`, `updated_at`) VALUES (1,'Karwa','karwa','Karwa Mobility',1,'2026','Product design, mobile','Ride-hailing app for city commuters.','A ride-hailing app built for crowded, unpredictable commutes: live routes, honest ETAs and a booking flow that works on a weak connection.',NULL,NULL,NULL,'#1fb58f','#0b6e57',0,1,0,'2026-10-08 07:21:29','2026-10-08 07:21:29');
INSERT INTO `projects` (`id`, `title`, `slug`, `client`, `category_id`, `year`, `role`, `summary`, `overview`, `content`, `cover_media_id`, `video_media_id`, `accent_a`, `accent_b`, `is_featured`, `is_published`, `sort_order`, `created_at`, `updated_at`) VALUES (2,'Mimikry','mimikry','Mimikry Labs',2,'2026','Design, development','Marketing site with a living brand mark.','A brand site where the logo is a living object. Motion, type and a small content system let the team publish without touching code.',NULL,NULL,NULL,'#6c5ce7','#2d1b69',0,1,1,'2026-10-08 07:21:29','2026-10-08 07:21:29');
INSERT INTO `projects` (`id`, `title`, `slug`, `client`, `category_id`, `year`, `role`, `summary`, `overview`, `content`, `cover_media_id`, `video_media_id`, `accent_a`, `accent_b`, `is_featured`, `is_published`, `sort_order`, `created_at`, `updated_at`) VALUES (3,'Secondz','secondz','Secondz',3,'2025','Product design, front-end','Discovery product for restaurants.','A discovery product that helps people find their next favourite table, with fast filters, honest reviews and a map that stays out of the way.',NULL,NULL,NULL,'#f2b632','#b8581a',0,1,2,'2026-10-08 07:21:29','2026-10-08 07:21:29');
INSERT INTO `projects` (`id`, `title`, `slug`, `client`, `category_id`, `year`, `role`, `summary`, `overview`, `content`, `cover_media_id`, `video_media_id`, `accent_a`, `accent_b`, `is_featured`, `is_published`, `sort_order`, `created_at`, `updated_at`) VALUES (4,'Anima','anima','Anima Studio',2,'2025','Design, motion','Campaign storytelling site.','A long-scroll campaign site for a film studio. Every section is paced like a cut, with type and footage carrying the story.',NULL,NULL,NULL,'#2d3436','#101214',0,1,3,'2026-10-08 07:21:29','2026-10-08 07:21:29');
INSERT INTO `projects` (`id`, `title`, `slug`, `client`, `category_id`, `year`, `role`, `summary`, `overview`, `content`, `cover_media_id`, `video_media_id`, `accent_a`, `accent_b`, `is_featured`, `is_published`, `sort_order`, `created_at`, `updated_at`) VALUES (5,'Ledgerly','ledgerly','Ledgerly',4,'2025','Data analysis, dashboard','Spending dashboard and analysis.','Spending analysis for small teams: a data model, a dashboard and a weekly brief that turns raw transactions into decisions.',NULL,NULL,NULL,'#19b5c6','#0a4f63',0,1,4,'2026-10-08 07:21:29','2026-10-08 07:21:29');
INSERT INTO `projects` (`id`, `title`, `slug`, `client`, `category_id`, `year`, `role`, `summary`, `overview`, `content`, `cover_media_id`, `video_media_id`, `accent_a`, `accent_b`, `is_featured`, `is_published`, `sort_order`, `created_at`, `updated_at`) VALUES (6,'Field Notes','field-notes','Self',5,'2024','Writing, design','Essay on designing for slow networks.','A long-form essay series on designing for slow networks, with annotated screenshots and measurements from real devices.',NULL,NULL,NULL,'#e5483b','#7a1c14',0,1,5,'2026-10-08 07:21:29','2026-10-08 07:21:29');
INSERT INTO `projects` (`id`, `title`, `slug`, `client`, `category_id`, `year`, `role`, `summary`, `overview`, `content`, `cover_media_id`, `video_media_id`, `accent_a`, `accent_b`, `is_featured`, `is_published`, `sort_order`, `created_at`, `updated_at`) VALUES (7,'Harmattan','harmattan','Self',6,'2024','Photography','Lagos street light series.','Street photography from Lagos in harmattan season, when dust turns the afternoon light amber and the city goes soft.',NULL,NULL,NULL,'#d9a56a','#4b3322',0,1,6,'2026-10-08 07:21:29','2026-10-08 07:21:29');
INSERT INTO `projects` (`id`, `title`, `slug`, `client`, `category_id`, `year`, `role`, `summary`, `overview`, `content`, `cover_media_id`, `video_media_id`, `accent_a`, `accent_b`, `is_featured`, `is_published`, `sort_order`, `created_at`, `updated_at`) VALUES (8,'Showtime POS','showtime-pos','Showtime Cinemas',7,'2024','Product design','Seat-booking point of sale.','A point of sale for cinema box offices: a seat map that reads at a glance and a checkout that takes seconds.',NULL,NULL,NULL,'#8e9aaf','#2b2d42',0,1,7,'2026-10-08 07:21:29','2026-10-08 07:21:29');
/*!40000 ALTER TABLE `projects` ENABLE KEYS */;

/*!40000 ALTER TABLE `project_metrics` DISABLE KEYS */;
INSERT INTO `project_metrics` (`id`, `project_id`, `value`, `label`, `sort_order`) VALUES (1,1,'12k','active riders',0);
INSERT INTO `project_metrics` (`id`, `project_id`, `value`, `label`, `sort_order`) VALUES (2,1,'4.8','app rating',1);
INSERT INTO `project_metrics` (`id`, `project_id`, `value`, `label`, `sort_order`) VALUES (3,1,'−30%','booking time',2);
INSERT INTO `project_metrics` (`id`, `project_id`, `value`, `label`, `sort_order`) VALUES (4,5,'3x','faster reports',0);
INSERT INTO `project_metrics` (`id`, `project_id`, `value`, `label`, `sort_order`) VALUES (5,5,'40+','dashboards',1);
INSERT INTO `project_metrics` (`id`, `project_id`, `value`, `label`, `sort_order`) VALUES (6,5,'98%','data accuracy',2);
/*!40000 ALTER TABLE `project_metrics` ENABLE KEYS */;

/*!40000 ALTER TABLE `countries` DISABLE KEYS */;
INSERT INTO `countries` (`id`, `iso_numeric`, `name`, `capital`, `client`, `note`, `marker_lat`, `marker_lng`, `sort_order`, `is_active`) VALUES (1,'566','Nigeria','Abuja',NULL,NULL,9.080000,7.400000,0,1);
INSERT INTO `countries` (`id`, `iso_numeric`, `name`, `capital`, `client`, `note`, `marker_lat`, `marker_lng`, `sort_order`, `is_active`) VALUES (2,'840','United States','Washington, D.C.',NULL,NULL,38.910000,-77.040000,1,1);
INSERT INTO `countries` (`id`, `iso_numeric`, `name`, `capital`, `client`, `note`, `marker_lat`, `marker_lng`, `sort_order`, `is_active`) VALUES (3,'826','United Kingdom','London',NULL,NULL,51.510000,-0.130000,2,1);
INSERT INTO `countries` (`id`, `iso_numeric`, `name`, `capital`, `client`, `note`, `marker_lat`, `marker_lng`, `sort_order`, `is_active`) VALUES (4,'124','Canada','Ottawa',NULL,NULL,45.420000,-75.700000,3,1);
INSERT INTO `countries` (`id`, `iso_numeric`, `name`, `capital`, `client`, `note`, `marker_lat`, `marker_lng`, `sort_order`, `is_active`) VALUES (5,'288','Ghana','Accra',NULL,NULL,5.600000,-0.190000,4,1);
/*!40000 ALTER TABLE `countries` ENABLE KEYS */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

