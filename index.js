const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const app = express();

// Токен бота из переменных окружения Render
const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: false });

// Функция транскрибации (замените на вашу реализацию)
function transcribeAudio(filePath) {
  // Здесь ваша логика транскрибации
  return "Пример транскрибированного текста";
}

app.post('/transcribe', upload.single('audio'), (req, res) => {
  const audioFile = req.file;
  const userId = req.body.userId;

  console.log('Получен аудиофайл:', audioFile?.originalname);
  console.log('Получен userId:', userId);

  if (!audioFile || !userId) {
    return res.status(400).json({ error: 'Аудиофайл или userId отсутствуют' });
  }

  const transcribedText = transcribeAudio(audioFile.path);

  // Отправляем сообщение в личный чат пользователя
  bot.sendMessage(userId, transcribedText)
    .then(() => {
      console.log(`Сообщение отправлено пользователю ${userId}`);
      res.json({ text: transcribedText });
    })
    .catch((error) => {
      console.error(`Ошибка отправки пользователю ${userId}:`, error);
      res.status(500).json({ error: 'Ошибка отправки сообщения' });
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});