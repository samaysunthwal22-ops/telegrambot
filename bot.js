const express = require("express");
const https = require("https");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const token = process.env.BOT_TOKEN;
const chat_id = process.env.CHAT_ID;

// Function to send Telegram message
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

// Root route
app.get("/", (req, res) => {
  res.send("Telegram bot is running");
});

// Health check
app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

// GameBoost webhook endpoint
app.post("/webhooks/gameboost", (req, res) => {

  const event = req.body;

  console.log("GameBoost Event:", event);

  let message = "📦 GameBoost Event";

  if(event.type === "order.created"){
    message =
`🛒 NEW ORDER

Buyer: ${event.data.buyer_username}
Product: ${event.data.title}
Price: $${event.data.price}`;
  }

  if(event.type === "message.created"){
    message =
`💬 NEW BUYER MESSAGE

From: ${event.data.sender}
Message: ${event.data.message}`;
  }

  if(event.type === "order.completed"){
    message =
`💰 ORDER COMPLETED

Product: ${event.data.title}
Amount: $${event.data.price}`;
  }

  sendMessage(message);

  res.status(200).send("ok");

});
