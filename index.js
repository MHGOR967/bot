/**
 * بوت وهم الذكي (wa7m.com)
 * المطور: Wahm (@ymn_x17)
 * ميزة: الربط بكود نصي (Pairing Code) بدلاً من QR
 */

const { default: makeWASocket, useMultiFileAuthState, delay, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const axios = require('axios');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;
const GROQ_API_KEY = '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';

// --- ضع رقم جوالك هنا مع مفتاح الدولة (مثلاً 966500000000) ---
const PHONE_NUMBER = '966XXXXXXXXX'; 

async function startWahmBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: 'silent' }),
        auth: state,
        browser: ["Ubuntu", "Chrome", "20.0.04"],
    });

    // ميزة الربط بالكود النصي للجوال
    if (!sock.authState.creds.registered) {
        if (!PHONE_NUMBER || PHONE_NUMBER === '966XXXXXXXXX') {
            console.log("❌ خطأ: لازم تحط رقم جوالك في الكود (السطر 16) عشان يرسل لك كود الربط!");
        } else {
            await delay(5000); // انتظر قليلاً لين يشتغل السيرفر
            const code = await sock.requestPairingCode(PHONE_NUMBER);
            console.log(`\n\n[!!!] كود الربط الخاص بك هو: ${code}\n\n`);
            console.log("افتح واتساب > الأجهزة المرتبطة > ربط جهاز > الربط برقم الهاتف ودخل الكود أعلاه.");
        }
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection } = update;
        if (connection === 'open') console.log('🛡️ Wahm Bot is Online!');
        if (connection === 'close') startWahmBot();
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;
        const from = m.key.remoteJid;
        const body = m.message.conversation || m.message.extendedTextMessage?.text || "";

        if (body.toLowerCase().startsWith('شغل ')) {
            const query = body.split(' ').slice(1).join(' ');
            await handleMedia(sock, from, query);
        } else {
            const reply = await askGroq(body);
            await sock.sendMessage(from, { text: reply });
        }
    });
}

async function handleMedia(sock, to, query) {
    try {
        const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
        const { data: html } = await axios.get(searchUrl);
        const videoId = html.match(/"videoId":"([^"]+)"/)[1];
        const apiRes = await axios.get(`https://api.phimtat.vn/snapvideo/json.php?url=https://www.youtube.com/watch?v=${videoId}`);
        const dlUrl = apiRes.data.url || apiRes.data.links[0].url;
        await sock.sendMessage(to, { audio: { url: dlUrl }, mimetype: 'audio/mp4' });
    } catch (e) {
        await sock.sendMessage(to, { text: "⚠️ ما قدرت أحمله حالياً." });
    }
}

async function askGroq(text) {
    try {
        const res = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
            model: "llama-3.3-70b-versatile",
            messages: [{ role: "system", content: "أنت وهم، مطور wa7m.com." }, { role: "user", content: text }]
        }, { headers: { 'Authorization': `Bearer ${GROQ_API_KEY}` } });
        return res.data.choices[0].message.content;
    } catch (e) { return "النظام مشغول.."; }
}

startWahmBot();
app.get('/', (req, res) => res.send('Active'));
app.listen(PORT);

