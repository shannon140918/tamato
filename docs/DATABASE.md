# 数据库存储说明

当前项目已统一使用本地 SQLite 数据库保存主要数据。

## 数据库文件

```text
data/daily-focus.sqlite
```

## 主要数据表

### users

保存注册账号。

字段：

```text
phone          手机号，主键
salt           密码盐值
password_hash  密码哈希
hash_type      哈希方式
created_at     注册时间
```

密码不是明文保存。

### account_state

保存登录账号的学习数据。

字段：

```text
phone       手机号，主键
state_json  学习数据 JSON
updated_at  更新时间
```

这里保存的内容包括：

```text
今日待办
提醒
学习计划
目标
奖励记录
愿望
奖学金
番茄钟设置
错题整理数据
```

### app_state

保存未登录或旧版通用状态。

字段：

```text
id
state_json
updated_at
```

## 已迁移的数据

服务启动时会自动把旧文件数据导入 SQLite：

```text
data/java-auth/users.tsv              -> users
data/java-accounts/{手机号}.json       -> account_state
data/app-state.json                   -> app_state
```

旧 JSON/TSV 文件会保留作为历史备份，但页面后续读写不再依赖这些文件。

## 当前接口

前端现在访问同源 Node 服务：

```text
POST   /api/auth/register
POST   /api/auth/login
GET    /api/accounts/{phone}/state
PUT    /api/accounts/{phone}/state
DELETE /api/accounts/{phone}
GET    /api/health
```

登录后，页面保存状态时会写入 `account_state` 表。

## 验证方式

查看数据库健康状态：

```text
http://127.0.0.1:8765/api/health
```

返回示例：

```json
{
  "ok": true,
  "database": "daily-focus.sqlite",
  "users": 5,
  "accountStates": 5
}
```
