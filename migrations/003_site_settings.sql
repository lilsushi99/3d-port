-- 003: favicon, optional navigation image, mobile-scroll switch, preloader. DATA-ONLY: `settings` is key/value,
-- so none of these needs a new column or table. INSERT IGNORE never overwrites values you already saved.
INSERT IGNORE INTO settings (`key`, `value`) VALUES ('hero.mobile_scroll', '1');
INSERT IGNORE INTO settings (`key`, `value`) VALUES ('site.favicon_media_id', '');
INSERT IGNORE INTO settings (`key`, `value`) VALUES ('hero.nav_image_media_id', '');
INSERT IGNORE INTO settings (`key`, `value`) VALUES ('preloader.enabled', '1');
INSERT IGNORE INTO settings (`key`, `value`) VALUES ('preloader.duration', '2000');
INSERT IGNORE INTO settings (`key`, `value`) VALUES ('preloader.text', 'Dominion Abiodun');
-- About / Playground are now real routes (/about, /playground). Only the untouched old hash defaults are rewritten.
UPDATE laptop_buttons SET target = '/about' WHERE target = '#/about';
UPDATE laptop_buttons SET target = '/playground' WHERE target = '#/playground';
UPDATE settings SET `value` = '/playground' WHERE `key` = 'hero.mouse_target' AND `value` = '#/playground';
