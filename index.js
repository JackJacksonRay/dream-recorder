const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const fileUpload = require('express-fileupload');
const axios = require('axios');
const app = express();
const port = process.env.PORT || 3000;

const BOT_TOKEN = process.env.BOT_TOKEN; // Токен от @BotFather
const CHAT_ID = '-1002502923348'; // Telegram ID или ID канала
const bot = new TelegramBot(BOT_TOKEN);

app.use(fileUpload());
app.use(express.static('public'));

const ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY; // Твой API Key от AssemblyAI

app.post('/transcribe', async (req, res) => {
  const audio = req.files.audio;
  console.log('Получен аудиофайл:', audio.name);

  const uploadUrl = 'https://api.assemblyai.com/v2/upload';
  const uploadHeaders = {
    'authorization': ASSEMBLYAI_API_KEY,
    'content-type': 'application/octet-stream'
  };
  const audioBuffer = audio.data;

  try {
    const uploadResponse = await axios.post(uploadUrl, audioBuffer, { headers: uploadHeaders });
    const audioUrl = uploadResponse.data.upload_url;

    const transcribeUrl = 'https://api.assemblyai.com/v2/transcript';
    const transcribeHeaders = {
      'authorization': ASSEMBLYAI_API_KEY,
      'content-type': 'application/json'
    };
    const transcribeData = {
      'audio_url': audioUrl,
      'language_code': 'ru'
    };

    const transcribeResponse = await axios.post(transcribeUrl, transcribeData, { headers: transcribeHeaders });
    const transcriptId = transcribeResponse.data.id;

    const resultUrl = `https://api.assemblyai.com/v2/transcript/${transcriptId}`;
    let transcriptStatus = 'processing';
    while (transcriptStatus === 'processing' || transcriptStatus === 'queued') {
      await new Promise(resolve => setTimeout(resolve, 5000));
      const resultResponse = await axios.get(resultUrl, { headers: { 'authorization': ASSEMBLYAI_API_KEY } });
      transcriptStatus = resultResponse.data.status;
      if (transcriptStatus === 'completed') {
        const text = resultResponse.data.text;
        res.json({ text });

        // Отправка в Telegram
        const now = new Date();
        const dateTime = now.toLocaleString('ru-RU');
        const message = `${dateTime}\n${text}`;
        bot.sendMessage(CHAT_ID, message);
      } else if (transcriptStatus === 'error') {
        res.status(500).json({ error: 'Ошибка транскрибации' });
      }
    }
  } catch (error) {
    console.error('Ошибка при транскрибации:', error);
    res.status(500).json({ error: 'Ошибка при транскрибации' });
  }
});

app.listen(port, () => {
  console.log(`Сервер запущен на порту ${port}`);
});