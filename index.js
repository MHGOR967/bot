/**
 * 🤖 مساعد محمد الذكي (wa7m.com)
 * نسخة تصحيح الأخطاء وربط الجلسة الجديدة
 * المطور: محمد (Wahm)
 */

const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    disconnectReason, 
    fetchLatestBaileysVersion, 
    Browsers 
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const axios = require('axios');
const express = require('express');
const qrcode = require('qrcode-terminal');

const app = express();
const port = process.env.PORT || 3000;
const GROQ_API_KEY = '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';

async function startWahmBot() {
    console.log("🛠️ جاري محاولة بدء التشغيل وتوليد الباركود...");
    
    // استخدم اسم مجلد جديد تماماً للتأكد من نظافة الجلسة
    const { state, saveCreds } = await useMultiFileAuthState('./session_final_wahm');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        auth: state,
        browser: Browsers.macOS('Desktop'),
        printQRInTerminal: true, // مهم جداً لرؤيته في Logs
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 15000
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log("📸 امسح الباركود الجديد الآن من سجلات Render:");
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
            if (reason !== disconnectReason.loggedOut) {
                console.log("🔄 انقطع الاتصال، جاري المحاولة مرة أخرى...");
                setTimeout(startWahmBot, 5000);
            } else {
                console.log("❌ تم تسجيل الخروج. يرجى مسح الباركود مجدداً.");
            }
        } else if (connection === 'open') {
            console.log('✅ تم الربط! مساعد محمد (wa7m.com) متصل الآن.');
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        try {
            const m = messages[0];
            if (!m.message || m.key.fromMe) return;

            const from = m.key.remoteJid;
            const senderName = m.pushName || "ضيفنا العزيز";
            const body = m.message.conversation || m.message.extendedTextMessage?.text || "";

            if (body.startsWith('.')) {
                const args = body.slice(1).trim().split(/ +/);
                const command = args.shift().toLowerCase();
                const text = args.join(' ');

                if (command === 'اوامر') {
                    const menu = `✨ *أهلاً يا ${senderName}* ✨\nأنا مساعد محمد الذكي. 🛡️\n\n📌 *الأوامر:* \n.شغل | .ذكاء | .مطور | .موقع | .آية\n\n_نسعد بخدمتك في wa7m.com_ 😊`;
                    await sock.sendMessage(from, { text: menu });
                } else if (command === 'شغل') {
                    if (!text) return sock.sendMessage(from, { text: "اكتب اسم المقطع بعد ( .شغل )" });
                    await sock.sendMessage(from, { text: "⏳ جاري جلب الصوت..." });
                    try {
                        const s = await axios.get(`https://api.vreden.my.id/api/ytsearch?query=${encodeURIComponent(text)}`);
                        const v = s.data.result[0];
                        const d = await axios.get(`https://api.vreden.my.id/api/ytmp3?url=${encodeURIComponent(v.url)}`);
                        await sock.sendMessage(from, { audio: { url: d.data.result.download.url }, mimetype: 'audio/mp4' });
                    } catch (e) { await sock.sendMessage(from, { text: "المحرك مشغول، جرب لاحقاً." }); }
                }
            } else if (body.length > 0) {
                const greetings = ['هلا', 'مرحبا', 'السلام', 'هاي'];
                if (greetings.some(g => body.toLowerCase().includes(g))) {
                    await sock.sendMessage(from, { text: `يا هلا بك يا ${senderName}! أنا مساعد محمد الذكي. 🛡️\nللاطلاع على خدماتي، أرسل:\n*( .اوامر )* 😊` });
                } else {
                    await handleAI(sock, from, body);
                }
            }
        } catch (err) { console.error(err); }
    });
}

async function handleAI(sock, from, prompt) {
    try {
        const res = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
            model: "llama-3.3-70b-versatile",
            messages: [
                { role: "system", content: "أنت مساعد محمد، ذكاء اصطناعي محترم. المطور هو محمد (Wahm) صاحب موقع wa7m.com." },
                { role: "user", content: prompt }
            ]
        }, { headers: { 'Authorization': `Bearer ${GROQ_API_KEY}` }, timeout: 15000 });
        const aiMsg = `⚠️ *تنبيه:* أنا مساعد محمد الذكي. سأخبره برسالتك فوراً. 😊\n\n━━━━━━━━━━━━━━\n${res.data.choices[0].message.content}`;
        await sock.sendMessage(from, { text: aiMsg });
    } catch (e) { console.log("AI Offline"); }
}

app.get('/', (req, res) => res.send("Bot is Running - wa7m.com"));
app.listen(port, () => startWahmBot());

