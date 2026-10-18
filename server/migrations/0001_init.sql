-- FruitLab R3 初始 schema（PostgreSQL 16）
-- 规则：本文件一旦发布不再修改；后续变更追加 0002_xxx.sql。

CREATE TABLE IF NOT EXISTS schema_migrations (
  version    integer PRIMARY KEY,
  name       text NOT NULL,
  checksum   text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  user_id       text PRIMARY KEY,
  username      text NOT NULL UNIQUE CHECK (char_length(username) BETWEEN 3 AND 32),
  password_hash text NOT NULL,
  role          text NOT NULL CHECK (role IN ('user','admin')),
  created_at    timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  product_id       text PRIMARY KEY,
  name             text NOT NULL,
  unit             text NOT NULL,
  unit_price_cents bigint NOT NULL CHECK (unit_price_cents >= 0 AND unit_price_cents <= 9999999),
  stock            integer NOT NULL CHECK (stock >= 0 AND stock <= 99999),
  listed           boolean NOT NULL,
  image_path       text NOT NULL,
  image_alt        text NOT NULL,
  description      text NOT NULL,
  sort_order       integer NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  order_id        bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_number    text NOT NULL UNIQUE,
  user_id         text NOT NULL REFERENCES users(user_id),
  client_order_id text NOT NULL CHECK (char_length(client_order_id) BETWEEN 8 AND 128),
  subtotal_cents  bigint NOT NULL CHECK (subtotal_cents >= 0),
  created_at      timestamptz NOT NULL,
  CONSTRAINT ux_orders_user_client UNIQUE (user_id, client_order_id)
);

CREATE TABLE IF NOT EXISTS order_items (
  item_id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id         bigint NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
  product_id       text NOT NULL REFERENCES products(product_id),
  quantity         integer NOT NULL CHECK (quantity BETWEEN 1 AND 99),
  unit_price_cents bigint NOT NULL CHECK (unit_price_cents >= 0),
  subtotal_cents   bigint NOT NULL CHECK (subtotal_cents >= 0)
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash text PRIMARY KEY,
  user_id    text NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
