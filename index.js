/**
 * بوت وهم المطور (wa7m.com)
 * نسخة التشغيل المستقرة مع قائمة أوامر ذكية
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

// قائمة الأوامر بشكل احترافي
const helpMenu = `
🛡️ *مرحباً بك في عالم وهم* 🛡️
_بوت موقع wa7m.com المطور_

إليك قائمة الأوامر الذكية:

1️⃣  *.شغل* [اسم المقطع] : تحميل صوت من يوتيوب.
2️⃣  *.ذكاء* [سؤالك] : التحدث مع أحدث موديلات AI.
3️⃣  *.موقع* : رابط موقعنا الرسمي.
4️⃣  *.وقت* : الوقت والتاريخ الحالي بالسعودية.
5️⃣  *.نكتة* : فرفش مع نكت وهم.
6️⃣  *.دعاء* : رسالة إيمانية لك.
7️⃣  *.ترجمة* [نص] : للترجمة الفورية.
8️⃣  *.مطور* : تواصل مع مطور البوت.
9️⃣  *.حالة* : فحص حالة السيرفر.
🔟 *.اوامر* : لعرض هذه القائمة مرة أخرى.

💡 *تلميح:* تقدر تسولف معي بأي وقت وبرد عليك باللهجة السعودية!
`;

async function startWahmPro() {
    // إعداد الجلسة من الملف المرفوع مباشرة (creds.json)
    const { state, saveCreds } = await useMultiFileAuthState('./'); 
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        auth: state,
        browser: Browsers.macOS('Desktop'),
        printQRInTerminal: true
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== disconnectReason.loggedOut;
            console.log('🔄 جاري محاولة إعادة الاتصال...');
            if (shouldReconnect) startWahmPro();
        } else if (connection === 'open') {
            console.log('🛡️ Wahm Pro Bot is Online & Ready!');
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;

        const from = m.key.remoteJid;
        const senderName = m.pushName || "صديق وهم";
        const body = m.message.conversation || m.message.extendedTextMessage?.text || "";
        
        // عرض القائمة عند أول تواصل
        if (body.toLowerCase() === 'اوامر' || body === '.' || body === 'هلا') {
            await sock.sendMessage(from, { text: `هلا بك يا ${senderName} في بوت wa7m.com\n${helpMenu}` });
            return;
        }

        // الأوامر المباشرة
        if (body.startsWith('.')) {
            const args = body.slice(1).trim().split(/ +/);
            const command = args.shift().toLowerCase();
            const fullArgs = args.join(' ');

            switch(command) {
                case 'شغل':
                    if (!fullArgs) return sock.sendMessage(from, { text: "ارسل اسم المقطع بعد .شغل" });
                    await sock.sendMessage(from, { text: "⏳ جاري جلب الصوت..." });
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
                    await sock.sendMessage(from, { text: "🌐 موقعنا الرسمي: https://wa7m.com" });
                    break;

                case 'مطور':
                    await sock.sendMessage(from, { text: "🛡️ المطور: وهم\nسناب: ymn_x17" });
                    break;

                case 'نكتة':
                    const jokes = ["محشش ضيع أهله، راح للشرطة قالهم: ما شفتوا واحد يمشي وأنا مو معه؟", "واحد سأل محشش: ليش لابس جزمتين وحدة سوداء ووحدة بنية؟ قال: والله عندي وحدة ثانية زيها بالبيت!"];
                    await sock.sendMessage(from, { text: jokes[Math.floor(Math.random() * jokes.length)] });
                    break;
                
                case 'حالة':
                    await sock.sendMessage(from, { text: "✅ السيرفر يعمل بكفاءة عالية لموقع wa7m.com" });
                    break;

                default:
                    await sock.sendMessage(from, { text: "⚠️ أمر غير موجود، أرسل كلمة (اوامر)." });
            }
            return;
        }

        // الرد بالذكاء الاصطناعي على أي رسالة أخرى
        try {
            const res = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
                model: "llama-3.3-70b-versatile",
                messages: [
                    { role: "system", content: "أنت وهم، مطور موقع wa7m.com. رد بلهجة سعودية خفيفة وذكية." },
                    { role: "user", content: body }
                ]
            }, { headers: { 'Authorization': `Bearer ${GROQ_API_KEY}` } });
            await sock.sendMessage(from, { text: res.data.choices[0].message.content });
        } catch (e) {}
    });
}

startWahmPro();
app.get('/', (req, res) => res.send('🛡️ Wahm Bot Active'));
app.listen(process.env.PORT || 3000);

