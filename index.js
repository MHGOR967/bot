/**
 * 🤖 بوت مساعد محمد الشخصي (wa7m.com)
 * المطور: محمد (Wahm)
 * نسخة الرد المباشر بدون تخزين معطل
 */

const { default: makeWASocket, useMultiFileAuthState, disconnectReason, fetchLatestBaileysVersion, Browsers } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const axios = require('axios');
const express = require('express');

const app = express();
const port = process.env.PORT || 3000;
const GROQ_API_KEY = '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';

// --- رسالة الأوامر الكاملة ---
const helpMenu = (name) => `
✨ *أهلاً بك يا ${name}* ✨
أنا *مساعد محمد* الذكي، خادمك التقني هنا. 🛡️

لقد تم تصميمي لأكون بجانبك حين انشغال المطور *محمد*، إليك خدماتنا:

📌 *قائمة الخدمات:*
━━━━━━━━━━━━━━
🎵 *.شغل* [اسم المقطع]
لتحميل المقاطع الصوتية من يوتيوب.

🤖 *.ذكاء* [سؤالك]
للتحدث مع الذكاء الاصطناعي مباشرة.

🕌 *.آية* | *.دعاء*
للحصول على محتوى إيماني هادئ.

📱 *.مطور*
للتواصل مع المطور محمد (واتساب/انستا).

🌍 *.موقع*
زيارة موقعنا الرسمي wa7m.com.
━━━━━━━━━━━━━━
_أنا هنا لخدمتك دائماً.._ 😊
`;

async function startWahmBot() {
    console.log("🚀 بدء تشغيل مساعد محمد (نسخة الرد المباشر)...");
    
    // استخدام مجلد بسيط للجلسة
    const { state, saveCreds } = await useMultiFileAuthState('./session');
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
            if (shouldReconnect) startWahmBot();
        } else if (connection === 'open') {
            console.log('✅ مساعد محمد متاح الآن!');
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        try {
            const m = messages[0];
            if (!m.message || m.key.fromMe) return;

            const from = m.key.remoteJid;
            const senderName = m.pushName || "ضيفنا العزيز";
            const body = m.message.conversation || m.message.extendedTextMessage?.text || "";

            // 1. التعامل مع الصوتيات بأسلوب محترم
            if (m.message.audioMessage) {
                return await sock.sendMessage(from, { 
                    text: `تحية طيبة يا ${senderName}.. أعتذر منك بشدة، أنا مساعد محمد ولا أستطيع سماع البصمات حالياً. 🎙️\n\nفضلاً لا أمراً، اكتب طلبك نصياً وسأخدمك فوراً. 😊` 
                });
            }

            // 2. التعامل مع الأوامر (التي تبدأ بنقطة)
            if (body.startsWith('.')) {
                const args = body.slice(1).trim().split(/ +/);
                const command = args.shift().toLowerCase();
                const text = args.join(' ');

                switch(command) {
                    case 'اوامر':
                        await sock.sendMessage(from, { text: helpMenu(senderName) });
                        break;

                    case 'شغل':
                        if (!text) return sock.sendMessage(from, { text: "تفضل بكتابة اسم المقطع بعد الأمر ( .شغل ) 🎵" });
                        await sock.sendMessage(from, { text: "⏳ لحظات، جاري جلب الصوت لعيونك من wa7m.com..." });
                        try {
                            const s = await axios.get(`https://api.vreden.my.id/api/ytsearch?query=${encodeURIComponent(text)}`);
                            const v = s.data.result[0];
                            const d = await axios.get(`https://api.vreden.my.id/api/ytmp3?url=${encodeURIComponent(v.url)}`);
                            await sock.sendMessage(from, { audio: { url: d.data.result.download.url }, mimetype: 'audio/mp4', fileName: `${v.title}.mp3` });
                        } catch (e) { await sock.sendMessage(from, { text: "نعتذر، واجهنا خطأ في التحميل، جرب مرة أخرى." }); }
                        break;

                    case 'مطور':
                        const devInfo = `👤 *معلومات المطور محمد:* \n\n• انستقرام: https://instagram.com/ymn_x17 \n• واتساب: https://wa.me/967730349682 \n• الموقع: wa7m.com \n\nنسعد بخدمتك دائماً! ✨`;
                        await sock.sendMessage(from, { text: devInfo });
                        break;

                    case 'آية':
                        const q = await axios.get('https://api.alquran.cloud/v1/ayah/random');
                        await sock.sendMessage(from, { text: `﴿${q.data.data.text}﴾ \n[سورة ${q.data.data.surah.name}]` });
                        break;

                    case 'موقع':
                        await sock.sendMessage(from, { text: "🌐 تفضل بزيارة موقعنا الرسمي:\nhttps://wa7m.com" });
                        break;
                }
            } 
            // 3. الرد الترحيبي أو الذكاء الاصطناعي للرسائل العادية
            else if (body.length > 0) {
                // إذا أرسل كلمة ترحيب بسيطة أو رسالة قصيرة، نوجهه للأوامر
                const greetings = ['هلا', 'مرحبا', 'السلام', 'هاي', 'الو', 'البوت'];
                const isGreeting = greetings.some(g => body.toLowerCase().includes(g));

                if (isGreeting) {
                    const welcome = `يا هلا بك يا ${senderName}! أنا مساعد محمد الذكي. 🛡️\n\nللاطلاع على خدماتي، يرجى إرسال كلمة:\n*( .اوامر )*\n\nأو يمكنك سؤالي عن أي شيء وسأجيبك فوراً. 😊`;
                    await sock.sendMessage(from, { text: welcome });
                } else {
                    // السوالف العادية تروح للذكاء الاصطناعي
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
                { role: "system", content: "أنت مساعد محمد، ذكاء اصطناعي ودود ومحترم جداً. المطور هو محمد صاحب موقع wa7m.com. رد بلهجة سعودية بيضاء محترمة." },
                { role: "user", content: prompt }
            ]
        }, { headers: { 'Authorization': `Bearer ${GROQ_API_KEY}` } });

        const aiText = res.data.choices[0].message.content;
        const msg = `⚠️ *تنبيه:* لاتقلق، أنا الذكاء الاصطناعي "مساعد محمد" حين لا يكون موجوداً. سأرسل له إشعاراً الآن برسالتك وسيرد عليك في أقرب وقت ممكن. 😊\n\n━━━━━━━━━━━━━━\n${aiText}`;
        await sock.sendMessage(from, { text: msg });
    } catch (e) { console.log("AI Offline"); }
}

app.get('/', (req, res) => res.send('🛡️ Wahm System Live'));
app.listen(port, () => {
    startWahmBot();
    setInterval(() => { axios.get(`https://bot-1q3m.onrender.com/`).catch(() => {}); }, 60000);
});

