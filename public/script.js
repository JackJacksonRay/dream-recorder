let mediaRecorder;
let audioChunks = [];
let loadingInterval;
let audioContext;
let analyser;
let source;
let isRecording = false;

// Исходные пути волн (для сброса после записи)
const initialWavePaths = [
  "M0,100 Q125,80 250,100 T500,100 T750,100 T1000,100 V200 H0 Z",
  "M0,110 Q125,90 250,110 T500,110 T750,110 T1000,110 V200 H0 Z",
  "M0,120 Q125,100 250,120 T500,120 T750,120 T1000,120 V200 H0 Z",
  "M0,130 Q125,110 250,130 T500,130 T750,130 T1000,130 V200 H0 Z",
  "M0,140 Q125,120 250,140 T500,140 T750,140 T1000,140 V200 H0 Z"
];

// Проверка и инициализация Telegram Web App
if (window.Telegram?.WebApp) {
  window.Telegram.WebApp.ready();
  window.Telegram.WebApp.expand();
  setTimeout(() => window.Telegram.WebApp.expand(), 500);
}

// Показ прелоадера
const loader = document.querySelector('.loader');
loader.style.display = 'flex';
console.log("Прелоадер должен быть виден");

// Скрытие прелоадера через 2,5 секунды
setTimeout(() => {
  console.log("Скрываем прелоадер");
  loader.classList.add('hidden');
  document.querySelector('.container').style.display = 'flex';
}, 2500);

// Инициализация Web Audio API для анализа звука
async function setupAudioAnalysis(stream) {
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioContext.createAnalyser();
  source = audioContext.createMediaStreamSource(stream);
  source.connect(analyser);
  analyser.fftSize = 256;
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  // Функция для обновления волн на основе громкости
  const wavePaths = document.querySelectorAll('.wave-path');
  function updateWaves() {
    if (!isRecording) return;

    analyser.getByteFrequencyData(dataArray);
    const avg = dataArray.reduce((sum, val) => sum + val, 0) / bufferLength;
    const amplitude = Math.min(avg / 128, 1) * 50; // Масштабируем амплитуду (0-50)

    wavePaths.forEach((path, index) => {
      const baseY = 100 + index * 10; // Базовая высота волны
      const wavePoints = [];
      for (let x = 0; x <= 1000; x += 125) {
        const y = baseY + Math.sin(x / 50 + index) * (20 + amplitude);
        wavePoints.push(`${x},${y}`);
      }
      const pathD = `M0,${baseY} Q${wavePoints.join(' Q')} V200 H0 Z`;
      path.setAttribute('d', pathD);
    });

    requestAnimationFrame(updateWaves);
  }

  updateWaves();
}

// Сброс волн в исходное состояние
function resetWaves() {
  const wavePaths = document.querySelectorAll('.wave-path');
  wavePaths.forEach((path, index) => {
    path.setAttribute('d', initialWavePaths[index]);
  });
}

// [Остальной код для записи]
document.getElementById('recordButton').addEventListener('click', async () => {
  console.log('Нажата кнопка "Начать запись"');
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.start();
    isRecording = true;
    document.getElementById('recordButton').disabled = true;
    document.getElementById('stopButton').disabled = false;
    fadeInStatus('Идёт запись...');
    document.getElementById('progressBar').style.display = 'none';
    mediaRecorder.ondataavailable = (event) => {
      audioChunks.push(event.data);
    };

    // Инициализация анализа звука
    await setupAudioAnalysis(stream);
  } catch (error) {
    console.error('Ошибка при доступе к микрофону:', error);
    fadeInStatus('Ошибка доступа к микрофону');
  }
});

document.getElementById('stopButton').addEventListener('click', () => {
  console.log('Нажата кнопка "Остановить запись"');
  mediaRecorder.stop();
  isRecording = false;
  document.getElementById('recordButton').disabled = false;
  document.getElementById('stopButton').disabled = true;

  // Остановка Web Audio API и сброс волн
  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }
  resetWaves();

  let dots = 0;
  fadeInStatus('Обработка');
  loadingInterval = setInterval(() => {
    dots = (dots + 1) % 4;
    document.getElementById('status').textContent = 'Обработка' + '.'.repeat(dots);
  }, 500);

  const progressBar = document.getElementById('progressBar');
  progressBar.style.display = 'block';
  let progress = 0;
  const progressInterval = setInterval(() => {
    progress += 10;
    if (progress <= 90) {
      progressBar.style.width = `${progress}%`;
    }
  }, 1000);

  mediaRecorder.onstop = async () => {
    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');

    try {
      const response = await fetch('/transcribe', {
        method: 'POST',
        body: formData
      });
      const result = await response.json();
      clearInterval(loadingInterval);
      clearInterval(progressInterval);
      progressBar.style.width = '100%';
      setTimeout(() => {
        progressBar.style.display = 'none';
      }, 500);
      fadeInStatus(`Текст: ${result.text}`);
    } catch (error) {
      console.error('Ошибка при отправке аудио:', error);
      clearInterval(loadingInterval);
      clearInterval(progressInterval);
      progressBar.style.display = 'none';
      fadeInStatus('Ошибка при обработке аудио');
    }
    audioChunks = [];
  };
});

function fadeInStatus(text) {
  const status = document.getElementById('status');
  status.style.opacity = '0';
  status.textContent = text;
  setTimeout(() => {
    status.style.transition = 'opacity 0.5s ease';
    status.style.opacity = '1';
  }, 10);
}