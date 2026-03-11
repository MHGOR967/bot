/**
 * بوت وهم المطور (wa7m.com)
 * نسخة احترافية مع قائمة أوامر وذكاء اصطناعي
 * المطور: Wahm (@ymn_x17)
 */

const { default: makeWASocket, useMultiFileAuthState, disconnectReason, fetchLatestBaileysVersion, Browsers } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const axios = require('axios');
const fs = require('fs');
const express = require('express');

const app = express();
const GROQ_API_KEY = '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';

// قائمة الأوامر بشكل منسق
const helpMenu = `
🛡️ *مرحباً بك في بوت وهم الذكي* 🛡️
_المطور الرسمي لموقع wa7m.com_

إليك قائمة الأوامر المتاحة حالياً:

1️⃣  *.شغل* [اسم الأغنية] : تحميل ملف صوتي من اليوتيوب.
2️⃣  *.بحث* [موضوع] : البحث في الإنترنت عبر الذكاء الاصطناعي.
3️⃣  *.موقع* : يعطيك رابط موقعنا الرسمي wa7m.com.
4️⃣  *.وقت* : لمعرفة الوقت والتاريخ الحالي.
5️⃣  *.هل* [سؤال] : يسأل البوت سؤال إجابته (نعم/لا).
6️⃣  *.نكتة* : يلقي عليك نكتة عشوائية بلهجة سعودية.
7️⃣  *.دعاء* : يرسل لك دعاء أو ذكر عشوائي.
8️⃣  *.ترجمة* [نص] : يترجم النص للغة الإنجليزية فوراً.
9️⃣  *.صور* [وصف] : (تجريبي) ذكاء اصطناعي لوصف الصور.
🔟 *.مطور* : معلومات التواصل مع المطور وهم.

💡 *ملاحظة:* يمكنك التحدث مع البوت مباشرة وسيرد عليك بذكاء خارق!
`;

async function startWahmPro() {
    const { state, saveCreds } = await useMultiFileAuthState('./'); 
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        auth: state,
        browser: Browsers.macOS('Desktop'),
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== disconnectReason.loggedOut;
            if (shouldReconnect) startWahmPro();
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

        // الرد التلقائي بالقائمة إذا كانت أول رسالة أو طلب المساعدة
        if (body.toLowerCase() === 'اوامر' || body.toLowerCase() === 'help' || body === '.') {
            await sock.sendMessage(from, { text: `هلا بك يا ${senderName}..\n${helpMenu}` });
            return;
        }

        // التعامل مع الأوامر
        if (body.startsWith('.')) {
            const args = body.slice(1).trim().split(/ +/);
            const command = args.shift().toLowerCase();
            const fullArgs = args.join(' ');

            switch(command) {
                case 'شغل':
                case 'صوت':
                    if (!fullArgs) return sock.sendMessage(from, { text: "ارسل اسم المقطع بعد الأمر .شغل" });
                    await sock.sendMessage(from, { text: "⏳ جاري جلب الملف الصوتي من اليوتيوب..." });
                    try {
                        const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(fullArgs)}`;
                        const { data: html } = await axios.get(searchUrl);
                        const videoId = html.match(/"videoId":"([^"]+)"/)[1];
                        const apiRes = await axios.get(`https://api.phimtat.vn/snapvideo/json.php?url=https://www.youtube.com/watch?v=${videoId}`);
                        const downloadUrl = apiRes.data.url || apiRes.data.links[0].url;
                        await sock.sendMessage(from, { audio: { url: downloadUrl }, mimetype: 'audio/mp4' });
                    } catch (e) { await sock.sendMessage(from, { text: "❌ فشل التحميل." }); }
                    break;

                case 'موقع':
                    await sock.sendMessage(from, { text: "🌐 تفضل بزيارة موقعنا: https://wa7m.com" });
                    break;

                case 'وقت':
                    await sock.sendMessage(from, { text: `⏰ الوقت الحالي: ${new Date().toLocaleTimeString('ar-SA')}` });
                    break;

                case 'مطور':
                    await sock.sendMessage(from, { text: "🛡️ المطور هو: وهم (Wahm)\nسناب: ymn_x17\nموقع: wa7m.com" });
                    break;

                case 'نكتة':
                    const jokes = ["محشش دخل بقالة وقال: عندك سكر؟ قال: إيه، قال: الله يشفيك.", "واحد منحوس خطب، قالوا له: مبروك، قال: والله أدري إنكم تمزحون."];
                    await sock.sendMessage(from, { text: jokes[Math.floor(Math.random() * jokes.length)] });
                    break;

                case 'ترجمة':
                    if (!fullArgs) return sock.sendMessage(from, { text: "اكتب النص بعد الأمر .ترجمة" });
                    const tRes = await askAI(`Translate this to English: ${fullArgs}`);
                    await sock.sendMessage(from, { text: `🔠 الترجمة:\n${tRes}` });
                    break;

                default:
                    await sock.sendMessage(from, { text: "⚠️ أمر غير معروف، أرسل كلمة (اوامر) لعرض القائمة." });
            }
            return;
        }

        // إذا أرسل كلام عادي، يرد بالذكاء الاصطناعي
        const aiResponse = await askAI(body);
        await sock.sendMessage(from, { text: aiResponse });
    });
}

// دالة الذكاء الاصطناعي
async function askAI(prompt) {
    try {
        const res = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
            model: "llama-3.3-70b-versatile",
            messages: [
                { role: "system", content: "أنت وهم، مطور موقع wa7m.com. رد بلهجة سعودية خفيفة وكن ذكياً جداً." },
                { role: "user", content: prompt }
            ]
        }, { headers: { 'Authorization': `Bearer ${GROQ_API_KEY}` } });
        return res.data.choices[0].message.content;
    } catch (e) {
        return "سوري يا وهم، مخي معلق شوي!";
    }
}

startWahmPro();
app.get('/', (req, res) => res.send('🛡️ Wahm Pro Bot Live'));
app.listen(process.env.PORT || 3000);

