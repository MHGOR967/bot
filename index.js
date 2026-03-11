/**
 * 🤖 مساعد محمد الذكي (wa7m.com)
 * نسخة "تجديد الجلسة" للاستقرار الكامل على Render
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
    console.log("🚀 بدء تشغيل نظام مساعد محمد... جاري تجهيز الجلسة.");
    
    // المجلد الجديد للجلسة (يُفضل مسح القديم أولاً من GitHub)
    const { state, saveCreds } = await useMultiFileAuthState('./session_new_wahm');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        auth: state,
        browser: Browsers.macOS('Desktop'),
        printQRInTerminal: true, // سيظهر الباركود في سجلات ريندر (Logs)
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 15000
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        // عرض الباركود في السجل إذا ظهر
        if (qr) {
            console.log("📢 يرجى مسح الباركود أدناه لربط مساعد محمد:");
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
            console.log(`📡 انقطع الاتصال. الكود: ${reason}`);
            if (reason !== disconnectReason.loggedOut) {
                console.log("🔄 محاولة إعادة اتصال تلقائية...");
                setTimeout(startWahmBot, 5000);
            }
        } else if (connection === 'open') {
            console.log('✅ تم الربط بنجاح! مساعد محمد متاح الآن لخدمة زوار wa7m.com');
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        try {
            const m = messages[0];
            if (!m.message || m.key.fromMe) return;

            const from = m.key.remoteJid;
            const senderName = m.pushName || "ضيفنا العزيز";
            const body = m.message.conversation || m.message.extendedTextMessage?.text || "";

            // 1. معالجة الأوامر (بالنقطة كما طلبت)
            if (body.startsWith('.')) {
                const args = body.slice(1).trim().split(/ +/);
                const command = args.shift().toLowerCase();
                const text = args.join(' ');

                if (command === 'اوامر') {
                    const menu = `✨ *أهلاً بك يا ${senderName}* ✨\nأنا *مساعد محمد* الذكي. 🛡️\n\n📌 *الأوامر المتاحة:* \n━━━━━━━━━━━━━━\n🎵 *.شغل* [اسم المقطع]\n🤖 *.ذكاء* [سؤالك]\n🕌 *.آية* | *.دعاء*\n📱 *.مطور*\n🌍 *.موقع*\n━━━━━━━━━━━━━━\n_نسعد بخدمتك دائماً.._ 😊`;
                    await sock.sendMessage(from, { text: menu });
                } else if (command === 'شغل') {
                    if (!text) return sock.sendMessage(from, { text: "اكتب اسم المقطع بعد ( .شغل ) 🎵" });
                    await sock.sendMessage(from, { text: "⏳ جاري التحميل من wa7m.com..." });
                    try {
                        const s = await axios.get(`https://api.vreden.my.id/api/ytsearch?query=${encodeURIComponent(text)}`);
                        const v = s.data.result[0];
                        const d = await axios.get(`https://api.vreden.my.id/api/ytmp3?url=${encodeURIComponent(v.url)}`);
                        await sock.sendMessage(from, { audio: { url: d.data.result.download.url }, mimetype: 'audio/mp4' });
                    } catch (e) { await sock.sendMessage(from, { text: "عذراً، المحرك مشغول حالياً." }); }
                } else if (command === 'مطور') {
                    await sock.sendMessage(from, { text: `👤 المطور: محمد (Wahm)\n🌐 الموقع: wa7m.com\n📱 واتساب: https://wa.me/967730349682` });
                }
            } 
            // 2. الرد الترحيبي الأول (بدون تخزين)
            else if (body.length > 0) {
                const greetings = ['هلا', 'مرحبا', 'السلام', 'هاي', 'الو'];
                if (greetings.some(g => body.toLowerCase().includes(g))) {
                    const welcome = `يا هلا بك يا ${senderName}! أنا مساعد محمد الذكي. 🛡️\n\nللاطلاع على خدماتي، يرجى إرسال كلمة:\n*( .اوامر )*\n\n(تذكر النقطة في البداية) 😊`;
                    await sock.sendMessage(from, { text: welcome });
                } else {
                    // السوالف تروح للذكاء
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
                { role: "system", content: "أنت مساعد محمد، ذكاء اصطناعي محترم. المطور هو محمد صاحب موقع wa7m.com." },
                { role: "user", content: prompt }
            ]
        }, { headers: { 'Authorization': `Bearer ${GROQ_API_KEY}` }, timeout: 15000 });

        const aiMsg = `⚠️ *تنبيه:* أنا مساعد محمد (ذكاء اصطناعي). سأخبر محمد برسالتك فور تواجدة. 😊\n\n━━━━━━━━━━━━━━\n${res.data.choices[0].message.content}`;
        await sock.sendMessage(from, { text: aiMsg });
    } catch (e) { console.log("AI Error"); }
}

app.get('/', (req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<div style="text-align:center; padding:50px; font-family:sans-serif;"><h1>🛡️ نظام مساعد محمد يعمل</h1><p>تأكد من سجلات ريندر لمسح الباركود الجديد</p></div>`);
});

app.listen(port, () => {
    startWahmBot();
});

