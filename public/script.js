document.addEventListener('DOMContentLoaded', async () => {
  // Элементы интерфейса
  const loader = document.querySelector('.loader');
  const container = document.querySelector('.container');
  const recordBtn = document.getElementById('recordButton');
  const stopBtn = document.getElementById('stopButton');
  const status = document.getElementById('status');
  
  // Состояние приложения
  let mediaRecorder;
  let audioChunks = [];
  let telegramUserId = null;

  // Шаг 1: Инициализация Telegram WebApp
  const initTelegram = () => {
    return new Promise((resolve) => {
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.ready();
        
        const checkUser = () => {
          const user = window.Telegram.WebApp.initDataUnsafe?.user;
          if (user?.id) {
            telegramUserId = user.id;
            console.log('User ID получен:', telegramUserId);
            resolve(true);
          } else {
            setTimeout(checkUser, 100);
          }
        };
        
        checkUser();
      } else {
        status.textContent = 'Запустите через Telegram!';
        resolve(false);
      }
    });
  };

  // Шаг 2: Настройка записи
  const setupRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      
      mediaRecorder.ondataavailable = (e) => {
        audioChunks.push(e.data);
      };
      
      recordBtn.disabled = false;
      stopBtn.disabled = true;

    } catch (error) {
      status.textContent = 'Доступ к микрофону запрещен!';
    }
  };

  // Шаг 3: Запуск приложения
  const startApp = async () => {
    try {
      // Инициализация Telegram
      const isTelegramReady = await initTelegram();
      if (!isTelegramReady) return;

      // Настройка записи
      await setupRecording();

      // Показ интерфейса
      loader.style.display = 'none';
      container.style.display = 'block';

      // Обработчики кнопок
      recordBtn.onclick = () => {
        mediaRecorder.start();
        recordBtn.disabled = true;
        stopBtn.disabled = false;
        status.textContent = 'Запись...';
      };

      stopBtn.onclick = () => {
        mediaRecorder.stop();
        status.textContent = 'Обработка...';
        recordBtn.disabled = false;
        stopBtn.disabled = true;
      };

      // Обработка окончания записи
      mediaRecorder.onstop = async () => {
        try {
          const formData = new FormData();
          formData.append('audio', new Blob(audioChunks, { type: 'audio/webm' }));
          formData.append('userId', telegramUserId);

          const response = await fetch('/transcribe', {
            method: 'POST',
            body: formData
          });

          if (response.ok) {
            status.textContent = 'Запись сохранена в ваш чат!';
          } else {
            status.textContent = 'Ошибка сервера';
          }

        } catch (error) {
          status.textContent = 'Ошибка соединения';
        }
        
        audioChunks = [];
      };

    } catch (error) {
      console.error('Ошибка инициализации:', error);
      loader.style.display = 'none';
      status.textContent = 'Критическая ошибка приложения';
    }
  };

  // Запуск
  startApp();
});
