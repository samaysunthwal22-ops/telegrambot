const express = require("express");
const https = require("https");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const GAMEBOOST_API_KEY = process.env.GAMEBOOST_API_KEY;


// send telegram message
function sendMessage(text){
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage?chat_id=${CHAT_ID}&text=${encodeURIComponent(text)}`;
  https.get(url);
}


// telegram webhook
app.post("/webhooks/telegram",(req,res)=>{

  const msg = req.body.message?.text;

  if(!msg){
    res.sendStatus(200);
    return;
  }

  if(msg.startsWith("/list")){

    sendMessage("📦 Creating listing...");

  }

  res.sendStatus(200);

});


// gameboost webhook
app.post("/webhooks/gameboost",(req,res)=>{

  const event=req.body;

  let message="📦 GameBoost Event";

  if(event.type==="order.created"){

    message=
`🛒 NEW ORDER

Buyer: ${event?.data?.buyer_username}
Product: ${event?.data?.title}
Price: $${event?.data?.price}`;

  }

  if(event.type==="message.created"){

    message=
`💬 BUYER MESSAGE

From: ${event?.data?.sender}
Message: ${event?.data?.message}`;

  }

  if(event.type==="order.completed"){

    message=
`💰 ORDER COMPLETED

Product: ${event?.data?.title}
Amount: $${event?.data?.price}`;

  }

  sendMessage(message);

  res.sendStatus(200);

});


app.listen(PORT,()=>{
  console.log("Server running");
  sendMessage("🚀 Bot deployed successfully");
});
