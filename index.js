"use strict";

require("dotenv").config();
const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const multer = require("multer");
const fs = require("fs");

// Настраиваем multer для временного хранения файлов
const upload = multer({ dest: "uploads/" });
const app = express();

// Чтение переменных окружения (на Render задаются в настройках)
const token = process.env.BOT_TOKEN;
const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY; // Если планируешь интегрировать AssemblyAI
if (!token || !ASSEMBLYAI_API_KEY) {
  console.error("Ошибка: BOT_TOKEN или ASSEMBLYAI_API_KEY не заданы!");
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: false });

// Функция-заглушка для транскрибации (замени на реальную интеграцию)
function transcribeAudio(filePath) {
  // Здесь должна быть интеграция с AssemblyAI API или другой сервис транскрипции
  return "Это пример транскрибированного текста";
}

// Middleware для обработки form-data
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static("public"));

// Эндпоинт для транскрипции аудио
app.post("/transcribe", upload.single("audio"), (req, res) => {
  const audioFile = req.file;
  const userId = req.body.userId; // Telegram User ID, переданный из клиента

  console.log("Получен аудиофайл:", audioFile?.originalname);
  console.log("Получен userId:", userId);

  // Если файл или userId отсутствуют, возвращаем ошибку
  if (!audioFile || !userId || userId.trim() === "") {
    return res.status(400).json({ error: "Аудиофайл или Telegram User ID отсутствуют. Убедитесь, что вы нажали «Start» в чате с ботом." });
  }

  const transcribedText = transcribeAudio(audioFile.path);
  const now = new Date();
  const dateTime = now.toLocaleString("ru-RU");
  const message = `${dateTime}\n${transcribedText}`;

  // Отправляем сообщение пользователю через Telegram
  bot.sendMessage(userId, message)
    .then(() => {
      console.log(`Сообщение отправлено пользователю ${userId}`);
      fs.unlink(audioFile.path, (err) => {
        if (err) console.error("Ошибка удаления файла:", err);
      });
      res.json({ text: transcribedText });
    })
    .catch((error) => {
      console.error(`Ошибка отправки пользователю ${userId}:`, error);
      res.status(500).json({ error: "Ошибка отправки сообщения" });
    });
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});
