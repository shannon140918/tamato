import { createServer } from "node:http";
import { mkdir, readFile, readdir } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { pbkdf2Sync, randomBytes, randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 8765);
const dataDir = path.join(root, "data");
const stateFile = path.join(dataDir, "app-state.json");
const databaseFile = path.join(dataDir, "daily-focus.sqlite");
const javaUsersFile = path.join(dataDir, "java-auth", "users.tsv");
const javaAccountsDir = path.join(dataDir, "java-accounts");
const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

let database;
const sessions = new Map();

async function getDatabase() {
  if (database) return database;
  await mkdir(dataDir, { recursive: true });
  database = new DatabaseSync(databaseFile);
  database.exec(`
    CREATE TABLE IF NOT EXISTS app_state (
      id TEXT PRIMARY KEY,
      state_json TEXT,
      updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS users (
      phone TEXT PRIMARY KEY,
      salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      hash_type TEXT NOT NULL DEFAULT 'pbkdf2-sha1',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS account_state (
      phone TEXT PRIMARY KEY,
      state_json TEXT,
      updated_at TEXT,
      FOREIGN KEY(phone) REFERENCES users(phone) ON DELETE CASCADE
    );
  `);
  await migrateJsonStateIfNeeded(database);
  await migrateJavaAccountDataIfNeeded(database);
  return database;
}

async function migrateJsonStateIfNeeded(db) {
  const existing = db.prepare("SELECT id FROM app_state WHERE id = ?").get("main");
  if (existing) return;
  try {
    const legacy = JSON.parse(await readFile(stateFile, "utf8"));
    if (!legacy || typeof legacy.state !== "object") return;
    db.prepare("INSERT INTO app_state (id, state_json, updated_at) VALUES (?, ?, ?)").run(
      "main",
      JSON.stringify(legacy.state),
      legacy.updatedAt || new Date().toISOString()
    );
  } catch {
    // No legacy JSON state to migrate.
  }
}

async function migrateJavaAccountDataIfNeeded(db) {
  const migrated = db.prepare("SELECT id FROM app_state WHERE id = ?").get("java-account-migration-v1");
  if (migrated) return;

  try {
    const content = await readFile(javaUsersFile, "utf8");
    const insertUser = db.prepare(
      `INSERT INTO users (phone, salt, password_hash, hash_type, created_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(phone) DO UPDATE SET
         salt = excluded.salt,
         password_hash = excluded.password_hash,
         hash_type = excluded.hash_type`
    );
    for (const line of content.split(/\r?\n/)) {
      const [phone, salt, passwordHash, createdAt] = line.split("\t");
      if (!/^1\d{10}$/.test(phone || "") || !salt || !passwordHash) continue;
      insertUser.run(phone, salt, passwordHash, "pbkdf2-sha1", createdAt || new Date().toISOString());
    }
  } catch {
    // No Java user file to migrate.
  }

  try {
    const files = await readdir(javaAccountsDir);
    const insertState = db.prepare(
      `INSERT INTO account_state (phone, state_json, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(phone) DO UPDATE SET
         state_json = excluded.state_json,
         updated_at = excluded.updated_at`
    );
    for (const file of files) {
      const phone = file.replace(/\.json$/i, "");
      if (!/^1\d{10}$/.test(phone)) continue;
      const payload = JSON.parse(await readFile(path.join(javaAccountsDir, file), "utf8"));
      insertState.run(phone, JSON.stringify(payload?.state || null), payload?.updatedAt || new Date().toISOString());
    }
  } catch {
    // No Java account files to migrate.
  }

  db.prepare("INSERT OR REPLACE INTO app_state (id, state_json, updated_at) VALUES (?, ?, ?)").run(
    "java-account-migration-v1",
    "{}",
    new Date().toISOString()
  );
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

function sendJson(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "");
}

function validateCredentials(phone, password) {
  if (!/^1\d{10}$/.test(phone)) return "请输入有效的11位手机号。";
  if (!password || String(password).length < 6) return "密码至少需要6位。";
  return "";
}

function createSalt() {
  return randomBytes(16).toString("base64");
}

function hashPassword(password, salt) {
  return pbkdf2Sync(String(password), Buffer.from(salt, "base64"), 12000, 32, "sha1").toString("base64");
}

function createToken() {
  return randomUUID().replaceAll("-", "") + randomUUID().replaceAll("-", "");
}

function getSessionPhone(request) {
  const token = String(request.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  return sessions.get(token) || "";
}

function ensureAuthorized(request, response, phone) {
  if (getSessionPhone(request) !== phone) {
    sendJson(response, 401, { error: { status: 401, message: "请先登录。" } });
    return false;
  }
  return true;
}

async function registerAccount(request, response) {
  try {
    const db = await getDatabase();
    const payload = JSON.parse((await readRequestBody(request)) || "{}");
    const phone = normalizePhone(payload.phone);
    const password = String(payload.password || "");
    const error = validateCredentials(phone, password);
    if (error) return sendJson(response, 400, { error: { status: 400, message: error } });

    if (db.prepare("SELECT phone FROM users WHERE phone = ?").get(phone)) {
      return sendJson(response, 409, { error: { status: 409, message: "手机号已注册。" } });
    }

    const salt = createSalt();
    const createdAt = new Date().toISOString();
    db.prepare("INSERT INTO users (phone, salt, password_hash, hash_type, created_at) VALUES (?, ?, ?, ?, ?)").run(
      phone,
      salt,
      hashPassword(password, salt),
      "pbkdf2-sha1",
      createdAt
    );
    db.prepare("INSERT OR IGNORE INTO account_state (phone, state_json, updated_at) VALUES (?, ?, ?)").run(
      phone,
      null,
      createdAt
    );

    const token = createToken();
    sessions.set(token, phone);
    sendJson(response, 200, { ok: true, phone, token });
  } catch (error) {
    sendJson(response, 500, { error: { status: 500, message: `注册失败：${error.message}` } });
  }
}

async function loginAccount(request, response) {
  try {
    const db = await getDatabase();
    const payload = JSON.parse((await readRequestBody(request)) || "{}");
    const phone = normalizePhone(payload.phone);
    const password = String(payload.password || "");
    const error = validateCredentials(phone, password);
    if (error) return sendJson(response, 400, { error: { status: 400, message: error } });

    const user = db.prepare("SELECT phone, salt, password_hash FROM users WHERE phone = ?").get(phone);
    if (!user || hashPassword(password, user.salt) !== user.password_hash) {
      return sendJson(response, 401, { error: { status: 401, message: "手机号或密码不正确。" } });
    }

    db.prepare("INSERT OR IGNORE INTO account_state (phone, state_json, updated_at) VALUES (?, ?, ?)").run(
      phone,
      null,
      new Date().toISOString()
    );
    const token = createToken();
    sessions.set(token, phone);
    sendJson(response, 200, { ok: true, phone, token });
  } catch (error) {
    sendJson(response, 500, { error: { status: 500, message: `登录失败：${error.message}` } });
  }
}

async function readAccountState(phone, request, response) {
  phone = normalizePhone(phone);
  if (!/^1\d{10}$/.test(phone)) return sendJson(response, 400, { error: { status: 400, message: "手机号格式不正确。" } });
  if (!ensureAuthorized(request, response, phone)) return;

  try {
    const db = await getDatabase();
    const row = db.prepare("SELECT state_json, updated_at FROM account_state WHERE phone = ?").get(phone);
    sendJson(response, 200, {
      state: row?.state_json ? JSON.parse(row.state_json) : null,
      phone,
      updatedAt: row?.updated_at || null,
    });
  } catch (error) {
    sendJson(response, 500, { error: { status: 500, message: `读取账号数据失败：${error.message}` } });
  }
}

async function writeAccountState(phone, request, response) {
  phone = normalizePhone(phone);
  if (!/^1\d{10}$/.test(phone)) return sendJson(response, 400, { error: { status: 400, message: "手机号格式不正确。" } });
  if (!ensureAuthorized(request, response, phone)) return;

  try {
    const payload = JSON.parse((await readRequestBody(request)) || "{}");
    if (!payload || typeof payload.state !== "object" || Array.isArray(payload.state)) {
      return sendJson(response, 400, { error: { status: 400, message: "状态数据格式不正确。" } });
    }

    const db = await getDatabase();
    const updatedAt = new Date().toISOString();
    db.prepare(
      `INSERT INTO account_state (phone, state_json, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(phone) DO UPDATE SET state_json = excluded.state_json, updated_at = excluded.updated_at`
    ).run(phone, JSON.stringify(payload.state), updatedAt);
    sendJson(response, 200, { ok: true, database: path.basename(databaseFile), updatedAt });
  } catch (error) {
    sendJson(response, 500, { error: { status: 500, message: `保存账号数据失败：${error.message}` } });
  }
}

async function deleteAccount(phone, request, response) {
  phone = normalizePhone(phone);
  if (!/^1\d{10}$/.test(phone)) return sendJson(response, 400, { error: { status: 400, message: "手机号格式不正确。" } });
  if (!ensureAuthorized(request, response, phone)) return;

  try {
    const db = await getDatabase();
    db.prepare("DELETE FROM account_state WHERE phone = ?").run(phone);
    db.prepare("DELETE FROM users WHERE phone = ?").run(phone);
    for (const [token, sessionPhone] of sessions.entries()) {
      if (sessionPhone === phone) sessions.delete(token);
    }
    sendJson(response, 200, { ok: true });
  } catch (error) {
    sendJson(response, 500, { error: { status: 500, message: `删除账号失败：${error.message}` } });
  }
}

async function proxyDashScope(request, response) {
  const apiKey = String(request.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  const baseUrl = String(request.headers["x-dashscope-base-url"] || "https://dashscope.aliyuncs.com/compatible-mode/v1")
    .trim()
    .replace(/\/+$/, "");

  if (!apiKey) {
    sendJson(response, 401, { error: { message: "缺少阿里云百炼 API Key。" } });
    return;
  }

  if (!/^https:\/\/dashscope(-intl|-us)?\.aliyuncs\.com\/compatible-mode\/v1$/i.test(baseUrl)) {
    sendJson(response, 400, { error: { message: "Base URL 不是受支持的百炼兼容接口地址。" } });
    return;
  }

  try {
    const upstream = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: await readRequestBody(request),
    });
    const text = await upstream.text();
    response.writeHead(upstream.status, {
      "Content-Type": upstream.headers.get("content-type") || "application/json; charset=utf-8",
    });
    response.end(text);
  } catch (error) {
    sendJson(response, 502, { error: { message: `百炼接口请求失败：${error.message}` } });
  }
}

async function readAppState(response) {
  try {
    const db = await getDatabase();
    const row = db.prepare("SELECT state_json, updated_at FROM app_state WHERE id = ?").get("main");
    sendJson(response, 200, {
      state: row?.state_json ? JSON.parse(row.state_json) : null,
      updatedAt: row?.updated_at || null,
    });
  } catch (error) {
    sendJson(response, 200, { state: null, updatedAt: null, error: error.message });
  }
}

async function writeAppState(request, response) {
  try {
    const payload = JSON.parse((await readRequestBody(request)) || "{}");
    if (!payload || typeof payload.state !== "object" || Array.isArray(payload.state)) {
      sendJson(response, 400, { error: { message: "状态数据格式不正确。" } });
      return;
    }

    const db = await getDatabase();
    const updatedAt = new Date().toISOString();
    db.prepare(
      `INSERT INTO app_state (id, state_json, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET state_json = excluded.state_json, updated_at = excluded.updated_at`
    ).run("main", JSON.stringify(payload.state), updatedAt);
    sendJson(response, 200, { ok: true, database: path.basename(databaseFile), updatedAt });
  } catch (error) {
    sendJson(response, 500, { error: { message: `保存状态失败：${error.message}` } });
  }
}

async function serveStatic(request, response) {
  let pathname = decodeURIComponent((request.url || "/").split("?")[0]);
  if (pathname === "/") pathname = "/index.html";
  const filePath = path.resolve(root, `.${pathname}`);

  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const data = await readFile(filePath);
    response.writeHead(200, { "Content-Type": mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream" });
    response.end(data);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
}

const server = createServer(async (request, response) => {
  const route = request.url?.split("?")[0] || "/";
  const accountStateMatch = route.match(/^\/api\/accounts\/(\d{11})\/state$/);
  const accountDeleteMatch = route.match(/^\/api\/accounts\/(\d{11})$/);

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }
  if (request.method === "POST" && route === "/api/auth/register") {
    await registerAccount(request, response);
    return;
  }
  if (request.method === "POST" && route === "/api/auth/login") {
    await loginAccount(request, response);
    return;
  }
  if (accountStateMatch) {
    const phone = accountStateMatch[1];
    if (request.method === "GET") {
      await readAccountState(phone, request, response);
      return;
    }
    if (request.method === "PUT") {
      await writeAccountState(phone, request, response);
      return;
    }
  }
  if (request.method === "DELETE" && accountDeleteMatch) {
    await deleteAccount(accountDeleteMatch[1], request, response);
    return;
  }
  if (request.method === "GET" && route === "/api/health") {
    const db = await getDatabase();
    const row = db.prepare("SELECT updated_at FROM app_state WHERE id = ?").get("main");
    const userCount = db.prepare("SELECT COUNT(*) AS count FROM users").get().count;
    const accountStateCount = db.prepare("SELECT COUNT(*) AS count FROM account_state").get().count;
    sendJson(response, 200, {
      ok: true,
      database: path.basename(databaseFile),
      hasState: Boolean(row),
      updatedAt: row?.updated_at || null,
      users: userCount,
      accountStates: accountStateCount,
    });
    return;
  }
  if (request.method === "GET" && route === "/api/state") {
    await readAppState(response);
    return;
  }
  if (request.method === "PUT" && route === "/api/state") {
    await writeAppState(request, response);
    return;
  }
  if (request.method === "POST" && route === "/api/dashscope/chat/completions") {
    await proxyDashScope(request, response);
    return;
  }
  await serveStatic(request, response);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`http://127.0.0.1:${port}/index.html`);
});
