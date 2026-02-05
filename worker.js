/**
 * TG群组反广告机器人 (KV日志版)
 * 功能:
 * 1. 名片/引用投毒/外部频道引用硬拦截
 * 2. 夜间静默模式
 * 3. 信任系统(10条消息自动信任，信任用户30%抽查)
 * 4. AI多维度审核(头像/Bio/文本/图片/链接)
 * 5. 管理员指令(/addgroup, /nighton, /nightoff, /unban, /id)
 * 6. 使用KV存储的Web实时日志查看
 */

const MAX_LOGS = 500;
const LOG_KEY = "bot_logs";

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        // GET请求 - 显示日志页面
        if (request.method === "GET") {
            // 检查日志是否启用
            const logsEnabled = env.ENABLE_LOGS !== "false";

            // 密码保护（可选）
            const logPassword = env.LOG_PASSWORD || "";
            const urlPassword = url.searchParams.get("password") || "";

            // 如果设置了密码且密码不匹配
            if (logPassword && urlPassword !== logPassword) {
                return new Response(renderLockedPage(), {
                    headers: { "Content-Type": "text/html; charset=utf-8" }
                });
            }

            // 如果日志未启用
            if (!logsEnabled) {
                return new Response(renderDisabledPage(), {
                    headers: { "Content-Type": "text/html; charset=utf-8" }
                });
            }

            // 清除日志
            if (url.pathname === "/clear") {
                await env.LOGS.delete(LOG_KEY);
                return new Response("Logs cleared", { status: 200 });
            }

            // 返回日志页面
            const logs = await getLogs(env);
            return new Response(renderLogPage(logs), {
                headers: { "Content-Type": "text/html; charset=utf-8" }
            });
        }

        // POST请求 - 处理Telegram webhook
        if (request.method === "POST") {
            try {
                const update = await request.json();
                await log(env, "INFO", `📨 Received update: ${JSON.stringify(update).substring(0, 300)}...`);
                ctx.waitUntil(handleUpdate(update, env, ctx));
                return new Response("OK", { status: 200 });
            } catch (e) {
                await log(env, "ERROR", `❌ Failed to parse update: ${e.message}`);
                return new Response("ERROR", { status: 500 });
            }
        }

        return new Response("Method Not Allowed", { status: 405 });
    },
};

// ==================== 日志系统 (KV存储) ====================

async function getLogs(env) {
    if (!env.LOGS) return [];
    try {
        const logsJson = await env.LOGS.get(LOG_KEY);
        return logsJson ? JSON.parse(logsJson) : [];
    } catch (e) {
        console.error("Failed to get logs:", e);
        return [];
    }
}

async function log(env, level, message) {
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const logEntry = { time: timestamp, level: level, message: message };

    console.log(`[${timestamp}] [${level}] ${message}`);

    // 检查日志是否启用
    const logsEnabled = env.ENABLE_LOGS !== "false";
    if (!logsEnabled) return;

    // 存储到KV
    if (!env.LOGS) return;

    try {
        const logs = await getLogs(env);
        logs.push(logEntry);

        // 保持最大日志数量
        if (logs.length > MAX_LOGS) {
            logs.splice(0, logs.length - MAX_LOGS);
        }

        await env.LOGS.put(LOG_KEY, JSON.stringify(logs));
    } catch (e) {
        console.error("Failed to save log:", e);
    }
}

function renderLogPage(logs) {
    const reversedLogs = [...logs].reverse(); // 最新的在前面

    const logHtml = reversedLogs.map(log => {
        let color = '#333';
        if (log.level === 'ERROR') color = '#d32f2f';
        else if (log.level === 'WARN') color = '#f57c00';
        else if (log.level === 'SUCCESS') color = '#388e3c';
        else if (log.level === 'AI') color = '#1976d2';

        return `<div class="log-entry ${log.level.toLowerCase()}">
            <span class="time">${log.time}</span>
            <span class="level" style="color: ${color}">[${log.level}]</span>
            <span class="message">${escapeHtml(log.message)}</span>
        </div>`;
    }).join('');

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TG Bot 实时日志</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
            background: #1e1e1e;
            color: #d4d4d4;
            padding: 20px;
        }
        .header {
            background: #252526;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        }
        .header h1 {
            color: #4fc3f7;
            font-size: 24px;
            margin-bottom: 10px;
        }
        .stats {
            display: flex;
            gap: 20px;
            margin-top: 15px;
            flex-wrap: wrap;
        }
        .stat-item {
            background: #2d2d30;
            padding: 10px 15px;
            border-radius: 5px;
            border-left: 3px solid #4fc3f7;
        }
        .stat-label {
            color: #858585;
            font-size: 12px;
        }
        .stat-value {
            color: #fff;
            font-size: 18px;
            font-weight: bold;
        }
        .controls {
            margin-bottom: 15px;
            display: flex;
            gap: 10px;
        }
        .btn {
            background: #0e639c;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
            transition: background 0.3s;
        }
        .btn:hover {
            background: #1177bb;
        }
        .btn.danger {
            background: #d32f2f;
        }
        .btn.danger:hover {
            background: #f44336;
        }
        .log-container {
            background: #252526;
            border-radius: 8px;
            padding: 20px;
            max-height: calc(100vh - 300px);
            overflow-y: auto;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        }
        .log-entry {
            padding: 8px 0;
            border-bottom: 1px solid #3e3e42;
            font-size: 13px;
            line-height: 1.6;
        }
        .log-entry:last-child {
            border-bottom: none;
        }
        .time {
            color: #858585;
            margin-right: 10px;
        }
        .level {
            font-weight: bold;
            margin-right: 10px;
            min-width: 70px;
            display: inline-block;
        }
        .message {
            color: #d4d4d4;
        }
        .log-entry.error {
            background: rgba(211, 47, 47, 0.1);
        }
        .log-entry.success {
            background: rgba(56, 142, 60, 0.1);
        }
        .log-entry.ai {
            background: rgba(25, 118, 210, 0.1);
        }
        .empty {
            text-align: center;
            color: #858585;
            padding: 40px;
        }
        .kv-notice {
            background: #2d2d30;
            padding: 10px 15px;
            border-radius: 5px;
            margin-bottom: 15px;
            border-left: 3px solid #f59e0b;
            color: #f59e0b;
            font-size: 13px;
        }
        ::-webkit-scrollbar {
            width: 10px;
        }
        ::-webkit-scrollbar-track {
            background: #1e1e1e;
        }
        ::-webkit-scrollbar-thumb {
            background: #424242;
            border-radius: 5px;
        }
        ::-webkit-scrollbar-thumb:hover {
            background: #555;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🤖 TG Anti-Spam Bot - 实时日志监控 (KV版)</h1>
        <div class="stats">
            <div class="stat-item">
                <div class="stat-label">总日志数</div>
                <div class="stat-value">${logs.length}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">最后更新</div>
                <div class="stat-value">${logs.length > 0 ? logs[logs.length - 1].time : 'N/A'}</div>
            </div>
            <div class="stat-item">
                <div class="stat-label">自动刷新</div>
                <div class="stat-value" id="countdown">5s</div>
            </div>
        </div>
    </div>

    ${logs.length === 0 ? '<div class="kv-notice">⚠️ 如果看不到日志，请确保已创建KV命名空间并绑定为 "LOGS"</div>' : ''}

    <div class="controls">
        <button class="btn" onclick="location.reload()">🔄 手动刷新</button>
        <button class="btn" onclick="toggleAutoRefresh()">⏸️ <span id="toggle-text">暂停</span>自动刷新</button>
        <button class="btn danger" onclick="clearLogs()">🗑️ 清空日志</button>
    </div>

    <div class="log-container">
        ${logs.length > 0 ? logHtml : '<div class="empty">暂无日志记录，等待消息中...</div>'}
    </div>

    <script>
        let autoRefresh = true;
        let countdown = 5;
        let timer;

        function toggleAutoRefresh() {
            autoRefresh = !autoRefresh;
            document.getElementById('toggle-text').textContent = autoRefresh ? '暂停' : '启动';
            if (autoRefresh) {
                countdown = 5;
                startCountdown();
            } else {
                clearInterval(timer);
            }
        }

        function clearLogs() {
            if (confirm('确定要清空所有日志吗？')) {
                fetch('/clear').then(() => location.reload());
            }
        }

        function startCountdown() {
            timer = setInterval(() => {
                countdown--;
                document.getElementById('countdown').textContent = countdown + 's';
                if (countdown <= 0) {
                    if (autoRefresh) {
                        location.reload();
                    }
                }
            }, 1000);
        }

        startCountdown();
    </script>
</body>
</html>`;
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

function renderDisabledPage() {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>日志已禁用</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 15px;
            padding: 40px;
            max-width: 500px;
            text-align: center;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        }
        .icon {
            font-size: 64px;
            margin-bottom: 20px;
        }
        h1 {
            color: #333;
            margin-bottom: 15px;
            font-size: 24px;
        }
        p {
            color: #666;
            line-height: 1.6;
            margin-bottom: 10px;
        }
        .code {
            background: #f5f5f5;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
            font-family: monospace;
            text-align: left;
            font-size: 13px;
        }
        .status {
            display: inline-block;
            background: #10b981;
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 14px;
            margin-top: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">🔒</div>
        <h1>日志功能已禁用</h1>
        <p>管理员已关闭日志查看功能。</p>
        <p>机器人仍在正常运行，只是不记录Web日志。</p>

        <div class="code">
如需启用，请在 Cloudflare Workers 环境变量中设置：<br><br>
<strong>ENABLE_LOGS = true</strong><br><br>
或删除 ENABLE_LOGS 变量
        </div>

        <div class="status">✅ Bot 正常运行中</div>
    </div>
</body>
</html>`;
}

function renderLockedPage() {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>需要密码</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 15px;
            padding: 40px;
            max-width: 400px;
            text-align: center;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        }
        .icon {
            font-size: 64px;
            margin-bottom: 20px;
        }
        h1 {
            color: #333;
            margin-bottom: 15px;
            font-size: 24px;
        }
        p {
            color: #666;
            margin-bottom: 25px;
        }
        input {
            width: 100%;
            padding: 12px;
            border: 2px solid #e0e0e0;
            border-radius: 8px;
            font-size: 14px;
            margin-bottom: 15px;
        }
        input:focus {
            outline: none;
            border-color: #667eea;
        }
        button {
            width: 100%;
            background: #667eea;
            color: white;
            border: none;
            padding: 12px;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: background 0.3s;
        }
        button:hover {
            background: #5568d3;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">🔐</div>
        <h1>需要访问密码</h1>
        <p>请输入密码以查看日志</p>

        <form onsubmit="event.preventDefault(); accessLogs();">
            <input type="password" id="password" placeholder="输入密码" autofocus>
            <button type="submit">访问日志</button>
        </form>
    </div>

    <script>
        function accessLogs() {
            const password = document.getElementById('password').value;
            if (password) {
                window.location.href = '/?password=' + encodeURIComponent(password);
            }
        }
    </script>
</body>
</html>`;
}

// ==================== 核心处理逻辑 ====================

async function handleUpdate(update, env, ctx) {
    const message = update.message || update.edited_message;

    if (!message || !message.from) {
        await log(env, "WARN", "⚠️ 无效消息: 缺少message或from字段");
        return;
    }

    const { chat, from: user, message_id: msgId } = message;
    const chatId = chat.id;
    const userId = user.id;
    const text = message.text || "";
    const isAdmin = checkIsAdmin(env, userId);

    await log(env, "INFO", `📩 消息 | 群组:${chatId} | 用户:${userId}(${user.first_name}) | 类型:${chat.type} | 管理员:${isAdmin}`);

    // ========== 私聊处理 ==========
    if (chat.type === "private") {
        if (isAdmin) {
            await log(env, "INFO", `👤 处理管理员私聊指令: ${text}`);

            // /start 命令显示使用说明
            if (text === "/start") {
                await sendHelpMessage(env, chatId);
                await log(env, "INFO", `📖 发送使用说明给管理员: ${userId}`);
                return;
            }

            await handleAdminCommand(env, message);
        } else {
            await log(env, "WARN", `🚫 非管理员私聊被拒绝: ${userId}`);
            // 非管理员静默忽略，不发送任何回复
        }
        return;
    }

    // ========== 群组消息处理 ==========

    // 1. 管理员指令优先处理
    if (text.startsWith("/") && !update.edited_message) {
        if (isAdmin) {
            await log(env, "INFO", `⚙️ 执行管理员指令: ${text.split(' ')[0]}`);
            await handleAdminCommand(env, message);
            return;
        }
    }

    // 2. 管理员豁免所有检测
    if (isAdmin) {
        await log(env, "INFO", `✅ 管理员豁免检测: ${userId}`);
        return;
    }

    // 3. 检查群组是否已激活
    const groupConfig = await getGroupConfig(env, chatId);
    if (!groupConfig) {
        await log(env, "WARN", `⚠️ 群组 ${chatId} 未激活，请使用 /addgroup 激活`);
        return;
    }

    // ========== 安全检测流程 ==========

    // 【硬拦截1】名片炸弹
    if (message.contact) {
        await log(env, "SUCCESS", `🔨 硬拦截: 用户 ${userId} 发送名片`);
        await executeBlock(env, chatId, userId, msgId, "发送名片", ctx);
        return;
    }

    // 【硬拦截2】夜间静默模式
    if (groupConfig.night_mode === 1) {
        const currentHour = getHourInTimezone(env.TZ_OFFSET || 8);
        if (currentHour >= 22 || currentHour < 9) {
            await log(env, "INFO", `🌙 夜间静默删除消息 (${currentHour}:00)`);
            await deleteMessage(env, chatId, msgId);
            return;
        }
    }

    // 【信任系统】检查是否跳过检测
    const userState = await getUserState(env, userId);
    let skipCheck = userState.trusted;

    if (skipCheck) {
        const hasLink = (message.entities || []).some(e => e.type === "url" || e.type === "text_link");
        const isForward = !!message.forward_date;
        const hasPhoto = !!message.photo;

        if ((hasLink || isForward || hasPhoto) && Math.random() < 0.3) {
            await log(env, "INFO", `🎲 信任用户抽查: ${userId} (链接/转发/图片)`);
            skipCheck = false;
        }
    }

    if (skipCheck) {
        await log(env, "INFO", `🛡️ 信任用户跳过检测: ${userId} (消息数:${userState.message_count})`);
        await updateUserState(env, userId, { message_count: userState.message_count + 1 });
        return;
    }

    // ========== 深度内容审核 ==========
    await log(env, "INFO", `🔍 开始深度扫描: ${userId}`);
    const scanResult = await performDeepScan(env, message, user, userState, chatId);

    if (scanResult.isViolation) {
        await log(env, "SUCCESS", `⚠️ 检测到违规: 用户=${userId}, 原因=${scanResult.reason}`);
        await executeBlock(env, chatId, userId, msgId, scanResult.reason, ctx);
    } else {
        const newCount = userState.message_count + 1;
        const updates = { message_count: newCount };

        if (newCount >= 10 && !userState.trusted) {
            updates.trusted = true;
            await log(env, "SUCCESS", `🎖️ 用户 ${userId} 晋升为信任用户 (${newCount}条消息)`);
        }

        await updateUserState(env, userId, updates);
        await log(env, "INFO", `✅ 消息安全通过: ${userId} (计数:${newCount})`);
    }
}

// ==================== 深度扫描引擎 ====================

async function performDeepScan(env, message, user, userState, chatId) {
    let violations = [];

    // 步骤1: 构建扫描内容
    let scanContent = message.text || message.caption || "";
    await log(env, "INFO", `📝 扫描内容长度: ${scanContent.length} 字符`);

    // 提取回复内容
    if (message.reply_to_message) {
        const reply = message.reply_to_message;
        let replyText = reply.text || reply.caption || "";
        if (!replyText) {
            if (reply.photo) replyText = "[Photo]";
            else if (reply.contact) replyText = "[Contact]";
        }

        let replySender = "Unknown";
        if (reply.forward_from_chat) replySender = reply.forward_from_chat.title;
        else if (reply.sender_chat) replySender = reply.sender_chat.title;
        else if (reply.from) replySender = reply.from.first_name;

        scanContent += `\n[ReplyTo ${replySender}]: ${replyText}`;
        await log(env, "INFO", `💬 检测到回复消息来自: ${replySender}`);
    }

    // 提取Quote引用片段
    if (message.quote?.text) {
        scanContent += `\n[Quote]: ${message.quote.text}`;
        await log(env, "INFO", `📌 检测到引用片段: ${message.quote.text.substring(0, 50)}`);
    }

    // 提取External Reply
    if (message.external_reply) {
        const ext = message.external_reply;
        const extTitle = ext.origin?.chat?.title || ext.chat?.title || "Unknown";
        const extText = ext.origin?.text || "";
        scanContent += `\n[ExternalSource]: ${extTitle} - ${extText}`;
        await log(env, "INFO", `🔗 检测到外部引用: ${extTitle}`);
    }

    // 步骤2: 硬关键词拦截
    const hardKeywords = ["查档", "开户", "猎魔", "轰炸", "上分", "烟酒", "代付"];
    for (const keyword of hardKeywords) {
        if (scanContent.includes(keyword)) {
            violations.push(`硬关键词[${keyword}]`);
            await log(env, "SUCCESS", `🚨 命中硬关键词: ${keyword}`);
            break;
        }
    }

    // 步骤3: 首次用户画像审核
    if (violations.length === 0 && !userState.profile_checked) {
        await log(env, "INFO", `👤 首次用户，开始画像审核: ${user.id}`);

        // 头像检测
        const avatarUnsafe = await checkUserAvatar(env, user.id, chatId);
        if (avatarUnsafe) {
            violations.push("头像违规");
            await log(env, "SUCCESS", `📸 头像检测违规: ${user.id}`);
        }

        // Bio检测
        if (violations.length === 0) {
            const bio = await getUserBio(env, user.id);
            const profileText = `Nick: ${user.first_name} ${user.last_name || ""}\nBio: ${bio}`;
            const bioPrompt = "Check user profile. RULES: 1. Selling Crypto/Drugs/Fake Money -> YES. 2. Porn/NSFW -> YES. 3. Normal -> NO. VERDICT: YES/NO.";

            await log(env, "AI", `🤖 AI审核Bio: ${user.id}`);
            const bioUnsafe = await checkWithAI(env, profileText, bioPrompt, "text");
            if (bioUnsafe) {
                violations.push("Bio广告");
                await log(env, "SUCCESS", `📋 Bio检测违规: ${user.id}`);
            }
        }

        await updateUserState(env, user.id, { profile_checked: true });
    }

    // 步骤4: 链接深度分析
    if (violations.length === 0) {
        const linkMatch = scanContent.match(/(?:t\.me|telegram\.me)\/([a-zA-Z0-9_]{5,})/);
        if (linkMatch?.[1]) {
            await log(env, "INFO", `🔗 检测到TG链接: ${linkMatch[1]}`);
            const targetInfo = await getChatInfo(env, linkMatch[1]);
            if (targetInfo) {
                scanContent += `\n\n[LinkedChat]\n${targetInfo}`;
                await log(env, "INFO", `📊 已获取链接信息: ${linkMatch[1]}`);
            }
        }
    }

    // 步骤5: AI文本内容审核
    if (violations.length === 0 && scanContent.trim().length > 2) {
        const textPrompt =
            "You are a TG Admin. Analyze message & context for ADS/SPAM.\n" +
            "Include: Crypto selling, Porn, Gambling, Carding, Illegal services.\n" +
            "Strictly end with: 'VERDICT: YES' (violation) or 'VERDICT: NO'.";

        await log(env, "AI", `🤖 AI审核文本内容 (${scanContent.length}字符)`);
        const textUnsafe = await checkWithAI(env, scanContent, textPrompt, "text");
        if (textUnsafe) {
            violations.push("文本内容");
            await log(env, "SUCCESS", `📝 文本内容违规`);
        }
    }

    // 步骤6: 图片审核
    if (violations.length === 0) {
        let photoToCheck = message.photo;
        if (!photoToCheck && message.external_reply?.origin?.photo) {
            photoToCheck = message.external_reply.origin.photo;
        }

        if (photoToCheck) {
            const fileId = photoToCheck[photoToCheck.length - 1].file_id;
            await log(env, "AI", `🤖 AI审核图片: ${fileId.substring(0, 20)}...`);
            const imageUnsafe = await checkImageWithAI(env, fileId, chatId);
            if (imageUnsafe) {
                violations.push("图片内容");
                await log(env, "SUCCESS", `🖼️ 图片内容违规`);
            }
        }
    }

    return {
        isViolation: violations.length > 0,
        reason: violations.join(", ")
    };
}

// ==================== 使用说明 ====================

async function sendHelpMessage(env, chatId) {
    const helpText = `
🤖 <b>TG 群组反广告机器人 使用说明</b>

<b>📋 主要功能</b>
• AI 智能审核 - 文本/图片/头像/Bio 多维度检测
• 信任系统 - 10条消息后自动信任，信任用户豁免检测
• 夜间静默 - 22:00-09:00 自动删除消息
• 硬关键词拦截 - 秒杀违规内容
• 引用投毒检测 - 防止通过回复/引用传播广告

<b>⚙️ 管理员命令</b>

<b>/addgroup</b>
激活群组防护功能
<i>使用场景：将机器人添加到群组后首次使用</i>

<b>/nighton</b> / <b>/nightoff</b>
开启/关闭夜间静默模式（22:00-09:00）
<i>夜间模式下会静默删除所有消息</i>

<b>/unban &lt;用户ID&gt;</b>
解封用户并加入白名单
<i>示例：/unban 123456789</i>

<b>/reset &lt;用户ID&gt;</b>
重置用户状态为新用户（用于测试AI审核）
<i>示例：/reset 123456789</i>

<b>/id</b>
查看当前群组ID和你的用户ID

<b>/start</b>
显示本使用说明（仅私聊有效）

<b>🛡️ 信任系统说明</b>
• 新用户：完整AI审核（头像+Bio+文本+图片）
• 发送10条正常消息后：自动晋升为信任用户
• 信任用户：跳过检测（节省AI费用）
• 抽查机制：信任用户发送链接/转发/图片时，30%概率抽查

<b>🚫 自动拦截规则</b>
1. 名片炸弹 - 立即封禁
2. 硬关键词 - 查档/开户/猎魔/轰炸/上分/烟酒/代付
3. 引用投毒 - 检测回复消息和外部引用中的广告内容
4. AI判定 - 加密货币交易/色情/赌博/黑产等

<b>⚡ 快速开始</b>
1. 将机器人添加为群组管理员（需要删除消息和封禁权限）
2. 在群组发送 <code>/addgroup</code> 激活防护
3. 完成！机器人开始自动工作

<b>📊 环境变量配置</b>
• <code>BOT_TOKEN</code> - 机器人Token
• <code>ADMIN_IDS</code> - 管理员ID（逗号分隔）
• <code>AI_API_URL</code> - AI API地址
• <code>AI_API_KEY</code> - AI API密钥
• <code>AI_MODEL</code> - AI模型（可选，默认gpt-4）
• <code>TZ_OFFSET</code> - 时区偏移（可选，默认8）
• <code>ENABLE_LOGS</code> - 启用Web日志（可选，设为false禁用）
• <code>LOG_PASSWORD</code> - 日志密码保护（可选）

<b>🔗 相关链接</b>
Web日志监控：访问 Worker URL
项目支持：有问题请联系管理员

<i>💡 提示：所有命令都需要管理员权限才能执行</i>
`;

    await sendMessage(env, chatId, helpText);
}

// ==================== 管理员指令处理 ====================

async function handleAdminCommand(env, message) {
    const userId = message.from.id;
    if (!checkIsAdmin(env, userId)) {
        await log(env, "WARN", `⚠️ 未授权的管理员指令尝试: ${userId}`);
        return;
    }

    const text = message.text || "";
    const chatId = message.chat.id;
    const args = text.trim().split(/\s+/);
    const cmd = args[0].split('@')[0];

    switch (cmd) {
        case "/addgroup":
            try {
                await env.DB.prepare(
                    "INSERT OR IGNORE INTO groups (chat_id, added_by, night_mode) VALUES (?, ?, 1)"
                ).bind(chatId, userId).run();
                await sendMessage(env, chatId, `✅ 已激活群组防护\n群组ID: <code>${chatId}</code>`);
                await log(env, "SUCCESS", `✅ 群组已激活: ${chatId} by ${userId}`);
            } catch (e) {
                await sendMessage(env, chatId, `❌ 激活失败: ${e.message}`);
                await log(env, "ERROR", `❌ 激活群组失败: ${e.message}`);
            }
            break;

        case "/nighton":
            await env.DB.prepare("UPDATE groups SET night_mode = 1 WHERE chat_id = ?").bind(chatId).run();
            await sendMessage(env, chatId, "🌙 夜间静默已开启 (22:00-09:00)");
            await log(env, "SUCCESS", `🌙 夜间模式开启: ${chatId}`);
            break;

        case "/nightoff":
            await env.DB.prepare("UPDATE groups SET night_mode = 0 WHERE chat_id = ?").bind(chatId).run();
            await sendMessage(env, chatId, "☀️ 夜间静默已关闭");
            await log(env, "SUCCESS", `☀️ 夜间模式关闭: ${chatId}`);
            break;

        case "/unban":
            const targetUserId = parseInt(args[1]);
            if (!targetUserId || isNaN(targetUserId)) {
                await sendMessage(env, chatId, "⚠️ 用法: /unban <用户ID>");
                return;
            }

            try {
                await unbanUser(env, chatId, targetUserId);
                await env.DB.prepare(
                    "INSERT OR REPLACE INTO users (user_id, trusted, message_count, profile_checked) VALUES (?, 1, 100, 1)"
                ).bind(targetUserId).run();

                await sendMessage(env, chatId, `✅ 用户 <code>${targetUserId}</code> 已恢复权限并加入白名单`);
                await log(env, "SUCCESS", `✅ 解封用户: ${targetUserId} in ${chatId}`);
            } catch (e) {
                await sendMessage(env, chatId, `❌ 解封失败: ${e.message}`);
                await log(env, "ERROR", `❌ 解封失败: ${e.message}`);
            }
            break;

        case "/id":
            await sendMessage(env, chatId, `📍 Chat ID: <code>${chatId}</code>\n👤 Your ID: <code>${userId}</code>`);
            await log(env, "INFO", `ℹ️ ID查询: Chat=${chatId}, User=${userId}`);
            break;

        case "/reset":
            const resetUserId = parseInt(args[1]);
            if (!resetUserId || isNaN(resetUserId)) {
                await sendMessage(env, chatId, "⚠️ 用法: /reset <用户ID>");
                return;
            }

            try {
                await env.DB.prepare(
                    "UPDATE users SET trusted = 0, message_count = 0, profile_checked = 0 WHERE user_id = ?"
                ).bind(resetUserId).run();

                await sendMessage(env, chatId, `✅ 用户 <code>${resetUserId}</code> 已重置为新用户状态\n下次发言将进行完整AI审核`);
                await log(env, "SUCCESS", `✅ 重置用户: ${resetUserId} in ${chatId}`);
            } catch (e) {
                await sendMessage(env, chatId, `❌ 重置失败: ${e.message}`);
                await log(env, "ERROR", `❌ 重置失败: ${e.message}`);
            }
            break;
    }
}

// ==================== AI审核函数 ====================

async function checkWithAI(env, content, systemPrompt, type = "text") {
    if (!env.AI_API_URL || !env.AI_API_KEY) {
        await log(env, "WARN", "⚠️ AI API未配置，跳过AI检测");
        return false;
    }

    try {
        const requestBody = {
            model: env.AI_MODEL || "gpt-4",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: content }
            ],
            temperature: 0.2
        };

        await log(env, "AI", `📤 发送AI请求 | URL: ${env.AI_API_URL} | Model: ${requestBody.model}`);

        const response = await fetch(env.AI_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${env.AI_API_KEY}`
            },
            body: JSON.stringify(requestBody)
        });

        await log(env, "AI", `📥 AI响应状态: ${response.status} ${response.statusText}`);

        if (!response.ok) {
            const errorText = await response.text();
            await log(env, "ERROR", `❌ AI API错误: ${response.status} - ${errorText.substring(0, 200)}`);
            return false;
        }

        const data = await response.json();
        const result = (data.choices?.[0]?.message?.content || "").toUpperCase();
        const isViolation = result.includes("VERDICT: YES") || (result.includes("YES") && !result.includes("NO"));

        await log(env, "AI", `✅ AI判定结果: ${isViolation ? "违规" : "安全"} | 原文: ${result.substring(0, 100)}`);
        return isViolation;
    } catch (e) {
        await log(env, "ERROR", `❌ AI请求异常: ${e.message}`);
        return false;
    }
}

async function checkImageWithAI(env, fileId, chatId) {
    if (!env.AI_API_URL || !env.AI_API_KEY) {
        await log(env, "WARN", "⚠️ AI API未配置，跳过图片检测");
        return false;
    }

    try {
        const fileRes = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/getFile?file_id=${fileId}`);
        const fileData = await fileRes.json();

        if (!fileData.ok) {
            await log(env, "ERROR", `❌ 获取图片失败: ${fileData.description}`);
            return false;
        }

        const imageUrl = `https://api.telegram.org/file/bot${env.BOT_TOKEN}/${fileData.result.file_path}`;

        const requestBody = {
            model: env.AI_MODEL || "gpt-4-vision",
            messages: [{
                role: "user",
                content: [
                    { type: "text", text: "Is this an AD/QR Code/Spam text in image? VERDICT: YES/NO" },
                    { type: "image_url", image_url: { url: imageUrl } }
                ]
            }]
        };

        const response = await fetch(env.AI_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${env.AI_API_KEY}`
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) return false;

        const data = await response.json();
        const result = (data.choices?.[0]?.message?.content || "").toUpperCase();
        const isViolation = result.includes("YES");

        await log(env, "AI", `✅ 图片判定: ${isViolation ? "违规" : "安全"}`);
        return isViolation;
    } catch (e) {
        await log(env, "ERROR", `❌ 图片审核异常: ${e.message}`);
        return false;
    }
}

async function checkUserAvatar(env, userId, chatId) {
    try {
        const res = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/getUserProfilePhotos?user_id=${userId}&limit=1`);
        const data = await res.json();

        if (data.ok && data.result.total_count > 0) {
            const fileId = data.result.photos[0].pop().file_id;
            return await checkImageWithAI(env, fileId, chatId);
        }
    } catch (e) {
        await log(env, "ERROR", `❌ 头像检测失败: ${e.message}`);
    }
    return false;
}

// ==================== 数据库操作 ====================

async function getGroupConfig(env, chatId) {
    try {
        return await env.DB.prepare(
            "SELECT chat_id, night_mode FROM groups WHERE chat_id = ?"
        ).bind(chatId).first();
    } catch (e) {
        await log(env, "ERROR", `❌ 数据库查询失败: ${e.message}`);
        return null;
    }
}

async function getUserState(env, userId) {
    try {
        const result = await env.DB.prepare(
            "SELECT * FROM users WHERE user_id = ?"
        ).bind(userId).first();

        if (!result) {
            await env.DB.prepare(
                "INSERT INTO users (user_id, message_count, profile_checked, trusted) VALUES (?, 0, 0, 0)"
            ).bind(userId).run();

            return { message_count: 0, profile_checked: false, trusted: false };
        }

        return result;
    } catch (e) {
        await log(env, "ERROR", `❌ 用户状态查询失败: ${e.message}`);
        return { message_count: 0, profile_checked: false, trusted: false };
    }
}

async function updateUserState(env, userId, updates) {
    try {
        const keys = Object.keys(updates);
        const values = Object.values(updates);
        const sql = `UPDATE users SET ${keys.map(k => `${k} = ?`).join(", ")} WHERE user_id = ?`;

        await env.DB.prepare(sql).bind(...values, userId).run();
    } catch (e) {
        await log(env, "ERROR", `❌ 用户状态更新失败: ${e.message}`);
    }
}

// ==================== Telegram API 操作 ====================

async function executeBlock(env, chatId, userId, msgId, reason, ctx) {
    try {
        await Promise.allSettled([
            restrictUser(env, chatId, userId),
            deleteMessage(env, chatId, msgId)
        ]);

        const notifyMsg = await sendMessage(
            env,
            chatId,
            `🚫 <a href="tg://user?id=${userId}">${userId}</a>: AI 审核为广告 (${reason})`
        );

        if (ctx && notifyMsg.result?.message_id) {
            ctx.waitUntil(
                new Promise(resolve =>
                    setTimeout(() => {
                        deleteMessage(env, chatId, notifyMsg.result.message_id).then(resolve);
                    }, 10000)
                )
            );
        }

        await log(env, "SUCCESS", `🔨 已执行封禁: 用户=${userId}, 原因=${reason}`);
    } catch (e) {
        await log(env, "ERROR", `❌ 封禁执行失败: ${e.message}`);
    }
}

async function restrictUser(env, chatId, userId) {
    const permissions = { can_send_messages: false };

    const res = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/restrictChatMember`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, user_id: userId, permissions })
    });

    const data = await res.json();
    if (!data.ok) {
        await log(env, "ERROR", `❌ 限制用户失败: ${data.description}`);
    }
}

async function unbanUser(env, chatId, userId) {
    const fullPermissions = {
        can_send_messages: true,
        can_send_media_messages: true,
        can_send_other_messages: true,
        can_add_web_page_previews: true,
        can_invite_users: true
    };

    const res = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/restrictChatMember`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, user_id: userId, permissions: fullPermissions })
    });

    const data = await res.json();

    if (!data.ok) {
        await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/unbanChatMember`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, user_id: userId, only_if_banned: false })
        });
    }
}

async function sendMessage(env, chatId, text) {
    try {
        const res = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" })
        });
        return await res.json();
    } catch (e) {
        await log(env, "ERROR", `❌ 发送消息失败: ${e.message}`);
        return { ok: false };
    }
}

async function deleteMessage(env, chatId, msgId) {
    try {
        await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/deleteMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, message_id: msgId })
        });
    } catch (e) {
        await log(env, "ERROR", `❌ 删除消息失败: ${e.message}`);
    }
}

async function getChatInfo(env, username) {
    try {
        const res = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/getChat?chat_id=@${username}`);
        const data = await res.json();

        if (data.ok && data.result) {
            const title = data.result.title || "Unknown";
            const desc = data.result.description || data.result.bio || "";
            return `Title: ${title}\nDesc: ${desc}`;
        }
    } catch (e) {
        await log(env, "ERROR", `❌ 获取频道信息失败: ${e.message}`);
    }
    return null;
}

async function getUserBio(env, userId) {
    try {
        const res = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/getChat?chat_id=${userId}`);
        const data = await res.json();
        return (data.ok && data.result) ? (data.result.bio || "") : "";
    } catch (e) {
        await log(env, "ERROR", `❌ 获取用户Bio失败: ${e.message}`);
        return "";
    }
}

// ==================== 工具函数 ====================

function checkIsAdmin(env, userId) {
    if (!env.ADMIN_IDS) return false;
    return env.ADMIN_IDS.split(",").map(id => id.trim()).includes(String(userId));
}

function getHourInTimezone(offset) {
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const targetTime = new Date(utc + (3600000 * offset));
    return targetTime.getHours();
}
