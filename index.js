/**
 * بوت وهم الذكي (wa7m.com)
 * المطور: Wahm (@ymn_x17)
 * المحرك: Baileys (مجاني 100% بدون UltraMsg)
 */

const { default: makeWASocket, useMultiFileAuthState, disconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const axios = require('axios');
const fs = require('fs');

const GROQ_API_KEY = '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';

async function startWahmBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    const sock = makeWASocket({
        printQRInTerminal: true, // بيطلع لك الـ QR في سجلات Render
        auth: state,
        browser: ["Wahm Bot", "Safari", "1.0.0"]
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
            console.log('--- SCAN THIS QR CODE WITH WHATSAPP ---');
            // ملاحظة: في Render المجاني قد تحتاج لفتح الرابط لمشاهدة الـ QR بوضوح
        }
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== disconnectReason.loggedOut;
            if (shouldReconnect) startWahmBot();
        } else if (connection === 'open') {
            console.log('🛡️ Wahm Bot is Online & Connected!');
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;

        const from = m.key.remoteJid;
        const body = m.message.conversation || m.message.extendedJsonMessage?.text || m.message.extendedTextMessage?.text || "";
        const input = body.toLowerCase();

        // 1. بحث وتحميل صوت
        if (input.startsWith('شغل ') || input.startsWith('صوت ')) {
            const query = body.split(' ').slice(1).join(' ');
            await sock.sendMessage(from, { text: `🔍 أبشر يا وهم، جاري البحث عن: ${query}` });
            
            try {
                const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
                const { data: html } = await axios.get(searchUrl);
                const videoId = html.match(/"videoId":"([^"]+)"/)[1];
                const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
                
                const apiRes = await axios.get(`https://api.phimtat.vn/snapvideo/json.php?url=${encodeURIComponent(videoUrl)}`);
                const downloadUrl = apiRes.data.url || apiRes.data.links[0].url;

                if (downloadUrl) {
                    await sock.sendMessage(from, { 
                        audio: { url: downloadUrl }, 
                        mimetype: 'audio/mp4',
                        caption: `🎶 تم الجلب من wa7m.com`
                    });
                }
            } catch (e) {
                await sock.sendMessage(from, { text: "⚠️ تعذر التحميل حالياً." });
            }
        } 
        // 2. ذكاء اصطناعي
        else if (body) {
            const aiReply = await askGroq(body);
            await sock.sendMessage(from, { text: aiReply });
        }
    });
}

async function askGroq(text) {
    try {
        const res = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
            model: "llama-3.3-70b-versatile",
            messages: [{ role: "system", content: "أنت وهم، مطور wa7m.com. رد بلهجة سعودية." }, { role: "user", content: text }]
        }, { headers: { 'Authorization': `Bearer ${GROQ_API_KEY}` } });
        return res.data.choices[0].message.content;
    } catch (e) { return "هلا بك.. السيرفر مشغول."; }
}

startWahmBot();
// تشغيل سيرفر وهمي لـ Render عشان ما يقفل التطبيق
const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('Bot Active'));
app.listen(process.env.PORT || 3000);

