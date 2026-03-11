const express = require("express");
const https = require("https");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const token = process.env.BOT_TOKEN;
const chat_id = process.env.CHAT_ID;

// Send message to Telegram
function sendMessage(text) {
  if (!token || !chat_id) {
    console.log("Missing BOT_TOKEN or CHAT_ID");
    return;
  }

  const url =
    `https://api.telegram.org/bot${token}/sendMessage?chat_id=${chat_id}&text=${encodeURIComponent(text)}`;

  https
    .get(url, (res) => {
      console.log("Telegram status:", res.statusCode);
    })
    .on("error", (err) => {
      console.log("Telegram error:", err.message);
    });
}

// Generic GET request to GameBoost
function gameboostGet(path, callback) {
  const apiKey = process.env.GAMEBOOST_API_KEY;

  if (!apiKey) {
    callback(new Error("Missing GAMEBOOST_API_KEY"), null);
    return;
  }

  const options = {
    hostname: "api.gameboost.com",
    path: path,
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  };

  const request = https.request(options, (response) => {
    let data = "";

    response.on("data", (chunk) => {
      data += chunk;
    });

    response.on("end", () => {
      try {
        const parsed = JSON.parse(data);
        callback(null, parsed);
      } catch (error) {
        callback(new Error("Invalid JSON response: " + data), null);
      }
    });
  });

  request.on("error", (error) => {
    callback(error, null);
  });

  request.end();
}

// Home route
app.get("/", (req, res) => {
  res.send("Telegram bot is running");
});

// Health check
app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

// Get Fortnite account offer template
app.get("/gameboost/template/fortnite", (req, res) => {
  gameboostGet("/v2/account-offers/templates/fortnite", (error, data) => {
    if (error) {
      console.log("Template fetch error:", error.message);
      return res.status(500).json({ error: error.message });
    }

    res.json(data);
  });
});

// GameBoost webhook
app.post("/webhooks/gameboost", (req, res) => {
  try {
    const event = req.body;

    console.log("GameBoost Event:", JSON.stringify(event, null, 2));

    let message = "📦 GameBoost Event Received";

    if (event && event.type === "order.created") {
      message =
        `🛒 NEW ORDER\n\n` +
        `Buyer: ${event?.data?.buyer_username || "Unknown"}\n` +
        `Product: ${event?.data?.title || "Unknown"}\n` +
        `Price: $${event?.data?.price || "Unknown"}`;
    } else if (event && event.type === "message.created") {
      message =
        `💬 NEW BUYER MESSAGE\n\n` +
        `From: ${event?.data?.sender || "Unknown"}\n` +
        `Message: ${event?.data?.message || "No message text"}`;
    } else if (event && event.type === "order.completed") {
      message =
        `💰 ORDER COMPLETED\n\n` +
        `Product: ${event?.data?.title || "Unknown"}\n` +
        `Amount: $${event?.data?.price || "Unknown"}`;
    } else if (event && event.type) {
      message = `📦 GameBoost Event\nType: ${event.type}`;
    }

    sendMessage(message);

    res.status(200).send("ok");
  } catch (error) {
    console.log("Webhook error:", error.message);
    res.status(500).send("error");
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  sendMessage("🚀 Bot deployed successfully on Render!");
});
