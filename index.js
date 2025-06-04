const express = require("express");
const fetch = require("node-fetch");
const TelegramBot = require("node-telegram-bot-api");

const token = "8155132969:AAHLBJs-5J0giI8icdDXTc8Xg1jGgjsF8q8";
const admin = "5708790879";
const DATABASE_URL = "https://rehan-image-bot-default-rtdb.firebaseio.com";
const WEBHOOK_URL = "https://rehan-image-bot.vercel.app/";

const bot = new TelegramBot(token, { webHook: { port: false } });
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

async function getTotalUsers() {
  const url = `${DATABASE_URL}/users.json`;
  const res = await fetch(url);
  const data = await res.json();
  return data ? Object.keys(data).length : 0;
}

async function getUserData(userId) {
  const url = `${DATABASE_URL}/users/${userId}.json`;
  const res = await fetch(url);
  return await res.json();
}

app.post("/", async (req, res) => {
  const update = req.body;
  bot.processUpdate(update);

  const msg = update.message;
  if (!msg) return res.end("OK");

  const chatId = msg.chat.id;
  const user = msg.from;
  const text = msg.text;

  if (text === "/start") {
    const userUrl = `${DATABASE_URL}/users/${user.id}.json`;
    const response = await fetch(userUrl);
    const exists = await response.json();

    const welcomeText = `Hello ${user.first_name}, How are you?\n\nClick the button to see more.`;
    await bot.sendMessage(chatId, welcomeText, {
      reply_markup: {
        keyboard: [["💰 Balance", "🔑 Redeem Code"]],
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

  else if (text === "💰 Balance") {
    const userData = await getUserData(user.id);
    const balanceText =
      `\n\n👤 Name: ${userData.first_name}\n` +
      `🆔 User ID: ${userData.id}\n` +
      `💰 Balance: ₹${userData.balance}\n\n` +
      `🤖 Bot by Rehan Ahmad`;
    await bot.sendMessage(chatId, balanceText);
  }

  else if (text === "🔑 Redeem Code") {
    await bot.sendMessage(chatId, "💳 Enter the code you wish to redeem:");
  }

  else if (text === "/admin" && user.id == admin) {
    adminFlow = { step: null, targetId: null };
    await bot.sendMessage(chatId, "Choose an option:", {
      reply_markup: {
        keyboard: [["➕ Add Balance", "➖ Remove Balance", "💳 Create Code"], ["⬅ Back"]],
        resize_keyboard: true
      }
    });
  }

  else if (text === "➕ Add Balance" && user.id == admin) {
    adminFlow.step = "awaiting_user_id";
    await bot.sendMessage(chatId, "🔹 Send the User ID to add balance:");
  }

  else if (text === "➖ Remove Balance" && user.id == admin) {
    adminFlow.step = "awaiting_remove_user_id";
    await bot.sendMessage(chatId, "🔹 Send the User ID to remove balance:");
  }

  else if (text === "💳 Create Code" && user.id == admin) {
    adminFlow.step = "awaiting_total_redeem";
    await bot.sendMessage(chatId, "🔸 Enter total number of users for the redeem code:");
  }

  else if (adminFlow.step === "awaiting_user_id" && user.id == admin) {
    adminFlow.targetId = text;
    adminFlow.step = "awaiting_amount";
    await bot.sendMessage(chatId, "💸 Now enter the amount to add:");
  }

  else if (adminFlow.step === "awaiting_remove_user_id" && user.id == admin) {
    adminFlow.targetId = text;
    adminFlow.step = "awaiting_remove_amount";
    await bot.sendMessage(chatId, "💸 Now enter the amount to remove:");
  }

  else if (adminFlow.step === "awaiting_total_redeem" && user.id == admin) {
    adminFlow.totalRedeem = parseInt(text);
    adminFlow.step = "awaiting_code_amount";
    await bot.sendMessage(chatId, "💸 Now enter the amount to split across users:");
  }

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

    await bot.sendMessage(chatId, `✅ Successfully added ₹${amount} to User ID: ${adminFlow.targetId}`);
    await bot.sendMessage(adminFlow.targetId, `🎉 Admin increased your balance by ₹${amount}\n💰 New Balance: ₹${newBalance}`);

    adminFlow = { step: null, targetId: null };
  }

  else if (adminFlow.step === "awaiting_remove_amount" && user.id == admin) {
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

    const newBalance = (parseFloat(userData.balance) || 0) - amount;

    if (newBalance < 0) {
      return await bot.sendMessage(chatId, "❌ Not enough balance to remove.");
    }

    await fetch(userUrl, {
      method: "PATCH",
      body: JSON.stringify({ balance: newBalance }),
      headers: { "Content-Type": "application/json" }
    });

    await bot.sendMessage(chatId, `✅ Successfully removed ₹${amount} from User ID: ${adminFlow.targetId}`);
    await bot.sendMessage(adminFlow.targetId, `🎉 Admin removed ₹${amount} from your balance.\n💰 New Balance: ₹${newBalance}`);

    adminFlow = { step: null, targetId: null };
  }

  else if (adminFlow.step === "awaiting_code_amount" && user.id == admin) {
    const amount = parseFloat(text);
    if (isNaN(amount)) {
      return await bot.sendMessage(chatId, "❌ Invalid amount. Try again.");
    }

    const code = `CODE_${Date.now()}`;
    adminFlow.code = code;
    const perUserAmount = amount / adminFlow.totalRedeem;
    await bot.sendMessage(chatId, `🎉 Code: ${code}\n💸 Amount per user: ₹${perUserAmount.toFixed(2)}\n💳 Share this code with your users!`);

    const redeemCodeUrl = `${DATABASE_URL}/redeem_codes/${code}.json`;
    await fetch(redeemCodeUrl, {
      method: "PUT",
      body: JSON.stringify({
        code: code,
        amount: perUserAmount,
        total_users: adminFlow.totalRedeem
      }),
      headers: { "Content-Type": "application/json" }
    });

    adminFlow = { step: null, targetId: null };
  }

  // ✅ REDEEM CODE - BLOCK MULTIPLE REDEEMS
  else if (text.startsWith("CODE_") && user.id != admin) {
    const redeemCodeUrl = `${DATABASE_URL}/redeem_codes/${text}.json`;
    const resCode = await fetch(redeemCodeUrl);
    const codeData = await resCode.json();

    if (!codeData) {
      return await bot.sendMessage(chatId, "❌ Invalid code. Please try again.");
    }

    const userData = await getUserData(user.id);

    if (userData.redeemed && userData.redeemed[text]) {
      return await bot.sendMessage(chatId, "⚠️ You have already redeemed this code.");
    }

    const newBalance = (userData.balance || 0) + codeData.amount;

    const updatedUserData = {
      balance: newBalance,
      redeemed: {
        ...(userData.redeemed || {}),
        [text]: true
      }
    };

    await fetch(`${DATABASE_URL}/users/${user.id}.json`, {
      method: "PATCH",
      body: JSON.stringify(updatedUserData),
      headers: { "Content-Type": "application/json" }
    });

    await bot.sendMessage(admin, `📝 User ${user.first_name} redeemed code ${text}. Amount: ₹${codeData.amount}`);
    await bot.sendMessage(chatId, `🎉 Code redeemed! ₹${codeData.amount} added to your balance.\n💰 New Balance: ₹${newBalance}`);
  }

  res.end("OK");
});

app.get("/", (req, res) => {
  res.send("Bot is live ✅");
});

module.exports = app;
