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

// Save user to Firebase
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

// Webhook
app.post("/", async (req, res) => {
  const update = req.body;
  bot.processUpdate(update);

  const msg = update.message;
  if (!msg) return res.end("OK");

  const chatId = msg.chat.id;
  const user = msg.from;

  // Start command
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

  // Show balance
  else if (msg.text === "💰 Balance") {
    const userData = await getUserData(user.id);
    const balanceText =
      `\n\n👤 Name: ${userData.first_name}\n` +
      `🆔 User ID: ${userData.id}\n` +
      `💰 Balance: ${userData.balance} coins\n\n` +
      `🤖 Bot by Rehan Ahmad`;
    await bot.sendMessage(chatId, balanceText);
  }

  // Admin Panel
  else if (msg.text === "/admin" && user.id == admin) {
    await bot.sendMessage(chatId, "Choose an option:", {
      reply_markup: {
        keyboard: [["➕ Add Balance", "➖ Remove Balance"], ["⬅ Back"]],
        resize_keyboard: true
      }
    });
  }

  // Add Balance Flow
  else if (msg.text === "➕ Add Balance" && user.id == admin) {
    bot.sendMessage(chatId, "Send User ID to add balance:");
    bot.once("message", async (msg2) => {
      const targetId = msg2.text;
      bot.sendMessage(chatId, "Enter amount to add:");
      bot.once("message", async (msg3) => {
        const amount = parseFloat(msg3.text);
        const userUrl = `${DATABASE_URL}/users/${targetId}.json`;
        const res = await fetch(userUrl);
        const data = await res.json();

        if (!data) {
          await bot.sendMessage(chatId, "❌ User not found.");
          return;
        }

        const newBalance = (parseFloat(data.balance) || 0) + amount;
        await fetch(userUrl, {
          method: "PATCH",
          body: JSON.stringify({ balance: newBalance }),
          headers: { "Content-Type": "application/json" }
        });

        // Notify Admin
        await bot.sendMessage(chatId, `✅ Added ₹${amount} to User ID: ${targetId}`);

        // Notify User
        await bot.sendMessage(targetId, `🎉 Admin increased your balance by ₹${amount}`);
      });
    });
  }

  res.end("OK");
});

// Health check
app.get("/", (req, res) => {
  res.send("Bot is live ✅");
});

module.exports = app;
