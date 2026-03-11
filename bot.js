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


// create fortnite listing
function createListing(title, price, skins){

  const data = JSON.stringify({
    title: title,
    price: parseFloat(price),

    login: "account_login",
    password: "account_password",

    description: `Fortnite account with ${skins} skins`,

    platform: "PC",

    account_data:{
      skins_count: parseInt(skins),
      account_level: 100,
      v_bucks_count: 0
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
      sendMessage("✅ Listing sent to GameBoost");
    });

  });

  req.write(data);
  req.end();

}



// telegram webhook
app.post("/webhooks/telegram",(req,res)=>{

  const text = req.body.message?.text;

  if(!text){
    res.sendStatus(200);
    return;
  }


  if(text.startsWith("/list")){

    const parts = text.split(" ");

    const title = parts[1];
    const price = parts[2];
    const skins = parts[3];

    sendMessage("📦 Creating listing...");

    createListing(title,price,skins);

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
