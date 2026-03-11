/**
 * 🤖 مساعد محمد الشخصي (wa7m.com)
 * نسخة الاستقرار المطلق ومعالجة الأخطاء الذكية
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

const app = express();
const port = process.env.PORT || 3000;
const GROQ_API_KEY = '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';

// إحصائيات النظام
let statusInfo = {
    status: "جاري بدء التشغيل",
    uptime: new Date().toLocaleString('ar-SA', { timeZone: 'Asia/Riyadh' }),
    processed: 0
};

// --- قائمة الأوامر بتنسيق راقٍ ---
const helpMenu = (name) => `
✨ *أهلاً بك يا ${name}* ✨
أنا *مساعد محمد* الذكي، أتشرف بخدمتك. 🛡️

📌 *قائمة الخدمات المتاحة:*
━━━━━━━━━━━━━━
🎵 *.شغل* [اسم المقطع]
🤖 *.ذكاء* [سؤالك]
🕌 *.آية* | *.دعاء*
📱 *.مطور* (معلومات التواصل)
🌍 *.موقع* (wa7m.com)
━━━━━━━━━━━━━━
💡 *تنبيه:* يمكنك التحدث معي مباشرة وسأفهمك بكل ود واحترام. 😊
`;

async function startWahmBot() {
    try {
        const { state, saveCreds } = await useMultiFileAuthState('./session_wahm');
        const { version } = await fetchLatestBaileysVersion();

        const sock = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            auth: state,
            browser: Browsers.macOS('Desktop'),
            printQRInTerminal: false,
            connectTimeoutMs: 60000, // مهلة اتصال طويلة للثبات
            defaultQueryTimeoutMs: 0,
            keepAliveIntervalMs: 10000 // الحفاظ على "نبض" الاتصال
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect } = update;
            if (connection === 'close') {
                statusInfo.status = "منقطع - جاري المحاولة";
                const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
                if (reason !== disconnectReason.loggedOut) {
                    console.log(`📡 انقطع الاتصال (السبب: ${reason})، إعادة التشغيل بعد 5 ثوانٍ...`);
                    setTimeout(startWahmBot, 5000);
                }
            } else if (connection === 'open') {
                statusInfo.status = "متصل وشغال ✅";
                console.log('✅ مساعد محمد متصل ومستقر الآن!');
            }
        });

        sock.ev.on('messages.upsert', async ({ messages }) => {
            // نظام Error Handling شامل لكل رسالة لضمان عدم تعليق البوت
            try {
                const m = messages[0];
                if (!m.message || m.key.fromMe) return;

                const from = m.key.remoteJid;
                const senderName = m.pushName || "ضيفنا العزيز";
                const body = m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || "";
                statusInfo.processed++;

                // الرد على الصوتيات
                if (m.message.audioMessage) {
                    return await sock.sendMessage(from, { text: `تحية طيبة يا ${senderName}.. أعتذر منك بشدة، أنا مساعد محمد ولا أستطيع سماع البصمات الصوتية حالياً. 🎙️\n\nفضلاً، اكتب طلبك نصياً وسأخدمك فوراً. 😊` });
                }

                if (body.startsWith('.')) {
                    const args = body.slice(1).trim().split(/ +/);
                    const command = args.shift().toLowerCase();
                    const text = args.join(' ');

                    switch(command) {
                        case 'اوامر':
                            await sock.sendMessage(from, { text: helpMenu(senderName) });
                            break;
                        
                        case 'شغل':
                            if (!text) return sock.sendMessage(from, { text: "يرجى كتابة اسم المقطع بعد الأمر ( .شغل ) 🎵" });
                            await sock.sendMessage(from, { text: "⏳ جاري البحث والتحميل لموقع wa7m.com..." });
                            try {
                                const s = await axios.get(`https://api.vreden.my.id/api/ytsearch?query=${encodeURIComponent(text)}`, { timeout: 10000 });
                                const v = s.data.result[0];
                                const d = await axios.get(`https://api.vreden.my.id/api/ytmp3?url=${encodeURIComponent(v.url)}`, { timeout: 15000 });
                                await sock.sendMessage(from, { audio: { url: d.data.result.download.url }, mimetype: 'audio/mp4' });
                            } catch (e) { 
                                await sock.sendMessage(from, { text: "نعتذر، محرك التحميل لا يستجيب حالياً، يرجى المحاولة لاحقاً." }); 
                            }
                            break;

                        case 'مطور':
                            await sock.sendMessage(from, { text: `👤 *معلومات المطور محمد:* \n\n• انستقرام: https://instagram.com/ymn_x17 \n• واتساب احتياطي: https://wa.me/967730349682 \n• الموقع: wa7m.com \n\nتشرفنا بك! ✨` });
                            break;

                        case 'آية':
                            try {
                                const q = await axios.get('https://api.alquran.cloud/v1/ayah/random');
                                await sock.sendMessage(from, { text: `﴿${q.data.data.text}﴾ \n[سورة ${q.data.data.surah.name}]` });
                            } catch (e) {}
                            break;

                        case 'موقع':
                            await sock.sendMessage(from, { text: "🌐 تفضل بزيارة موقعنا الرسمي: https://wa7m.com" });
                            break;
                    }
                } else if (body.length > 0) {
                    // التوجيه للأوامر عند الترحيب
                    const greetings = ['هلا', 'مرحبا', 'السلام', 'هاي'];
                    if (greetings.some(g => body.toLowerCase().includes(g))) {
                        await sock.sendMessage(from, { text: `يا هلا بك يا ${senderName}! أنا مساعد محمد الذكي. 🛡️\n\nللاطلاع على خدماتي، يرجى إرسال كلمة:\n*( .اوامر )*` });
                    } else {
                        await handleAI(sock, from, body);
                    }
                }
            } catch (err) {
                console.error("Internal Message Error:", err.message);
            }
        });

    } catch (criticalErr) {
        console.error("Critical Startup Error:", criticalErr.message);
        setTimeout(startWahmBot, 10000);
    }
}

// دالة الذكاء الاصطناعي المنفصلة مع Timeout
async function handleAI(sock, from, prompt) {
    try {
        const res = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
            model: "llama-3.3-70b-versatile",
            messages: [
                { role: "system", content: "أنت مساعد محمد، ذكاء اصطناعي محترم جداً وودود. المطور هو محمد صاحب موقع wa7m.com. رد بلهجة سعودية بيضاء محترمة." },
                { role: "user", content: prompt }
            ]
        }, { 
            headers: { 'Authorization': `Bearer ${GROQ_API_KEY}` },
            timeout: 12000 // مهلة 12 ثانية فقط للرد لضمان عدم التعليق
        });

        const aiText = res.data.choices[0].message.content;
        const finalMsg = `⚠️ *تنبيه:* لاتقلق، أنا الذكاء الاصطناعي "مساعد محمد" حين لا يكون موجوداً. سأرسل له إشعاراً الآن برسالتك وسيرد عليك في أقرب وقت. 😊\n\n━━━━━━━━━━━━━━\n${aiText}`;
        await sock.sendMessage(from, { text: finalMsg });
    } catch (e) {
        console.log("AI process skipped or timed out to save resources.");
    }
}

// واجهة الويب لـ Render و Cron-Job
app.get('/', (req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`
        <div style="font-family: sans-serif; text-align: center; padding: 50px; background: #f0f2f5; min-height: 100vh;">
            <div style="background: white; display: inline-block; padding: 30px; border-radius: 15px; box-shadow: 0 5px 15px rgba(0,0,0,0.1);">
                <h1 style="color: #1a73e8;">🛡️ مساعد محمد - الحالة المستقرة</h1>
                <p>الحالة: <strong>${statusInfo.status}</strong></p>
                <p>تاريخ التشغيل: <strong>${statusInfo.uptime}</strong></p>
                <p>الرسائل المعالجة: <strong>${statusInfo.processed}</strong></p>
                <hr>
                <p style="color: #5f6368;">النظام يعمل بكفاءة على wa7m.com</p>
            </div>
        </div>
    `);
});

app.listen(port, () => {
    startWahmBot();
    // Self-ping داخلي إضافي
    setInterval(() => {
        axios.get(`http://localhost:${port}`).catch(() => {});
    }, 45000);
});

