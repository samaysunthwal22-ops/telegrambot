const express = require("express");
const https = require("https");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const GAMEBOOST_API_KEY = process.env.GAMEBOOST_API_KEY;

const sessions = {};

// ---------- HELPERS ----------

function telegramRequest(method, payload, callback) {
  const data = JSON.stringify(payload);

  const options = {
    hostname: "api.telegram.org",
    path: `/bot${BOT_TOKEN}/${method}`,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(data),
    },
  };

  const req = https.request(options, (res) => {
    let body = "";
    res.on("data", (chunk) => (body += chunk));
    res.on("end", () => {
      if (callback) callback(null, body);
    });
  });

  req.on("error", (err) => {
    if (callback) callback(err, null);
  });

  req.write(data);
  req.end();
}

function sendMessage(text, chatId = CHAT_ID) {
  telegramRequest("sendMessage", {
    chat_id: chatId,
    text,
  });
}

function getSession(chatId) {
  if (!sessions[chatId]) {
    sessions[chatId] = {
      raikaTitle: "",
      raikaStatsText: "",
      photos: [],
      email: "",
      password: "",
      pending: null,
      parsed: {},
    };
  }
  return sessions[chatId];
}

function parseRaikaStats(text) {
  const getNum = (label) => {
    const regex = new RegExp(`${label}:\\s*(\\d+)`, "i");
    const match = text.match(regex);
    return match ? parseInt(match[1], 10) : 0;
  };

  return {
    accountLevel: getNum("Account Level"),
    outfits: getNum("Outfits"),
    backpacks: getNum("Backpacks"),
    pickaxes: getNum("Pickaxes"),
    dances: getNum("Dances"),
    gliders: getNum("Gliders"),
    wraps: getNum("Wraps"),
    banners: getNum("Banners"),
    sprays: getNum("Sprays"),
    exclusives: getNum("Exclusives"),
  };
}

function extractPlatform(rawTitle) {
  if (!rawTitle) return "PC";
  if (rawTitle.includes("[PC]")) return "PC";
  if (rawTitle.toLowerCase().includes("playstation")) return "PlayStation";
  if (rawTitle.toLowerCase().includes("xbox")) return "Xbox";
  if (rawTitle.toLowerCase().includes("switch")) return "Switch";
  if (rawTitle.toLowerCase().includes("android")) return "Android";
  if (rawTitle.toLowerCase().includes("ios")) return "iOS";
  return "PC";
}

function extractVBucks(rawTitle) {
  const match = rawTitle.match(/(\d+)\s*VB/i);
  return match ? parseInt(match[1], 10) : 0;
}

function buildGeneratedTitle(session) {
  const p = session.parsed;
  const raw = session.raikaTitle || "";

  let label = "";
  if (p.exclusives >= 20) {
    label = "💎 ULTRA RARE 💎 | ";
  } else if (p.outfits >= 100) {
    label = "👑 STACKED 👑 | ";
  } else {
    label = "🔥 Fortnite Account 🔥 | ";
  }

  const highlights = [];

  const knownNames = [
    "IKONIK",
    "Glow",
    "The Reaper",
    "Elite Agent",
    "Gold Brutus",
    "Gold Midas",
    "Master Chief",
    "Omega",
    "Sub Commander",
    "Galaxy",
    "Black Knight",
    "Travis Scott",
  ];

  for (const name of knownNames) {
    if (raw.toLowerCase().includes(name.toLowerCase())) {
      highlights.push(name);
    }
  }

  const vbucks = extractVBucks(raw);

  let title = `${label}💥 ${p.outfits || 0} Skins`;

  if (highlights.length) {
    title += " | " + highlights.slice(0, 8).join(" | ");
  }

  if (vbucks > 0) {
    title += ` | 💰 ${vbucks} VB`;
  }

  return title;
}

function buildDescription(session) {
  const p = session.parsed;

  return `🔑 EMAIL CHANGEABLE & LINKABLE TO XBOX • PSN • SWITCH • iOS • ANDROID • PC 🔑

🎁 When You Purchase This Offer, You Will Receive 🎁
➕ Account Info (Email / Password / Backup Code if available)
➕ Step-by-step Guide on How to Log In
➕ Tips & Rules on How to Use the Account Safely
➕ Pro Tips on How to Secure Your Account

⸻

✅ IMPORTANT
• ❗ All sales are final. No refunds if you change your mind or simply don’t like the account after purchase.
• 🔐 The details provided are for Epic Games and Email access only.
• ⚠️ DO NOT contact Epic Games support — buying/selling accounts is against their ToS and may lead to account bans. If the account is locked due to contacting support, no refund or replacement will be provided.

⸻

📊 ACCOUNT STATS
• Account Level: ${p.accountLevel || 0}
• Outfits: ${p.outfits || 0}
• Backpacks: ${p.backpacks || 0}
• Pickaxes: ${p.pickaxes || 0}
• Dances: ${p.dances || 0}
• Gliders: ${p.gliders || 0}
• Wraps: ${p.wraps || 0}
• Banners: ${p.banners || 0}
• Sprays: ${p.sprays || 0}
• Exclusives: ${p.exclusives || 0}`;
}

function buildDump(session) {
  const raw = (session.raikaTitle || "").toLowerCase();

  const parts = [
    "fortnite",
    "account",
    "full access",
    "battle royale",
    `${session.parsed.outfits || 0} skins`,
    `${session.parsed.exclusives || 0} exclusives`,
  ];

  if (raw.includes("ikonik")) parts.push("ikonik");
  if (raw.includes("the reaper")) parts.push("the reaper");
  if (raw.includes("elite agent")) parts.push("elite agent");
  if (raw.includes("gold midas")) parts.push("gold midas");
  if (raw.includes("gold brutus")) parts.push("gold brutus");
  if (raw.includes("master chief")) parts.push("master chief");
  if (raw.includes("omega")) parts.push("omega");
  if (session.parsed.exclusives >= 20) parts.push("ultra rare", "stacked", "og account");

  return parts.join(" ");
}

function createGameBoostListing(session, price, chatId) {
  const platform = extractPlatform(session.raikaTitle);
  const vbucks = extractVBucks(session.raikaTitle);

  const accountTags = ["Battle Royale"];
  if (session.parsed.exclusives >= 20) accountTags.push("OG Account", "Stacked");

  const payload = {
    game: "fortnite",
    title: buildGeneratedTitle(session),
    price: parseFloat(price),
    login: session.email,
    password: session.password,
    delivery_time: {
      duration: 5,
      unit: "minutes",
    },
    description: buildDescription(session),
    dump: buildDump(session),
    delivery_instructions: "Login details will be delivered after purchase. Please secure the account immediately after receiving it.",
    account_data: {
      platform,
      linkable_platforms: ["PC", "PlayStation", "Xbox", "Android", "iOS", "Switch"],
      account_tags: accountTags,
      outfits_count: session.parsed.outfits || 0,
      emotes_count: session.parsed.dances || 0,
      pickaxes_count: session.parsed.pickaxes || 0,
      backblings_count: session.parsed.backpacks || 0,
      gliders_count: session.parsed.gliders || 0,
      wraps_count: session.parsed.wraps || 0,
      loadings_count: 0,
      sprays_count: session.parsed.sprays || 0,
      account_level: session.parsed.accountLevel || 0,
      v_bucks_count: vbucks,
    },
  };

  const data = JSON.stringify(payload);

  const options = {
    hostname: "api.gameboost.com",
    path: "/v2/account-offers",
    method: "POST",
    headers: {
      Authorization: `Bearer ${GAMEBOOST_API_KEY}`,
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(data),
    },
  };

  const req = https.request(options, (res) => {
    let body = "";

    res.on("data", (chunk) => {
      body += chunk;
    });

    res.on("end", () => {
      let parsed;
      try {
        parsed = JSON.parse(body);
      } catch {
        parsed = { raw: body };
      }

      if (res.statusCode >= 200 && res.statusCode < 300) {
        sendMessage(
          `✅ Listing created successfully!

Title:
${payload.title}

Price: $${price}
Platform: ${platform}
Photos stored in bot: ${session.photos.length}

GameBoost Response:
${JSON.stringify(parsed).slice(0, 1200)}`,
          chatId
        );
      } else {
        sendMessage(
          `❌ Listing failed.

Status: ${res.statusCode}
Response:
${JSON.stringify(parsed).slice(0, 1500)}`,
          chatId
        );
      }
    });
  });

  req.on("error", (err) => {
    sendMessage(`❌ API error: ${err.message}`, chatId);
  });

  req.write(data);
  req.end();
}

// ---------- TELEGRAM WEBHOOK ----------

app.post("/webhooks/telegram", (req, res) => {
  const chatId = req.body.message?.chat?.id;
  const text = req.body.message?.text;
  const photo = req.body.message?.photo;

  if (!chatId) {
    return res.sendStatus(200);
  }

  const session = getSession(chatId);

  // store photos
  if (photo && photo.length) {
    const largest = photo[photo.length - 1];
    session.photos.push(largest.file_id);
    sendMessage(`🖼 Screenshot saved. Total screenshots stored: ${session.photos.length}`, chatId);
    return res.sendStatus(200);
  }

  if (!text) {
    return res.sendStatus(200);
  }

  // /start
  if (text === "/start") {
    sendMessage(
      `🚀 GameBoost Seller Bot Ready

Workflow:
1. Send Raika title text
2. Send Raika stats text
3. Send Raika screenshots
4. /pass
5. /post

Commands:
/pass
/post
/reset
/show`,
      chatId
    );
    return res.sendStatus(200);
  }

  // /reset
  if (text === "/reset") {
    sessions[chatId] = {
      raikaTitle: "",
      raikaStatsText: "",
      photos: [],
      email: "",
      password: "",
      pending: null,
      parsed: {},
    };
    sendMessage("♻️ Current draft reset.", chatId);
    return res.sendStatus(200);
  }

  // /show
  if (text === "/show") {
    sendMessage(
      `📦 Current Draft

Raika title:
${session.raikaTitle || "Not set"}

Email:
${session.email || "Not set"}

Password:
${session.password ? "Saved" : "Not set"}

Photos stored:
${session.photos.length}

Parsed stats:
${JSON.stringify(session.parsed, null, 2)}`,
      chatId
    );
    return res.sendStatus(200);
  }

  // /pass flow
  if (text === "/pass") {
    session.pending = "awaiting_email";
    sendMessage("📧 Please send email/login", chatId);
    return res.sendStatus(200);
  }

  if (session.pending === "awaiting_email") {
    session.email = text.trim();
    session.pending = "awaiting_password";
    sendMessage("🔐 Please send password", chatId);
    return res.sendStatus(200);
  }

  if (session.pending === "awaiting_password") {
    session.password = text.trim();
    session.pending = null;
    sendMessage("✅ Email and password saved.", chatId);
    return res.sendStatus(200);
  }

  // /post flow
  if (text === "/post") {
    if (!session.raikaStatsText) {
      sendMessage("❌ First send Raika stats text.", chatId);
      return res.sendStatus(200);
    }
    if (!session.email || !session.password) {
      sendMessage("❌ First use /pass and save email/password.", chatId);
      return res.sendStatus(200);
    }
    session.pending = "awaiting_price";
    sendMessage("💰 Please tell the price", chatId);
    return res.sendStatus(200);
  }

  if (session.pending === "awaiting_price") {
    const price = parseFloat(text.trim());

    if (isNaN(price)) {
      sendMessage("❌ Invalid price. Send only a number, like: 149", chatId);
      return res.sendStatus(200);
    }

    session.pending = null;
    sendMessage("📦 Creating GameBoost listing...", chatId);
    createGameBoostListing(session, price, chatId);
    return res.sendStatus(200);
  }

  // auto-detect Raika title
  if (text.startsWith("[PC]") || text.startsWith("[Xbox]") || text.startsWith("[PlayStation]")) {
    session.raikaTitle = text.trim();
    sendMessage("🏷 Raika title saved.", chatId);
    return res.sendStatus(200);
  }

  // auto-detect Raika stats block
  if (text.includes("Outfits:") && text.includes("Backpacks:") && text.includes("Pickaxes:")) {
    session.raikaStatsText = text;
    session.parsed = parseRaikaStats(text);
    sendMessage(
      `📊 Raika stats saved.

Parsed:
Outfits: ${session.parsed.outfits}
Backpacks: ${session.parsed.backpacks}
Pickaxes: ${session.parsed.pickaxes}
Dances: ${session.parsed.dances}
Gliders: ${session.parsed.gliders}
Wraps: ${session.parsed.wraps}
Banners: ${session.parsed.banners}
Sprays: ${session.parsed.sprays}
Exclusives: ${session.parsed.exclusives}
Account Level: ${session.parsed.accountLevel}`,
      chatId
    );
    return res.sendStatus(200);
  }

  sendMessage("ℹ️ I saved nothing from that message. Send Raika title, Raika stats, screenshots, /pass, or /post.", chatId);
  return res.sendStatus(200);
});

// ---------- GAMEBOOST WEBHOOK ----------

app.post("/webhooks/gameboost", (req, res) => {
  const event = req.body;

  let message = "📦 GameBoost Event";

  if (event.type === "order.created") {
    message =
`🛒 NEW ORDER

Buyer: ${event?.data?.buyer_username || "Unknown"}
Product: ${event?.data?.title || "Unknown"}
Price: $${event?.data?.price || "Unknown"}`;
  }

  if (event.type === "message.created") {
    message =
`💬 BUYER MESSAGE

From: ${event?.data?.sender || "Unknown"}
Message: ${event?.data?.message || "No message text"}`;
  }

  if (event.type === "order.completed") {
    message =
`💰 ORDER COMPLETED

Product: ${event?.data?.title || "Unknown"}
Amount: $${event?.data?.price || "Unknown"}`;
  }

  sendMessage(message);
  res.sendStatus(200);
});

// ---------- ROOT ----------

app.get("/", (req, res) => {
  res.send("GameBoost bot running");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  sendMessage("🚀 Bot deployed successfully");
});
