/**
 * بوت وهم المطور (wa7m.com) - نسخة إصلاح التحميل
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
1️⃣ .شغل [اسم المقطع] : تحميل صوتي.
2️⃣ .ذكاء [سؤالك] : تحدث مع الذكاء الاصطناعي.
3️⃣ .موقع : رابطنا الرسمي.
4️⃣ .وقت : توقيت مكة المكرمة.
5️⃣ .نكتة : فرفش مع وهم.
6️⃣ .دعاء : رسالة إيمانية.
7️⃣ .ترجمة [نص] : ترجمة فورية.
8️⃣ .مطور : تواصل مع وهم.
9️⃣ .حالة : فحص السيرفر.
🔟 .اوامر : عرض القائمة.
`;

async function startWahmBot() {
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
                setTimeout(startWahmBot, 5000);
            }
        } else if (connection === 'open') {
            console.log('🛡️ Wahm Pro Bot is Online!');
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;

        const from = m.key.remoteJid;
        const body = m.message.conversation || m.message.extendedTextMessage?.text || "";
        const senderName = m.pushName || "صديق وهم";

        if (body.startsWith('.')) {
            const args = body.slice(1).trim().split(/ +/);
            const command = args.shift().toLowerCase();
            const text = args.join(' ');

            if (command === 'اوامر') {
                await sock.sendMessage(from, { text: `هلا بك يا ${senderName} في بوت wa7m.com\n${helpMenu}` });
            } else if (command === 'شغل') {
                if (!text) return sock.sendMessage(from, { text: "⚠️ يرجى كتابة اسم المقطع بعد الأمر .شغل" });
                await sock.sendMessage(from, { text: "⏳ جاري البحث والتحميل لموقع wa7m.com..." });

                try {
                    // استخدام محرك بحث وتحميل جديد (API البديل)
                    const searchRes = await axios.get(`https://api.popcat.xyz/github/search?q=${encodeURIComponent(text)}`); // هذا مثال لمصدر بحث، سنستخدم يوتيوب المباشر
                    const youtubeSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(text)}`;
                    const { data: html } = await axios.get(youtubeSearchUrl);
                    const videoIdMatch = html.match(/"videoId":"([^"]+)"/);
                    
                    if (!videoIdMatch) throw new Error("Video not found");
                    const videoId = videoIdMatch[1];
                    
                    // API تحميل بديل ومستقر
                    const downloadApiUrl = `https://api.vevioz.com/api/button/mp3/${videoId}`;
                    
                    await sock.sendMessage(from, { 
                        audio: { url: downloadApiUrl }, 
                        mimetype: 'audio/mp4',
                        fileName: `${text}.mp3`
                    });

                } catch (e) {
                    console.error(e);
                    await sock.sendMessage(from, { text: "❌ معذرةً، حدث خطأ أثناء التحميل. جرب كتابة اسم المقطع بشكل أوضح." });
                }
            } else if (command === 'موقع') {
                await sock.sendMessage(from, { text: "🌐 موقعنا الرسمي: https://wa7m.com" });
            } else if (command === 'وقت') {
                await sock.sendMessage(from, { text: `⏰ التوقيت الحالي (مكة): ${new Date().toLocaleTimeString('ar-SA')}` });
            } else if (command === 'نكتة') {
                const jokes = ["محشش يسأل خويه: ليش القطار مهم؟ قال: لأن تحته خطين!", "واحد بخيل احترق بيته، اتصل بالمطافئ رنة وفصل."];
                await sock.sendMessage(from, { text: jokes[Math.floor(Math.random() * jokes.length)] });
            } else if (command === 'مطور') {
                await sock.sendMessage(from, { text: "🛡️ المطور: وهم (Wahm)\nسناب: ymn_x17\nالموقع: wa7m.com" });
            } else if (command === 'حالة') {
                await sock.sendMessage(from, { text: "✅ السيرفر متصل ويعمل بكفاءة." });
            }
        } else {
            // رد الذكاء الاصطناعي الافتراضي
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

// البقاء حياً
app.get('/', (req, res) => res.send('🛡️ Wahm Bot is Live!'));
app.listen(port, () => {
    console.log(`Server started on port ${port}`);
    startWahmBot();
    
    // Self-ping للبقاء حياً
    setInterval(() => {
        axios.get(`https://bot-1q3m.onrender.com`).catch(() => {});
    }, 5 * 60 * 1000);
});

