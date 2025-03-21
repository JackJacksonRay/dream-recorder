"use strict";

(() => {
  let mediaRecorder;
  let audioChunks = [];
  let audioContext;
  let analyser;
  let isRecording = false;
  let telegramUserId = null;
  const waveContainer = document.querySelector('.wave-container');
  
  // Инициализация Telegram Web App
  const initTelegram = async () => {
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
      return window.Telegram.WebApp.initDataUnsafe?.user?.id;
    }
    return null;
  };

  // Создание визуализации волн
  const createAudioVisualizer = () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.classList.add('visualizer');
    waveContainer.appendChild(canvas);

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = 150;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    return { canvas, ctx };
  };

  // Анализ аудиопотока
  const analyzeAudio = (stream) => {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    analyser.fftSize = 256;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const { canvas, ctx } = createAudioVisualizer();

    const draw = () => {
      if (!isRecording) return;

      analyser.getByteFrequencyData(dataArray);
      ctx.fillStyle = '#1a2a2a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 2.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = dataArray[i] / 2;
        ctx.fillStyle = `hsl(${i * 2}, 100%, 50%)`;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
      }

      requestAnimationFrame(draw);
    };

    draw();
  };

  // Управление записью
  const initRecorder = async () => {
    const recordButton = document.getElementById('recordButton');
    const stopButton = document.getElementById('stopButton');
    const statusElement = document.getElementById('status');

    recordButton.addEventListener('click', async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.start();
        
        mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
        analyzeAudio(stream);
        
        isRecording = true;
        recordButton.disabled = true;
        stopButton.disabled = false;
        statusElement.textContent = 'Запись...';
      } catch (error) {
        statusElement.textContent = 'Ошибка доступа к микрофону';
      }
    });

    stopButton.addEventListener('click', async () => {
      mediaRecorder.stop();
      isRecording = false;
      statusElement.textContent = 'Обработка...';

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('audio', audioBlob);
        formData.append('userId', telegramUserId);

        try {
          const response = await fetch('/transcribe', {
            method: 'POST',
            body: formData
          });
          
          const result = await response.json();
          statusElement.textContent = result.success 
            ? 'Текст отправлен в ваш чат!' 
            : 'Ошибка обработки';
          
        } catch (error) {
          statusElement.textContent = 'Ошибка соединения';
        }
      };
    });
  };

  // Инициализация приложения
  const initApp = async () => {
    telegramUserId = await initTelegram();
    if (!telegramUserId) {
      document.getElementById('status').textContent = 'Требуется авторизация в Telegram';
      return;
    }
    
    await initRecorder();
    document.querySelector('.loader').style.display = 'none';
    document.querySelector('.container').style.display = 'block';
  };

  window.addEventListener('DOMContentLoaded', initApp);
})();
