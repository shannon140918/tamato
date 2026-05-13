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
import java.util.Base64;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.TimeZone;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

public final class TomatoAuthServer {
  private static final int DEFAULT_PORT = 8787;
  private static final SecureRandom RANDOM = new SecureRandom();
  private static final File ROOT = new File(System.getProperty("user.dir")).getParentFile();
  private static final File DATA_DIR = new File(ROOT, "data");
  private static final File AUTH_DIR = new File(DATA_DIR, "java-auth");
  private static final File ACCOUNT_DIR = new File(DATA_DIR, "java-accounts");
  private static final File USERS_FILE = new File(AUTH_DIR, "users.tsv");
  private static final Map<String, UserRecord> users = new ConcurrentHashMap<String, UserRecord>();
  private static final Map<String, String> sessions = new ConcurrentHashMap<String, String>();

  private TomatoAuthServer() {
  }

  public static void main(String[] args) throws Exception {
    ensureDirs();
    loadUsers();

    int port = getPort();
    HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", port), 0);
    server.createContext("/api/", new ApiHandler());
    server.setExecutor(null);
    server.start();
    System.out.println("Tomato Java Auth Server: http://127.0.0.1:" + port);
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
    sendJson(exchange, 200, "{\"ok\":true}");
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
