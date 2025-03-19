"use strict";

const express = require('express');
const fileUpload = require('express-fileupload');
const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
const app = express();
const port = process.env.PORT || 3000;

// Переменные окружения
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = '-1002502923348'; // ID чата или канала Telegram
const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;

if (!BOT_TOKEN || !ASSEMBLYAI_API_KEY) {
  console.error("Необходимые переменные окружения не заданы!");
  process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN);

// Middleware
app.use(fileUpload({
  limits: { fileSize: 10 * 1024 * 1024 } // Ограничение размера файла 10MB
}));
app.use(express.static('public'));

// Эндпоинт для транскрипции аудио
app.post('/transcribe', async (req, res) => {
  if (!req.files || !req.files.audio) {
    return res.status(400).json({ error: 'Файл не найден' });
  }

  const audio = req.files.audio;
  console.log('Получен аудиофайл:', audio.name);

  try {
    // Загрузка аудио на AssemblyAI
    const uploadResponse = await axios.post(
      'https://api.assemblyai.com/v2/upload',
      audio.data,
      {
        headers: {
          'authorization': ASSEMBLYAI_API_KEY,
          'content-type': 'application/octet-stream'
        }
      }
    );
    const audioUrl = uploadResponse.data.upload_url;

    // Запрос на транскрипцию
    const transcribeResponse = await axios.post(
      'https://api.assemblyai.com/v2/transcript',
      { audio_url: audioUrl, language_code: 'ru' },
      {
        headers: {
          'authorization': ASSEMBLYAI_API_KEY,
          'content-type': 'application/json'
        }
      }
    );

    const transcriptId = transcribeResponse.data.id;
    const resultUrl = `https://api.assemblyai.com/v2/transcript/${transcriptId}`;

    // Функция для опроса статуса транскрипции
    async function pollTranscriptStatus() {
      try {
        const resultResponse = await axios.get(resultUrl, {
          headers: { 'authorization': ASSEMBLYAI_API_KEY }
        });
        return resultResponse.data;
      } catch (error) {
        throw new Error('Ошибка при опросе статуса транскрипции');
      }
    }

    // Рекурсивный polling с использованием setTimeout
    const poll = async () => {
      let transcriptData = await pollTranscriptStatus();
      if (transcriptData.status === 'completed') {
        return transcriptData;
      } else if (transcriptData.status === 'error') {
        throw new Error('Ошибка транскрибации');
      } else {
        await new Promise(resolve => setTimeout(resolve, 5000));
        return poll();
      }
    };

    const transcriptData = await poll();
    const text = transcriptData.text;
    res.json({ text });

    // Отправка результата в Telegram
    const now = new Date();
    const dateTime = now.toLocaleString('ru-RU');
    const message = `${dateTime}\n${text}`;
    bot.sendMessage(CHAT_ID, message).catch(err => {
      console.error("Ошибка отправки в Telegram:", err.message);
    });
  } catch (error) {
    console.error('Ошибка при транскрибации:', error.message);
    res.status(500).json({ error: 'Ошибка при транскрибации' });
  }
});

// Запуск сервера
app.listen(port, () => {
  console.log(`Сервер запущен на порту ${port}`);
});
