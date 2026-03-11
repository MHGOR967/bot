/**
 * بوت وهم المطور (wa7m.com) - النسخة المستقرة جداً
 * تم إصلاح التعليق عند بدء التشغيل وتحسين نظام الأوامر
 * المطور: Wahm (@ymn_x17)
 */

const { default: makeWASocket, useMultiFileAuthState, disconnectReason, fetchLatestBaileysVersion, Browsers } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const axios = require('axios');
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
5️⃣ .نكتة : نكتة من اختيار وهم.
6️⃣ .دعاء : ذكر اليوم.
7️⃣ .ترجمة [نص] : ترجمة فورية.
8️⃣ .مطور : تواصل مع مطور البوت.
9️⃣ .حالة : فحص حالة السيرفر.
🔟 .اوامر : عرض هذه القائمة.
`;

async function startWahmBot() {
    console.log("🚀 جاري بدء تشغيل بوت wa7m.com...");
    
    // استخدام المسار الحالي للجلسة لضمان الثبات في Render
    const { state, saveCreds } = await useMultiFileAuthState('./');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        auth: state,
        browser: Browsers.macOS('Desktop'),
        printQRInTerminal: false,
        // إضافة إعدادات إضافية للثبات
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 0,
        keepAliveIntervalMs: 10000
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
            console.log(`📡 انقطع الاتصال، السبب: ${reason}`);
            // إعادة التشغيل في حال لم يكن تسجيل خروج متعمد
            if (reason !== disconnectReason.loggedOut) {
                console.log("🔄 محاولة إعادة الاتصال خلال 5 ثوانٍ...");
                setTimeout(startWahmBot, 5000);
            }
        } else if (connection === 'open') {
            console.log('✅ البوت متصل الآن بنجاح على سيرفر Render!');
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        try {
            const m = messages[0];
            if (!m.message || m.key.fromMe) return;

            const from = m.key.remoteJid;
            const senderName = m.pushName || "صديق وهم";
            const body = m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || "";
            
            if (body.startsWith('.')) {
                const args = body.slice(1).trim().split(/ +/);
                const command = args.shift().toLowerCase();
                const text = args.join(' ');

                switch(command) {
                    case 'اوامر':
                        await sock.sendMessage(from, { text: `هلا ${senderName}، تفضل قائمة أوامر wa7m.com:\n${helpMenu}` });
                        break;

                    case 'شغل':
                        if (!text) return sock.sendMessage(from, { text: "⚠️ يرجى كتابة اسم المقطع، مثال: .شغل شيلة" });
                        await sock.sendMessage(from, { text: "⏳ جاري البحث والتحميل لعيونك..." });
                        
                        try {
                            // استخدام API بحث مستقر
                            const searchApi = `https://api.vreden.my.id/api/ytsearch?query=${encodeURIComponent(text)}`;
                            const sRes = await axios.get(searchApi);
                            
                            if (sRes.data.status && sRes.data.result[0]) {
                                const vid = sRes.data.result[0];
                                const dlApi = `https://api.vreden.my.id/api/ytmp3?url=${encodeURIComponent(vid.url)}`;
                                const dRes = await axios.get(dlApi);
                                
                                if (dRes.data.status && dRes.data.result.download.url) {
                                    await sock.sendMessage(from, { 
                                        audio: { url: dRes.data.result.download.url }, 
                                        mimetype: 'audio/mp4',
                                        fileName: `${vid.title}.mp3`
                                    });
                                } else { throw new Error(); }
                            } else { throw new Error(); }
                        } catch (e) {
                            await sock.sendMessage(from, { text: "❌ عذراً، محرك التحميل مشغول حالياً. جرب لاحقاً." });
                        }
                        break;

                    case 'موقع':
                        await sock.sendMessage(from, { text: "🌐 موقعنا الرسمي: https://wa7m.com" });
                        break;

                    case 'حالة':
                        await sock.sendMessage(from, { text: "✅ البوت يعمل بكفاءة على Render." });
                        break;

                    case 'مطور':
                        await sock.sendMessage(from, { text: "🛡️ المطور: وهم (Wahm)\nسناب: ymn_x17" });
                        break;

                    default:
                        // إذا لم يكن أمراً معروفاً، نستخدم الذكاء الاصطناعي
                        await handleAI(sock, from, body);
                }
            } else if (body) {
                // محادثة عادية بالذكاء الاصطناعي
                await handleAI(sock, from, body);
            }
        } catch (err) {
            console.error("Error handling message:", err);
        }
    });
}

// دالة منفصلة للذكاء الاصطناعي لتجنب التعليق
async function handleAI(sock, from, prompt) {
    try {
        const res = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
            model: "llama-3.3-70b-versatile",
            messages: [
                { role: "system", content: "أنت وهم، مطور موقع wa7m.com. رد بلهجة سعودية خفيفة." },
                { role: "user", content: prompt }
            ]
        }, { headers: { 'Authorization': `Bearer ${GROQ_API_KEY}` }, timeout: 10000 });
        
        await sock.sendMessage(from, { text: res.data.choices[0].message.content });
    } catch (e) {
        // لا داعي للرد في حال فشل الـ AI لعدم إزعاج المستخدم
    }
}

// تشغيل السيرفر والبقاء حياً
app.get('/', (req, res) => res.send('🛡️ Wahm Bot is Active and Healthy!'));

app.listen(port, () => {
    console.log(`Server started on port ${port}`);
    startWahmBot().catch(e => console.error("Critical Startup Error:", e));
    
    // نظام الـ Self-Ping المطور
    setInterval(() => {
        const url = `https://bot-1q3m.onrender.com/`;
        axios.get(url).then(() => console.log("⚓ Ping Sent")).catch(() => {});
    }, 60000); 
});

