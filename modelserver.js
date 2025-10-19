// modelserver.js
const https = require('https');
const fs = require('fs');
const path = require('path');
const express = require('express');

const app = express();

// 1️⃣ 静态资源

// 2️⃣ 添加 COEP/COOP + CORS
app.use((req, res, next) => {
  res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Access-Control-Allow-Origin", "https://myebook.asia:3000");
  next();
});

// 2️⃣ 静态资源
app.use(express.static(path.resolve(__dirname)));

// 3️⃣ 启动 HTTPS
https.createServer({
  key: fs.readFileSync('/home/chenyang/ebook/Flipbook/cert/key.pem'),
  cert: fs.readFileSync('/home/chenyang/ebook/Flipbook/cert/cert.pem')
}, app).listen(8000, () => {
  console.log("HTTPS model server running on port 8000");
});

