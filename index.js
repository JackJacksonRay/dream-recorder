require('dotenv').config();
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const fileUpload = require('express-fileupload');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

const bot = new TelegramBot(process.env.BOT_TOKEN);
app.use(fileUpload());
app.use(express.static('public'));

// Обработчик транскрибации
app.post('/transcribe', async (req, res) => {
  try {
    const { userId } = req.body;
    const audioFile = req.files.audio;

    // Загрузка аудио в AssemblyAI
    const uploadRes = await axios.post(
      'https://api.assemblyai.com/v2/upload',
      audioFile.data,
      { headers: { authorization: process.env.ASSEMBLYAI_API_KEY } }
    );

    // Создание транскрипции
    const transcriptRes = await axios.post(
      'https://api.assemblyai.com/v2/transcript',
      { 
        audio_url: uploadRes.data.upload_url,
        language_code: 'ru'
      },
      { headers: { authorization: process.env.ASSEMBLYAI_API_KEY } }
    );

    // Получение результата
    let transcript;
    do {
      await new Promise(resolve => setTimeout(resolve, 2000));
      transcript = await axios.get(
        `https://api.assemblyai.com/v2/transcript/${transcriptRes.data.id}`,
        { headers: { authorization: process.env.ASSEMBLYAI_API_KEY } }
      );
    } while (transcript.data.status === 'processing');

    // Отправка сообщения
    await bot.sendMessage(
      userId,
      `📅 ${new Date().toLocaleString('ru-RU')}\n${transcript.data.text}`
    );

    res.json({ success: true });

  } catch (error) {
    console.error('Ошибка:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => console.log(`Сервер запущен на порту ${port}`));