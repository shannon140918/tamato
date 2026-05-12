# Tomato Java Auth Server

本项目提供番茄钟待办提醒的 Java 本地接口，兼容 Java 8。

## 启动

```powershell
cd E:\codex\番茄钟待办提醒\java-auth-server
.\build.bat
java -jar target\tomato-auth-server-1.0.0.jar
```

也可以直接运行：

```powershell
.\run.bat
```

默认地址：

```text
http://127.0.0.1:8787
```

可用环境变量修改端口：

```powershell
$env:JAVA_AUTH_PORT=8788
java -jar target\tomato-auth-server-1.0.0.jar
```

## 接口

### 注册

```http
POST /api/auth/register
Content-Type: application/json

{"phone":"13800138000","password":"123456"}
```

### 登录

```http
POST /api/auth/login
Content-Type: application/json

{"phone":"13800138000","password":"123456"}
```

注册和登录成功都会返回：

```json
{"ok":true,"phone":"13800138000","token":"..."}
```

### 保存账号数据

```http
PUT /api/accounts/13800138000/state
Authorization: Bearer 返回的token
Content-Type: application/json

{"state":{"todos":[]}}
```

### 读取账号数据

```http
GET /api/accounts/13800138000/state
Authorization: Bearer 返回的token
```

### 删除账号和账号数据

```http
DELETE /api/accounts/13800138000
Authorization: Bearer 返回的token
```

数据文件保存在：

```text
E:\codex\番茄钟待办提醒\data\java-auth
E:\codex\番茄钟待办提醒\data\java-accounts
```
