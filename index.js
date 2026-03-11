/**
 * بوت وهم المطور (wa7m.com) - نسخة VIP
 * تحديث: محرك تحميل فائق السرعة ومستقر
 * المطور: Wahm (@ymn_x17)
 */

const { default: makeWASocket, useMultiFileAuthState, disconnectReason, fetchLatestBaileysVersion, Browsers } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const axios = require('axios');
const fs = require('fs');
const express = require('express');

const app = express();
const port = process.env.PORT || 3000;
const GROQ_API_KEY = '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';

// قائمة الأوامر
const helpMenu = `
🛡️ *مرحباً بك في عالم وهم* 🛡️
_بوت موقع wa7m.com المطور_

إليك قائمة الأوامر الذكية:
1️⃣ .شغل [اسم المقطع] : تحميل MP3 فوري.
2️⃣ .ذكاء [سؤالك] : استشارة وهم بالذكاء الاصطناعي.
3️⃣ .موقع : الرابط الرسمي لـ wa7m.com.
4️⃣ .وقت : الوقت الآن (توقيت السعودية).
5️⃣ .نكتة : فرفش مع وهم.
6️⃣ .دعاء : ذكر/دعاء اليوم.
7️⃣ .ترجمة [نص] : الترجمة الاحترافية.
8️⃣ .مطور : تواصل مع وهم مباشرة.
9️⃣ .حالة : فحص سرعة السيرفر.
🔟 .اوامر : عرض هذه القائمة.
`;

async function startWahmBot() {
    console.log("🚀 جاري بدء التشغيل المطور لـ wa7m.com...");
    
    const { state, saveCreds } = await useMultiFileAuthState('./');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        auth: state,
        browser: Browsers.macOS('Desktop'),
        printQRInTerminal: false
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
            if (reason !== disconnectReason.loggedOut) {
                console.log("🔄 إعادة اتصال...");
                setTimeout(startWahmBot, 5000);
            }
        } else if (connection === 'open') {
            console.log('✅ البوت الآن Online ومستعد للتحميل!');
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;

        const from = m.key.remoteJid;
        const body = m.message.conversation || m.message.extendedTextMessage?.text || "";
        const senderName = m.pushName || "صديق وهم";

        if (body.startsWith('.')) {
            const command = body.slice(1).trim().split(/ +/);
            const cmd = command.shift().toLowerCase();
            const text = command.join(' ');

            if (cmd === 'اوامر') {
                await sock.sendMessage(from, { text: `هلا بك يا ${senderName}..\n${helpMenu}` });
            } 
            else if (cmd === 'شغل') {
                if (!text) return sock.sendMessage(from, { text: "⚠️ ارسل اسم المقطع بعد .شغل" });
                await sock.sendMessage(from, { text: "⏳ جاري البحث والتحميل لموقع wa7m.com..." });

                try {
                    // المرحلة 1: البحث عن المقطع في يوتيوب
                    const searchRes = await axios.get(`https://api.vreden.my.id/api/ytsearch?query=${encodeURIComponent(text)}`);
                    if (!searchRes.data.status || !searchRes.data.result[0]) throw new Error("Not Found");
                    
                    const videoUrl = searchRes.data.result[0].url;
                    const title = searchRes.data.result[0].title;

                    // المرحلة 2: التحميل عبر الـ API الذهبي
                    const dlRes = await axios.get(`https://api.vreden.my.id/api/ytmp3?url=${encodeURIComponent(videoUrl)}`);
                    
                    if (dlRes.data.status && dlRes.data.result.download.url) {
                        const mp3Link = dlRes.data.result.download.url;
                        
                        await sock.sendMessage(from, { 
                            audio: { url: mp3Link }, 
                            mimetype: 'audio/mp4',
                            fileName: `${title}.mp3`,
                            caption: `✅ تم التحميل لعيونك يا وهم!`
                        });
                    } else {
                        throw new Error("DL Failed");
                    }
                } catch (e) {
                    console.error("Download Error:", e.message);
                    await sock.sendMessage(from, { text: "❌ فشل التحميل. جرب اسم آخر أو رابط مباشر." });
                }
            } 
            else if (cmd === 'موقع') {
                await sock.sendMessage(from, { text: "🌐 موقعنا: https://wa7m.com" });
            }
            // بقية الأوامر...
        } else {
            // رد ذكاء اصطناعي (AI)
            try {
                const res = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
                    model: "llama-3.3-70b-versatile",
                    messages: [
                        { role: "system", content: "أنت وهم، مطور موقع wa7m.com. رد بلهجة سعودية." },
                        { role: "user", content: body }
                    ]
                }, { headers: { 'Authorization': `Bearer ${GROQ_API_KEY}` } });
                await sock.sendMessage(from, { text: res.data.choices[0].message.content });
            } catch (e) {}
        }
    });
}

// السيرفر والبقاء حياً
app.get('/', (req, res) => res.send('🛡️ Wahm Bot Active'));
app.listen(port, () => {
    console.log(`Port ${port} is open.`);
    startWahmBot();
    setInterval(() => {
        axios.get(`https://bot-1q3m.onrender.com/`).catch(() => {});
    }, 60000); // بينغ كل دقيقة
});

