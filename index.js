"use strict";

// Загружаем переменные окружения (проверь, что в файле .env задан BOT_TOKEN)
require("dotenv").config();

const express = require("express");
const path = require("path");
const TelegramBot = require("node-telegram-bot-api");
const multer = require("multer");
const fs = require("fs").promises;
const axios = require("axios"); // Если потребуется интеграция с внешним сервисом транскрипции

// Создаем экземпляр Express
const app = express();

// Подключаем статику: отдаем файлы из папки public (index.html, styles.css, script.js)
app.use(express.static(path.join(__dirname, "public")));

// Настраиваем multer для временного хранения загруженных аудиофайлов в папке uploads
const upload = multer({ dest: "uploads/" });

// Читаем токен Telegram-бота из переменных окружения
const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error("Ошибка: BOT_TOKEN не задан в переменных окружения!");
  process.exit(1);
}

// Инициализируем Telegram-бота (polling выключен, т.к. используем метод sendMessage)
const bot = new TelegramBot(BOT_TOKEN, { polling: false });

/**
 * Функция транскрипции аудио.
 * Сейчас реализована как заглушка и возвращает тестовый текст.
 * При интеграции Assembly API (или другого сервиса) замените тело функции на вызов API.
 */
async function transcribeAudio(filePath) {
  // Пример интеграции с Assembly API (закомментирован):
  // try {
  //   const response = await axios.post(process.env.ASSEMBLY_API_URL, { filePath }, {
  //     headers: { 'Authorization': `Bearer ${process.env.ASSEMBLY_API_KEY}` }
  //   });
  //   return response.data.transcribedText;
  // } catch (error) {
  //   console.error("Ошибка транскрипции:", error);
  //   throw error;
  // }

  // Заглушка:
  return "Это пример транскрибированного текста";
}

// Эндпоинт для приема аудио и отправки результата транскрипции в Telegram
app.post("/transcribe", upload.single("audio"), async (req, res) => {
  try {
    const audioFile = req.file;          // Получаем загруженный аудиофайл
    const userId = req.body.userId;        // Получаем userId из тела запроса

    console.log("Получен аудиофайл:", audioFile?.originalname);
    console.log("Получен userId:", userId);

    // Если не найден файл или параметр userId, возвращаем ошибку 400
    if (!audioFile || !userId) {
      return res.status(400).json({ error: "Аудиофайл или userId отсутствуют" });
    }

    // Транскрибируем аудиофайл (функция возвращает строку с транскрипцией)
    const transcribedText = await transcribeAudio(audioFile.path);

    // Формируем сообщение с датой, временем и текстом транскрипции
    const timestamp = new Date().toLocaleString();
    const message = `Дата и время: ${timestamp}\nТекст: ${transcribedText}`;

    // Отправляем сообщение пользователю через Telegram бота
    await bot.sendMessage(userId, message);
    console.log(`Сообщение отправлено пользователю ${userId}`);

    // Удаляем временный файл после обработки
    await fs.unlink(audioFile.path);

    // Возвращаем JSON с результатом транскрипции
    res.json({ text: transcribedText });
  } catch (error) {
    console.error("Ошибка при обработке транскрипции:", error);
    res.status(500).json({ error: "Ошибка сервера" });
  }
});

// Запуск сервера на порту, указанном в переменной окружения PORT или 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});

