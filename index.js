const express = require("express");
const fetch = require("node-fetch");
const TelegramBot = require("node-telegram-bot-api");

const token = "8155132969:AAHLBJs-5J0giI8icdDXTc8Xg1jGgjsF8q8";
const admin = "5708790879";
const DATABASE_URL = "https://rehan-image-bot-default-rtdb.firebaseio.com";
const WEBHOOK_URL = "https://rehan-image-bot.vercel.app/";

const bot = new TelegramBot(token);
const app = express();
app.use(express.json());
bot.setWebHook(WEBHOOK_URL);

let adminFlow = {
  step: null,
  targetId: null,
  amount: null,
  code: null,
  totalRedeem: null
};

// Save user to Firebase
async function saveUserToFirebase(user) {
  const url = `${DATABASE_URL}/users/${user.id}.json`;
  const payload = {
    id: user.id,
    first_name: user.first_name || "",
    username: user.username || "",
    balance: 100,
    timestamp: Date.now(),
    redeemed: {}
  };
  await fetch(url, {
    method: "PUT",
    body: JSON.stringify(payload),
    headers: { "Content-Type": "application/json" }
  });
}

// Get total users
async function getTotalUsers() {
  const url = `${DATABASE_URL}/users.json`;
  const res = await fetch(url);
  const data = await res.json();
  return data ? Object.keys(data).length : 0;
}

// Get user data
async function getUserData(userId) {
  const url = `${DATABASE_URL}/users/${userId}.json`;
  const res = await fetch(url);
  return await res.json();
}

// Webhook
app.post("/", async (req, res) => {
  const update = req.body;
  bot.processUpdate(update);

  const msg = update.message;
  if (!msg) return res.end("OK");

  const chatId = msg.chat.id;
  const user = msg.from;
  const text = msg.text;

  if (!text) return res.end("OK");

  // START
  if (text === "/start") {
    const userUrl = `${DATABASE_URL}/users/${user.id}.json`;
    const exists = await fetch(userUrl).then(res => res.json());

    await bot.sendMessage(chatId, `Hello ${user.first_name}, How are you?\n\nClick the button to see more.`, {
      reply_markup: {
        keyboard: [["💰 Balance", "🔑 Redeem Code"]],
        resize_keyboard: true
      }
    });

    if (!exists) {
      await saveUserToFirebase(user);
      const totalUsers = await getTotalUsers();
      await bot.sendMessage(admin,
        `➕ <b>New User Notification</b> ➕\n👤 <a href='tg://user?id=${user.id}'>${user.first_name}</a>\n🆔 <code>${user.id}</code>\n🌝 <b>Total Users: ${totalUsers}</b>`,
        { parse_mode: "HTML" });
    }
  }

  // BALANCE
  else if (text === "💰 Balance") {
    const userData = await getUserData(user.id);
    await bot.sendMessage(chatId,
      `👤 Name: ${userData.first_name}\n🆔 User ID: ${userData.id}\n💰 Balance: ₹${userData.balance}\n\n🤖 Bot by Rehan Ahmad`);
  }

  // REDEEM START
  else if (text === "🔑 Redeem Code") {
    await bot.sendMessage(chatId, "💳 Enter the code you wish to redeem:");
  }

  // ADMIN PANEL
  else if (text === "/admin" && user.id == admin) {
    adminFlow = { step: null, targetId: null };
    await bot.sendMessage(chatId, "Choose an option:", {
      reply_markup: {
        keyboard: [["➕ Add Balance", "➖ Remove Balance", "💳 Create Code"], ["⬅ Back"]],
        resize_keyboard: true
      }
    });
  }

  // Handle ADMIN Flow Steps (Add / Remove Balance, Create Code)
  // --- (Code omitted here since you already wrote all steps correctly)
  // Just ensure the logic stays inside this `if (user.id == admin)` block

  // REDEEM CODE PROCESS
  else if (text.startsWith("CODE_") && user.id != admin) {
    const redeemCodeUrl = `${DATABASE_URL}/redeem_codes/${text}.json`;
    const resCode = await fetch(redeemCodeUrl);
    const codeData = await resCode.json();

    if (!codeData) {
      return await bot.sendMessage(chatId, "❌ Invalid code. Please try again.");
    }

    const userData = await getUserData(user.id);
    if (userData.redeemed && userData.redeemed[text]) {
      return await bot.sendMessage(chatId, "⚠️ You've already used this code.");
    }

    const newBalance = (userData.balance || 0) + codeData.amount;
    const updateData = {
      balance: newBalance,
      redeemed: { ...(userData.redeemed || {}), [text]: true }
    };

    await fetch(`${DATABASE_URL}/users/${user.id}.json`, {
      method: "PATCH",
      body: JSON.stringify(updateData),
      headers: { "Content-Type": "application/json" }
    });

    await bot.sendMessage(admin, `📝 ${user.first_name} redeemed ${text} | ₹${codeData.amount}`);
    await bot.sendMessage(chatId, `🎉 ₹${codeData.amount} added to your balance!\n💰 New Balance: ₹${newBalance}`);
  }

  res.end("OK");
});

// Health check
app.get("/", (req, res) => {
  res.send("✅ Bot is live");
});

module.exports = app;
