const express = require("express");
const fetch = require("node-fetch");
const TelegramBot = require("node-telegram-bot-api");

const token = "8155132969:AAHLBJs-5J0giI8icdDXTc8Xg1jGgjsF8q8"; // Your bot token
const admin = "5708790879"; // Your admin ID
const DATABASE_URL = "https://rehan-image-bot-default-rtdb.firebaseio.com"; // Firebase Realtime DB
const WEBHOOK_URL = "https://rehan-image-bot.vercel.app/"; // Your Vercel webhook

const bot = new TelegramBot(token, { webHook: { port: false } });
const app = express();
app.use(express.json());
bot.setWebHook(WEBHOOK_URL);

// Save user to Firebase with default balance
async function saveUserToFirebase(user) {
  const url = `${DATABASE_URL}/users/${user.id}.json`;
  const payload = {
    id: user.id,
    first_name: user.first_name || "",
    username: user.username || "",
    balance: 100,
    timestamp: Date.now()
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

// Main webhook endpoint
app.post("/", async (req, res) => {
  const update = req.body;
  bot.processUpdate(update);

  const msg = update.message;
  if (!msg) return res.end("OK");

  const chatId = msg.chat.id;
  const user = msg.from;

  // /start command
  if (msg.text === "/start") {
    const userUrl = `${DATABASE_URL}/users/${user.id}.json`;
    const response = await fetch(userUrl);
    const exists = await response.json();

    const welcomeText = `Hello ${user.first_name}, How are you?\n\nClick the button to see more.`;
    await bot.sendMessage(chatId, welcomeText, {
      reply_markup: {
        keyboard: [["💰 Balance"]],
        resize_keyboard: true
      }
    });

    // New user logic
    if (!exists) {
      await saveUserToFirebase(user);
      const totalUsers = await getTotalUsers();
      const newUserMsg =
        "➕ <b>New User Notification</b> ➕\n\n" +
        `👤<b>User:</b> <a href='tg://user?id=${user.id}'>${user.first_name}</a>\n\n` +
        `🆔<b>User ID:</b> <code>${user.id}</code>\n\n` +
        `🌝 <b>Total Users Count: ${totalUsers}</b>`;
      await bot.sendMessage(admin, newUserMsg, { parse_mode: "HTML" });
    }
  }

  // 💰 Balance button
  else if (msg.text === "💰 Balance") {
    const userData = await getUserData(user.id);
    const balanceText =
      `\n\n👤 Name: ${userData.first_name}\n` +
      `🆔 User ID: ${userData.id}\n` +
      `💰 Balance: ${userData.balance} coins\n\n` +
      `🤖 Bot by Rehan Ahmad`;
    await bot.sendMessage(chatId, balanceText);
  }

  res.end("OK");
});

// Health check
app.get("/", (req, res) => {
  res.send("Bot is live ✅");
});

module.exports = app;
