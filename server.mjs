import { createServer } from "node:http";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 8765);
const dataDir = path.join(root, "data");
const accountDataDir = path.join(dataDir, "accounts");
const stateFile = path.join(dataDir, "app-state.json");
const databaseFile = path.join(dataDir, "daily-focus.sqlite");
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
  `);
  await migrateJsonStateIfNeeded(database);
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

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

function getAccountFile(phone) {
  const normalized = String(phone || "").replace(/\D/g, "");
  if (!/^1\d{10}$/.test(normalized)) return null;
  return path.join(accountDataDir, `${normalized}.json`);
}

async function readAccountState(phone, response) {
  const accountFile = getAccountFile(phone);
  if (!accountFile) {
    response.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: { message: "手机号格式不正确。" } }));
    return;
  }

  try {
    const payload = JSON.parse(await readFile(accountFile, "utf8"));
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    response.end(
      JSON.stringify({
        state: payload?.state || null,
        phone: payload?.phone || phone,
        updatedAt: payload?.updatedAt || null,
      })
    );
  } catch {
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ state: null, phone, updatedAt: null }));
  }
}

async function writeAccountState(phone, request, response) {
  const accountFile = getAccountFile(phone);
  if (!accountFile) {
    response.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: { message: "手机号格式不正确。" } }));
    return;
  }

  try {
    const payload = JSON.parse((await readRequestBody(request)) || "{}");
    if (!payload || typeof payload.state !== "object" || Array.isArray(payload.state)) {
      response.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ error: { message: "状态数据格式不正确。" } }));
      return;
    }

    const updatedAt = new Date().toISOString();
    await mkdir(accountDataDir, { recursive: true });
    await writeFile(
      accountFile,
      JSON.stringify(
        {
          phone,
          updatedAt,
          state: payload.state,
        },
        null,
        2
      ),
      "utf8"
    );
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ ok: true, file: path.relative(root, accountFile), updatedAt }));
  } catch (error) {
    response.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: { message: `保存账号数据失败：${error.message}` } }));
  }
}

async function deleteAccountState(phone, response) {
  const accountFile = getAccountFile(phone);
  if (!accountFile) {
    response.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: { message: "手机号格式不正确。" } }));
    return;
  }

  try {
    await rm(accountFile, { force: true });
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ ok: true }));
  } catch (error) {
    response.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: { message: `删除账号数据失败：${error.message}` } }));
  }
}

async function proxyDashScope(request, response) {
  const apiKey = String(request.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  const baseUrl = String(request.headers["x-dashscope-base-url"] || "https://dashscope.aliyuncs.com/compatible-mode/v1")
    .trim()
    .replace(/\/+$/, "");

  if (!apiKey) {
    response.writeHead(401, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: { message: "缺少阿里云百炼 API Key。" } }));
    return;
  }

  if (!/^https:\/\/dashscope(-intl|-us)?\.aliyuncs\.com\/compatible-mode\/v1$/i.test(baseUrl)) {
    response.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: { message: "Base URL 不是受支持的百炼兼容接口地址。" } }));
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
    response.writeHead(502, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: { message: `百炼接口请求失败：${error.message}` } }));
  }
}

async function readAppState(response) {
  try {
    const db = await getDatabase();
    const row = db.prepare("SELECT state_json, updated_at FROM app_state WHERE id = ?").get("main");
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    response.end(
      JSON.stringify({
        state: row?.state_json ? JSON.parse(row.state_json) : null,
        updatedAt: row?.updated_at || null,
      })
    );
  } catch (error) {
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ state: null, updatedAt: null, error: error.message }));
  }
}

async function writeAppState(request, response) {
  try {
    const payload = JSON.parse(await readRequestBody(request) || "{}");
    if (!payload || typeof payload.state !== "object" || Array.isArray(payload.state)) {
      response.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ error: { message: "状态数据格式不正确。" } }));
      return;
    }

    const db = await getDatabase();
    const updatedAt = new Date().toISOString();
    db.prepare(
      `INSERT INTO app_state (id, state_json, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET state_json = excluded.state_json, updated_at = excluded.updated_at`
    ).run("main", JSON.stringify(payload.state), updatedAt);
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ ok: true, updatedAt }));
  } catch (error) {
    response.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: { message: `保存状态失败：${error.message}` } }));
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
  const route = request.url?.split("?")[0];
  const accountStateMatch = route?.match(/^\/api\/accounts\/(\d{11})\/state$/);
  if (accountStateMatch) {
    const phone = accountStateMatch[1];
    if (request.method === "GET") {
      await readAccountState(phone, response);
      return;
    }
    if (request.method === "PUT") {
      await writeAccountState(phone, request, response);
      return;
    }
    if (request.method === "DELETE") {
      await deleteAccountState(phone, response);
      return;
    }
  }

  if (request.method === "GET" && route === "/api/health") {
    const db = await getDatabase();
    const row = db.prepare("SELECT updated_at FROM app_state WHERE id = ?").get("main");
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ ok: true, database: path.basename(databaseFile), hasState: Boolean(row), updatedAt: row?.updated_at || null }));
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
  if (request.method === "POST" && request.url?.split("?")[0] === "/api/dashscope/chat/completions") {
    await proxyDashScope(request, response);
    return;
  }
  await serveStatic(request, response);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`http://127.0.0.1:${port}/index.html`);
});
