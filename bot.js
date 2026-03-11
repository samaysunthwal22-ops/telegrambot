const https = require("https");

const token = process.env.BOT_TOKEN;
const chat_id = process.env.CHAT_ID;

function sendMessage(text) {
  const url = `https://api.telegram.org/bot${token}/sendMessage?chat_id=${chat_id}&text=${encodeURIComponent(text)}`;
  https.get(url);
}

sendMessage("🚀 Bot deployed successfully on Render!");

setInterval(() => {
  console.log("Bot running...");
}, 10000);
