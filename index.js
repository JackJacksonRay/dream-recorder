const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

// Настраиваем multer для сохранения файлов во временную папку
const upload = multer({ dest: 'uploads/' });
const app = express();

// Middleware для обслуживания статических файлов из папки 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Токен бота и ключ AssemblyAI из переменных окружения
const token = process.env.BOT_TOKEN;
const assemblyApiKey = process.env.ASSEMBLY_API_KEY;

if (!token || !assemblyApiKey) {
  console.error('Ошибка: BOT_TOKEN или ASSEMBLY_API_KEY не заданы в переменных окружения!');
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

// Функция для транскрибации аудио через AssemblyAI
async function transcribeAudio(filePath) {
  try {
    const audioData = fs.readFileSync(filePath);
    const uploadResponse = await axios.post(
      'https://api.assemblyai.com/v2/upload',
      audioData,
      {
        headers: {
          'authorization': assemblyApiKey,
          'content-type': 'application/octet-stream',
        },
      }
    );

    const uploadUrl = uploadResponse.data.upload_url;

    const transcribeResponse = await axios.post(
      'https://api.assemblyai.com/v2/transcript',
      { audio_url: uploadUrl },
      { headers: { 'authorization': assemblyApiKey } }
    );

    const transcriptId = transcribeResponse.data.id;

    // Ожидание завершения транскрибации
    let transcript;
    while (true) {
      const statusResponse = await axios.get(
        `https://api.assemblyai.com/v2/transcript/${transcriptId}`,
        { headers: { 'authorization': assemblyApiKey } }
      );
      transcript = statusResponse.data;
      if (transcript.status === 'completed' || transcript.status === 'error') break;
      await new Promise(resolve => setTimeout(resolve, 1000)); // Пауза 1 секунда
    }

    if (transcript.status === 'error') {
      throw new Error('Ошибка транскрибации: ' + transcript.error);
    }

    const dateTime = new Date().toLocaleString('ru-RU');
    return `${dateTime}: ${transcript.text}`;
  } catch (error) {
    console.error('Ошибка транскрибации:', error.message);
    throw error;
  }
}

// Обработка POST-запроса на эндпоинт /transcribe
app.post('/transcribe', upload.single('audio'), async (req, res) => {
  const audioFile = req.file;
  const userId = req.body.userId;

  console.log('Получен аудиофайл:', audioFile?.originalname);
  console.log('Получен userId:', userId);

  if (!audioFile || !userId) {
    return res.status(400).json({ error: 'Аудиофайл или userId отсутствуют' });
  }

  try {
    const transcribedText = await transcribeAudio(audioFile.path);

    await bot.sendMessage(userId, transcribedText);
    console.log(`Сообщение отправлено пользователю ${userId}`);

    fs.unlink(audioFile.path, (err) => {
      if (err) console.error('Ошибка удаления файла:', err);
    });

    res.json({ text: transcribedText });
  } catch (error) {
    console.error(`Ошибка обработки для пользователя ${userId}:`, error);
    res.status(500).json({ error: 'Ошибка обработки аудио' });
  }
});

// Обработчик для корневого маршрута
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Обработка команды /start для бота
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, 'Добро пожаловать! Нажмите кнопку ниже, чтобы открыть приложение.', {
    reply_markup: {
      inline_keyboard: [
        [{
          text: 'Открыть запись мыслей',
          web_app: { url: process.env.APP_URL || 'https://your-app.onrender.com' }
        }]
      ]
    }
  });
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});