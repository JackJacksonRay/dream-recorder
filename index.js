"use strict";

require("dotenv").config(); // Если используется .env
const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const multer = require("multer");
const fs = require("fs");

// Настраиваем multer для сохранения файлов во временную папку
const upload = multer({ dest: "uploads/" });
const app = express();

// Чтение переменных окружения (на Render задаются в настройках сервиса)
const token = process.env.BOT_TOKEN;
const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY; // Если интегрируешь AssemblyAI, сюда подставь свой ключ
// Мы не используем fallback – если userId отсутствует, возвращаем ошибку.
if (!token || !ASSEMBLYAI_API_KEY) {
  console.error("Ошибка: BOT_TOKEN или ASSEMBLYAI_API_KEY не заданы в переменных окружения!");
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: false });

// Функция-заглушка для транскрибации (замени на реальную логику, например, вызов AssemblyAI)
function transcribeAudio(filePath) {
  // Здесь должна быть твоя интеграция AssemblyAI (например, HTTP-запрос с использованием axios)
  return "Это пример транскрибированного текста";
}

// Middleware для обработки form-data
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static("public"));

// Эндпоинт для транскрипции аудио
app.post("/transcribe", upload.single("audio"), (req, res) => {
  const audioFile = req.file; // Файл, загруженный через multer
  const userId = req.body.userId; // Telegram User ID, переданный из клиента

  console.log("Получен аудиофайл:", audioFile?.originalname);
  console.log("Получен userId:", userId);

  // Если нет файла или userId, возвращаем ошибку
  if (!audioFile || !userId || userId.trim() === "") {
    return res.status(400).json({ error: "Аудиофайл или Telegram User ID отсутствуют. Убедитесь, что вы нажали «Start» в чате с ботом." });
  }

  // Транскрибируем аудио (здесь интегрируй AssemblyAI, если нужно)
  const transcribedText = transcribeAudio(audioFile.path);
  const now = new Date();
  const dateTime = now.toLocaleString("ru-RU");
  const message = `${dateTime}\n${transcribedText}`;

  // Отправляем сообщение пользователю через Telegram
  bot.sendMessage(userId, message)
    .then(() => {
      console.log(`Сообщение отправлено пользователю ${userId}`);
      // Удаляем временный файл после обработки
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
