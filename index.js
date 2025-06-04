const express = require("express");
const fetch = require("node-fetch");
const TelegramBot = require("node-telegram-bot-api");

const token = "8155132969:AAHLBJs-5J0giI8icdDXTc8Xg1jGgjsF8q8"; // Your bot token
const admin = "5708790879"; // Your admin ID
const DATABASE_URL = "https://rehan-image-bot-default-rtdb.firebaseio.com"; // Firebase DB
const WEBHOOK_URL = "https://rehan-image-bot.vercel.app/"; // Webhook for Vercel

const bot = new TelegramBot(token, { webHook: { port: false } });
const app = express();
app.use(express.json());
bot.setWebHook(WEBHOOK_URL);

// Store admin flow state
let adminFlow = {
  step: null,
  targetId: null
};

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
  const text = msg.text;

  // START COMMAND
  if (text === "/start") {
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

  // BALANCE CHECK
  else if (text === "💰 Balance") {
    const userData = await getUserData(user.id);
    const balanceText =
      `\n\n👤 Name: ${userData.first_name}\n` +
      `🆔 User ID: ${userData.id}\n` +
      `💰 Balance: ₹${userData.balance}\n\n` +
      `🤖 Bot by Rehan Ahmad`;
    await bot.sendMessage(chatId, balanceText);
  }

  // ADMIN PANEL
  else if (text === "/admin" && user.id == admin) {
    adminFlow = { step: null, targetId: null };
    await bot.sendMessage(chatId, "Choose an option:", {
      reply_markup: {
        keyboard: [["➕ Add Balance", "➖ Remove Balance"], ["⬅ Back"]],
        resize_keyboard: true
      }
    });
  }

  // ADD BALANCE - STEP 1
  else if (text === "➕ Add Balance" && user.id == admin) {
    adminFlow.step = "awaiting_user_id";
    await bot.sendMessage(chatId, "🔹 Send the User ID to add balance:");
  }

  // ADD BALANCE - STEP 2: User ID
  else if (adminFlow.step === "awaiting_user_id" && user.id == admin) {
    adminFlow.targetId = text;
    adminFlow.step = "awaiting_amount";
    await bot.sendMessage(chatId, "💸 Now enter the amount to add:");
  }

  // ADD BALANCE - STEP 3: Amount
  else if (adminFlow.step === "awaiting_amount" && user.id == admin) {
    const amount = parseFloat(text);
    if (isNaN(amount)) {
      return await bot.sendMessage(chatId, "❌ Invalid amount. Try again.");
    }

    const userUrl = `${DATABASE_URL}/users/${adminFlow.targetId}.json`;
    const resUser = await fetch(userUrl);
    const userData = await resUser.json();

    if (!userData) {
      adminFlow = { step: null, targetId: null };
      return await bot.sendMessage(chatId, "❌ User not found.");
    }

    const newBalance = (parseFloat(userData.balance) || 0) + amount;

    await fetch(userUrl, {
      method: "PATCH",
      body: JSON.stringify({ balance: newBalance }),
      headers: { "Content-Type": "application/json" }
    });

    // Notify Admin
    await bot.sendMessage(chatId, `✅ Successfully added ₹${amount} to User ID: ${adminFlow.targetId}`);

    // Notify User
    await bot.sendMessage(adminFlow.targetId, `🎉 Admin increased your balance by ₹${amount}\n💰 New Balance: ₹${newBalance}`);

    // Reset
    adminFlow = { step: null, targetId: null };
  }

  res.end("OK");
});

// Health check
app.get("/", (req, res) => {
  res.send("Bot is live ✅");
});

module.exports = app;
