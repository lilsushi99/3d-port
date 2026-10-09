-- 002: mobile/tablet closing statement, footer "made by" line, centre button renamed to "Click Me".
-- DATA-ONLY: `settings` is a key/value table, so the statement needs a new ROW, not a new column
-- (no existing key stores this content, and no schema change is required).
-- Safe to run on a live site: INSERT IGNORE never overwrites values you already edited in the admin.
INSERT IGNORE INTO settings (`key`, `value`) VALUES ('hero.closing_lead', 'I build products that');
INSERT IGNORE INTO settings (`key`, `value`) VALUES ('hero.closing_rest', 'solve real problems across technology, data, and customer experience.');
INSERT IGNORE INTO settings (`key`, `value`) VALUES ('site.made_by', 'Made by Castiel.');
-- Only renames the button if it still has the untouched default label "Work".
UPDATE laptop_buttons SET label = 'Click Me' WHERE slug = 'work' AND label = 'Work';
