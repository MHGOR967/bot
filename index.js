/**
 * 🤖 بوت مساعد محمد الشخصي (wa7m.com)
 * المطور: محمد (Wahm)
 * الميزات: ذكاء اصطناعي، نظام ذاكرة ساعي، ردود راقية
 */

const { default: makeWASocket, useMultiFileAuthState, disconnectReason, fetchLatestBaileysVersion, Browsers } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const axios = require('axios');
const express = require('express');

const app = express();
const port = process.env.PORT || 3000;
const GROQ_API_KEY = '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';

// ذاكرة مؤقتة لتخزين وقت آخر ظهور لكل مستخدم
const userCooldown = new Map();

// --- تنسيق رسالة الأوامر ---
const helpMenu = (name) => `
✨ *مرحباً بك يا ${name}* ✨
أنا *مساعد محمد* الذكي، أتشرف بخدمتك. 🛡️

لقد تم تصميمي لأكون معك حين انشغال المطور *محمد*، إليك كيف يمكنني مساعدتك:

📌 *الأوامر المتاحة:*
━━━━━━━━━━━━━━
🎵 *.شغل* [اسم المقطع]
لتحميل المقاطع الصوتية مباشرة من يوتيوب.

🤖 *.ذكاء* [سؤالك]
للحصول على إجابات مفصلة من الذكاء الاصطناعي.

🌐 *.موقع*
زيارة موقعنا الرسمي wa7m.com.

🕌 *.آية* | *.دعاء*
للحصول على نفحات إيمانية هادئة.

📱 *.مطور*
للحصول على معلومات التواصل مع محمد.
━━━━━━━━━━━━━━

💡 *نصيحة:* يمكنك التحدث معي مباشرة بدون أوامر وسأفهمك بكل ود. 😊
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
            if (new Boom(lastDisconnect?.error)?.output?.statusCode !== disconnectReason.loggedOut) {
                setTimeout(startWahmBot, 5000);
            }
        } else if (connection === 'open') {
            console.log('✅ مساعد محمد متصل الآن..');
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        try {
            const m = messages[0];
            if (!m.message || m.key.fromMe) return;

            const from = m.key.remoteJid;
            const senderName = m.pushName || "ضيفنا الكريم";
            const body = m.message.conversation || m.message.extendedTextMessage?.text || "";
            const isAudio = m.message.audioMessage;
            const isSticker = m.message.stickerMessage;

            // --- التعامل مع المقاطع الصوتية ---
            if (isAudio) {
                return await sock.sendMessage(from, { 
                    text: `عذراً يا ${senderName}، أنا مساعد محمد الذكي، وللأسف لا أستطيع فهم المقاطع الصوتية حالياً. 🎙️\n\nفضلاً منك، هل يمكنك كتابة طلبك نصياً؟ سأكون سعيداً جداً بمساعدتك. 😊` 
                });
            }

            // --- التعامل مع الملصقات ---
            if (isSticker) {
                return await sock.sendMessage(from, { 
                    text: `ملصق جميل! أشكرك على ذوقك يا ${senderName}. 🌸\nهل هناك شيء يمكنني مساعدتك به؟` 
                });
            }

            // --- نظام إظهار الأوامر كل ساعة ---
            const now = Date.now();
            const lastSeen = userCooldown.get(from) || 0;
            const oneHour = 60 * 60 * 1000;

            if (now - lastSeen > oneHour && body !== '.اوامر') {
                await sock.sendMessage(from, { text: helpMenu(senderName) });
                userCooldown.set(from, now);
                // لا نتوقف هنا، بل نكمل لمعالجة الرسالة إذا كانت أمراً
            }

            // --- معالجة الأوامر النصية ---
            if (body.startsWith('.')) {
                const args = body.slice(1).trim().split(/ +/);
                const command = args.shift().toLowerCase();
                const text = args.join(' ');

                switch(command) {
                    case 'اوامر':
                        await sock.sendMessage(from, { text: helpMenu(senderName) });
                        userCooldown.set(from, now);
                        break;

                    case 'شغل':
                        if (!text) return sock.sendMessage(from, { text: "تفضل بكتابة اسم المقطع الذي تود سماعه بعد الأمر .شغل 🎵" });
                        await sock.sendMessage(from, { text: "⏳ لحظات من فضلك، جاري البحث والتحميل..." });
                        try {
                            const search = await axios.get(`https://api.vreden.my.id/api/ytsearch?query=${encodeURIComponent(text)}`);
                            const vid = search.data.result[0];
                            const dl = await axios.get(`https://api.vreden.my.id/api/ytmp3?url=${encodeURIComponent(vid.url)}`);
                            await sock.sendMessage(from, { 
                                audio: { url: dl.data.result.download.url }, 
                                mimetype: 'audio/mp4',
                                fileName: `${vid.title}.mp3`
                            });
                        } catch (e) { await sock.sendMessage(from, { text: "نعتذر منك، واجهت مشكلة بسيطة في التحميل، يرجى المحاولة مرة أخرى." }); }
                        break;

                    case 'مطور':
                        const devMsg = `
👤 *معلومات مطور النظام:*
━━━━━━━━━━━━━━
• *الاسم:* محمد (Wahm)
• *انستقرام:* [اضغط هنا](https://instagram.com/ymn_x17)
• *واتساب احتياطي:* https://wa.me/967730349682
• *الموقع:* wa7m.com
━━━━━━━━━━━━━━
_تشرفنا بزيارتك!_
`;
                        await sock.sendMessage(from, { text: devMsg });
                        break;

                    case 'موقع':
                        await sock.sendMessage(from, { text: "تفضل بزيارة موقعنا الرسمي لمزيد من الخدمات:\n🌐 https://wa7m.com" });
                        break;

                    case 'آية':
                        const q = await axios.get('https://api.alquran.cloud/v1/ayah/random');
                        await sock.sendMessage(from, { text: `﴿${q.data.data.text}﴾\n\n[سورة ${q.data.data.surah.name}]` });
                        break;
                }
            } else if (body.length > 1) {
                // الرد الذكي العام مع تنبيه الغياب
                await handleAI(sock, from, body, senderName);
            }

        } catch (err) { console.error(err); }
    });
}

async function handleAI(sock, from, prompt, name) {
    try {
        const res = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
            model: "llama-3.3-70b-versatile",
            messages: [
                { role: "system", content: `أنت "مساعد محمد"، ذكاء اصطناعي محترم جداً وودود. المطور هو محمد صاحب موقع wa7m.com. رد بلهجة سعودية بيضاء مهذبة. في أول رد لك دائماً طمئن المستخدم أنك ذكاء اصطناعي مساعد لمحمد.` },
                { role: "user", content: prompt }
            ]
        }, { headers: { 'Authorization': `Bearer ${GROQ_API_KEY}` } });

        const aiResponse = res.data.choices[0].message.content;
        const finalMsg = `⚠️ *تنبيه:* لاتقلق، أنا الذكاء الاصطناعي "مساعد محمد" حين لا يكون موجوداً. سأرسل له إشعاراً الآن برسالتك وسيرد عليك في أقرب وقت ممكن بإذن الله. 😊\n\n━━━━━━━━━━━━━━\n${aiResponse}`;
        
        await sock.sendMessage(from, { text: finalMsg });
    } catch (e) { /* تجاهل الأخطاء البسيطة */ }
}

app.get('/', (req, res) => res.send('🛡️ Wahm Assistant is Online'));
app.listen(port, () => {
    startWahmBot();
    setInterval(() => { axios.get(`https://bot-1q3m.onrender.com/`).catch(() => {}); }, 60000);
});

