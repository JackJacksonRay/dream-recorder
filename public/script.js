let mediaRecorder;
let audioChunks = [];
let audioContext;
let analyser;
let isRecording = false;
let timerInterval;

const waveContainer = document.querySelector('.wave-container');
const recordButton = document.getElementById('recordButton');
const stopButton = document.getElementById('stopButton');
const statusElement = document.getElementById('status');
const timerElement = document.getElementById('timer');
const audioPreview = document.getElementById('audioPreview');
const progressBar = document.getElementById('progressBar');
const loader = document.querySelector('.loader');

// Инициализация Canvas для волн
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
canvas.classList.add('canvas-waves');
waveContainer.appendChild(canvas);

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Оптимизированная отрисовка волн
let lastFrame = 0;
const throttleDelay = 100;

function drawWaves(amplitude) {
  const now = Date.now();
  if (now - lastFrame < throttleDelay) return;
  lastFrame = now;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  for(let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(0, canvas.height/2);
    ctx.strokeStyle = `hsla(${200 + i*20}, 70%, 50%, ${0.3 + i*0.1})`;
    ctx.lineWidth = 2 + i*2;
    
    for(let x = 0; x < canvas.width; x++) {
      const y = canvas.height/2 
        + Math.sin(x * 0.02 + Date.now()*0.002 * (i+1)) * (20 + amplitude*10) 
        + Math.sin(x * 0.01) * 10;
      ctx.lineTo(x, y);
    }
    
    ctx.stroke();
  }
}

// Инициализация Telegram Web App
try {
  if (window.Telegram?.WebApp) {
    window.Telegram.WebApp.ready();
    window.Telegram.WebApp.expand();
  }
} catch (error) {
  showError('Ошибка интеграции с Telegram');
}

// Запуск прелоадера
window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    if(loader) {
      loader.classList.add('hidden');
      document.querySelector('.container').style.display = 'flex';
    }
  }, 2500);
});

// Таймер записи
function startTimer() {
  let seconds = 0;
  timerElement.style.display = 'block';
  timerElement.textContent = '00:00';
  
  timerInterval = setInterval(() => {
    seconds++;
    const mins = String(Math.floor(seconds/60)).padStart(2,'0');
    const secs = String(seconds%60).padStart(2,'0');
    timerElement.textContent = `${mins}:${secs}`;
  }, 1000);
}

// Обработка ошибок
function showError(message) {
  const modal = document.getElementById('errorModal');
  document.getElementById('errorText').textContent = message;
  modal.style.display = 'block';

  document.querySelector('.close').onclick = () => {
    modal.style.display = 'none';
  };

  window.onclick = (e) => {
    if (e.target === modal) modal.style.display = 'none';
  };

  if (window.Telegram?.WebApp) {
    Telegram.WebApp.showAlert(message);
  }
}

// Запись аудио
recordButton.addEventListener('click', async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.start();
    
    isRecording = true;
    recordButton.disabled = true;
    stopButton.disabled = false;
    statusElement.textContent = 'Идет запись...';
    progressBar.style.display = 'none';
    audioPreview.style.display = 'none';
    
    startTimer();
    
    mediaRecorder.ondataavailable = (e) => {
      audioChunks.push(e.data);
    };

    // Анализ звука
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    analyser.fftSize = 256;
    
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    const updateVisuals = () => {
      if (!isRecording) return;
      
      analyser.getByteFrequencyData(dataArray);
      const avg = dataArray.reduce((a, b) => a + b, 0) / bufferLength;
      drawWaves(avg / 128);
      
      requestAnimationFrame(updateVisuals);
    };
    
    updateVisuals();
    
  } catch (error) {
    showError('Доступ к микрофону запрещен!');
    statusElement.textContent = 'Ошибка доступа';
    recordButton.disabled = false;
  }
});

// Остановка записи
stopButton.addEventListener('click', () => {
  mediaRecorder.stop();
  isRecording = false;
  recordButton.disabled = false;
  stopButton.disabled = true;
  clearInterval(timerInterval);
  timerElement.style.display = 'none';
  
  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }

  mediaRecorder.onstop = async () => {
    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
    audioChunks = [];
    
    // Показ превью
    audioPreview.src = URL.createObjectURL(audioBlob);
    audioPreview.style.display = 'block';
    
    // Отправка на сервер
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');
    
    progressBar.style.display = 'block';
    let progress = 0;
    const progressInterval = setInterval(() => {
      progress = Math.min(progress + 10, 90);
      progressBar.style.width = `${progress}%`;
    }, 1000);

    try {
      const response = await fetch('/transcribe', {
        method: 'POST',
        body: formData
      });
      
      const result = await response.json();
      clearInterval(progressInterval);
      progressBar.style.width = '100%';
      
      setTimeout(() => {
        progressBar.style.display = 'none';
        statusElement.textContent = result.text || 'Готово!';
      }, 500);
      
    } catch (error) {
      clearInterval(progressInterval);
      progressBar.style.display = 'none';
      showError('Ошибка обработки аудио');
    }
  };
});