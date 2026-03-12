const { Client, GatewayIntentBits } = require("discord.js");

const { aiSupportReply } = require("./aiSupport");
const { isEscalationMessage } = require("./escalation");
const { activeConversations } = require("./convoManager");
const {
  disableAI,
  escalate,
  getState,
  hasAIHandled,
  markAIHandled,
  hasWelcomed,
  markWelcomed
} = require("./orderState");

const express = require("express");
const https = require("https");
const querystring = require("querystring");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const GAMEBOOST_API_KEY = process.env.GAMEBOOST_API_KEY;
const IMGBB_API_KEY = process.env.IMGBB_API_KEY;

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;

const AUTO_REPLY_TEXT =
  "❤️ Thanks for buying from us! If you need any help, just message here — I will help you within seconds ❤️";

const sessions = {};
const autoRepliedOrders = new Set();

// ---------- GENERIC HELPERS ----------

function httpRequest(options, body = null, callback) {
  const req = https.request(options, (res) => {
    let data = "";
    res.on("data", (chunk) => (data += chunk));
    res.on("end", () => callback(null, res, data));
  });

  req.on("error", (err) => callback(err, null, null));

  if (body) req.write(body);
  req.end();
}

function gbRequest(method, path, payload, callback) {
  const body = payload ? JSON.stringify(payload) : null;

  const options = {
    hostname: "api.gameboost.com",
    path,
    method,
    headers: {
      Authorization: `Bearer ${GAMEBOOST_API_KEY}`,
      "Content-Type": "application/json",
    },
  };

  if (body) {
    options.headers["Content-Length"] = Buffer.byteLength(body);
  }

  httpRequest(options, body, (err, res, raw) => {
    if (err) return callback(err, null, null);

    let parsed;
    try {
      parsed = raw ? JSON.parse(raw) : {};
    } catch {
      parsed = { raw };
    }

    callback(null, res, parsed);
  });
}

function telegramRequest(method, payload, callback) {
  const body = JSON.stringify(payload);

  const options = {
    hostname: "api.telegram.org",
    path: `/bot${BOT_TOKEN}/${method}`,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(body),
    },
  };

  httpRequest(options, body, callback || (() => {}));
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
      imageUrls: [],
      epicLogin: "",
      epicPassword: "",
      emailLogin: "",
      emailPassword: "",
      pending: null,
      parsed: {},
    };
  }
  return sessions[chatId];
}

// ---------- RAIKA PARSING ----------

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
  if (highlights.length) title += " | " + highlights.slice(0, 8).join(" | ");
  if (vbucks > 0) title += ` | 💰 ${vbucks} VB`;

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

// ---------- SCREENSHOT UPLOAD ----------

function getTelegramFilePath(fileId, callback) {
  const options = {
    hostname: "api.telegram.org",
    path: `/bot${BOT_TOKEN}/getFile?file_id=${encodeURIComponent(fileId)}`,
    method: "GET",
  };

  httpRequest(options, null, (err, res, raw) => {
    if (err) return callback(err, null);

    try {
      const parsed = JSON.parse(raw);
      if (parsed.ok && parsed.result && parsed.result.file_path) {
        callback(null, parsed.result.file_path);
      } else {
        callback(new Error("Could not get Telegram file path"), null);
      }
    } catch (e) {
      callback(e, null);
    }
  });
}

function downloadTelegramFileAsBase64(filePath, callback) {
  const options = {
    hostname: "api.telegram.org",
    path: `/file/bot${BOT_TOKEN}/${filePath}`,
    method: "GET",
  };

  const req = https.request(options, (res) => {
    const chunks = [];
    res.on("data", (chunk) => chunks.push(chunk));
    res.on("end", () => {
      try {
        const base64 = Buffer.concat(chunks).toString("base64");
        callback(null, base64);
      } catch (e) {
        callback(e, null);
      }
    });
  });

  req.on("error", (e) => callback(e, null));
  req.end();
}

function uploadBase64ToImgBB(base64Image, callback) {
  const postData = querystring.stringify({
    key: IMGBB_API_KEY,
    image: base64Image,
  });

  const options = {
    hostname: "api.imgbb.com",
    path: "/1/upload",
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Content-Length": Buffer.byteLength(postData),
    },
  };

  httpRequest(options, postData, (err, res, raw) => {
    if (err) return callback(err, null);

    try {
      const parsed = JSON.parse(raw);
      if (parsed.success && parsed.data && parsed.data.url) {
        callback(null, parsed.data.url);
      } else {
        callback(new Error("ImgBB upload failed"), null);
      }
    } catch (e) {
      callback(e, null);
    }
  });
}

function processTelegramPhoto(fileId, chatId, session) {
  if (!IMGBB_API_KEY) {
    sendMessage("❌ Missing IMGBB_API_KEY in Render environment.", chatId);
    return;
  }

  sendMessage("🖼 Uploading screenshot...", chatId);

  getTelegramFilePath(fileId, (err, filePath) => {
    if (err) return sendMessage(`❌ Failed to get file path: ${err.message}`, chatId);

    downloadTelegramFileAsBase64(filePath, (err2, base64Image) => {
      if (err2) return sendMessage(`❌ Failed to download image: ${err2.message}`, chatId);

      uploadBase64ToImgBB(base64Image, (err3, imageUrl) => {
        if (err3) return sendMessage(`❌ ImgBB upload failed: ${err3.message}`, chatId);

        session.photos.push(fileId);
        session.imageUrls.push(imageUrl);

        sendMessage(
          `✅ Screenshot uploaded.\nStored screenshots: ${session.imageUrls.length}`,
          chatId
        );
      });
    });
  });
}

// ---------- GAMEBOOST OFFER + ORDER HELPERS ----------

function listGameBoostOffer(offerId, chatId, callback) {
  gbRequest("POST", `/v2/account-offers/${offerId}/list`, null, (err, res, parsed) => {
    if (err) {
      sendMessage(`❌ Auto-list failed: ${err.message}`, chatId);
      return callback && callback(err);
    }

    if (res.statusCode >= 200 && res.statusCode < 300) {
      sendMessage(
        `🚀 Listing is now LIVE!\n\nOffer ID: ${offerId}`,
        chatId
      );
      return callback && callback(null, parsed);
    }

    sendMessage(
      `⚠️ Offer created but listing failed.\n\nOffer ID: ${offerId}\nStatus: ${res.statusCode}\nResponse:\n${JSON.stringify(parsed).slice(0, 1200)}`,
      chatId
    );
    return callback && callback(new Error("list failed"));
  });
}

function sendOrderMessage(orderId, message, chatId = CHAT_ID, callback) {
  gbRequest(
    "POST",
    `/v2/account-orders/${orderId}/messages`,
    { message },
    (err, res, parsed) => {
      if (err) {
        sendMessage(`❌ Reply failed: ${err.message}`, chatId);
        return callback && callback(err);
      }

      if (res.statusCode >= 200 && res.statusCode < 300) {
        sendMessage(`✅ Reply sent to order ${orderId}`, chatId);
        return callback && callback(null, parsed);
      }

      sendMessage(
        `❌ Reply failed for order ${orderId}\nStatus: ${res.statusCode}\nResponse:\n${JSON.stringify(parsed).slice(0, 1200)}`,
        chatId
      );
      return callback && callback(new Error("reply failed"));
    }
  );
}

function getOrderMessages(orderId, chatId = CHAT_ID) {
  gbRequest("GET", `/v2/account-orders/${orderId}/messages`, null, (err, res, parsed) => {
    if (err) return sendMessage(`❌ Could not fetch messages: ${err.message}`, chatId);

    if (!(res.statusCode >= 200 && res.statusCode < 300)) {
      return sendMessage(
        `❌ Could not fetch messages.\nStatus: ${res.statusCode}\nResponse:\n${JSON.stringify(parsed).slice(0, 1200)}`,
        chatId
      );
    }

    const rows = (parsed.data || []).slice(-8).map((m) => {
      const sender = m?.sender?.username || "unknown";
      const text = m?.text || "";
      return `${sender}: ${text}`;
    });

    sendMessage(
      rows.length ? `💬 Last messages for order ${orderId}\n\n${rows.join("\n\n")}` : `ℹ️ No messages found for order ${orderId}`,
      chatId
    );
  });
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

    // Epic credentials
    login: session.epicLogin,
    password: session.epicPassword,

    // Email credentials
    email_login: session.emailLogin,
    email_password: session.emailPassword,

    delivery_time: {
      duration: 5,
      unit: "minutes",
    },
    description: buildDescription(session),
    dump: buildDump(session),
    delivery_instructions:
      "Login details will be delivered after purchase. Please secure the account immediately after receiving it.",
    image_urls: session.imageUrls,
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

  gbRequest("POST", "/v2/account-offers", payload, (err, res, parsed) => {
    if (err) return sendMessage(`❌ API error: ${err.message}`, chatId);

    if (!(res.statusCode >= 200 && res.statusCode < 300)) {
      return sendMessage(
        `❌ Listing failed.\nStatus: ${res.statusCode}\nResponse:\n${JSON.stringify(parsed).slice(0, 1500)}`,
        chatId
      );
    }

    const offerId = parsed?.data?.id || parsed?.id;

    if (!offerId) {
      return sendMessage(
        `⚠️ Offer created but ID not found.\nResponse:\n${JSON.stringify(parsed).slice(0, 1200)}`,
        chatId
      );
    }

    sendMessage(
      `✅ Offer created.\n\nOffer ID: ${offerId}\nNow auto-listing it live...`,
      chatId
    );

    listGameBoostOffer(offerId, chatId);
  });
}

// ---------- TELEGRAM COMMANDS ----------

app.post("/webhooks/telegram", (req, res) => {
  const chatId = req.body.message?.chat?.id;
  const text = req.body.message?.text;
  const photo = req.body.message?.photo;

  if (!chatId) return res.sendStatus(200);

  const session = getSession(chatId);

  if (photo && photo.length) {
    const largest = photo[photo.length - 1];
    processTelegramPhoto(largest.file_id, chatId, session);
    return res.sendStatus(200);
  }

  if (!text) return res.sendStatus(200);
  // Conversation mode
if (activeConversations[chatId] && !text.startsWith("/")) {
  const orderId = activeConversations[chatId];
  disableAI(orderId);
  sendOrderMessage(orderId, text, chatId);
  return res.sendStatus(200);
}

  if (text === "/start") {
    sendMessage(
      `🚀 GameBoost Seller Bot Ready

Workflow:
1. Send Raika title
2. Send Raika stats
3. Send screenshots
4. /pass
5. /post

Commands:
/pass
/post
/show
/reset
/reply ORDER_ID your message
/messages ORDER_ID
/bal`,
      chatId
    );
    return res.sendStatus(200);
  }

  if (text === "/reset") {
    sessions[chatId] = {
      raikaTitle: "",
      raikaStatsText: "",
      photos: [],
      imageUrls: [],
      epicLogin: "",
      epicPassword: "",
      emailLogin: "",
      emailPassword: "",
      pending: null,
      parsed: {},
    };
    sendMessage("♻️ Current draft reset.", chatId);
    return res.sendStatus(200);
  }

  if (text === "/show") {
    sendMessage(
      `📦 Current Draft

Raika title:
${session.raikaTitle || "Not set"}

Epic login:
${session.epicLogin || "Not set"}

Epic password:
${session.epicPassword ? "Saved" : "Not set"}

Email login:
${session.emailLogin || "Not set"}

Email password:
${session.emailPassword ? "Saved" : "Not set"}

Uploaded screenshots:
${session.imageUrls.length}

Parsed stats:
${JSON.stringify(session.parsed, null, 2)}`,
      chatId
    );
    return res.sendStatus(200);
  }

  if (text === "/bal") {
    sendMessage(
      "ℹ️ /bal is not wired yet. I could not verify a public v2 balance endpoint in the current GameBoost docs, so I left this safe for now.",
      chatId
    );
    return res.sendStatus(200);
  }

  if (text === "/pass") {
    session.pending = "awaiting_epic_login";
    sendMessage("🎮 Please send Epic login", chatId);
    return res.sendStatus(200);
  }

  if (session.pending === "awaiting_epic_login") {
    session.epicLogin = text.trim();
    session.pending = "awaiting_epic_password";
    sendMessage("🔐 Please send Epic password", chatId);
    return res.sendStatus(200);
  }

  if (session.pending === "awaiting_epic_password") {
    session.epicPassword = text.trim();
    session.pending = "awaiting_email_login";
    sendMessage("📧 Please send email login", chatId);
    return res.sendStatus(200);
  }

  if (session.pending === "awaiting_email_login") {
    session.emailLogin = text.trim();
    session.pending = "awaiting_email_password";
    sendMessage("📨 Please send email password", chatId);
    return res.sendStatus(200);
  }

  if (session.pending === "awaiting_email_password") {
    session.emailPassword = text.trim();
    session.pending = null;
    sendMessage("✅ Epic + email credentials saved.", chatId);
    return res.sendStatus(200);
  }

  if (text === "/post") {
    if (!session.raikaStatsText) {
      sendMessage("❌ First send Raika stats text.", chatId);
      return res.sendStatus(200);
    }

    if (!session.epicLogin || !session.epicPassword || !session.emailLogin || !session.emailPassword) {
      sendMessage("❌ First use /pass and save all credentials.", chatId);
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

  if (text.startsWith("/reply ")) {
    const parts = text.split(" ");
    if (parts.length < 3) {
      sendMessage("❌ Usage: /reply ORDER_ID your message", chatId);
      return res.sendStatus(200);
    }

    const orderId = parts[1];
    const message = text.split(" ").slice(2).join(" ");
    sendOrderMessage(orderId, message, chatId);
    return res.sendStatus(200);
  }

  if (text.startsWith("/messages ")) {
    const orderId = text.split(" ")[1];
    if (!orderId) {
      sendMessage("❌ Usage: /messages ORDER_ID", chatId);
      return res.sendStatus(200);
    }
    getOrderMessages(orderId, chatId);
    return res.sendStatus(200);
  } // Start conversation mode
if (text.startsWith("/convo ")) {
  const orderId = text.split(" ")[1];

  if (!orderId) {
    sendMessage("❌ Usage: /convo ORDER_ID", chatId);
    return res.sendStatus(200);
  }

  activeConversations[chatId] = String(orderId);
  disableAI(orderId);

  sendMessage(
    `✅ Conversation mode started for order ${orderId}

Now every normal message you send will go directly to the buyer.
Use /convoend to stop.`,
    chatId
  );

  getOrderMessages(orderId, chatId);
  return res.sendStatus(200);
}

// End conversation mode
if (text === "/convoend") {
  const active = activeConversations[chatId];

  if (!active) {
    sendMessage("ℹ️ No active conversation mode.", chatId);
    return res.sendStatus(200);
  }

  delete activeConversations[chatId];

  sendMessage(`🛑 Conversation mode ended for order ${active}`, chatId);
  return res.sendStatus(200);
}

  if (
    text.startsWith("[PC]") ||
    text.startsWith("[Xbox]") ||
    text.startsWith("[PlayStation]")
  ) {
    session.raikaTitle = text.trim();
    sendMessage("🏷 Raika title saved.", chatId);
    return res.sendStatus(200);
  }

  if (
    text.includes("Outfits:") &&
    text.includes("Backpacks:") &&
    text.includes("Pickaxes:")
  ) {
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

  sendMessage(
    "ℹ️ I saved nothing from that message. Send Raika title, Raika stats, screenshots, /pass, /post, /reply, or /messages.",
    chatId
  );
  return res.sendStatus(200);
});

// ---------- GAMEBOOST WEBHOOK ----------

app.post("/webhooks/gameboost", (req, res) => {
  sendMessage("RAW:\n" + JSON.stringify(req.body).slice(0, 3500));
  const event = req.body || {};
  const type = event.type || "";
  const data = event.data || {};

  const orderId =
    data.id ||
    data.order_id ||
    data.account_order_id ||
    data.accountOrderId;

  if (type === "order.created") {
    sendMessage(
      `🛒 NEW ORDER

Order ID: ${orderId || "Unknown"}
Buyer: ${data?.buyer_username || data?.buyer?.username || "Unknown"}
Product: ${data?.title || "Unknown"}
Price: $${data?.price || "Unknown"}`
    );

    if (orderId && !autoRepliedOrders.has(String(orderId))) {
      autoRepliedOrders.add(String(orderId));
      sendOrderMessage(String(orderId), AUTO_REPLY_TEXT);
    }
  } else if (type === "message.created") {
    sendMessage(
      `💬 BUYER MESSAGE

Order ID: ${orderId || "Unknown"}
From: ${data?.sender?.username || data?.sender || "Unknown"}
Message: ${data?.message || data?.text || "No message text"}`
    );

    if (orderId && !autoRepliedOrders.has(String(orderId))) {
      autoRepliedOrders.add(String(orderId));
      sendOrderMessage(String(orderId), AUTO_REPLY_TEXT);
    }
  } else if (type === "order.completed") {
    sendMessage(
      `💰 ORDER COMPLETED

Order ID: ${orderId || "Unknown"}
Product: ${data?.title || "Unknown"}
Amount: $${data?.price || "Unknown"}`
    );
  } else {
    sendMessage(`📦 GameBoost Event\nType: ${type || "unknown"}`);
  }

  res.sendStatus(200);
});
// ---------- DISCORD LISTENER ----------

const { Client, GatewayIntentBits } = require("discord.js");

const discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

discordClient.on("messageCreate", (message) => {
  if (message.author.bot) return;

  const text = `📦 GameBoost Discord Message

${message.content}`;

  sendMessage(text);
});

discordClient.login(process.env.DISCORD_BOT_TOKEN);
// ---------- DISCORD LISTENER ----------

function extractOrderIdFromDiscordText(text) {
  if (!text) return null;

  const patterns = [
    /order id[:# ]+(\d+)/i,
    /order[:# ]+(\d+)/i,
    /#(\d{4,})/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }

  return null;
}

function extractBuyerMessageFromDiscordText(text) {
  if (!text) return "";

  const messageMatch = text.match(/message[: ]+([\s\S]*)/i);
  if (messageMatch && messageMatch[1]) {
    return messageMatch[1].trim();
  }

  const lines = text.split("\n").map(line => line.trim()).filter(Boolean);
  return lines.length ? lines[lines.length - 1] : text;
}

const discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

discordClient.on("ready", () => {
  sendMessage("🤖 Discord bridge connected successfully.");
});

discordClient.on("messageCreate", (message) => {

  if (message.author.bot) return;
  if (DISCORD_CHANNEL_ID && message.channel.id !== DISCORD_CHANNEL_ID) return;

  const content = message.content || "";

  if (!content) return;

  sendMessage(`📦 GameBoost Discord Update

${content}`);

  const orderId = extractOrderIdFromDiscordText(content);

  if (!orderId) return;

  const orderIdStr = String(orderId);

  if (/new order|order created|purchase/i.test(content) && !hasWelcomed(orderIdStr)) {

    markWelcomed(orderIdStr);

    sendOrderMessage(orderIdStr, AUTO_REPLY_TEXT);

    sendMessage(`🤖 Welcome message sent to order ${orderIdStr}`);

    return;
  }

  if (/buyer message|message:/i.test(content)) {

    const buyerMessage = extractBuyerMessageFromDiscordText(content);

    if (getState(orderIdStr) === "SELLER") return;

    if (isEscalationMessage(buyerMessage)) {

      escalate(orderIdStr);

      sendMessage(`⚠️ ESCALATION REQUIRED

Order ID: ${orderIdStr}

Buyer message:
${buyerMessage}

Seller attention required.`);

      return;
    }

    if (!hasAIHandled(orderIdStr)) {

      const aiReply = aiSupportReply(orderIdStr, buyerMessage);

      if (aiReply) {

        markAIHandled(orderIdStr);

        sendOrderMessage(orderIdStr, aiReply);

        sendMessage(`🤖 AI replied to order ${orderIdStr}`);
      }
    }
  }

});

discordClient.login(DISCORD_BOT_TOKEN);

// ---------- ROOT ----------

app.get("/", (req, res) => {
  res.send("GameBoost bot running");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  sendMessage("🚀 Bot deployed successfully");
});
