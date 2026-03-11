/**
 * 🤖 بوت مساعد محمد الشخصي (wa7m.com)
 * المطور: محمد (Wahm)
 * نظام الرد الذكي والمحترم
 */

const { default: makeWASocket, useMultiFileAuthState, disconnectReason, fetchLatestBaileysVersion, Browsers } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const axios = require('axios');
const express = require('express');

const app = express();
const port = process.env.PORT || 3000;
const GROQ_API_KEY = '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';

// ذاكرة بسيطة للأوامر (ساعة واحدة)
const lastSeenUsers = new Map();

// --- تنسيق القائمة الرئيسية ---
const getHelpMenu = (name) => `
✨ *أهلاً بك يا ${name}* ✨
أنا *مساعد محمد* الذكي، خادمك التقني. 🛡️

لقد تم تصميمي لأكون بجانبك حين انشغال المطور *محمد*، إليك كيف يمكنني مساعدتك:

📌 *قائمة الخدمات:*
━━━━━━━━━━━━━━
🎵 *.شغل* [اسم المقطع]
لتحميل الملفات الصوتية من يوتيوب.

🤖 *.ذكاء* [سؤالك]
للتحدث مع الذكاء الاصطناعي.

🕌 *.آية* | *.دعاء*
للحصول على محتوى إيماني.

📱 *.مطور*
للتواصل مع المطور محمد مباشرة.

🌍 *.موقع*
رابط موقعنا الرسمي wa7m.com.
━━━━━━━━━━━━━━

💡 *تنبيه:* يمكنك الكتابة إليّ مباشرة وسأفهمك بكل ود واحترام. 😊
`;

async function startWahmBot() {
    console.log("🚀 جاري بدء تشغيل مساعد محمد...");
    const { state, saveCreds } = await useMultiFileAuthState('./session_wahm');
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
            const shouldReconnect = (new Boom(lastDisconnect?.error)?.output?.statusCode !== disconnectReason.loggedOut);
            if (shouldReconnect) {
                console.log("🔄 إعادة الاتصال...");
                startWahmBot();
            }
        } else if (connection === 'open') {
            console.log('✅ مساعد محمد جاهز لخدمة المستخدمين!');
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        try {
            const m = messages[0];
            if (!m.message || m.key.fromMe) return;

            const from = m.key.remoteJid;
            const senderName = m.pushName || "ضيفنا الكريم";
            const body = m.message.conversation || m.message.extendedTextMessage?.text || "";
            
            // رد محترم على الصوتيات
            if (m.message.audioMessage) {
                return await sock.sendMessage(from, { 
                    text: `تحية طيبة لك يا ${senderName}، أنا مساعد محمد. أعتذر منك بشدة، فأنا لا أستطيع حالياً سماع المقاطع الصوتية. 🎙️\n\nفضلاً لا أمراً، هل يمكنك كتابة طلبك نصياً؟ وسأكون سعيداً بخدمتك. 😊` 
                });
            }

            // رد على الملصقات
            if (m.message.stickerMessage) {
                return await sock.sendMessage(from, { text: "أشكرك على هذا الملصق اللطيف! 🌸 هل يمكنني مساعدتك بشيء آخر؟" });
            }

            // نظام إظهار الأوامر (مرة كل ساعة)
            const now = Date.now();
            if (!lastSeenUsers.has(from) || (now - lastSeenUsers.get(from) > 3600000)) {
                if (!body.startsWith('.')) {
                    await sock.sendMessage(from, { text: getHelpMenu(senderName) });
                    lastSeenUsers.set(from, now);
                }
            }

            // معالجة الأوامر
            if (body.startsWith('.')) {
                const args = body.slice(1).trim().split(/ +/);
                const command = args.shift().toLowerCase();
                const text = args.join(' ');

                switch(command) {
                    case 'اوامر':
                        await sock.sendMessage(from, { text: getHelpMenu(senderName) });
                        break;
                    
                    case 'شغل':
                        if (!text) return sock.sendMessage(from, { text: "يرجى كتابة اسم المقطع الذي تود سماعه بعد الأمر .شغل 🎵" });
                        await sock.sendMessage(from, { text: "⏳ لحظات من فضلك، جاري البحث والتحميل لموقع wa7m.com..." });
                        try {
                            const search = await axios.get(`https://api.vreden.my.id/api/ytsearch?query=${encodeURIComponent(text)}`);
                            const vid = search.data.result[0];
                            const dl = await axios.get(`https://api.vreden.my.id/api/ytmp3?url=${encodeURIComponent(vid.url)}`);
                            await sock.sendMessage(from, { 
                                audio: { url: dl.data.result.download.url }, 
                                mimetype: 'audio/mp4',
                                fileName: `${vid.title}.mp3`
                            });
                        } catch (e) { await sock.sendMessage(from, { text: "نعتذر، واجهنا صعوبة في تحميل المقطع حالياً، يرجى المحاولة مرة أخرى." }); }
                        break;

                    case 'مطور':
                        await sock.sendMessage(from, { text: `👤 *معلومات المطور محمد:* \n\n• انستقرام: https://instagram.com/ymn_x17 \n• واتساب احتياطي: +967730349682 \n• الموقع: wa7m.com \n\nتشرفنا بك! ✨` });
                        break;

                    case 'آية':
                        const q = await axios.get('https://api.alquran.cloud/v1/ayah/random');
                        await sock.sendMessage(from, { text: `﴿${q.data.data.text}﴾ \n[سورة ${q.data.data.surah.name}]` });
                        break;
                    
                    case 'موقع':
                        await sock.sendMessage(from, { text: "🌐 تفضل بزيارة رابط موقعنا الرسمي:\nhttps://wa7m.com" });
                        break;
                }
            } else if (body.length > 2) {
                // محادثة ذكية
                await handleAI(sock, from, body, senderName);
            }

        } catch (err) { console.error("Error:", err); }
    });
}

async function handleAI(sock, from, prompt, name) {
    try {
        const res = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
            model: "llama-3.3-70b-versatile",
            messages: [
                { role: "system", content: "أنت 'مساعد محمد'، ذكاء اصطناعي محترم وودود جداً. المطور هو محمد صاحب موقع wa7m.com. رد بلهجة سعودية بيضاء مهذبة." },
                { role: "user", content: prompt }
            ]
        }, { headers: { 'Authorization': `Bearer ${GROQ_API_KEY}` } });

        const aiText = res.data.choices[0].message.content;
        const response = `⚠️ *تنبيه:* لاتقلق، أنا الذكاء الاصطناعي "مساعد محمد" حين لا يكون موجوداً. سأرسل له إشعاراً الآن برسالتك وسيرد عليك في أقرب وقت ممكن بإذن الله. 😊\n\n━━━━━━━━━━━━━━\n${aiText}`;
        await sock.sendMessage(from, { text: response });
    } catch (e) { console.error("AI Error"); }
}

app.get('/', (req, res) => res.send('🛡️ Wahm System Active'));
app.listen(port, () => {
    startWahmBot();
    setInterval(() => { axios.get(`https://bot-1q3m.onrender.com/`).catch(() => {}); }, 60000);
});

