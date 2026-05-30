const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token);
const app = express();

app.use(cors());
app.use(express.json());

// Подключение к Postgres (Neon)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Обработка вебхука от Telegram
app.post('/api/index', async (req, res) => {
  const { message } = req.body;
  if (message && message.text === '/start') {
    await bot.sendMessage(message.chat.id, "Сыграем?", {
      reply_markup: {
        inline_keyboard: [[{ 
          text: "Начать игру", 
          web_app: { url: process.env.WEB_APP_URL } 
        }]]
      }
    });
  }
  res.sendStatus(200);
});

// API игры: Сохранение результата
app.post('/api/result', async (req, res) => {
  const { userId, username, result } = req.body;
  try {
    const client = await pool.connect();
    const userRes = await client.query('SELECT * FROM users WHERE id = $1', [userId]);
    let { wins, losses, played } = userRes.rows[0] || { wins: 0, losses: 0, played: 0 };
    
    played++;
    if (result === 1) wins++;
    if (result === 2) losses++;

    await client.query(
      'INSERT INTO users (id, username, wins, losses, played) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO UPDATE SET username=$2, wins=$3, losses=$4, played=$5',
      [userId, username || 'Anon', wins, losses, played]
    );
    client.release();
    res.sendStatus(200);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// API игры: Топ-10
app.get('/api/leaderboard', async (req, res) => {
  try {
    const result = await pool.query('SELECT username, wins, losses, played FROM users ORDER BY wins DESC LIMIT 10');
    res.json(result.rows);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

module.exports = app;
