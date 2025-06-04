// index.js const express = require("express"); const fetch = require("node-fetch"); const TelegramBot = require("node-telegram-bot-api");

const token = "7529372450:AAEvmJlfsbSaS0jA767za_Z4oGSty-cDxkE"; // Replace with your bot token const admin = "5708790879";   // Replace with your admin user ID const DATABASE_URL = "https://rehan-image-bot-default-rtdb.firebaseio.com"; // Replace with your Firebase URL const WEBHOOK_URL = "<your_vercel_deploy_url>/"; // Replace with your Vercel deploy URL

const bot = new TelegramBot(token, { webHook: { port: false } }); const app = express(); app.use(express.json()); bot.setWebHook(WEBHOOK_URL);

async function saveUserToFirebase(user) { const url = ${DATABASE_URL}/users/${user.id}.json; const payload = { id: user.id, first_name: user.first_name || "", username: user.username || "", balance: 100, // Default balance timestamp: Date.now() }; await fetch(url, { method: "PUT", body: JSON.stringify(payload), headers: { "Content-Type": "application/json" } }); }

async function getTotalUsers() { const url = ${DATABASE_URL}/users.json; const res = await fetch(url); const data = await res.json(); return data ? Object.keys(data).length : 0; }

async function getUserData(userId) { const url = ${DATABASE_URL}/users/${userId}.json; const res = await fetch(url); return await res.json(); }

app.post("/", async (req, res) => { const update = req.body; bot.processUpdate(update);

const msg = update.message; if (!msg) return res.end("OK");

const chatId = msg.chat.id; const user = msg.from;

if (msg.text === "/start") { const userUrl = ${DATABASE_URL}/users/${user.id}.json; const response = await fetch(userUrl); const exists = await response.json();

const welcomeText = `Hello ${user.first_name}, How are you?\n\nClick button to see more.`;
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
    "\u2795 <b>New User Notification</b> \u2795\n\n" +
    `\ud83d\udc64<b>User:</b> <a href='tg://user?id=${user.id}'>${user.first_name}</a>\n\n` +
    `\ud83c\udd94<b>User ID:</b> <code>${user.id}</code>\n\n` +
    `\ud83c\udf1d <b>Total Users Count: ${totalUsers}</b>`;

  await bot.sendMessage(admin, newUserMsg, { parse_mode: "HTML" });
}

} else if (msg.text === "💰 Balance") { const userData = await getUserData(user.id); const balanceText = \n\n\u{1F464} Name: ${userData.first_name}\n🆔 User ID: ${userData.id}\n💰 Balance: ${userData.balance} coins\n\n🤖 Bot by Rehan Ahmad; await bot.sendMessage(chatId, balanceText); }

res.end("OK"); });

app.get("/", (req, res) => { res.send("OK"); });

module.exports = app;

                      
