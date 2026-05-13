package com.tomato.auth;

import com.sun.net.httpserver.Headers;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;

import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.security.SecureRandom;
import java.security.spec.KeySpec;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TimeZone;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;

public final class TomatoAuthServer {
  private static final int DEFAULT_PORT = 8787;
  private static final SecureRandom RANDOM = new SecureRandom();
  private static final File ROOT = new File(System.getProperty("user.dir")).getParentFile();
  private static final File DATA_DIR = new File(ROOT, "data");
  private static final File AUTH_DIR = new File(DATA_DIR, "java-auth");
  private static final File ACCOUNT_DIR = new File(DATA_DIR, "java-accounts");
  private static final File RESOURCE_DIR = new File(DATA_DIR, "java-resources");
  private static final File USERS_FILE = new File(AUTH_DIR, "users.tsv");
  private static final Map<String, String> COLLECTION_ROUTES = new LinkedHashMap<String, String>();
  private static final Map<String, UserRecord> users = new ConcurrentHashMap<String, UserRecord>();
  private static final Map<String, String> sessions = new ConcurrentHashMap<String, String>();

  static {
    COLLECTION_ROUTES.put("/api/todos", "todos");
    COLLECTION_ROUTES.put("/api/reminders", "reminders");
    COLLECTION_ROUTES.put("/api/goals", "goals");
    COLLECTION_ROUTES.put("/api/wishes", "wishes");
    COLLECTION_ROUTES.put("/api/study-plans", "study-plans");
    COLLECTION_ROUTES.put("/api/focus-sessions", "focus-sessions");
    COLLECTION_ROUTES.put("/api/mistakes", "mistakes");
  }

  private TomatoAuthServer() {
  }

  public static void main(String[] args) throws Exception {
    ensureDirs();
    loadUsers();

    int port = getPort();
    HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", port), 0);
    server.createContext("/api/", new ApiHandler());
    server.setExecutor(Executors.newCachedThreadPool());
    server.start();
    System.out.println("Tomato Java Auth Server: http://127.0.0.1:" + port);
    Thread.currentThread().join();
  }

  private static int getPort() {
    String value = System.getenv("JAVA_AUTH_PORT");
    if (value == null || value.trim().isEmpty()) return DEFAULT_PORT;
    try {
      return Integer.parseInt(value.trim());
    } catch (NumberFormatException ignored) {
      return DEFAULT_PORT;
    }
  }

  private static void ensureDirs() throws IOException {
    Files.createDirectories(AUTH_DIR.toPath());
    Files.createDirectories(ACCOUNT_DIR.toPath());
    Files.createDirectories(RESOURCE_DIR.toPath());
  }

  private static void loadUsers() throws IOException {
    users.clear();
    if (!USERS_FILE.isFile()) return;
    for (String line : Files.readAllLines(USERS_FILE.toPath(), StandardCharsets.UTF_8)) {
      String[] parts = line.split("\\t", -1);
      if (parts.length < 4) continue;
      users.put(parts[0], new UserRecord(parts[0], parts[1], parts[2], parts[3]));
    }
  }

  private static synchronized void saveUsers() throws IOException {
    StringBuilder builder = new StringBuilder();
    for (UserRecord user : users.values()) {
      builder.append(user.phone).append('\t')
        .append(user.salt).append('\t')
        .append(user.hash).append('\t')
        .append(user.createdAt).append('\n');
    }
    Files.write(USERS_FILE.toPath(), builder.toString().getBytes(StandardCharsets.UTF_8));
  }

  private static final class ApiHandler implements HttpHandler {
    @Override
    public void handle(HttpExchange exchange) throws IOException {
      addCors(exchange);
      if ("OPTIONS".equalsIgnoreCase(exchange.getRequestMethod())) {
        send(exchange, 204, "");
        return;
      }

      try {
        String method = exchange.getRequestMethod();
        String path = URLDecoder.decode(exchange.getRequestURI().getPath(), "UTF-8");

        if ("POST".equals(method) && "/api/auth/register".equals(path)) {
          register(exchange);
          return;
        }
        if ("POST".equals(method) && "/api/auth/login".equals(path)) {
          login(exchange);
          return;
        }

        String statePrefix = "/api/accounts/";
        if (path.startsWith(statePrefix)) {
          String rest = path.substring(statePrefix.length());
          String[] parts = rest.split("/");
          if (parts.length == 1 && "DELETE".equals(method)) {
            deleteAccount(exchange, parts[0]);
            return;
          }
          if (parts.length == 2 && "state".equals(parts[1])) {
            if ("GET".equals(method)) {
              readState(exchange, parts[0]);
              return;
            }
            if ("PUT".equals(method)) {
              writeState(exchange, parts[0]);
              return;
            }
          }
        }

        if (handleProfileRoutes(exchange, method, path)) return;
        if (handleSettingsRoutes(exchange, method, path)) return;
        if (handleDashboardRoutes(exchange, method, path)) return;
        if (handleScholarshipRoutes(exchange, method, path)) return;
        if (handleAiRoutes(exchange, method, path)) return;
        if (handleCollectionRoutes(exchange, method, path)) return;
        sendJson(exchange, 404, "{\"error\":{\"message\":\"接口不存在。\"}}");
      } catch (Exception error) {
        sendJson(exchange, 500, "{\"error\":{\"message\":\"" + escapeJson(error.getMessage()) + "\"}}");
      }
    }
  }

  private static void register(HttpExchange exchange) throws Exception {
    String body = readBody(exchange);
    String phone = normalizePhone(readJsonString(body, "phone"));
    String password = readJsonString(body, "password");

    String validationError = validateCredentials(phone, password);
    if (validationError != null) {
      sendError(exchange, 400, validationError);
      return;
    }
    if (users.containsKey(phone)) {
      sendError(exchange, 409, "手机号已注册。");
      return;
    }

    byte[] saltBytes = new byte[16];
    RANDOM.nextBytes(saltBytes);
    String salt = Base64.getEncoder().encodeToString(saltBytes);
    String hash = hashPassword(password, salt);
    users.put(phone, new UserRecord(phone, salt, hash, nowIso()));
    saveUsers();
    ensureAccountFile(phone);

    sendAuthSuccess(exchange, phone);
  }

  private static void login(HttpExchange exchange) throws Exception {
    String body = readBody(exchange);
    String phone = normalizePhone(readJsonString(body, "phone"));
    String password = readJsonString(body, "password");

    String validationError = validateCredentials(phone, password);
    if (validationError != null) {
      sendError(exchange, 400, validationError);
      return;
    }

    UserRecord user = users.get(phone);
    if (user == null || !hashPassword(password, user.salt).equals(user.hash)) {
      sendError(exchange, 401, "手机号或密码不正确。");
      return;
    }

    ensureAccountFile(phone);
    sendAuthSuccess(exchange, phone);
  }

  private static void readState(HttpExchange exchange, String phone) throws IOException {
    phone = normalizePhone(phone);
    if (!isValidPhone(phone)) {
      sendError(exchange, 400, "手机号格式不正确。");
      return;
    }
    if (!isAuthorized(exchange, phone)) return;

    File file = accountFile(phone);
    if (!file.isFile()) {
      sendJson(exchange, 200, "{\"phone\":\"" + phone + "\",\"updatedAt\":null,\"state\":null}");
      return;
    }
    sendJson(exchange, 200, new String(Files.readAllBytes(file.toPath()), StandardCharsets.UTF_8));
  }

  private static void writeState(HttpExchange exchange, String phone) throws IOException {
    phone = normalizePhone(phone);
    if (!isValidPhone(phone)) {
      sendError(exchange, 400, "手机号格式不正确。");
      return;
    }
    if (!isAuthorized(exchange, phone)) return;

    String body = readBody(exchange);
    String stateJson = readJsonValue(body, "state");
    if (stateJson == null || stateJson.trim().isEmpty() || "null".equals(stateJson.trim())) {
      sendError(exchange, 400, "状态数据格式不正确。");
      return;
    }

    String updatedAt = nowIso();
    String payload = "{\n"
      + "  \"phone\": \"" + phone + "\",\n"
      + "  \"updatedAt\": \"" + updatedAt + "\",\n"
      + "  \"state\": " + stateJson + "\n"
      + "}\n";
    Files.write(accountFile(phone).toPath(), payload.getBytes(StandardCharsets.UTF_8));
    sendJson(exchange, 200, "{\"ok\":true,\"updatedAt\":\"" + updatedAt + "\"}");
  }

  private static void deleteAccount(HttpExchange exchange, String phone) throws IOException {
    phone = normalizePhone(phone);
    if (!isValidPhone(phone)) {
      sendError(exchange, 400, "手机号格式不正确。");
      return;
    }
    if (!isAuthorized(exchange, phone)) return;

    users.remove(phone);
    saveUsers();
    sessions.values().remove(phone);
    Files.deleteIfExists(accountFile(phone).toPath());
    deleteDirectory(resourceUserDir(phone));
    sendJson(exchange, 200, "{\"ok\":true}");
  }

  private static boolean handleProfileRoutes(HttpExchange exchange, String method, String path) throws IOException {
    if (!"/api/me".equals(path)) return false;
    String phone = authorizedPhone(exchange);
    if (phone == null) return true;

    if ("GET".equals(method)) {
      String profile = readObjectResource(phone, "profile", defaultProfile(phone));
      sendJson(exchange, 200, "{\"phone\":\"" + phone + "\",\"createdAt\":\"" + escapeJson(createdAt(phone)) + "\",\"profile\":" + profile + ",\"stats\":" + basicStats(phone) + "}");
      return true;
    }
    if ("PUT".equals(method)) {
      String body = requireObjectBody(exchange);
      if (body == null) return true;
      String payload = withServerFields(body, null, false);
      writeObjectResource(phone, "profile", payload);
      sendJson(exchange, 200, "{\"ok\":true,\"profile\":" + payload + "}");
      return true;
    }

    sendError(exchange, 405, "请求方法不支持。");
    return true;
  }

  private static boolean handleSettingsRoutes(HttpExchange exchange, String method, String path) throws IOException {
    if (!"/api/settings".equals(path)) return false;
    String phone = authorizedPhone(exchange);
    if (phone == null) return true;

    if ("GET".equals(method)) {
      sendJson(exchange, 200, readObjectResource(phone, "settings", defaultSettings()));
      return true;
    }
    if ("PUT".equals(method)) {
      String body = requireObjectBody(exchange);
      if (body == null) return true;
      String payload = withServerFields(body, null, false);
      writeObjectResource(phone, "settings", payload);
      sendJson(exchange, 200, "{\"ok\":true,\"settings\":" + payload + "}");
      return true;
    }

    sendError(exchange, 405, "请求方法不支持。");
    return true;
  }

  private static boolean handleDashboardRoutes(HttpExchange exchange, String method, String path) throws IOException {
    if (!"/api/dashboard".equals(path)) return false;
    String phone = authorizedPhone(exchange);
    if (phone == null) return true;
    if (!"GET".equals(method)) {
      sendError(exchange, 405, "请求方法不支持。");
      return true;
    }

    String profile = readObjectResource(phone, "profile", defaultProfile(phone));
    String response = "{"
      + "\"profile\":{\"phone\":\"" + phone + "\",\"detail\":" + profile + "},"
      + "\"today\":" + basicStats(phone) + ","
      + "\"todos\":" + readArrayResource(phone, "todos") + ","
      + "\"reminders\":" + readArrayResource(phone, "reminders") + ","
      + "\"studyPlans\":" + readArrayResource(phone, "study-plans") + ","
      + "\"goals\":" + readArrayResource(phone, "goals") + ","
      + "\"affordableWish\":null"
      + "}";
    sendJson(exchange, 200, response);
    return true;
  }

  private static boolean handleScholarshipRoutes(HttpExchange exchange, String method, String path) throws IOException {
    if (!path.equals("/api/scholarship")
      && !path.equals("/api/scholarship/settings")
      && !path.equals("/api/scholarship/redeem")
      && !path.equals("/api/scholarship/records")) {
      return false;
    }

    String phone = authorizedPhone(exchange);
    if (phone == null) return true;

    if ("GET".equals(method) && "/api/scholarship".equals(path)) {
      sendJson(exchange, 200, readObjectResource(phone, "scholarship", defaultScholarship()));
      return true;
    }
    if ("PUT".equals(method) && "/api/scholarship/settings".equals(path)) {
      String body = requireObjectBody(exchange);
      if (body == null) return true;
      String payload = withServerFields(body, null, false);
      writeObjectResource(phone, "scholarship-settings", payload);
      sendJson(exchange, 200, "{\"ok\":true,\"settings\":" + payload + "}");
      return true;
    }
    if ("POST".equals(method) && "/api/scholarship/redeem".equals(path)) {
      String body = requireObjectBody(exchange);
      if (body == null) return true;
      String record = appendResourceItem(phone, "scholarship-records", body);
      sendJson(exchange, 200, "{\"ok\":true,\"record\":" + record + "}");
      return true;
    }
    if ("GET".equals(method) && "/api/scholarship/records".equals(path)) {
      sendJson(exchange, 200, readArrayResource(phone, "scholarship-records"));
      return true;
    }

    sendError(exchange, 405, "请求方法不支持。");
    return true;
  }

  private static boolean handleAiRoutes(HttpExchange exchange, String method, String path) throws IOException {
    if (!"/api/ai-config".equals(path) && !"/api/ai/mistake-analysis".equals(path)) return false;
    String phone = authorizedPhone(exchange);
    if (phone == null) return true;

    if ("GET".equals(method) && "/api/ai-config".equals(path)) {
      sendJson(exchange, 200, readObjectResource(phone, "ai-config", "{\"baseUrl\":\"\",\"model\":\"qwen3-vl-plus\",\"hasApiKey\":false}"));
      return true;
    }
    if ("PUT".equals(method) && "/api/ai-config".equals(path)) {
      String body = requireObjectBody(exchange);
      if (body == null) return true;
      String payload = withServerFields(body, null, false);
      writeObjectResource(phone, "ai-config", payload);
      sendJson(exchange, 200, "{\"ok\":true,\"config\":" + payload + "}");
      return true;
    }
    if ("POST".equals(method) && "/api/ai/mistake-analysis".equals(path)) {
      String body = requireObjectBody(exchange);
      if (body == null) return true;
      String record = appendResourceItem(phone, "ai-analysis-requests", body);
      sendJson(exchange, 200, "{\"ok\":true,\"request\":" + record + ",\"recognizedText\":\"\",\"summary\":\"AI 分析请求已记录，请接入正式模型后返回分析结果。\",\"similarQuestions\":[]}");
      return true;
    }

    sendError(exchange, 405, "请求方法不支持。");
    return true;
  }

  private static boolean handleCollectionRoutes(HttpExchange exchange, String method, String path) throws IOException {
    for (Map.Entry<String, String> entry : COLLECTION_ROUTES.entrySet()) {
      String basePath = entry.getKey();
      String resourceName = entry.getValue();
      if (!path.equals(basePath) && !path.startsWith(basePath + "/")) continue;

      String phone = authorizedPhone(exchange);
      if (phone == null) return true;

      if (path.equals(basePath)) {
        if ("GET".equals(method)) {
          sendJson(exchange, 200, readArrayResource(phone, resourceName));
          return true;
        }
        if ("POST".equals(method)) {
          String body = requireObjectBody(exchange);
          if (body == null) return true;
          String item = appendResourceItem(phone, resourceName, body);
          sendJson(exchange, 200, "{\"ok\":true,\"item\":" + item + "}");
          return true;
        }
        sendError(exchange, 405, "请求方法不支持。");
        return true;
      }

      String rest = path.substring(basePath.length() + 1);
      if ("focus-sessions".equals(resourceName) && "stats".equals(rest) && "GET".equals(method)) {
        sendJson(exchange, 200, focusStats(phone));
        return true;
      }

      String[] parts = rest.split("/");
      String id = parts.length > 0 ? parts[0] : "";
      if (id.trim().isEmpty()) {
        sendError(exchange, 400, "资源 ID 不能为空。");
        return true;
      }

      if (parts.length == 1) {
        if ("PUT".equals(method)) {
          String body = requireObjectBody(exchange);
          if (body == null) return true;
          String item = replaceResourceItem(phone, resourceName, id, body);
          if (item == null) {
            sendError(exchange, 404, "资源不存在。");
          } else {
            sendJson(exchange, 200, "{\"ok\":true,\"item\":" + item + "}");
          }
          return true;
        }
        if ("DELETE".equals(method)) {
          if (!deleteResourceItem(phone, resourceName, id)) {
            sendError(exchange, 404, "资源不存在。");
          } else {
            sendJson(exchange, 200, "{\"ok\":true}");
          }
          return true;
        }
      }

      if (parts.length == 2 && "POST".equals(method)) {
        handleCollectionAction(exchange, phone, resourceName, id, parts[1]);
        return true;
      }

      sendError(exchange, 404, "接口不存在。");
      return true;
    }
    return false;
  }

  private static void handleCollectionAction(HttpExchange exchange, String phone, String resourceName, String id, String action) throws IOException {
    String body = readBody(exchange).trim();
    if (body.isEmpty()) body = "{}";

    if ("goals".equals(resourceName) && "complete".equals(action)) {
      String record = appendResourceItem(phone, "goal-completions", "{\"goalId\":\"" + escapeJson(id) + "\",\"payload\":" + body + "}");
      sendJson(exchange, 200, "{\"ok\":true,\"goalId\":\"" + escapeJson(id) + "\",\"record\":" + record + "}");
      return;
    }
    if ("wishes".equals(resourceName) && "redeem".equals(action)) {
      String record = appendResourceItem(phone, "wish-redemptions", "{\"wishId\":\"" + escapeJson(id) + "\",\"payload\":" + body + "}");
      sendJson(exchange, 200, "{\"ok\":true,\"wishId\":\"" + escapeJson(id) + "\",\"record\":" + record + "}");
      return;
    }
    if ("study-plans".equals(resourceName) && "to-todo".equals(action)) {
      String todo = appendResourceItem(phone, "todos", "{\"planId\":\"" + escapeJson(id) + "\",\"source\":\"study-plan\",\"payload\":" + body + "}");
      sendJson(exchange, 200, "{\"ok\":true,\"todo\":" + todo + "}");
      return;
    }
    if ("mistakes".equals(resourceName) && "image".equals(action)) {
      String record = appendResourceItem(phone, "mistake-images", "{\"mistakeId\":\"" + escapeJson(id) + "\",\"payload\":" + body + "}");
      sendJson(exchange, 200, "{\"ok\":true,\"image\":" + record + "}");
      return;
    }
    if ("mistakes".equals(resourceName) && "analyze".equals(action)) {
      String record = appendResourceItem(phone, "mistake-analysis", "{\"mistakeId\":\"" + escapeJson(id) + "\",\"payload\":" + body + "}");
      sendJson(exchange, 200, "{\"ok\":true,\"analysis\":" + record + ",\"recognizedText\":\"\",\"summary\":\"AI 分析任务已记录。\",\"similarQuestions\":[]}");
      return;
    }

    sendError(exchange, 404, "接口不存在。");
  }

  private static void sendAuthSuccess(HttpExchange exchange, String phone) throws IOException {
    String token = UUID.randomUUID().toString().replace("-", "") + UUID.randomUUID().toString().replace("-", "");
    sessions.put(token, phone);
    sendJson(exchange, 200, "{\"ok\":true,\"phone\":\"" + phone + "\",\"token\":\"" + token + "\"}");
  }

  private static boolean isAuthorized(HttpExchange exchange, String phone) throws IOException {
    String authorization = exchange.getRequestHeaders().getFirst("Authorization");
    String token = authorization == null ? "" : authorization.replaceFirst("(?i)^Bearer\\s+", "").trim();
    if (!phone.equals(sessions.get(token))) {
      sendError(exchange, 401, "请先登录。");
      return false;
    }
    return true;
  }

  private static String authorizedPhone(HttpExchange exchange) throws IOException {
    String authorization = exchange.getRequestHeaders().getFirst("Authorization");
    String token = authorization == null ? "" : authorization.replaceFirst("(?i)^Bearer\\s+", "").trim();
    String phone = sessions.get(token);
    if (phone == null || phone.trim().isEmpty()) {
      sendError(exchange, 401, "请先登录。");
      return null;
    }
    return phone;
  }

  private static String requireObjectBody(HttpExchange exchange) throws IOException {
    String body = readBody(exchange).trim();
    if (!body.startsWith("{") || !body.endsWith("}")) {
      sendError(exchange, 400, "请求参数必须是 JSON 对象。");
      return null;
    }
    return body;
  }

  private static String validateCredentials(String phone, String password) {
    if (!isValidPhone(phone)) return "请输入有效的11位手机号。";
    if (password == null || password.length() < 6) return "密码至少需要6位。";
    return null;
  }

  private static boolean isValidPhone(String phone) {
    return phone != null && phone.matches("1\\d{10}");
  }

  private static String normalizePhone(String value) {
    return value == null ? "" : value.replaceAll("\\D", "");
  }

  private static void ensureAccountFile(String phone) throws IOException {
    File file = accountFile(phone);
    if (file.isFile()) return;
    String updatedAt = nowIso();
    String payload = "{\n"
      + "  \"phone\": \"" + phone + "\",\n"
      + "  \"updatedAt\": \"" + updatedAt + "\",\n"
      + "  \"state\": null\n"
      + "}\n";
    Files.write(file.toPath(), payload.getBytes(StandardCharsets.UTF_8));
  }

  private static File accountFile(String phone) {
    return new File(ACCOUNT_DIR, phone + ".json");
  }

  private static File resourceUserDir(String phone) {
    return new File(RESOURCE_DIR, phone);
  }

  private static File resourceFile(String phone, String name) throws IOException {
    File dir = resourceUserDir(phone);
    Files.createDirectories(dir.toPath());
    return new File(dir, name + ".json");
  }

  private static String readArrayResource(String phone, String name) throws IOException {
    File file = resourceFile(phone, name);
    if (!file.isFile()) return "[]";
    String value = new String(Files.readAllBytes(file.toPath()), StandardCharsets.UTF_8).trim();
    return value.startsWith("[") ? value : "[]";
  }

  private static void writeArrayResource(String phone, String name, String json) throws IOException {
    Files.write(resourceFile(phone, name).toPath(), json.getBytes(StandardCharsets.UTF_8));
  }

  private static String readObjectResource(String phone, String name, String fallback) throws IOException {
    File file = resourceFile(phone, name);
    if (!file.isFile()) return fallback;
    String value = new String(Files.readAllBytes(file.toPath()), StandardCharsets.UTF_8).trim();
    return value.startsWith("{") ? value : fallback;
  }

  private static void writeObjectResource(String phone, String name, String json) throws IOException {
    Files.write(resourceFile(phone, name).toPath(), json.getBytes(StandardCharsets.UTF_8));
  }

  private static String appendResourceItem(String phone, String name, String body) throws IOException {
    String id = "item_" + UUID.randomUUID().toString().replace("-", "");
    String item = withServerFields(body, id, true);
    List<String> items = splitArrayItems(readArrayResource(phone, name));
    items.add(item);
    writeArrayResource(phone, name, joinArrayItems(items));
    return item;
  }

  private static String replaceResourceItem(String phone, String name, String id, String body) throws IOException {
    List<String> items = splitArrayItems(readArrayResource(phone, name));
    for (int index = 0; index < items.size(); index++) {
      if (id.equals(readJsonString(items.get(index), "id"))) {
        String item = withServerFields(body, id, false);
        items.set(index, item);
        writeArrayResource(phone, name, joinArrayItems(items));
        return item;
      }
    }
    return null;
  }

  private static boolean deleteResourceItem(String phone, String name, String id) throws IOException {
    List<String> items = splitArrayItems(readArrayResource(phone, name));
    for (int index = 0; index < items.size(); index++) {
      if (id.equals(readJsonString(items.get(index), "id"))) {
        items.remove(index);
        writeArrayResource(phone, name, joinArrayItems(items));
        return true;
      }
    }
    return false;
  }

  private static List<String> splitArrayItems(String arrayJson) {
    List<String> items = new ArrayList<String>();
    if (arrayJson == null) return items;
    int index = skipWhitespace(arrayJson, 0);
    if (index >= arrayJson.length() || arrayJson.charAt(index) != '[') return items;
    index++;
    while (index < arrayJson.length()) {
      index = skipWhitespace(arrayJson, index);
      if (index >= arrayJson.length() || arrayJson.charAt(index) == ']') break;
      char first = arrayJson.charAt(index);
      String item = first == '{' || first == '[' ? readBalancedJson(arrayJson, index) : readJsonPrimitive(arrayJson, index);
      if (item == null || item.trim().isEmpty()) break;
      items.add(item.trim());
      index += item.length();
      index = skipWhitespace(arrayJson, index);
      if (index < arrayJson.length() && arrayJson.charAt(index) == ',') index++;
    }
    return items;
  }

  private static String readJsonPrimitive(String json, int start) {
    int end = start;
    while (end < json.length() && ",]".indexOf(json.charAt(end)) < 0) end++;
    return json.substring(start, end);
  }

  private static String joinArrayItems(List<String> items) {
    StringBuilder builder = new StringBuilder("[\n");
    for (int index = 0; index < items.size(); index++) {
      if (index > 0) builder.append(",\n");
      builder.append("  ").append(items.get(index));
    }
    if (!items.isEmpty()) builder.append('\n');
    builder.append(']');
    return builder.toString();
  }

  private static String withServerFields(String json, String id, boolean created) {
    String value = json == null ? "{}" : json.trim();
    if (!value.startsWith("{") || !value.endsWith("}")) value = "{}";
    StringBuilder fields = new StringBuilder();
    if (id != null && readJsonValue(value, "id") == null) {
      appendJsonField(fields, "id", id);
    }
    if (created && readJsonValue(value, "createdAt") == null) {
      appendJsonField(fields, "createdAt", nowIso());
    }
    appendJsonField(fields, "updatedAt", nowIso());
    if (fields.length() == 0) return value;
    String body = value.substring(1, value.length() - 1).trim();
    if (body.isEmpty()) return "{" + fields + "}";
    return "{" + body + "," + fields + "}";
  }

  private static void appendJsonField(StringBuilder builder, String key, String value) {
    if (builder.length() > 0) builder.append(',');
    builder.append("\"").append(escapeJson(key)).append("\":\"").append(escapeJson(value)).append("\"");
  }

  private static String defaultProfile(String phone) {
    return "{\"nickname\":\"学习小基地用户\",\"avatar\":\"\",\"grade\":\"\",\"school\":\"\",\"phone\":\"" + escapeJson(phone) + "\"}";
  }

  private static String defaultSettings() {
    return "{\"focusMinutes\":25,\"shortMinutes\":5,\"longMinutes\":15,\"notificationEnabled\":true}";
  }

  private static String defaultScholarship() {
    return "{\"balance\":0,\"rate\":10,\"records\":[]}";
  }

  private static String basicStats(String phone) throws IOException {
    return "{\"todosTotal\":" + splitArrayItems(readArrayResource(phone, "todos")).size()
      + ",\"reminders\":" + splitArrayItems(readArrayResource(phone, "reminders")).size()
      + ",\"studyPlans\":" + splitArrayItems(readArrayResource(phone, "study-plans")).size()
      + ",\"goals\":" + splitArrayItems(readArrayResource(phone, "goals")).size()
      + ",\"focusSessions\":" + splitArrayItems(readArrayResource(phone, "focus-sessions")).size()
      + "}";
  }

  private static String focusStats(String phone) throws IOException {
    int total = splitArrayItems(readArrayResource(phone, "focus-sessions")).size();
    return "{\"totalSessions\":" + total + ",\"completedSessions\":" + total + ",\"earnedStars\":" + total + "}";
  }

  private static String createdAt(String phone) {
    UserRecord user = users.get(phone);
    return user == null ? "" : user.createdAt;
  }

  private static void deleteDirectory(File file) throws IOException {
    if (file == null || !file.exists()) return;
    File[] children = file.listFiles();
    if (children != null) {
      for (File child : children) {
        deleteDirectory(child);
      }
    }
    Files.deleteIfExists(file.toPath());
  }

  private static String hashPassword(String password, String salt) throws Exception {
    byte[] saltBytes = Base64.getDecoder().decode(salt);
    KeySpec spec = new PBEKeySpec(password.toCharArray(), saltBytes, 12000, 256);
    SecretKeyFactory factory = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA1");
    return Base64.getEncoder().encodeToString(factory.generateSecret(spec).getEncoded());
  }

  private static String readJsonString(String json, String key) {
    String value = readJsonValue(json, key);
    if (value == null) return "";
    value = value.trim();
    if (value.length() >= 2 && value.charAt(0) == '"' && value.charAt(value.length() - 1) == '"') {
      return unescapeJson(value.substring(1, value.length() - 1));
    }
    return value;
  }

  private static String readJsonValue(String json, String key) {
    if (json == null) return null;
    String quotedKey = "\"" + key + "\"";
    int keyIndex = json.indexOf(quotedKey);
    if (keyIndex < 0) return null;
    int colon = json.indexOf(':', keyIndex + quotedKey.length());
    if (colon < 0) return null;
    int start = skipWhitespace(json, colon + 1);
    if (start >= json.length()) return null;

    char first = json.charAt(start);
    if (first == '"') return readQuotedJson(json, start);
    if (first == '{' || first == '[') return readBalancedJson(json, start);

    int end = start;
    while (end < json.length() && ",}\r\n\t ".indexOf(json.charAt(end)) < 0) end++;
    return json.substring(start, end);
  }

  private static String readQuotedJson(String json, int start) {
    boolean escaped = false;
    for (int index = start + 1; index < json.length(); index++) {
      char current = json.charAt(index);
      if (escaped) {
        escaped = false;
      } else if (current == '\\') {
        escaped = true;
      } else if (current == '"') {
        return json.substring(start, index + 1);
      }
    }
    return null;
  }

  private static String readBalancedJson(String json, int start) {
    char open = json.charAt(start);
    char close = open == '{' ? '}' : ']';
    int depth = 0;
    boolean inString = false;
    boolean escaped = false;
    for (int index = start; index < json.length(); index++) {
      char current = json.charAt(index);
      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (current == '\\') {
          escaped = true;
        } else if (current == '"') {
          inString = false;
        }
        continue;
      }
      if (current == '"') {
        inString = true;
      } else if (current == open) {
        depth++;
      } else if (current == close) {
        depth--;
        if (depth == 0) return json.substring(start, index + 1);
      }
    }
    return null;
  }

  private static int skipWhitespace(String value, int start) {
    int index = start;
    while (index < value.length() && Character.isWhitespace(value.charAt(index))) index++;
    return index;
  }

  private static String unescapeJson(String value) {
    return value.replace("\\\"", "\"").replace("\\\\", "\\");
  }

  private static String escapeJson(String value) {
    if (value == null) return "";
    return value.replace("\\", "\\\\").replace("\"", "\\\"").replace("\r", "\\r").replace("\n", "\\n");
  }

  private static String readBody(HttpExchange exchange) throws IOException {
    InputStream input = exchange.getRequestBody();
    ByteArrayOutputStream output = new ByteArrayOutputStream();
    byte[] buffer = new byte[4096];
    int length;
    while ((length = input.read(buffer)) >= 0) {
      output.write(buffer, 0, length);
    }
    return new String(output.toByteArray(), StandardCharsets.UTF_8);
  }

  private static void addCors(HttpExchange exchange) {
    Headers headers = exchange.getResponseHeaders();
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type,Authorization");
  }

  private static void sendError(HttpExchange exchange, int status, String message) throws IOException {
    sendJson(exchange, status, "{\"error\":{\"status\":" + status + ",\"message\":\"" + escapeJson(message) + "\"}}");
  }

  private static void sendJson(HttpExchange exchange, int status, String body) throws IOException {
    exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
    send(exchange, status, body);
  }

  private static void send(HttpExchange exchange, int status, String body) throws IOException {
    byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
    exchange.sendResponseHeaders(status, bytes.length);
    OutputStream output = exchange.getResponseBody();
    output.write(bytes);
    output.close();
  }

  private static String nowIso() {
    SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");
    format.setTimeZone(TimeZone.getTimeZone("UTC"));
    return format.format(new Date());
  }

  private static final class UserRecord {
    final String phone;
    final String salt;
    final String hash;
    final String createdAt;

    UserRecord(String phone, String salt, String hash, String createdAt) {
      this.phone = phone;
      this.salt = salt;
      this.hash = hash;
      this.createdAt = createdAt;
    }
  }
}
