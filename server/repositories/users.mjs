// users 数据访问：只做 SQL 与行映射，不含业务分支。
export function rowToUser(row) {
  if (!row) return null;
  return { id: row.user_id, username: row.username, role: row.role, createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at };
}

export async function findByUsername(pool, username) {
  const result = await pool.query(
    "SELECT user_id, username, password_hash, role, created_at FROM users WHERE username = $1",
    [username],
  );
  if (result.rowCount === 0) return null;
  const row = result.rows[0];
  return { ...rowToUser(row), passwordHash: row.password_hash };
}

export async function findById(pool, id) {
  const result = await pool.query("SELECT user_id, username, role, created_at FROM users WHERE user_id = $1", [id]);
  return result.rowCount === 0 ? null : rowToUser(result.rows[0]);
}

export async function create(client, { id, username, passwordHash, role, createdAt }) {
  const result = await client.query(
    `INSERT INTO users (user_id, username, password_hash, role, created_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING user_id, username, role, created_at`,
    [id, username, passwordHash, role, createdAt],
  );
  return rowToUser(result.rows[0]);
}

export async function list(pool) {
  const result = await pool.query("SELECT user_id, username, role, created_at FROM users ORDER BY username");
  return result.rows.map(rowToUser);
}
