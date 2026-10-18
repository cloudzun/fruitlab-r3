import test from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword, validateCredentials, createSession, getSessionUser, deleteSession, findUserByUsername, createUser } from "../server/auth.mjs";
import { createTempDb } from "./helpers/db.mjs";

test("password hashing is salted and verifiable", () => {
  const stored = hashPassword("correct horse battery");
  assert.match(stored, /^scrypt\$\d+\$\d+\$\d+\$/);
  assert.equal(verifyPassword("correct horse battery", stored), true);
  assert.equal(verifyPassword("wrong password", stored), false);
  assert.notEqual(hashPassword("same"), hashPassword("same"));
});

test("credential validation rejects weak input", () => {
  assert.equal(validateCredentials({ username: "ab", password: "longenough" }), "invalid-username");
  assert.equal(validateCredentials({ username: "user-ok", password: "short" }), "invalid-password");
  assert.equal(validateCredentials({ username: "user-ok", password: "longenough" }), null);
});

test("sessions can be created, resolved and deleted", () => {
  const t = createTempDb();
  try {
    const user = findUserByUsername(t.db, "userA");
    const token = createSession(t.db, user.id);
    assert.equal(token.length, 64);
    const resolved = getSessionUser(t.db, token);
    assert.equal(resolved.userId, user.id);
    assert.equal(resolved.username, "userA");
    assert.equal(resolved.role, "user");
    deleteSession(t.db, token);
    assert.equal(getSessionUser(t.db, token), null);
  } finally { t.close(); }
});

test("session stores only the hash of the token", () => {
  const t = createTempDb();
  try {
    const user = findUserByUsername(t.db, "userA");
    const token = createSession(t.db, user.id);
    const rows = t.db.prepare("SELECT token FROM sessions").all();
    assert.equal(rows.length, 1);
    assert.notEqual(rows[0].token, token);
    assert.match(rows[0].token, /^[a-f0-9]{64}$/);
  } finally { t.close(); }
});

test("createUser rejects duplicates and invalid roles", () => {
  const t = createTempDb();
  try {
    assert.equal(createUser(t.db, { username: "userA", password: "password123" }).code, "auth-username-taken");
    assert.equal(createUser(t.db, { username: "newuser", password: "password123", role: "root" }).code, "invalid-request");
    const created = createUser(t.db, { username: "newuser", password: "password123" });
    assert.equal(created.ok, true);
    assert.equal(created.user.role, "user");
  } finally { t.close(); }
});
