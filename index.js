const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const fileUpload = require('express-fileupload');
const axios = require('axios');
const app = express();
const port = process.env.PORT || 3000;

// Чтение переменных окружения
const BOT_TOKEN = process.env.BOT_TOKEN;
const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY;

if (!BOT_TOKEN || !ASSEMBLYAI_API_KEY) {
  console.error('Необходимые переменные окружения не заданы!');
  process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, { polling: false });

// Middleware
app.use(fileUpload({
  limits: { fileSize: 10 * 1024 * 1024 }, // Лимит 10 МБ
}));
app.use(express.static('public'));

// Обработчик для корневого маршрута
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// Эндпоинт для транскрипции аудио
app.post('/transcribe', async (req, res) => {
  if (!req.files || !req.files.audio || !req.body.userId) {
    return res.status(400).json({ error: 'Файл или userId не найдены' });
  }

  const audio = req.files.audio;
  const userId = req.body.userId;
  console.log('Получен аудиофайл:', audio.name);
  console.log('Получен userId:', userId);

  try {
    // Загрузка аудио на AssemblyAI
    const uploadResponse = await axios.post(
      'https://api.assemblyai.com/v2/upload',
      audio.data,
      {
        headers: {
          authorization: ASSEMBLYAI_API_KEY,
          'content-type': 'application/octet-stream',
        },
      }
    );
    const audioUrl = uploadResponse.data.upload_url;

    // Запрос на транскрипцию
    const transcribeResponse = await axios.post(
      'https://api.assemblyai.com/v2/transcript',
      { audio_url: audioUrl, language_code: 'ru' },
      {
        headers: {
          authorization: ASSEMBLYAI_API_KEY,
          'content-type': 'application/json',
        },
      }
    );

    const transcriptId = transcribeResponse.data.id;
    const resultUrl = `https://api.assemblyai.com/v2/transcript/${transcriptId}`;

    // Ожидание завершения транскрипции
    const pollTranscriptStatus = async () => {
      const statusResponse = await axios.get(resultUrl, {
        headers: { authorization: ASSEMBLYAI_API_KEY },
      });
      return statusResponse.data;
    };

    const poll = async () => {
      const transcriptData = await pollTranscriptStatus();
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
    const transcriptText = transcriptData.text; // Переименовал text в transcriptText, чтобы избежать конфликтов

    const now = new Date();
    const dateTime = now.toLocaleString('ru-RU');
    const message = `${dateTime}\n${transcriptText}`;

    // Отправка в личный чат пользователя
    await bot.sendMessage(userId, message).catch(err => {
      console.error(`Ошибка отправки пользователю ${userId}:`, err.message);
    });
    console.log(`Сообщение отправлено пользователю ${userId}`);

    res.json({ text: message });
  } catch (error) {
    console.error('Ошибка при транскрибации:', error.message);
    res.status(500).json({ error: 'Ошибка при транскрибации' });
  }
});

// Запуск сервера
app.listen(port, () => {
  console.log(`Сервер запущен на порту ${port}`);
});
        





