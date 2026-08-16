// ============================================================
// TELEGRAM BOT - MULTI-FEATURE SECURITY & UTILITY BOT
// ============================================================

const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const dns = require('dns');
const net = require('net');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { exec, spawn } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// ============ CONFIGURATION ============
const BOT_TOKEN = process.env.BOT_TOKEN || 'YOUR_BOT_TOKEN_HERE';
const ADMIN_IDS = process.env.ADMIN_IDS ? process.env.ADMIN_IDS.split(',') : [];
const LOG_FILE = 'bot_activity.log';

// ============ BOT INITIALIZATION ============
const bot = new TelegramBot(BOT_TOKEN, { polling: true });
console.log('[+] Bot started successfully');

// ============ LOGGER ============
function log(user, command, details = '') {
    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] User:${user} | CMD:${command} | ${details}\n`;
    fs.appendFileSync(LOG_FILE, entry);
    console.log(entry.trim());
}

// ============ HELPER FUNCTIONS ============
function isAdmin(userId) {
    return ADMIN_IDS.includes(userId.toString());
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ============ START & HELP ============
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const username = msg.from.username || msg.from.first_name;
    
    log(username, '/start');
    
    const welcome = `
🤖 *Welcome to Security Bot, ${username}!*

*Available Commands:*

🔍 *RECONNAISSANCE*
• /whois [domain] - WHOIS lookup
• /dns [domain] - DNS enumeration
• /portscan [host] [ports] - Port scanner
• /ipinfo [ip] - IP geolocation & info
• /subdomain [domain] - Subdomain enumeration

🌐 *WEB SECURITY*
• /headers [url] - HTTP headers analysis
• /status [url] - HTTP status check
• /dirscan [url] - Directory brute force
• /sqli [url] - SQL Injection test
• /xss [url] - XSS vulnerability test

📡 *NETWORK*
• /ping [host] - Ping host
• /traceroute [host] - Traceroute
• /nmap [host] - Nmap scan (admin only)
• /netstat - Network connections

🔐 *CRYPTOGRAPHY*
• /hash [text] [md5|sha1|sha256] - Generate hash
• /b64encode [text] - Base64 encode
• /b64decode [text] - Base64 decode
• /genpass [length] - Generate password
• /encrypt [text] [key] - AES encryption
• /decrypt [text] [key] - AES decryption

💻 *SYSTEM*
• /sysinfo - System information
• /exec [command] - Execute command (admin)
• /shell [command] - Interactive shell (admin)
• /upload - Upload file to server
• /download [url] - Download file

📊 *UTILITIES*
• /weather [city] - Weather info
• /crypto [coin] - Crypto prices
• /translate [text] - Translate text
• /shorten [url] - Shorten URL
• /qrcode [text] - Generate QR code
• /screenshot [url] - Web screenshot

⚙️ *ADMIN*
• /users - List authorized users
• /broadcast [msg] - Send to all
• /logs - View bot logs
• /restart - Restart bot

Type /help [command] for detailed usage.
    `;
    
    bot.sendMessage(chatId, welcome, { parse_mode: 'Markdown' });
});

bot.onText(/\/help (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const cmd = match[1].toLowerCase();
    
    const helps = {
        whois: '/whois [domain] - Lookup domain registration info\nExample: /whois google.com',
        portscan: '/portscan [host] [start_port] [end_port]\nExample: /portscan 192.168.1.1 1 1000',
        sqli: '/sqli [url] - Test SQL injection\nExample: /sqli http://target.com/page?id=1',
        exec: '/exec [command] - Execute system command (admin only)\nExample: /exec ls -la',
        encrypt: '/encrypt [text] [key] - AES-256 encryption\nExample: /encrypt hello world mysecretkey',
        genpass: '/genpass [length] - Generate secure password\nExample: /genpass 16'
    };
    
    bot.sendMessage(chatId, helps[cmd] || 'Command not found. Use /start to see all commands.');
});

// ============ RECONNAISSANCE ============

// WHOIS Lookup
bot.onText(/\/whois (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const domain = match[1].trim();
    
    try {
        bot.sendChatAction(chatId, 'typing');
        const { stdout } = await execPromise(`whois ${domain} 2>/dev/null || echo "WHOIS data unavailable"`);
        const result = stdout.substring(0, 4000);
        bot.sendMessage(chatId, `📋 *WHOIS: ${domain}*\n\`\`\`\n${result}\n\`\`\``, { parse_mode: 'Markdown' });
    } catch (e) {
        bot.sendMessage(chatId, `❌ Error: ${e.message}`);
    }
});

// DNS Enumeration
bot.onText(/\/dns (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const domain = match[1].trim();
    
    try {
        bot.sendChatAction(chatId, 'typing');
        
        const records = {};
        const types = ['A', 'AAAA', 'MX', 'NS', 'TXT', 'CNAME', 'SOA'];
        
        for (const type of types) {
            try {
                const res = await util.promisify(dns.resolve)(domain, type);
                records[type] = res;
            } catch (e) {
                records[type] = 'Not found';
            }
        }
        
        let output = `🔍 *DNS Records: ${domain}*\n\n`;
        for (const [type, value] of Object.entries(records)) {
            output += `*${type}:* \`${Array.isArray(value) ? value.join(', ') : value}\`\n`;
        }
        
        bot.sendMessage(chatId, output, { parse_mode: 'Markdown' });
    } catch (e) {
        bot.sendMessage(chatId, `❌ Error: ${e.message}`);
    }
});

// Port Scanner
bot.onText(/\/portscan (.+) (\d+) (\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const host = match[1];
    const startPort = parseInt(match[2]);
    const endPort = parseInt(match[3]);
    
    if (endPort - startPort > 1000) {
        return bot.sendMessage(chatId, '⚠️ Max 1000 ports per scan');
    }
    
    bot.sendMessage(chatId, `🔍 Scanning ${host} ports ${startPort}-${endPort}...\nThis may take a while.`);
    bot.sendChatAction(chatId, 'typing');
    
    const openPorts = [];
    const promises = [];
    
    for (let port = startPort; port <= endPort; port++) {
        promises.push(
            new Promise((resolve) => {
                const socket = new net.Socket();
                socket.setTimeout(2000);
                socket.on('connect', () => {
                    openPorts.push(port);
                    socket.destroy();
                    resolve();
                });
                socket.on('timeout', () => {
                    socket.destroy();
                    resolve();
                });
                socket.on('error', () => {
                    socket.destroy();
                    resolve();
                });
                socket.connect(port, host);
            })
        );
    }
    
    await Promise.all(promises);
    
    if (openPorts.length === 0) {
        bot.sendMessage(chatId, `🔒 No open ports found on ${host}`);
    } else {
        bot.sendMessage(chatId, `🔓 *Open Ports on ${host}:*\n\`${openPorts.join(', ')}\``, { parse_mode: 'Markdown' });
    }
});

// IP Info
bot.onText(/\/ipinfo (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const ip = match[1].trim();
    
    try {
        bot.sendChatAction(chatId, 'typing');
        const res = await axios.get(`http://ip-api.com/json/${ip}`, { timeout: 10000 });
        const data = res.data;
        
        const output = `
🌐 *IP Information: ${ip}*

*Country:* ${data.country} (${data.countryCode})
*Region:* ${data.regionName}
*City:* ${data.city}
*ZIP:* ${data.zip}
*ISP:* ${data.isp}
*Org:* ${data.org}
*AS:* ${data.as}
*Lat/Lon:* ${data.lat}, ${data.lon}
*Timezone:* ${data.timezone}
        `;
        
        bot.sendMessage(chatId, output, { parse_mode: 'Markdown' });
    } catch (e) {
        bot.sendMessage(chatId, `❌ Error: ${e.message}`);
    }
});

// Subdomain Enumeration
bot.onText(/\/subdomain (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const domain = match[1].trim();
    
    const subdomains = [
        'www', 'mail', 'ftp', 'localhost', 'webmail', 'smtp', 'pop', 'ns1', 'webdisk',
        'ns2', 'cpanel', 'whm', 'autodiscover', 'autoconfig', 'ns3', 'm', 'imap', 'test',
        'ns', 'blog', 'pop3', 'dev', 'www2', 'admin', 'forum', 'news', 'vpn', 'ns4',
        'www1', 'api', 'media', 'mail2', 'new', 'www3', 'web', 'www4', 'mobile', 'mail3',
        'gateway', 'api2', 'api3', 'www5', 'www6', 'www7', 'www9', 'staging', 'www8'
    ];
    
    bot.sendMessage(chatId, `🔍 Enumerating subdomains for ${domain}...\nChecking ${subdomains.length} common subdomains.`);
    bot.sendChatAction(chatId, 'typing');
    
    const found = [];
    
    for (const sub of subdomains) {
        const fullDomain = `${sub}.${domain}`;
        try {
            await util.promisify(dns.resolve4)(fullDomain);
            found.push(fullDomain);
        } catch (e) {
            // Not found
        }
    }
    
    if (found.length === 0) {
        bot.sendMessage(chatId, `❌ No subdomains found for ${domain}`);
    } else {
        bot.sendMessage(chatId, `✅ *Found ${found.length} subdomains:*\n\`\`\`\n${found.join('\n')}\n\`\`\``, { parse_mode: 'Markdown' });
    }
});

// ============ WEB SECURITY ============

// HTTP Headers
bot.onText(/\/headers (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const url = match[1].trim();
    
    try {
        bot.sendChatAction(chatId, 'typing');
        const res = await axios.head(url, { timeout: 10000, validateStatus: () => true });
        
        let output = `📡 *HTTP Headers: ${url}*\n*Status:* ${res.status} ${res.statusText}\n\n`;
        
        for (const [key, value] of Object.entries(res.headers)) {
            output += `*${key}:* \`${value}\`\n`;
        }
        
        bot.sendMessage(chatId, output, { parse_mode: 'Markdown' });
    } catch (e) {
        bot.sendMessage(chatId, `❌ Error: ${e.message}`);
    }
});

// HTTP Status Check
bot.onText(/\/status (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const url = match[1].trim();
    
    try {
        bot.sendChatAction(chatId, 'typing');
        const start = Date.now();
        const res = await axios.get(url, { timeout: 15000, validateStatus: () => true });
        const time = Date.now() - start;
        
        const output = `
🔗 *Status Check: ${url}*

*Status Code:* ${res.status}
*Response Time:* ${time}ms
*Content-Type:* ${res.headers['content-type'] || 'N/A'}
*Server:* ${res.headers['server'] || 'N/A'}
*Content-Length:* ${formatBytes(res.headers['content-length'] || 0)}
        `;
        
        bot.sendMessage(chatId, output, { parse_mode: 'Markdown' });
    } catch (e) {
        bot.sendMessage(chatId, `❌ Error: ${e.message}`);
    }
});

// Directory Brute Force
bot.onText(/\/dirscan (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const url = match[1].trim().replace(/\/$/, '');
    
    const wordlist = [
        'admin', 'login', 'dashboard', 'api', 'config', 'backup', 'test',
        'phpmyadmin', 'wp-admin', 'administrator', 'panel', 'cpanel',
        '.env', '.git', 'robots.txt', 'sitemap.xml', 'phpinfo.php',
        'uploads', 'images', 'css', 'js', 'assets', 'includes',
        'database', 'db', 'sql', 'dump', 'backup.zip', 'old',
        'temp', 'tmp', 'dev', 'development', 'staging', 'beta'
    ];
    
    bot.sendMessage(chatId, `🔍 Directory scanning ${url}...\nTesting ${wordlist.length} paths.`);
    bot.sendChatAction(chatId, 'typing');
    
    const found = [];
    
    for (const path of wordlist) {
        try {
            const testUrl = `${url}/${path}`;
            const res = await axios.get(testUrl, { 
                timeout: 5000, 
                validateStatus: () => true,
                maxRedirects: 0
            });
            
            if (res.status !== 404) {
                found.push({ path, status: res.status, size: res.headers['content-length'] || '?' });
            }
        } catch (e) {
            // Continue
        }
    }
    
    if (found.length === 0) {
        bot.sendMessage(chatId, `❌ No directories found`);
    } else {
        let output = `✅ *Found ${found.length} paths:*\n\n`;
        found.forEach(f => {
            output += `🟢 \`/${f.path}\` - Status: ${f.status} (${f.size} bytes)\n`;
        });
        bot.sendMessage(chatId, output, { parse_mode: 'Markdown' });
    }
});

// SQL Injection Test
bot.onText(/\/sqli (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const url = match[1].trim();
    
    const payloads = [
        "' OR '1'='1",
        "' OR 1=1--",
        "1' AND 1=1--",
        "1' AND 1=2--",
        "' UNION SELECT NULL--",
        "'; DROP TABLE users;--",
        "1' OR '1'='1' /*",
        "1' AND SLEEP(5)--",
        "1' AND (SELECT * FROM (SELECT(SLEEP(5)))a)--"
    ];
    
    bot.sendMessage(chatId, `🧪 Testing SQL Injection on ${url}...\nTesting ${payloads.length} payloads.`);
    bot.sendChatAction(chatId, 'typing');
    
    const results = [];
    
    for (const payload of payloads) {
        try {
            const testUrl = url.includes('?') ? `${url}${payload}` : `${url}?id=${encodeURIComponent(payload)}`;
            const start = Date.now();
            const res = await axios.get(testUrl, { timeout: 10000, validateStatus: () => true });
            const time = Date.now() - start;
            
            const vuln = res.status !== 404 && (time > 4000 || res.data.includes('SQL') || res.data.includes('syntax'));
            results.push({ payload: payload.substring(0, 30), status: res.status, time, vuln });
        } catch (e) {
            results.push({ payload: payload.substring(0, 30), status: 'ERR', time: 0, vuln: false });
        }
    }
    
    let output = `🧪 *SQL Injection Results:*\n\n`;
    results.forEach(r => {
        const icon = r.vuln ? '🔴' : '⚪';
        output += `${icon} Payload: \`${r.payload}...\` | Status: ${r.status} | Time: ${r.time}ms\n`;
    });
    
    bot.sendMessage(chatId, output, { parse_mode: 'Markdown' });
});

// XSS Test
bot.onText(/\/xss (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const url = match[1].trim();
    
    const payloads = [
        '<script>alert(1)</script>',
        '"><script>alert(1)</script>',
        '<img src=x onerror=alert(1)>',
        '"><img src=x onerror=alert(1)>',
        '<svg onload=alert(1)>',
        'javascript:alert(1)',
        "'-alert(1)-'",
        '"><svg onload=alert(1)>',
        '<body onload=alert(1)>',
        '<iframe src=javascript:alert(1)>'
    ];
    
    bot.sendMessage(chatId, `🧪 Testing XSS on ${url}...\nTesting ${payloads.length} payloads.`);
    bot.sendChatAction(chatId, 'typing');
    
    const results = [];
    
    for (const payload of payloads) {
        try {
            const testUrl = url.includes('?') ? `${url}${encodeURIComponent(payload)}` : `${url}?q=${encodeURIComponent(payload)}`;
            const res = await axios.get(testUrl, { timeout: 10000, validateStatus: () => true });
            
            const reflected = res.data.includes(payload) || res.data.includes(encodeURIComponent(payload));
            results.push({ payload: payload.substring(0, 35), status: res.status, reflected });
        } catch (e) {
            results.push({ payload: payload.substring(0, 35), status: 'ERR', reflected: false });
        }
    }
    
    let output = `🧪 *XSS Test Results:*\n\n`;
    results.forEach(r => {
        const icon = r.reflected ? '🔴 REFLECTED' : '⚪ Not reflected';
        output += `${icon} | Payload: \`${r.payload}...\` | Status: ${r.status}\n`;
    });
    
    bot.sendMessage(chatId, output, { parse_mode: 'Markdown' });
});

// ============ NETWORK ============

// Ping
bot.onText(/\/ping (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const host = match[1].trim();
    
    try {
        bot.sendChatAction(chatId, 'typing');
        const { stdout } = await execPromise(`ping -c 4 ${host} 2>/dev/null || ping -n 4 ${host}`);
        bot.sendMessage(chatId, `📡 *Ping: ${host}*\n\`\`\`\n${stdout.substring(0, 4000)}\n\`\`\``, { parse_mode: 'Markdown' });
    } catch (e) {
        bot.sendMessage(chatId, `❌ Error: ${e.message}`);
    }
});

// Traceroute
bot.onText(/\/traceroute (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const host = match[1].trim();
    
    try {
        bot.sendChatAction(chatId, 'typing');
        const { stdout } = await execPromise(`traceroute ${host} 2>/dev/null || tracert ${host}`);
        bot.sendMessage(chatId, `🌐 *Traceroute: ${host}*\n\`\`\`\n${stdout.substring(0, 4000)}\n\`\`\``, { parse_mode: 'Markdown' });
    } catch (e) {
        bot.sendMessage(chatId, `❌ Error: ${e.message}`);
    }
});

// Nmap Scan (Admin Only)
bot.onText(/\/nmap (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const target = match[1].trim();
    const userId = msg.from.id;
    
    if (!isAdmin(userId)) {
        return bot.sendMessage(chatId, '⛔ Admin only command');
    }
    
    try {
        bot.sendMessage(chatId, `🔍 Running nmap on ${target}...\nThis may take a while.`);
        bot.sendChatAction(chatId, 'typing');
        
        const { stdout } = await execPromise(`nmap -sV -O ${target} 2>/dev/null || echo "nmap not installed"`);
        bot.sendMessage(chatId, `🔍 *Nmap Results: ${target}*\n\`\`\`\n${stdout.substring(0, 4000)}\n\`\`\``, { parse_mode: 'Markdown' });
    } catch (e) {
        bot.sendMessage(chatId, `❌ Error: ${e.message}`);
    }
});

// Netstat
bot.onText(/\/netstat/, async (msg) => {
    const chatId = msg.chat.id;
    
    try {
        bot.sendChatAction(chatId, 'typing');
        const { stdout } = await execPromise(`netstat -tuln 2>/dev/null || ss -tuln`);
        bot.sendMessage(chatId, `📊 *Network Connections*\n\`\`\`\n${stdout.substring(0, 4000)}\n\`\`\``, { parse_mode: 'Markdown' });
    } catch (e) {
        bot.sendMessage(chatId, `❌ Error: ${e.message}`);
    }
});

// ============ CRYPTOGRAPHY ============

// Hash Generator
bot.onText(/\/hash (.+) (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const text = match[1];
    const algo = match[2].toLowerCase();
    
    try {
        let hash;
        switch(algo) {
            case 'md5': hash = crypto.createHash('md5').update(text).digest('hex'); break;
            case 'sha1': hash = crypto.createHash('sha1').update(text).digest('hex'); break;
            case 'sha256': hash = crypto.createHash('sha256').update(text).digest('hex'); break;
            case 'sha512': hash = crypto.createHash('sha512').update(text).digest('hex'); break;
            default: return bot.sendMessage(chatId, '❌ Supported: md5, sha1, sha256, sha512');
        }
        
        bot.sendMessage(chatId, `🔐 *Hash (${algo}):*\n\`\`\`\n${hash}\n\`\`\``, { parse_mode: 'Markdown' });
    } catch (e) {
        bot.sendMessage(chatId, `❌ Error: ${e.message}`);
    }
});

// Base64 Encode
bot.onText(/\/b64encode (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const text = match[1];
    const encoded = Buffer.from(text).toString('base64');
    bot.sendMessage(chatId, `🔤 *Base64 Encoded:*\n\`\`\`\n${encoded}\n\`\`\``, { parse_mode: 'Markdown' });
});

// Base64 Decode
bot.onText(/\/b64decode (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const text = match[1];
    try {
        const decoded = Buffer.from(text, 'base64').toString('utf8');
        bot.sendMessage(chatId, `🔤 *Base64 Decoded:*\n\`\`\`\n${decoded}\n\`\`\``, { parse_mode: 'Markdown' });
    } catch (e) {
        bot.sendMessage(chatId, '❌ Invalid Base64 string');
    }
});

// Password Generator
bot.onText(/\/genpass(?: (\d+))?/, (msg, match) => {
    const chatId = msg.chat.id;
    const length = parseInt(match[1]) || 16;
    
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
    let password = '';
    const randomBytes = crypto.randomBytes(length);
    
    for (let i = 0; i < length; i++) {
        password += chars[randomBytes[i] % chars.length];
    }
    
    bot.sendMessage(chatId, `🔑 *Generated Password (${length} chars):*\n\`\`\`\n${password}\n\`\`\``, { parse_mode: 'Markdown' });
});

// AES Encrypt
bot.onText(/\/encrypt (.+) (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const text = match[1];
    const key = match[2];
    
    try {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-cbc', crypto.scryptSync(key, 'salt', 32), iv);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        const result = iv.toString('hex') + ':' + encrypted;
        bot.sendMessage(chatId, `🔒 *Encrypted:*\n\`\`\`\n${result}\n\`\`\``, { parse_mode: 'Markdown' });
    } catch (e) {
        bot.sendMessage(chatId, `❌ Error: ${e.message}`);
    }
});

// AES Decrypt
bot.onText(/\/decrypt (.+) (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const encryptedData = match[1];
    const key = match[2];
    
    try {
        const [ivHex, encrypted] = encryptedData.split(':');
        const iv = Buffer.from(ivHex, 'hex');
        const decipher = crypto.createDecipheriv('aes-256-cbc', crypto.scryptSync(key, 'salt', 32), iv);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        bot.sendMessage(chatId, `🔓 *Decrypted:*\n\`\`\`\n${decrypted}\n\`\`\``, { parse_mode: 'Markdown' });
    } catch (e) {
        bot.sendMessage(chatId, `❌ Error: ${e.message}`);
    }
});

// ============ SYSTEM ============

// System Info
bot.onText(/\/sysinfo/, async (msg) => {
    const chatId = msg.chat.id;
    
    try {
        const osInfo = {
            platform: process.platform,
            arch: process.arch,
            nodeVersion: process.version,
            uptime: Math.floor(process.uptime()),
            memory: process.memoryUsage(),
            cpus: require('os').cpus().length,
            totalMem: formatBytes(require('os').totalmem()),
            freeMem: formatBytes(require('os').freemem()),
            hostname: require('os').hostname()
        };
        
        const output = `
💻 *System Information*

*Hostname:* ${osInfo.hostname}
*Platform:* ${osInfo.platform} ${osInfo.arch}
*Node.js:* ${osInfo.nodeVersion}
*CPUs:* ${osInfo.cpus} cores
*Total RAM:* ${osInfo.totalMem}
*Free RAM:* ${osInfo.freeMem}
*Uptime:* ${osInfo.uptime}s
*Bot PID:* ${process.pid}
        `;
        
        bot.sendMessage(chatId, output, { parse_mode: 'Markdown' });
    } catch (e) {
        bot.sendMessage(chatId, `❌ Error: ${e.message}`);
    }
});

// Execute Command (Admin Only)
bot.onText(/\/exec (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const command = match[1];
    
    if (!isAdmin(userId)) {
        return bot.sendMessage(chatId, '⛔ Admin only command');
    }
    
    try {
        bot.sendChatAction(chatId, 'typing');
        const { stdout, stderr } = await execPromise(command, { timeout: 30000 });
        const output = stdout || stderr || 'Command executed (no output)';
        bot.sendMessage(chatId, `💻 *Exec Output:*\n\`\`\`\n${output.substring(0, 4000)}\n\`\`\``, { parse_mode: 'Markdown' });
        log(msg.from.username, '/exec', command);
    } catch (e) {
        bot.sendMessage(chatId, `❌ Error: ${e.message}`);
    }
});

// Interactive Shell (Admin Only)
bot.onText(/\/shell (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const command = match[1];
    
    if (!isAdmin(userId)) {
        return bot.sendMessage(chatId, '⛔ Admin only command');
    }
    
    try {
        bot.sendChatAction(chatId, 'typing');
        const child = spawn('bash', ['-c', command]);
        
        let output = '';
        child.stdout.on('data', (data) => { output += data.toString(); });
        child.stderr.on('data', (data) => { output += data.toString(); });
        
        child.on('close', (code) => {
            bot.sendMessage(chatId, `🐚 *Shell Output (exit: ${code}):*\n\`\`\`\n${output.substring(0, 4000)}\n\`\`\``, { parse_mode: 'Markdown' });
        });
        
        log(msg.from.username, '/shell', command);
    } catch (e) {
        bot.sendMessage(chatId, `❌ Error: ${e.message}`);
    }
});

// Upload Handler
bot.on('document', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (!isAdmin(userId)) {
        return bot.sendMessage(chatId, '⛔ Admin only');
    }
    
    try {
        bot.sendChatAction(chatId, 'upload_document');
        const fileId = msg.document.file_id;
        const fileName = msg.document.file_name;
        const filePath = path.join(__dirname, 'uploads', fileName);
        
        fs.mkdirSync('uploads', { recursive: true });
        
        const file = await bot.getFile(fileId);
        const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`;
        
        const res = await axios.get(fileUrl, { responseType: 'stream' });
        const writer = fs.createWriteStream(filePath);
        res.data.pipe(writer);
        
        writer.on('finish', () => {
            bot.sendMessage(chatId, `✅ *File uploaded:*\n\`${fileName}\`\nSize: ${formatBytes(msg.document.file_size)}`, { parse_mode: 'Markdown' });
        });
        
        log(msg.from.username, 'UPLOAD', fileName);
    } catch (e) {
        bot.sendMessage(chatId, `❌ Upload error: ${e.message}`);
    }
});

// Download File
bot.onText(/\/download (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const url = match[1].trim();
    
    try {
        bot.sendChatAction(chatId, 'upload_document');
        const fileName = path.basename(url) || 'download';
        const filePath = path.join(__dirname, 'downloads', fileName);
        
        fs.mkdirSync('downloads', { recursive: true });
        
        const res = await axios.get(url, { responseType: 'stream', timeout: 60000 });
        const writer = fs.createWriteStream(filePath);
        res.data.pipe(writer);
        
        writer.on('finish', () => {
            bot.sendDocument(chatId, filePath, {}, {
                caption: `✅ Downloaded: ${fileName}`
            });
        });
    } catch (e) {
        bot.sendMessage(chatId, `❌ Download error: ${e.message}`);
    }
});

// ============ UTILITIES ============

// Weather
bot.onText(/\/weather (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const city = match[1].trim();
    
    try {
        bot.sendChatAction(chatId, 'typing');
        const res = await axios.get(`https://wttr.in/${city}?format=j1`, { timeout: 10000 });
        const data = res.data.current_condition[0];
        
        const output = `
🌤 *Weather: ${city}*

*Temperature:* ${data.temp_C}°C / ${data.temp_F}°F
*Feels Like:* ${data.FeelsLikeC}°C
*Humidity:* ${data.humidity}%
*Wind:* ${data.windspeedKmph} km/h ${data.winddir16Point}
*Pressure:* ${data.pressure} hPa
*Visibility:* ${data.visibility} km
*Description:* ${data.weatherDesc[0].value}
        `;
        
        bot.sendMessage(chatId, output, { parse_mode: 'Markdown' });
    } catch (e) {
        bot.sendMessage(chatId, `❌ Error: ${e.message}`);
    }
});

// Crypto Prices
bot.onText(/\/crypto (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const coin = match[1].trim().toLowerCase();
    
    try {
        bot.sendChatAction(chatId, 'typing');
        const res = await axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=${coin}&vs_currencies=usd,idr&include_24hr_change=true`, { timeout: 10000 });
        const data = res.data[coin];
        
        if (!data) return bot.sendMessage(chatId, '❌ Coin not found');
        
        const change = data.usd_24h_change || 0;
        const emoji = change >= 0 ? '📈' : '📉';
        
        const output = `
${emoji} *${coin.toUpperCase()} Price*

*USD:* $${data.usd.toLocaleString()}
*IDR:* Rp ${data.idr.toLocaleString()}
*24h Change:* ${change.toFixed(2)}%
        `;
        
        bot.sendMessage(chatId, output, { parse_mode: 'Markdown' });
    } catch (e) {
        bot.sendMessage(chatId, `❌ Error: ${e.message}`);
    }
});

// Translate
bot.onText(/\/translate (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const text = match[1];
    
    try {
        bot.sendChatAction(chatId, 'typing');
        const res = await axios.get(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=auto|en`, { timeout: 10000 });
        const data = res.data.responseData;
        
        bot.sendMessage(chatId, `🌐 *Translation:*\n\n*Original:* ${text}\n*Translated:* ${data.translatedText}\n*Detected:* ${res.data.responseDetails || 'auto'}`, { parse_mode: 'Markdown' });
    } catch (e) {
        bot.sendMessage(chatId, `❌ Error: ${e.message}`);
    }
});

// URL Shortener
bot.onText(/\/shorten (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const url = match[1].trim();
    
    try {
        bot.sendChatAction(chatId, 'typing');
        const res = await axios.get(`https://is.gd/create.php?format=simple&url=${encodeURIComponent(url)}`, { timeout: 10000 });
        bot.sendMessage(chatId, `🔗 *Shortened URL:*\n\`${res.data}\``, { parse_mode: 'Markdown' });
    } catch (e) {
        bot.sendMessage(chatId, `❌ Error: ${e.message}`);
    }
});

// QR Code Generator
bot.onText(/\/qrcode (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const text = match[1];
    
    try {
        bot.sendChatAction(chatId, 'upload_photo');
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(text)}`;
        bot.sendPhoto(chatId, qrUrl, { caption: `📱 QR Code for:\n\`${text}\``, parse_mode: 'Markdown' });
    } catch (e) {
        bot.sendMessage(chatId, `❌ Error: ${e.message}`);
    }
});

// Screenshot
bot.onText(/\/screenshot (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const url = match[1].trim();
    
    try {
        bot.sendChatAction(chatId, 'upload_photo');
        const screenshotUrl = `https://image.thum.io/get/width/1200/crop/800/${encodeURIComponent(url)}`;
        bot.sendPhoto(chatId, screenshotUrl, { caption: `📸 Screenshot of ${url}` });
    } catch (e) {
        bot.sendMessage(chatId, `❌ Error: ${e.message}`);
    }
});

// ============ ADMIN ============

// List Users
bot.onText(/\/users/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (!isAdmin(userId)) {
        return bot.sendMessage(chatId, '⛔ Admin only');
    }
    
    const users = ADMIN_IDS.map((id, i) => `${i+1}. ID: ${id}`).join('\n');
    bot.sendMessage(chatId, `👥 *Admin Users:*\n\`\`\`\n${users}\n\`\`\``, { parse_mode: 'Markdown' });
});

// Broadcast
bot.onText(/\/broadcast (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const message = match[1];
    
    if (!isAdmin(userId)) {
        return bot.sendMessage(chatId, '⛔ Admin only');
    }
    
    // Send to all known chats (simplified)
    bot.sendMessage(chatId, `📢 Broadcast sent:\n\`\`\`\n${message}\n\`\`\``, { parse_mode: 'Markdown' });
    log('ADMIN', 'BROADCAST', message);
});

// View Logs
bot.onText(/\/logs/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (!isAdmin(userId)) {
        return bot.sendMessage(chatId, '⛔ Admin only');
    }
    
    try {
        const logs = fs.readFileSync(LOG_FILE, 'utf8').split('\n').slice(-50).join('\n');
        bot.sendMessage(chatId, `📋 *Recent Logs:*\n\`\`\`\n${logs}\n\`\`\``, { parse_mode: 'Markdown' });
    } catch (e) {
        bot.sendMessage(chatId, '❌ No logs found');
    }
});

// Restart Bot
bot.onText(/\/restart/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (!isAdmin(userId)) {
        return bot.sendMessage(chatId, '⛔ Admin only');
    }
    
    bot.sendMessage(chatId, '🔄 Restarting bot...');
    log('ADMIN', 'RESTART');
    setTimeout(() => process.exit(0), 2000);
});

// ============ ERROR HANDLING ============
bot.on('polling_error', (error) => {
    console.error('Polling error:', error);
});

bot.on('error', (error) => {
    console.error('Bot error:', error);
});

// ============ KEEP ALIVE ============
setInterval(() => {
    console.log(`[${new Date().toISOString()}] Bot heartbeat - Active processes: ${Object.keys(active_processes).length}`);
}, 300000); // Every 5 minutes

console.log('[+] Security Bot is running...');
