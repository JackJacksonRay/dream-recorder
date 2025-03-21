"use strict";

require("dotenv").config(); // Для загрузки переменных окружения из .env, если требуется
const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const multer = require("multer");
const fs = require("fs");

// Настраиваем multer для сохранения файлов во временную папку
const upload = multer({ dest: "uploads/" });
const app = express();

// Чтение переменных окружения (на Render задаются в настройках сервиса)
const token = process.env.BOT_TOKEN;
const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;
const DEFAULT_CHAT_ID = "-1002502923348"; // общий канал, если userId не пришёл

if (!token || !ASSEMBLYAI_API_KEY) {
  console.error("Ошибка: BOT_TOKEN или ASSEMBLYAI_API_KEY не заданы в переменных окружения!");
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: false });

// Функция-заглушка для транскрибации (замените на вашу реальную интеграцию AssemblyAI)
function transcribeAudio(filePath) {
  // Здесь должна быть ваша логика транскрибации, например, вызов AssemblyAI API
  return "Это пример транскрибированного текста";
}

// Middleware для обработки form-data (multer уже занимается файлами)
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static("public"));

// Эндпоинт для транскрипции аудио
app.post("/transcribe", upload.single("audio"), (req, res) => {
  const audioFile = req.file; // Файл, загруженный через multer
  const userId = req.body.userId; // Telegram ID, переданный из клиента

  console.log("Получен аудиофайл:", audioFile?.originalname);
  console.log("Получен userId:", userId);

  // Если нет файла или userId, возвращаем ошибку
  if (!audioFile || !userId) {
    return res.status(400).json({ error: "Аудиофайл или userId отсутствуют" });
  }

  // Транскрибируем аудио (здесь можно интегрировать AssemblyAI)
  const transcribedText = transcribeAudio(audioFile.path);
  const now = new Date();
  const dateTime = now.toLocaleString("ru-RU");
  const message = `${dateTime}\n${transcribedText}`;

  // Отправляем сообщение пользователю через Telegram
  bot
    .sendMessage(userId, message)
    .then(() => {
      console.log(`Сообщение отправлено пользователю ${userId}`);
      // Удаляем временный файл
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
