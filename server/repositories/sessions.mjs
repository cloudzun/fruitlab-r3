// sessions 数据访问：只存 token 的 sha256；过期校验在 SQL 中完成。
export async function create(client, { tokenHash, userId, createdAt, expiresAt }) {
  await client.query(
    "INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES ($1, $2, $3, $4)",
    [tokenHash, userId, createdAt, expiresAt],
  );
}

export async function findUserByToken(pool, tokenHash, now = new Date()) {
  const result = await pool.query(
    `SELECT u.user_id, u.username, u.role, s.expires_at
       FROM sessions s JOIN users u ON u.user_id = s.user_id
      WHERE s.token_hash = $1 AND s.expires_at > $2`,
    [tokenHash, now],
  );
  if (result.rowCount === 0) return null;
  const row = result.rows[0];
  return { id: row.user_id, username: row.username, role: row.role };
}

export async function deleteByToken(clientOrPool, tokenHash) {
  const result = await clientOrPool.query("DELETE FROM sessions WHERE token_hash = $1", [tokenHash]);
  return result.rowCount;
}

export async function purgeExpired(pool, now = new Date()) {
  const result = await pool.query("DELETE FROM sessions WHERE expires_at <= $1", [now]);
  return result.rowCount;
}

export async function countForUser(pool, userId) {
  const result = await pool.query("SELECT COUNT(*)::int AS n FROM sessions WHERE user_id = $1", [userId]);
  return result.rows[0].n;
}
