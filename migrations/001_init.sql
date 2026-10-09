-- 001_init: core content model. Add NEW migrations for structural changes only;
-- new projects/countries/links are rows, never new tables.
CREATE TABLE settings (
  `key` VARCHAR(100) PRIMARY KEY,
  `value` MEDIUMTEXT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE media (
  id INT AUTO_INCREMENT PRIMARY KEY,
  path VARCHAR(255) NOT NULL,            -- file name inside UPLOAD_DIR (binary files are NOT stored in MySQL)
  original_name VARCHAR(255) NULL,
  mime VARCHAR(100) NULL,
  kind ENUM('image','video','other') NOT NULL DEFAULT 'image',
  size_bytes INT NULL,
  alt VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE laptop_buttons (
  id INT AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(50) NOT NULL UNIQUE,
  label VARCHAR(60) NOT NULL,
  hover_text VARCHAR(120) NULL,
  target VARCHAR(255) NOT NULL,          -- '#/about', '#work', '#globe', '#/playground', or a URL
  color ENUM('cyan','mustard','red') NOT NULL DEFAULT 'cyan',
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE social_channels (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  icon_key VARCHAR(40) NOT NULL DEFAULT 'link',   -- linkedin|x|whatsapp|email|facebook|instagram|github|link
  url VARCHAR(500) NOT NULL,
  icon_media_id INT NULL,                          -- optional custom icon
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  CONSTRAINT fk_social_icon FOREIGN KEY (icon_media_id) REFERENCES media(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Only `title` is required. Everything else is optional.
CREATE TABLE projects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  slug VARCHAR(220) NOT NULL UNIQUE,
  client VARCHAR(200) NULL,
  category_id INT NULL,
  year VARCHAR(10) NULL,
  role VARCHAR(200) NULL,
  summary VARCHAR(500) NULL,
  overview TEXT NULL,
  content MEDIUMTEXT NULL,
  cover_media_id INT NULL,
  video_media_id INT NULL,
  accent_a VARCHAR(9) NULL,              -- fallback artwork colours when there is no cover image
  accent_b VARCHAR(9) NULL,
  is_featured TINYINT(1) NOT NULL DEFAULT 0,
  is_published TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_proj_cat FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
  CONSTRAINT fk_proj_cover FOREIGN KEY (cover_media_id) REFERENCES media(id) ON DELETE SET NULL,
  CONSTRAINT fk_proj_video FOREIGN KEY (video_media_id) REFERENCES media(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE project_media (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  media_id INT NOT NULL,
  caption VARCHAR(255) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_pm_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  CONSTRAINT fk_pm_media FOREIGN KEY (media_id) REFERENCES media(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE project_metrics (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  value VARCHAR(40) NOT NULL,
  label VARCHAR(120) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_metric_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Global Footprint. The map highlight count is COUNT(*) of active rows: never hardcoded.
CREATE TABLE countries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  iso_numeric CHAR(3) NOT NULL UNIQUE,   -- ISO 3166-1 numeric, matches public/map-data.json
  name VARCHAR(120) NOT NULL,
  capital VARCHAR(120) NULL,
  client VARCHAR(255) NULL,
  note VARCHAR(500) NULL,
  marker_lat DECIMAL(9,6) NULL,
  marker_lng DECIMAL(9,6) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE articles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(250) NOT NULL,
  slug VARCHAR(270) NOT NULL UNIQUE,
  excerpt VARCHAR(500) NULL,
  content MEDIUMTEXT NULL,
  cover_media_id INT NULL,
  category_id INT NULL,
  author VARCHAR(120) NULL,
  status ENUM('draft','published') NOT NULL DEFAULT 'draft',
  published_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_art_cover FOREIGN KEY (cover_media_id) REFERENCES media(id) ON DELETE SET NULL,
  CONSTRAINT fk_art_cat FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE admin_users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
