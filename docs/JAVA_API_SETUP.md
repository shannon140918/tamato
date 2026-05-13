# 番茄钟待办提醒 Java 接口搭建文档

本文档记录本项目 Java 后端接口的搭建步骤、已新增接口、运行方式、数据保存位置，以及开发过程中遇到的问题和处理方式。

## 1. 当前项目结构

```text
E:\codex\番茄钟待办提醒
├─ index.html                         前端页面
├─ server.mjs                         本地前端/Node 服务，端口 8765
├─ docs
│  ├─ API.md                          接口文档
│  └─ JAVA_API_SETUP.md               Java 接口搭建文档
├─ java-auth-server
│  ├─ build.bat                       Java 编译脚本
│  ├─ run.bat                         Java 启动脚本
│  ├─ pom.xml                         Maven 配置，当前保留但不作为主要构建方式
│  └─ src\main\java\com\tomato\auth
│     └─ TomatoAuthServer.java        Java 接口服务源码
└─ data
   ├─ java-auth                       账号文件
   ├─ java-accounts                   兼容旧版整包 state 数据
   └─ java-resources                  新增业务接口数据
```

## 2. 服务地址

前端页面：

```text
http://127.0.0.1:8765/index.html
```

Java 接口服务：

```text
http://127.0.0.1:8787
```

## 3. 环境要求

本地需要 Java 环境。当前项目按 JDK 8 兼容方式编译：

```bat
java -version
javac -version
```

如果能看到 Java 版本号，说明 Java 基础环境可用。

## 4. Java 服务编译步骤

进入 Java 项目目录：

```bat
cd E:\codex\番茄钟待办提醒\java-auth-server
```

执行编译：

```bat
build.bat
```

成功后会生成：

```text
java-auth-server\target\tomato-auth-server-1.0.0.jar
```

## 5. Java 服务启动步骤

执行：

```bat
run.bat
```

启动成功后终端会显示：

```text
Tomato Java Auth Server: http://127.0.0.1:8787
```

保持这个窗口不要关闭，前端登录、注册和业务接口都需要访问这个服务。

## 6. 前端服务启动步骤

在项目根目录启动本地前端服务：

```bat
cd E:\codex\番茄钟待办提醒
node server.mjs
```

然后打开：

```text
http://127.0.0.1:8765/index.html
```

## 7. 鉴权方式

除注册、登录外，其他 Java 接口都需要登录后返回的 token：

```http
Authorization: Bearer <token>
```

注册或登录成功返回示例：

```json
{
  "ok": true,
  "phone": "13800138000",
  "token": "登录令牌"
}
```

## 8. 已新增接口

本次按照 `docs/API.md` 补齐了下面这些接口路由。

账号接口：

```http
POST /api/auth/register
POST /api/auth/login
GET /api/accounts/{phone}/state
PUT /api/accounts/{phone}/state
DELETE /api/accounts/{phone}
```

个人信息和首页：

```http
GET /api/me
PUT /api/me
GET /api/dashboard
GET /api/settings
PUT /api/settings
```

待办、提醒、目标、愿望、学习计划、错题：

```http
GET /api/todos
POST /api/todos
PUT /api/todos/{id}
DELETE /api/todos/{id}

GET /api/reminders
POST /api/reminders
PUT /api/reminders/{id}
DELETE /api/reminders/{id}

GET /api/goals
POST /api/goals
PUT /api/goals/{id}
DELETE /api/goals/{id}
POST /api/goals/{id}/complete

GET /api/wishes
POST /api/wishes
PUT /api/wishes/{id}
DELETE /api/wishes/{id}
POST /api/wishes/{id}/redeem

GET /api/study-plans
POST /api/study-plans
PUT /api/study-plans/{id}
DELETE /api/study-plans/{id}
POST /api/study-plans/{id}/to-todo

GET /api/mistakes
POST /api/mistakes
PUT /api/mistakes/{id}
DELETE /api/mistakes/{id}
POST /api/mistakes/{id}/image
POST /api/mistakes/{id}/analyze
```

番茄钟、奖学金、AI 配置：

```http
GET /api/focus-sessions
POST /api/focus-sessions
PUT /api/focus-sessions/{id}
DELETE /api/focus-sessions/{id}
GET /api/focus-sessions/stats

GET /api/scholarship
PUT /api/scholarship/settings
POST /api/scholarship/redeem
GET /api/scholarship/records

GET /api/ai-config
PUT /api/ai-config
POST /api/ai/mistake-analysis
```

## 9. 接口测试示例

注册：

```bat
curl -X POST http://127.0.0.1:8787/api/auth/register -H "Content-Type: application/json" -d "{\"phone\":\"13800138000\",\"password\":\"123456\"}"
```

登录：

```bat
curl -X POST http://127.0.0.1:8787/api/auth/login -H "Content-Type: application/json" -d "{\"phone\":\"13800138000\",\"password\":\"123456\"}"
```

新增待办，把 `<token>` 换成登录返回的 token：

```bat
curl -X POST http://127.0.0.1:8787/api/todos -H "Content-Type: application/json" -H "Authorization: Bearer <token>" -d "{\"text\":\"完成数学练习\",\"estimatedMinutes\":25}"
```

查询待办：

```bat
curl http://127.0.0.1:8787/api/todos -H "Authorization: Bearer <token>"
```

查询首页汇总：

```bat
curl http://127.0.0.1:8787/api/dashboard -H "Authorization: Bearer <token>"
```

## 10. 数据保存位置

账号密码保存位置：

```text
data\java-auth\users.tsv
```

账号完整 state 兼容数据：

```text
data\java-accounts\{手机号}.json
```

新增业务接口数据：

```text
data\java-resources\{手机号}\todos.json
data\java-resources\{手机号}\reminders.json
data\java-resources\{手机号}\goals.json
data\java-resources\{手机号}\wishes.json
data\java-resources\{手机号}\study-plans.json
data\java-resources\{手机号}\focus-sessions.json
data\java-resources\{手机号}\mistakes.json
data\java-resources\{手机号}\settings.json
data\java-resources\{手机号}\profile.json
```

## 11. 本次实现说明

当前 Java 后端没有引入第三方 JSON 库，也没有接入数据库。为了保证本地可以直接运行，新增业务接口采用“一个用户一个目录、一个资源一个 JSON 文件”的保存方式。

这种方式适合当前本地测试和接口联调，优点是启动简单、没有数据库依赖、数据文件容易查看。后续如果要正式上线，建议升级为 SQLite 或 MySQL，并把待办、目标、番茄钟记录等资源拆成独立表。

## 12. 遇到的问题和处理方式

### 问题 1：Maven 构建受限

之前尝试使用 Maven 时，本地依赖仓库写入受限，导致依赖下载和缓存失败。

处理方式：

保留 `pom.xml`，但当前主构建方式改为 `javac + jar`，也就是使用 `build.bat` 编译。这样不需要下载依赖，适合当前本地环境。

### 问题 2：JDK 8 编译 UTF-8 BOM 报错

Windows 写文件时可能在 Java 文件开头加上 UTF-8 BOM，JDK 8 的 `javac` 会报：

```text
非法字符: '\ufeff'
```

处理方式：

把 `TomatoAuthServer.java` 保存为无 BOM UTF-8，再执行 `build.bat`。

### 问题 3：前端打开 GitHub Pages 后不能直接访问本地 Java

GitHub Pages 只能托管静态页面，不能运行 Java 后端。页面如果部署到 GitHub Pages，仍然需要一个可访问的后端接口地址。

处理方式：

本地开发阶段使用：

```text
http://127.0.0.1:8787
```

正式部署阶段，需要把 Java 服务部署到服务器，再把前端接口地址改成公网后端地址。

### 问题 4：未登录访问业务接口返回 401

业务接口需要 `Authorization: Bearer <token>`。

处理方式：

先调用登录或注册接口，拿到 token 后再访问业务接口。

### 问题 5：端口被占用

如果 `8787` 被占用，Java 服务会启动失败。

处理方式：

关闭占用端口的旧 Java 服务，或者设置新端口：

```bat
set JAVA_AUTH_PORT=8788
run.bat
```

## 13. 后续建议

1. 前端可以逐步从 `PUT /api/accounts/{phone}/state` 改成调用独立业务接口。
2. 待办、目标、愿望、学习计划等接口后续建议增加分页、日期过滤和字段校验。
3. 图片类数据不建议长期用 base64 存在 JSON 文件里，建议改成文件上传并保存图片路径。
4. 正式部署前需要增加 HTTPS、跨域白名单、token 过期时间和数据库持久化。
