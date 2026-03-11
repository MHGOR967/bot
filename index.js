/**
 * بوت وهم الذكي (wa7m.com)
 * المطور: Wahm (@ymn_x17)
 * المميزات: تحميل صوتيات + ذكاء اصطناعي + تحميل من الروابط
 * البيئة: Node.js (Render)
 */

const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

// --- إعداداتك الخاصة (قم بتعبئتها) ---
const INSTANCE_ID = 'instanceXXXX'; // ايدي النسخة من UltraMsg
const TOKEN = 'yourTokenXXXX';       // التوكن من UltraMsg
const GROQ_API_KEY = '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';

const PORT = process.env.PORT || 3000;

// 1. استقبال الرسائل من الـ Webhook
app.post('/webhook', async (req, res) => {
    try {
        const data = req.body.data;
        
        // تجاهل الرسائل لو كانت فارغة أو مرسلة منك شخصياً
        if (!data || data.fromMe) return res.sendStatus(200);

        const from = data.from;
        const body = data.body ? data.body.trim() : "";
        const input = body.toLowerCase();

        console.log(`[New Message] from ${from}: ${body}`);

        // أ. إذا أرسل رابط مباشر (TikTok, Insta, YT)
        if (isValidUrl(body)) {
            await handleDirectDownload(from, body);
        }
        // ب. إذا طلب بحث عن أغنية (شغل .. أو صوت ..)
        else if (input.startsWith('شغل ') || input.startsWith('صوت ') || input.startsWith('اغنية ')) {
            const query = body.split(' ').slice(1).join(' ');
            await handleYoutubeSearch(from, query);
        }
        // ج. الدردشة بالذكاء الاصطناعي (Groq)
        else if (body.length > 0) {
            const aiReply = await askGroq(body);
            await sendText(from, aiReply);
        }

    } catch (error) {
        console.error("Webhook Error:", error.message);
    }
    res.sendStatus(200);
});

// دالة البحث في يوتيوب والتحميل عبر API SnapVideo
async function handleYoutubeSearch(to, query) {
    try {
        await sendText(to, `🔍 أبشر يا وهم، جاري البحث عن: ${query}...`);
        
        // البحث عن الفيديو
        const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
        const { data: html } = await axios.get(searchUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const videoIdMatch = html.match(/"videoId":"([^"]+)"/);

        if (videoIdMatch) {
            const videoUrl = `https://www.youtube.com/watch?v=${videoIdMatch[1]}`;
            await handleDirectDownload(to, videoUrl, query);
        } else {
            await sendText(to, "❌ معليش، ما لقيت شي بهذا الاسم.");
        }
    } catch (e) {
        await sendText(to, "⚠️ حدث خطأ أثناء البحث.");
    }
}

// دالة التحميل المباشر باستخدام الـ API المفضل لديك
async function handleDirectDownload(to, url, query = "الملف المطلوب") {
    try {
        const apiRes = await axios.get(`https://api.phimtat.vn/snapvideo/json.php?url=${encodeURIComponent(url)}`);
        // استخراج الرابط من JSON (يدعم صيغ مختلفة للرد)
        const downloadUrl = apiRes.data.url || (apiRes.data.links && apiRes.data.links[0].url);

        if (downloadUrl) {
            await sendAudio(to, downloadUrl, `🎶 تم التجهيز لعيونك من wa7m.com\n📌: ${query}`);
        } else {
            await sendText(to, "⚠️ السيرفر رفض استخراج الرابط، جرب مقطع آخر.");
        }
    } catch (e) {
        await sendText(to, "❌ فشل التحميل، الرابط قد يكون محمياً.");
    }
}

// دالة الذكاء الاصطناعي Groq (Llama 3.3)
async function askGroq(text) {
    try {
        const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
            model: "llama-3.3-70b-versatile",
            messages: [
                { role: "system", content: "أنت وهم (Wahm)، مطور موقع wa7m.com. رد بلهجة سعودية تقنية فخمة ومختصرة. ساعد المستخدمين في تحميل المقاطع." },
                { role: "user", content: text }
            ]
        }, {
            headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' }
        });
        return response.data.choices[0].message.content;
    } catch (e) {
        return "هلا بك يا وهم.. السيرفر مضغوط شوي، اطلب اللي تبي.";
    }
}

// دوال الإرسال عبر UltraMsg
async function sendText(to, text) {
    return axios.post(`https://api.ultramsg.com/${INSTANCE_ID}/messages/chat`, { token: TOKEN, to, body: text });
}

async function sendAudio(to, audio, caption) {
    return axios.post(`https://api.ultramsg.com/${INSTANCE_ID}/messages/audio`, { token: TOKEN, to, audio, caption });
}

function isValidUrl(string) {
    try { new URL(string); return true; } catch (_) { return false; }
}

app.get('/', (req, res) => res.send('🛡️ Wahm Bot is Active!'));
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));

