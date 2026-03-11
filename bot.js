const express = require("express");
const https = require("https");

const app = express();
const PORT = process.env.PORT || 3000;

const token = process.env.BOT_TOKEN;
const chat_id = process.env.CHAT_ID;

function sendMessage(text) {
  if (!token || !chat_id) {
    console.log("Missing BOT_TOKEN or CHAT_ID");
    return;
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage?chat_id=${chat_id}&text=${encodeURIComponent(text)}`;
  https.get(url, (res) => {
    console.log("Telegram status:", res.statusCode);
  }).on("error", (err) => {
    console.log("Telegram error:", err.message);
  });
}

app.get("/", (req, res) => {
  res.send("Telegram bot is running");
});

app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  sendMessage("🚀 Bot deployed successfully on Render!");
});
