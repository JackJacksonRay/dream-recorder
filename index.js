// Загружаем переменные окружения
require('dotenv').config();

const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const multer = require('multer');
const fs = require('fs').promises;
const axios = require('axios'); // Для интеграции Assembly API, если потребуется

const app = express();

// Настройка multer для временного сохранения аудиофайлов
const upload = multer({ dest: 'uploads/' });

// Читаем токен Telegram-бота
const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error('Ошибка: BOT_TOKEN не задан в переменных окружения!');
  process.exit(1);
}

// Инициализируем Telegram-бота (polling выключен)
const bot = new TelegramBot(BOT_TOKEN, { polling: false });

/**
 * Функция для транскрипции аудио.
 * Сейчас реализована как заглушка.
 * При интеграции Assembly API замените логику внутри на вызов API.
 */
async function transcribeAudio(filePath) {
  // Пример асинхронного вызова Assembly API:
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

// Эндпоинт для приёма аудио и отправки транскрипции в Telegram
app.post('/transcribe', upload.single('audio'), async (req, res) => {
  try {
    const audioFile = req.file;
    const userId = req.body.userId;

    console.log('Получен аудиофайл:', audioFile?.originalname);
    console.log('Получен userId:', userId);

    if (!audioFile || !userId) {
      return res.status(400).json({ error: 'Аудиофайл или userId отсутствуют' });
    }
    
    // Выполняем транскрипцию аудио (заглушка/реализация Assembly)
    const transcribedText = await transcribeAudio(audioFile.path);
    
    // Формируем сообщение с датой и временем
    const timestamp = new Date().toLocaleString();
    const message = `Дата и время: ${timestamp}\nТекст: ${transcribedText}`;

    await bot.sendMessage(userId, message);
    console.log(`Сообщение отправлено пользователю ${userId}`);
    
    // Удаляем временный файл
    await fs.unlink(audioFile.path);

    res.json({ text: transcribedText });
  } catch (error) {
    console.error('Ошибка при обработке транскрипции:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});
