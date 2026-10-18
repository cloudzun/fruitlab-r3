-- 记录 seed 模式，防止 classroom 数据库被误当 production 使用。
CREATE TABLE IF NOT EXISTS app_meta (
  key   text PRIMARY KEY,
  value text NOT NULL
);
