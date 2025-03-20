"use strict";

const express = require("express");
const fileUpload = require("express-fileupload");
const axios = require("axios");
const TelegramBot = require("node-telegram-bot-api");
const app = express();
const port = process.env.PORT || 3000;

// Чтение переменных окружения (на Render задаём их в настройках сервиса)
const BOT_TOKEN = process.env.BOT_TOKEN; // Токен от @BotFather
const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY; // API Key от AssemblyAI
// Если в запросе передан userId, будем отправлять сообщение пользователю, иначе – в общий канал
const DEFAULT_CHAT_ID = "-1002502923348";

if (!BOT_TOKEN || !ASSEMBLYAI_API_KEY) {
  console.error("Необходимые переменные окружения не заданы!");
  process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN);

// Middleware
app.use(
  fileUpload({
    limits: { fileSize: 10 * 1024 * 1024 }, // Ограничение ~10MB
  })
);
app.use(express.static("public"));

// Для чтения дополнительных полей, кроме файлов
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Эндпоинт для транскрипции аудио
app.post("/transcribe", async (req, res) => {
  if (!req.files || !req.files.audio) {
    return res.status(400).json({ error: "Файл не найден" });
  }

  const audio = req.files.audio;
  console.log("Получен аудиофайл:", audio.name);

  // Если передан userId из клиента, используем его
  const userId = req.body.userId;

  try {
    // 1. Загрузка аудио на AssemblyAI
    const uploadResponse = await axios.post(
      "https://api.assemblyai.com/v2/upload",
      audio.data,
      {
        headers: {
          authorization: ASSEMBLYAI_API_KEY,
          "content-type": "application/octet-stream",
        },
      }
    );
    const audioUrl = uploadResponse.data.upload_url;

    // 2. Запрос на транскрипцию
    const transcribeResponse = await axios.post(
      "https://api.assemblyai.com/v2/transcript",
      { audio_url: audioUrl, language_code: "ru" },
      {
        headers: {
          authorization: ASSEMBLYAI_API_KEY,
          "content-type": "application/json",
        },
      }
    );

    const transcriptId = transcribeResponse.data.id;
    const resultUrl = `https://api.assemblyai.com/v2/transcript/${transcriptId}`;

    // Функция для опроса статуса
    async function pollTranscriptStatus() {
      try {
        const resultResponse = await axios.get(resultUrl, {
          headers: { authorization: ASSEMBLYAI_API_KEY },
        });
        return resultResponse.data;
      } catch (error) {
        throw new Error("Ошибка при опросе статуса транскрипции");
      }
    }

    // Рекурсивный polling через setTimeout
    const poll = async () => {
      const transcriptData = await pollTranscriptStatus();
      if (transcriptData.status === "completed") {
        return transcriptData;
      } else if (transcriptData.status === "error") {
        throw new Error("Ошибка транскрибации");
      } else {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        return poll();
      }
    };

    const transcriptData = await poll();
    const text = transcriptData.text;
    res.json({ text });

    // 3. Отправка результата транскрипции
    const now = new Date();
    const dateTime = now.toLocaleString("ru-RU");
    const message = `${dateTime}\n${text}`;

    // Если передан userId, отправляем лично пользователю, иначе в общий чат
    const targetChat = userId || DEFAULT_CHAT_ID;
    bot.sendMessage(targetChat, message).catch((err) => {
      console.error("Ошибка отправки в Telegram:", err.message);
    });
  } catch (error) {
    console.error("Ошибка при транскрибации:", error.message);
    res.status(500).json({ error: "Ошибка при транскрибации" });
  }
});

// Запуск сервера
app.listen(port, () => {
  console.log(`Сервер запущен на порту ${port}`);
});
