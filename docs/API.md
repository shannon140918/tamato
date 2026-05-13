# 番茄钟待办提醒接口文档

## 1. 当前接口概览

### 服务地址

本地 Java 接口服务：

```text
http://127.0.0.1:8787
```

本地前端/Node 服务：

```text
http://127.0.0.1:8765
```

### 鉴权方式

除注册、登录外，Java 账号接口都建议携带：

```http
Authorization: Bearer <token>
```

`token` 来自登录或注册成功后的返回值。

### 通用成功返回

```json
{
  "ok": true
}
```

### 通用错误返回

```json
{
  "error": {
    "status": 401,
    "message": "手机号或密码不正确。"
  }
}
```

## 2. 已实现接口

### 2.1 注册

```http
POST /api/auth/register
Content-Type: application/json
```

请求参数：

```json
{
  "phone": "13800138000",
  "password": "123456"
}
```

成功返回：

```json
{
  "ok": true,
  "phone": "13800138000",
  "token": "登录令牌"
}
```

常见错误：

| 状态码 | 场景 | message |
|---|---|---|
| 400 | 手机号格式错误 | 请输入有效的11位手机号。 |
| 400 | 密码不足 6 位 | 密码至少需要6位。 |
| 409 | 手机号已注册 | 手机号已注册。 |

### 2.2 登录

```http
POST /api/auth/login
Content-Type: application/json
```

请求参数：

```json
{
  "phone": "13800138000",
  "password": "123456"
}
```

成功返回：

```json
{
  "ok": true,
  "phone": "13800138000",
  "token": "登录令牌"
}
```

常见错误：

| 状态码 | 场景 | message |
|---|---|---|
| 400 | 手机号格式错误 | 请输入有效的11位手机号。 |
| 400 | 密码不足 6 位 | 密码至少需要6位。 |
| 401 | 手机号或密码错误 | 手机号或密码不正确。 |

### 2.3 读取账号完整状态

当前页面所有业务数据仍打包保存在一个 `state` 对象里。

```http
GET /api/accounts/{phone}/state
Authorization: Bearer <token>
```

成功返回：

```json
{
  "phone": "13800138000",
  "updatedAt": "2026-05-13T01:20:00.000Z",
  "state": {
    "date": "2026-05-13",
    "todos": [],
    "reminders": [],
    "studyPlans": [],
    "goals": [],
    "rewards": [],
    "wishes": [],
    "scholarship": {
      "balance": 0,
      "rate": 10,
      "records": []
    },
    "focusStars": 0,
    "settings": {
      "focusMinutes": 25,
      "shortMinutes": 5,
      "longMinutes": 15
    }
  }
}
```

### 2.4 保存账号完整状态

```http
PUT /api/accounts/{phone}/state
Authorization: Bearer <token>
Content-Type: application/json
```

请求参数：

```json
{
  "state": {
    "todos": [],
    "reminders": [],
    "studyPlans": [],
    "goals": [],
    "wishes": []
  }
}
```

成功返回：

```json
{
  "ok": true,
  "updatedAt": "2026-05-13T01:20:00.000Z"
}
```

### 2.5 注销账号

```http
DELETE /api/accounts/{phone}
Authorization: Bearer <token>
```

成功返回：

```json
{
  "ok": true
}
```

### 2.6 Node 本地状态接口

旧接口，主要用于未登录或早期本地服务。

```http
GET /api/state
PUT /api/state
```

### 2.7 AI 错题识别代理接口

Node 本地代理，用于避免前端直接请求阿里云百炼接口时遇到跨域问题。

```http
POST /api/dashscope/chat/completions
Authorization: Bearer <DashScope API Key>
X-DashScope-Base-Url: https://dashscope.aliyuncs.com/compatible-mode/v1
Content-Type: application/json
```

## 3. 页面仍建议新增的业务接口

当前页面功能很多，但后端只有一个“保存整包 state”的接口。短期可用，但长期不利于排查、同步、多人设备使用和数据统计。建议逐步拆成下面这些接口。

## 4. 建议新增接口清单

### 4.1 个人信息接口

#### 获取个人信息

```http
GET /api/me
Authorization: Bearer <token>
```

返回：

```json
{
  "phone": "13800138000",
  "createdAt": "2026-05-13T01:20:00.000Z",
  "profile": {
    "nickname": "学习小基地用户",
    "avatar": "",
    "grade": "",
    "school": ""
  },
  "stats": {
    "todayTodoDone": 2,
    "todayTodoTotal": 5,
    "focusStars": 12,
    "scholarshipBalance": 3.5
  }
}
```

#### 更新个人信息

```http
PUT /api/me
Authorization: Bearer <token>
Content-Type: application/json
```

请求：

```json
{
  "nickname": "小番茄",
  "avatar": "base64或图片URL",
  "grade": "五年级",
  "school": "XX小学"
}
```

### 4.2 待办任务接口

#### 获取今日待办

```http
GET /api/todos?date=2026-05-13
Authorization: Bearer <token>
```

#### 新增待办

```http
POST /api/todos
Authorization: Bearer <token>
Content-Type: application/json
```

请求：

```json
{
  "text": "完成数学练习",
  "estimatedMinutes": 25,
  "planId": ""
}
```

#### 更新待办

```http
PUT /api/todos/{todoId}
Authorization: Bearer <token>
Content-Type: application/json
```

请求：

```json
{
  "text": "完成数学练习",
  "estimatedMinutes": 30,
  "done": false,
  "completedSegments": 1
}
```

#### 删除待办

```http
DELETE /api/todos/{todoId}
Authorization: Bearer <token>
```

### 4.3 番茄钟记录接口

#### 完成一个番茄钟

```http
POST /api/focus-sessions
Authorization: Bearer <token>
Content-Type: application/json
```

请求：

```json
{
  "todoId": "todo_001",
  "mode": "focus",
  "minutes": 25,
  "completed": true,
  "startedAt": "2026-05-13T01:00:00.000Z",
  "endedAt": "2026-05-13T01:25:00.000Z"
}
```

返回：

```json
{
  "ok": true,
  "earnedStars": 1,
  "focusStars": 13
}
```

#### 获取专注统计

```http
GET /api/focus-sessions/stats?from=2026-05-01&to=2026-05-13
Authorization: Bearer <token>
```

### 4.4 定时提醒接口

```http
GET /api/reminders
POST /api/reminders
PUT /api/reminders/{reminderId}
DELETE /api/reminders/{reminderId}
Authorization: Bearer <token>
```

新增请求：

```json
{
  "text": "喝水休息",
  "time": "15:30"
}
```

### 4.5 学习目标接口

```http
GET /api/goals?type=daily&periodKey=2026-05-13
POST /api/goals
PUT /api/goals/{goalId}
DELETE /api/goals/{goalId}
POST /api/goals/{goalId}/complete
Authorization: Bearer <token>
```

新增目标请求：

```json
{
  "type": "daily",
  "title": "完成英语听力",
  "periodKey": "2026-05-13",
  "reward": 1
}
```

完成目标返回：

```json
{
  "ok": true,
  "reward": 1,
  "focusStars": 14
}
```

### 4.6 愿望和星星兑换接口

```http
GET /api/wishes
POST /api/wishes
PUT /api/wishes/{wishId}
DELETE /api/wishes/{wishId}
POST /api/wishes/{wishId}/redeem
Authorization: Bearer <token>
```

新增愿望请求：

```json
{
  "title": "周末看电影",
  "cost": 10
}
```

兑换返回：

```json
{
  "ok": true,
  "focusStars": 4,
  "rewardRecord": {
    "label": "实现愿望：周末看电影",
    "stars": 10
  }
}
```

### 4.7 奖学金接口

```http
GET /api/scholarship
PUT /api/scholarship/settings
POST /api/scholarship/redeem
GET /api/scholarship/records
Authorization: Bearer <token>
```

兑换请求：

```json
{
  "stars": 20,
  "rate": 10
}
```

返回：

```json
{
  "ok": true,
  "amount": 2.0,
  "balance": 5.5,
  "focusStars": 8
}
```

### 4.8 日历学习计划接口

```http
GET /api/study-plans?date=2026-05-13
GET /api/study-plans?from=2026-05-01&to=2026-05-31
POST /api/study-plans
PUT /api/study-plans/{planId}
DELETE /api/study-plans/{planId}
POST /api/study-plans/{planId}/to-todo
Authorization: Bearer <token>
```

新增计划请求：

```json
{
  "date": "2026-05-13",
  "title": "英语听力",
  "minutes": 30,
  "note": "第3单元"
}
```

### 4.9 错题与图片接口

当前错题图片以 base64 保存在前端状态里，数据会膨胀。建议拆出图片上传接口。

```http
POST /api/mistakes
GET /api/mistakes?todoId={todoId}
PUT /api/mistakes/{mistakeId}
DELETE /api/mistakes/{mistakeId}
POST /api/mistakes/{mistakeId}/image
POST /api/mistakes/{mistakeId}/analyze
Authorization: Bearer <token>
```

上传图片请求：

```http
POST /api/mistakes/{mistakeId}/image
Content-Type: multipart/form-data
```

AI 分析请求：

```json
{
  "action": "organize",
  "model": "qwen3-vl-plus"
}
```

AI 分析返回：

```json
{
  "recognizedText": "题目原文",
  "summary": "错因分析和正确思路",
  "similarQuestions": [
    "同类型练习题1",
    "同类型练习题2"
  ]
}
```

### 4.10 AI 配置接口

当前 API Key 保存在浏览器本地。正式环境建议后端保存或代理。

```http
GET /api/ai-config
PUT /api/ai-config
POST /api/ai/mistake-analysis
Authorization: Bearer <token>
```

注意：正式环境不要把第三方 API Key 直接暴露给前端。

### 4.11 设置接口

```http
GET /api/settings
PUT /api/settings
Authorization: Bearer <token>
```

请求：

```json
{
  "focusMinutes": 25,
  "shortMinutes": 5,
  "longMinutes": 15,
  "notificationEnabled": true
}
```

### 4.12 首页汇总接口

减少首页多次请求，可提供聚合接口。

```http
GET /api/dashboard?date=2026-05-13
Authorization: Bearer <token>
```

返回：

```json
{
  "profile": {
    "phone": "13800138000",
    "nickname": "小番茄"
  },
  "today": {
    "todosDone": 2,
    "todosTotal": 5,
    "completedPomodoros": 3,
    "focusStars": 12,
    "reminders": 2,
    "studyPlans": 4
  },
  "goals": [],
  "affordableWish": null
}
```

## 5. 建议开发优先级

### 第一阶段：账号和首页稳定

1. `GET /api/me`
2. `PUT /api/me`
3. `GET /api/dashboard`
4. `GET /api/settings`
5. `PUT /api/settings`

### 第二阶段：核心学习数据

1. 待办任务接口
2. 番茄钟完成记录接口
3. 学习目标接口
4. 日历学习计划接口

### 第三阶段：奖励体系

1. 愿望接口
2. 奖学金接口
3. 奖励记录接口

### 第四阶段：错题和 AI

1. 错题接口
2. 图片上传接口
3. AI 分析代理接口
4. AI 配置接口

## 6. 当前前端需要调整的方向

当前前端的保存方式：

```text
任意页面操作 -> 修改 state -> PUT /api/accounts/{phone}/state
```

建议逐步改为：

```text
待办操作 -> /api/todos
目标操作 -> /api/goals
愿望操作 -> /api/wishes
学习计划操作 -> /api/study-plans
番茄钟完成 -> /api/focus-sessions
```

保留 `PUT /api/accounts/{phone}/state` 作为兼容接口或备份导入导出接口。

## 7. 数据落盘建议

当前 Java 服务使用文件存储：

```text
data/java-auth/users.tsv
data/java-accounts/{phone}.json
```

如果继续扩大接口，建议后续升级为 SQLite：

```text
users
profiles
todos
reminders
goals
focus_sessions
wishes
scholarship_records
study_plans
mistakes
settings
```

这样后续统计、查询、分页和同步会更稳定。
