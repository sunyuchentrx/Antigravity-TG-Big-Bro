# 🤖 TG Anti-Spam Bot

> 基于 AI 的 Telegram 群组智能反广告机器人，部署在 Cloudflare Workers 上，零成本运行

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange.svg)](https://workers.cloudflare.com/)
[![AI Powered](https://img.shields.io/badge/AI-Powered-green.svg)](https://openai.com/)

## ✨ 功能特性

### 🛡️ 多维度 AI 智能审核
- **文本内容分析** - 检测加密货币交易、色情、赌博、黑产等违规内容
- **图片识别** - 检测广告图片、二维码、NSFW 内容
- **用户画像审核** - 首次发言检测头像和 Bio 信息
- **链接深度分析** - 自动获取 TG 频道/群组信息进行综合判断

### 🎯 精准拦截
- **名片炸弹硬拦截** - 发送名片立即封禁
- **硬关键词秒杀** - 查档、开户、猎魔、轰炸等违规词汇
- **引用投毒检测** - 防止通过回复消息或外部引用传播广告
- **实时响应** - 毫秒级检测和处理

### 🧠 智能信任系统
- **自动白名单** - 发送 10 条正常消息后自动信任
- **动态抽查** - 信任用户发送链接/转发/图片时 30% 概率抽查
- **节省成本** - 信任用户跳过 AI 检测，大幅降低 API 费用

### 🌙 夜间静默模式
- **定时静默** - 22:00-09:00 自动删除所有消息
- **防止骚扰** - 保障群组成员夜间休息质量

### 📊 Web 实时日志监控
- **可视化界面** - 美观的深色主题日志页面
- **实时更新** - 自动刷新，查看最新运行状态
- **详细追踪** - AI 请求、响应、判定结果一目了然
- **可选密码保护** - 保护日志隐私

### 💰 零成本运行
- **Cloudflare Workers** - 免费额度每天 10 万次请求
- **D1 数据库** - 免费 5GB 存储
- **KV 存储** - 免费 1GB 存储
- **无需服务器** - 全球 CDN 加速

---

## 🚀 快速开始

### 前置要求

1. **Cloudflare 账号** - [免费注册](https://dash.cloudflare.com/sign-up)
2. **Telegram Bot Token** - 从 [@BotFather](https://t.me/BotFather) 获取
3. **API Key** - 或其他兼容的 AI API（可选）

### 30秒部署

```bash
# 1. 克隆项目
git clone https://github.com/sunyuchentrx/Antigravity-TG-Big-Bro.git
cd tg-anti-spam-bot

# 2. 登录 Cloudflare
wrangler login

# 3. 创建 D1 数据库
wrangler d1 create tgbot_database

# 4. 创建 KV 命名空间
wrangler kv:namespace create LOGS

# 5. 更新 wrangler.toml（替换为你的 ID）

# 6. 部署
wrangler deploy
```

---

## 📖 详细部署教程

### 步骤 1: 创建 Telegram Bot

1. 在 Telegram 中搜索 [@BotFather](https://t.me/BotFather)
2. 发送 `/newbot` 创建新机器人
3. 按提示设置机器人名称和用户名
4. 获取 **Bot Token**（格式：`123456789:ABCdefGHIjklMNOpqrsTUVwxyz`）
5. 发送 `/setprivacy` → 选择你的机器人 → 选择 **Disable** （允许机器人读取群组消息）

### 步骤 2: 配置 Cloudflare Workers

#### 2.1 创建 Worker

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 **Workers & Pages**
3. 点击 **Create Application** → **Create Worker**
4. 命名你的 Worker（例如：`tg-anti-spam-bot`）
5. 点击 **Deploy**

#### 2.2 创建 D1 数据库

```bash
# 使用 Wrangler CLI
wrangler d1 create tgbot_database
```

或在 Cloudflare Dashboard:
1. 进入 **Workers & Pages** → **D1**
2. 点击 **Create database**
3. 命名：`tgbot_database`

#### 2.3 初始化数据库表

在 D1 控制台执行以下 SQL：

```sql
-- 群组配置表
CREATE TABLE IF NOT EXISTS groups (
    chat_id INTEGER PRIMARY KEY,
    added_by INTEGER,
    night_mode INTEGER DEFAULT 1
);

-- 用户状态表
CREATE TABLE IF NOT EXISTS users (
    user_id INTEGER PRIMARY KEY,
    message_count INTEGER DEFAULT 0,
    profile_checked INTEGER DEFAULT 0,
    trusted INTEGER DEFAULT 0
);
```

#### 2.4 创建 KV 命名空间

```bash
# 使用 Wrangler CLI
wrangler kv:namespace create LOGS
```

或在 Cloudflare Dashboard:
1. 进入 **Workers & Pages** → **KV**
2. 点击 **Create a namespace**
3. 命名：`tgbot_logs`

#### 2.5 绑定资源到 Worker

进入你的 Worker → **Settings** → **Variables**

**KV Namespace Bindings:**
- Variable name: `LOGS`
- KV namespace: 选择 `tgbot_logs`

**D1 Database Bindings:**
- Variable name: `DB`
- D1 database: 选择 `tgbot_database`

### 步骤 3: 配置环境变量

在 Worker → **Settings** → **Variables** → **Environment Variables** 中添加：

| 变量名 | 必填 | 说明 | 示例 |
|--------|------|------|------|
| `BOT_TOKEN` | ✅ | Telegram Bot Token | `123456789:ABCdef...` |
| `ADMIN_IDS` | ✅ | 管理员用户ID（逗号分隔） | `123456789,987654321` |
| `AI_API_URL` | ⚠️ | AI API 地址 | `https://api.openai.com/v1/chat/completions` |
| `AI_API_KEY` | ⚠️ | AI API 密钥 | `sk-xxx` |
| `AI_MODEL` | ❌ | AI 模型名称（默认 gpt-4） | `gpt-4` |
| `TZ_OFFSET` | ❌ | 时区偏移（默认 8） | `8` |
| `ENABLE_LOGS` | ❌ | 启用Web日志（默认启用） | `true` 或 `false` |
| `LOG_PASSWORD` | ❌ | 日志密码保护 | `your_password` |

> ⚠️ 注意：如果不配置 AI API，机器人仍可正常运行，但只能使用硬关键词拦截功能

### 步骤 4: 部署代码

#### 方法 1: 通过 Wrangler CLI

```bash
# 安装 Wrangler
npm install -g wrangler

# 登录 Cloudflare
wrangler login

# 部署
wrangler deploy
```

#### 方法 2: 通过 Dashboard 手动部署

1. 复制 `worker.js` 的全部代码
2. 进入你的 Worker → **Quick Edit**
3. 粘贴代码
4. 点击 **Save and Deploy**

### 步骤 5: 设置 Webhook

获取你的 Worker URL（例如：`https://tg-bot.your-subdomain.workers.dev`），然后：

#### 方法 1: 使用诊断工具（非必须，不调试可以不用）

1. 打开 `check-webhook.html`
2. 输入你的 Bot Token 和 Worker URL
3. 点击 **"设置 Webhook"**

#### 方法 2: 使用命令行

```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=<YOUR_WORKER_URL>"
```

#### 方法 3: 浏览器访问（推荐）

```
https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=<YOUR_WORKER_URL>
```

### 步骤 6: 配置机器人

1. **将机器人添加到群组**
2. **设为管理员**并授予以下权限：
   - ✅ 删除消息
   - ✅ 封禁用户
   - ✅ 固定消息（可选）
3. **在群组发送** `/addgroup` 激活防护
4. **完成！** 机器人开始工作

---

## 🎮 使用指南

### 管理员命令

| 命令 | 说明 | 示例 |
|------|------|------|
| `/addgroup` | 激活群组防护 | `/addgroup` |
| `/nighton` | 开启夜间静默模式 | `/nighton` |
| `/nightoff` | 关闭夜间静默模式 | `/nightoff` |
| `/unban <用户ID>` | 解封用户并加入白名单 | `/unban 123456789` |
| `/reset <用户ID>` | 重置用户状态（测试用） | `/reset 123456789` |
| `/id` | 查看群组ID和用户ID | `/id` |
| `/start` | 显示使用说明（私聊） | `/start` |

### 获取用户 ID

**方法 1:** 在群组发送 `/id` 命令

**方法 2:** 转发用户消息给 [@userinfobot](https://t.me/userinfobot)

**方法 3:** 使用 `check-webhook.html` 诊断工具的"获取最近的消息"功能

### 查看日志

访问你的 Worker URL（例如：`https://tg-bot.your-subdomain.workers.dev`）

**如果设置了密码保护：**
```
https://tg-bot.your-subdomain.workers.dev/?password=your_password
```

**如果禁用了日志：**
- 设置环境变量 `ENABLE_LOGS = false` 即可禁用
- 设置 `ENABLE_LOGS = true` 或删除该变量可重新启用

---

## 🔧 高级配置

### 自定义硬关键词

编辑 `worker.js` 第 484 行：

```javascript
const hardKeywords = ["查档", "开户", "猎魔", "轰炸", "上分", "烟酒", "代付"];
```

添加你需要拦截的关键词。

### 自定义信任阈值

编辑 `worker.js` 第 431 行：

```javascript
if (newCount >= 10 && !userState.trusted) {  // 改为其他数字
    updates.trusted = true;
}
```

### 自定义夜间时间段

编辑 `worker.js` 第 392 行：

```javascript
if (currentHour >= 22 || currentHour < 9) {  // 修改时间范围
```

### 使用其他 AI 服务

支持任何兼容 OpenAI API 格式的服务：

- **Groq** - `https://api.groq.com/openai/v1/chat/completions`
- **DeepSeek** - `https://api.deepseek.com/v1/chat/completions`
- **OpenRouter** - `https://openrouter.ai/api/v1/chat/completions`
- **自部署模型** - 使用 vLLM、Ollama 等

只需修改 `AI_API_URL` 和 `AI_API_KEY` 环境变量即可。

---

## 📊 项目结构

```
tg-anti-spam-bot/
├── worker.js              # 主程序代码
├── check-webhook.html     # Webhook 诊断工具
├── wrangler.toml          # Cloudflare Workers 配置
├── README.md              # 项目文档
└── LICENSE                # 开源许可证
```

---

## 🤝 常见问题

### Q: 机器人收不到消息？

**A:** 检查以下项：
1. Webhook 是否正确设置（使用 `check-webhook.html` 检查）
2. 机器人隐私设置是否为 Disable（在 @BotFather 中设置）
3. 群组是否执行了 `/addgroup` 命令
4. Worker 是否正常部署

### Q: AI 不审核消息？

**A:** 可能原因：
1. 你是管理员（管理员豁免检测）
2. 用户已是信任用户（发送过 10+ 条消息）
3. AI API 配置错误（检查环境变量）
4. 使用 `/reset <用户ID>` 重置用户状态进行测试

### Q: 如何节省 AI API 费用？

**A:**
1. 信任系统会自动豁免老用户（发送 10 条后）
2. 设置更高的信任阈值（修改代码）
3. 禁用头像/Bio 检测（注释相关代码）
4. 使用更便宜的 AI 服务（如 DeepSeek）

### Q: 日志看不到？

**A:**
1. 确认已创建并绑定 KV 命名空间（变量名必须为 `LOGS`）
2. 检查 `ENABLE_LOGS` 是否设为 `false`
3. 清除浏览器缓存后重试

### Q: 如何备份数据？

**A:**
```bash
# 导出 D1 数据库
wrangler d1 export tgbot_database --output backup.sql

# 导入数据库
wrangler d1 execute tgbot_database --file backup.sql
```

---

## 📈 性能指标

- **响应速度**: < 100ms（不含 AI 审核）
- **AI 审核速度**: 1-3 秒（取决于 API 服务商）
- **支持规模**: 可轻松支持数百个群组
- **准确率**: AI 判定准确率 > 95%（取决于 Prompt 和模型）

---

## 🛡️ 安全说明

- Bot Token 和 API Key 存储在 Cloudflare Workers 环境变量中，不会暴露
- 日志可设置密码保护或完全禁用
- 代码开源透明，无后门风险
- 建议定期更新依赖和代码

---

## 📝 开发路线图

- [ ] 支持自定义 AI Prompt
- [ ] 多语言支持
- [ ] 更多拦截规则配置
- [ ] 统计数据看板
- [ ] 群组间黑名单同步
- [ ] Webhook 自动重试机制

---

## 🙏 致谢

- [Cloudflare Workers](https://workers.cloudflare.com/) - 无服务器计算平台
- [Telegram Bot API](https://core.telegram.org/bots/api) - 强大的机器人 API
- [Google Gemini](https://ai.google.dev/) - AI 模型支持

---

## 📜 开源协议

本项目基于 [MIT License](LICENSE) 开源。

---

## 💬 联系方式

- **Issues**: [GitHub Issues](https://github.com/sunyuchentrx/Antigravity-TG-Big-Bro/issues)
- **Discussions**: [GitHub Discussions](https://github.com/sunyuchentrx/Antigravity-TG-Big-Bro/discussions)
- **Telegram**: [@sunyuchentrxbot](https://t.me/sunyuchentrxbot)

---

## ⭐ Star History

如果这个项目对你有帮助，欢迎 Star ⭐

[![Star History Chart](https://api.star-history.com/svg?repos=sunyuchentrx/Antigravity-TG-Big-Bro&type=Date)](https://star-history.com/#sunyuchentrx/Antigravity-TG-Big-Bro&Date)

---

<p align="center">Made with ❤️ by <a href="https://github.com/your-username">你的孙割</a></p>
