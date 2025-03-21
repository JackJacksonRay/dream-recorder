require('dotenv').config();
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const fileUpload = require('express-fileupload');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Инициализация бота
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
app.use(fileUpload());
app.use(express.static('public'));

// Конфигурация AssemblyAI
const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;
const UPLOAD_URL = 'https://api.assemblyai.com/v2/upload';
const TRANSCRIPT_URL = 'https://api.assemblyai.com/v2/transcript';

// Обработчик для транскрибации
app.post('/transcribe', async (req, res) => {
  try {
    const { userId } = req.body;
    const audioFile = req.files.audio;

    if (!userId || !audioFile) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Шаг 1: Загрузка аудио в AssemblyAI
    const uploadResponse = await axios.post(UPLOAD_URL, audioFile.data, {
      headers: {
        'authorization': ASSEMBLYAI_API_KEY,
        'content-type': 'audio/webm'
      }
    });

    // Шаг 2: Создание транскрипции
    const transcriptResponse = await axios.post(TRANSCRIPT_URL, {
      audio_url: uploadResponse.data.upload_url,
      language_code: 'ru'
    }, {
      headers: { 'authorization': ASSEMBLYAI_API_KEY }
    });

    // Шаг 3: Ожидание завершения транскрибации
    let transcriptResult;
    while (true) {
      transcriptResult = await axios.get(`${TRANSCRIPT_URL}/${transcriptResponse.data.id}`, {
        headers: { 'authorization': ASSEMBLYAI_API_KEY }
      });
      
      if (transcriptResult.data.status === 'completed') break;
      if (transcriptResult.data.status === 'error') throw new Error('Transcription failed');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Шаг 4: Отправка результата пользователю
    const message = `📅 ${new Date().toLocaleString('ru-RU')}\n${transcriptResult.data.text}`;
    await bot.sendMessage(userId, message);

    res.json({ success: true, text: transcriptResult.data.text });

  } catch (error) {
    console.error('Transcription error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Обработчик для главной страницы
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Запуск сервера
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
