const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const multer = require('multer');
const fs = require('fs');

// Настраиваем multer для сохранения файлов во временную папку
const upload = multer({ dest: 'uploads/' });
const app = express();

// Токен бота из переменных окружения (должен быть задан на Render)
const token = process.env.BOT_TOKEN;
if (!token) {
  console.error('Ошибка: BOT_TOKEN не задан в переменных окружения!');
  process.exit(1);
}
const bot = new TelegramBot(token, { polling: false });

// Функция-заглушка для транскрибации (замените на вашу реализацию)
function transcribeAudio(filePath) {
  // Здесь будет ваша логика транскрибации, например, с использованием Whisper API
  return "Это пример транскрибированного текста";
}

// Обработка POST-запроса на эндпоинт /transcribe
app.post('/transcribe', upload.single('audio'), (req, res) => {
  const audioFile = req.file; // Файл, загруженный через multer
  const userId = req.body.userId; // ID пользователя из тела запроса

  console.log('Получен аудиофайл:', audioFile?.originalname);
  console.log('Получен userId:', userId);

  // Проверяем, что все данные пришли
  if (!audioFile || !userId) {
    return res.status(400).json({ error: 'Аудиофайл или userId отсутствуют' });
  }

  // Транскрибируем аудио
  const transcribedText = transcribeAudio(audioFile.path);

  // Отправляем сообщение пользователю через Telegram
  bot.sendMessage(userId, transcribedText)
    .then(() => {
      console.log(`Сообщение отправлено пользователю ${userId}`);
      // Удаляем временный файл после обработки
      fs.unlink(audioFile.path, (err) => {
        if (err) console.error('Ошибка удаления файла:', err);
      });
      res.json({ text: transcribedText });
    })
    .catch((error) => {
      console.error(`Ошибка отправки пользователю ${userId}:`, error);
      res.status(500).json({ error: 'Ошибка отправки сообщения' });
    });
});

// Запуск сервера
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});