const express = require("express");
const https = require("https");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const GAMEBOOST_API_KEY = process.env.GAMEBOOST_API_KEY;


// send telegram message
function sendMessage(text){
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage?chat_id=${CHAT_ID}&text=${encodeURIComponent(text)}`;
  https.get(url);
}


// create fortnite listing
function createListing(title,price){

  const data = JSON.stringify({
    title:title,
    price:price,
    login:"sample_login",
    password:"sample_password",
    manual:false,
    description:"Fortnite stacked account",
    platform:"PC",

    account_data:{
      account_level:100,
      skins_count:20,
      v_bucks_count:0
    }

  });

  const options = {
    hostname:"api.gameboost.com",
    path:"/v2/account-offers",
    method:"POST",
    headers:{
      "Authorization":`Bearer ${GAMEBOOST_API_KEY}`,
      "Content-Type":"application/json",
      "Content-Length":data.length
    }
  };

  const req = https.request(options,res=>{

    let body="";

    res.on("data",chunk=>{
      body+=chunk;
    });

    res.on("end",()=>{
      sendMessage("✅ Listing created on GameBoost");
    });

  });

  req.write(data);
  req.end();

}


// telegram command webhook
app.post(`/bot${BOT_TOKEN}`, (req,res)=>{

  const message = req.body.message?.text;

  if(!message) return res.sendStatus(200);


  // create listing command
  if(message.startsWith("/list")){

    const parts = message.split(" ");

    const title = parts[1];
    const price = parseFloat(parts[2]);

    createListing(title,price);

    sendMessage("📦 Creating Fortnite listing...");

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

  res.status(200).send("ok");

});


// start server
app.listen(PORT,()=>{

  console.log("Bot running");

  sendMessage("🚀 Bot deployed successfully");

});
