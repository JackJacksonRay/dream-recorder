"use strict";

document.addEventListener('DOMContentLoaded', async () => {
  // Элементы интерфейса
  const loader = document.querySelector('.loader');
  const container = document.querySelector('.container');
  const recordBtn = document.getElementById('recordButton');
  const stopBtn = document.getElementById('stopButton');
  const status = document.getElementById('status');
  
  // Инициализация переменных
  let mediaRecorder;
  let audioChunks = [];
  let telegramUserId = null;

  // Проверка инициализации Telegram WebApp
  const initTelegram = () => {
    return new Promise((resolve) => {
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.ready();
        window.Telegram.WebApp.expand();
        
        const checkUser = () => {
          if (window.Telegram.WebApp.initDataUnsafe?.user?.id) {
            telegramUserId = window.Telegram.WebApp.initDataUnsafe.user.id;
            console.log('User ID:', telegramUserId);
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

  // Скрытие прелоадера
  const hideLoader = () => {
    loader.style.display = 'none';
    container.style.display = 'block';
  };

  // Запуск записи
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.start();
      
      mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
      recordBtn.disabled = true;
      stopBtn.disabled = false;
      status.textContent = 'Запись...';
      
    } catch (error) {
      status.textContent = 'Разрешите доступ к микрофону!';
    }
  };

  // Остановка записи
  const stopRecording = async () => {
    mediaRecorder.stop();
    status.textContent = 'Обработка...';
    
    mediaRecorder.onstop = async () => {
      try {
        const blob = new Blob(audioChunks, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('audio', blob, 'recording.webm');
        formData.append('userId', telegramUserId);

        const response = await fetch('/transcribe', {
          method: 'POST',
          body: formData
        });
        
        const result = await response.json();
        status.textContent = result.success 
          ? 'Запись сохранена в ваш чат!' 
          : 'Ошибка обработки';
          
      } catch (error) {
        status.textContent = 'Ошибка соединения';
      }
      
      audioChunks = [];
      recordBtn.disabled = false;
      stopBtn.disabled = true;
    };
  };

  // Основная инициализация
  try {
    const telegramReady = await initTelegram();
    if (!telegramReady) return;
    
    recordBtn.onclick = startRecording;
    stopBtn.onclick = stopRecording;
    hideLoader();
    
  } catch (error) {
    console.error('Ошибка инициализации:', error);
    status.textContent = 'Критическая ошибка!';
    loader.style.display = 'none';
  }
});
