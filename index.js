require('dotenv').config();
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const fileUpload = require('express-fileupload');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Исправление конфликта поллинга
const bot = new TelegramBot(process.env.BOT_TOKEN);
app.use(fileUpload());
app.use(express.static('public'));

// Конфигурация AssemblyAI
const ASSEMBLY_API_KEY = process.env.ASSEMBLYAI_API_KEY;

// Вебхук для бота
app.post(`/webhook/${process.env.BOT_TOKEN}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Обработчик транскрибации
app.post('/transcribe', async (req, res) => {
  try {
    const { userId } = req.body;
    const audioFile = req.files.audio;

    // Загрузка аудио в AssemblyAI
    const uploadRes = await axios.post(
      'https://api.assemblyai.com/v2/upload',
      audioFile.data,
      { headers: { authorization: ASSEMBLY_API_KEY } }
    );

    // Создание транскрипции
    const transcriptRes = await axios.post(
      'https://api.assemblyai.com/v2/transcript',
      { audio_url: uploadRes.data.upload_url, language_code: 'ru' },
      { headers: { authorization: ASSEMBLY_API_KEY } }
    );

    // Получение результата
    let transcript;
    do {
      await new Promise(resolve => setTimeout(resolve, 2000));
      transcript = await axios.get(
        `https://api.assemblyai.com/v2/transcript/${transcriptRes.data.id}`,
        { headers: { authorization: ASSEMBLY_API_KEY } }
      );
    } while (transcript.data.status === 'processing');

    // Отправка сообщения
    const message = `📅 ${new Date().toLocaleString('ru-RU')}\n${transcript.data.text}`;
    await bot.sendMessage(userId, message);

    res.json({ success: true, text: transcript.data.text });

  } catch (error) {
    console.error('Ошибка:', error);
    res.status(500).json({ error: error.message });
  }
});

// Статические файлы
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Запуск сервера
app.listen(port, () => {
  console.log(`Сервер запущен на порту ${port}`);
  bot.setWebHook(`${process.env.RENDER_URL}/webhook/${process.env.BOT_TOKEN}`);
});