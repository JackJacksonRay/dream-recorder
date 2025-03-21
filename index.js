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
const ASSEMBLY_API_KEY = process.env.ASSEMBLYAI_API_KEY;
const UPLOAD_ENDPOINT = 'https://api.assemblyai.com/v2/upload';
const TRANSCRIPT_ENDPOINT = 'https://api.assemblyai.com/v2/transcript';

// Обработчик транскрибации
app.post('/transcribe', async (req, res) => {
  try {
    const { userId } = req.body;
    const audioFile = req.files.audio;

    // Валидация данных
    if (!userId || !audioFile) {
      return res.status(400).json({ error: 'Недостаточно данных' });
    }

    // Загрузка аудио
    const { data: uploadData } = await axios.post(UPLOAD_ENDPOINT, audioFile.data, {
      headers: { authorization: ASSEMBLY_API_KEY }
    });

    // Создание транскрипции
    const { data: transcriptData } = await axios.post(TRANSCRIPT_ENDPOINT, {
      audio_url: uploadData.upload_url,
      language_code: 'ru'
    }, {
      headers: { authorization: ASSEMBLY_API_KEY }
    });

    // Ожидание результата
    let transcript;
    do {
      await new Promise(resolve => setTimeout(resolve, 2000));
      transcript = await axios.get(`${TRANSCRIPT_ENDPOINT}/${transcriptData.id}`, {
        headers: { authorization: ASSEMBLY_API_KEY }
      });
    } while (transcript.data.status === 'processing');

    // Отправка результата
    const message = `📅 ${new Date().toLocaleString('ru-RU')}\n${transcript.data.text}`;
    await bot.sendMessage(userId, message);

    res.json({ text: transcript.data.text });

  } catch (error) {
    console.error('Ошибка транскрибации:', error);
    res.status(500).json({ error: error.message });
  }
});

// Статический роут
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Запуск сервера
app.listen(port, () => {
  console.log(`Сервер запущен на порту ${port}`);
});