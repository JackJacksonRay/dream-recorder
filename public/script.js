"use strict";

(() => {
  // Инициализация состояния приложения
  let mediaRecorder = null;
  let audioChunks = [];
  let audioContext = null;
  let analyser = null;
  let isRecording = false;
  let telegramUserId = null;
  
  // DOM элементы
  const loader = document.querySelector('.loader');
  const container = document.querySelector('.container');
  const statusElement = document.getElementById('status');
  const recordButton = document.getElementById('recordButton');
  const stopButton = document.getElementById('stopButton');

  // Функция логирования
  const log = (message, isError = false) => {
    console[isError ? 'error' : 'log'](message);
    if (isError) statusElement.textContent = `Ошибка: ${message}`;
  };

  // Инициализация Telegram WebApp
  const initTelegram = () => {
    return new Promise((resolve) => {
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.ready();
        window.Telegram.WebApp.expand();
        
        const checkInit = () => {
          if (window.Telegram.WebApp.initDataUnsafe?.user?.id) {
            telegramUserId = window.Telegram.WebApp.initDataUnsafe.user.id;
            log(`Идентифицирован пользователь: ${telegramUserId}`);
            resolve(true);
          } else {
            setTimeout(checkInit, 100);
          }
        };
        
        checkInit();
      } else {
        log('Telegram WebApp не обнаружен', true);
        resolve(false);
      }
    });
  };

  // Анимация волн
  const createWaveAnimation = () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.className = 'wave-canvas';
    document.querySelector('.wave-container').appendChild(canvas);

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = 200;
    };
    
    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      if (!isRecording) return;
      
      ctx.fillStyle = '#1a2a2a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Реализация визуализации волн
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(dataArray);
      
      dataArray.forEach((value, i) => {
        const height = value * 0.5;
        ctx.fillStyle = `hsl(${i * 2}, 70%, 50%)`;
        ctx.fillRect(i * 5, canvas.height - height, 4, height);
      });
      
      requestAnimationFrame(draw);
    };

    draw();
  };

  // Управление записью
  const handleRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      analyser = audioContext.createAnalyser();
      audioContext.createMediaStreamSource(stream).connect(analyser);
      
      mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.start();
      isRecording = true;
      
      mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
      createWaveAnimation();
      
    } catch (error) {
      log(`Ошибка доступа к микрофону: ${error.message}`, true);
    }
  };

  // Отправка данных на сервер
  const sendAudioData = async () => {
    try {
      const blob = new Blob(audioChunks, { type: 'audio/webm' });
      const formData = new FormData();
      formData.append('audio', blob, 'recording.webm');
      formData.append('userId', telegramUserId);

      const response = await fetch('/transcribe', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) throw new Error('Ошибка сервера');
      
      const result = await response.json();
      statusElement.textContent = result.text 
        ? 'Текст успешно отправлен!' 
        : 'Ошибка обработки';
        
    } catch (error) {
      log(`Ошибка отправки: ${error.message}`, true);
    }
  };

  // Инициализация приложения
  const initApp = async () => {
    try {
      loader.style.display = 'flex';
      container.style.display = 'none';
      
      // Шаг 1: Инициализация Telegram
      const telegramInitSuccess = await initTelegram();
      if (!telegramInitSuccess) return;

      // Шаг 2: Настройка обработчиков
      recordButton.onclick = () => {
        recordButton.disabled = true;
        stopButton.disabled = false;
        statusElement.textContent = 'Запись...';
        handleRecording();
      };

      stopButton.onclick = () => {
        mediaRecorder.stop();
        isRecording = false;
        statusElement.textContent = 'Обработка...';
        recordButton.disabled = false;
        stopButton.disabled = true;
        
        mediaRecorder.onstop = () => {
          sendAudioData();
          audioChunks = [];
        };
      };

      // Шаг 3: Показ интерфейса
      loader.style.display = 'none';
      container.style.display = 'block';

    } catch (error) {
      log(`Критическая ошибка: ${error.message}`, true);
      loader.style.display = 'none';
    }
  };

  // Запуск приложения
  if (document.readyState === 'complete') initApp();
  else window.addEventListener('DOMContentLoaded', initApp);
})();
