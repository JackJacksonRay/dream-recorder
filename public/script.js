let mediaRecorder;
let audioChunks = [];
let loadingInterval;
let audioContext;
let analyser;
let source;
let isRecording = false;

// Исходные пути волн (для сброса после записи)
const initialWavePaths = [
  "M0,100 Q125,85 250,100 T500,100 T750,100 T1000,100 V200 H0 Z",
  "M0,105 Q125,90 250,105 T500,105 T750,105 T1000,105 V200 H0 Z",
  "M0,110 Q125,95 250,110 T500,110 T750,110 T1000,110 V200 H0 Z",
  "M0,115 Q125,100 250,115 T500,115 T750,115 T1000,115 V200 H0 Z",
  "M0,120 Q125,105 250,120 T500,120 T750,120 T1000,120 V200 H0 Z",
  "M0,125 Q125,110 250,125 T500,125 T750,125 T1000,125 V200 H0 Z",
  "M0,130 Q125,115 250,130 T500,130 T750,130 T1000,130 V200 H0 Z",
  "M0,135 Q125,120 250,135 T500,135 T750,135 T1000,135 V200 H0 Z",
  "M0,140 Q125,125 250,140 T500,140 T750,140 T1000,140 V200 H0 Z",
  "M0,145 Q125,130 250,145 T500,145 T750,145 T1000,145 V200 H0 Z"
];

// Функция для вывода логов в интерфейс
function logToInterface(message) {
  const debugLog = document.getElementById('debugLog');
  debugLog.textContent = message;
  console.log(message); // Для отладки, если консоль доступна
}

// Проверка и инициализация Telegram Web App
if (window.Telegram?.WebApp) {
  window.Telegram.WebApp.ready();
  window.Telegram.WebApp.expand();
  setTimeout(() => window.Telegram.WebApp.expand(), 500);
  logToInterface("Telegram Web App инициализирован");
}

// Показ прелоадера
const loader = document.querySelector('.loader');
loader.style.display = 'flex';
logToInterface("Прелоадер должен быть виден");

// Скрытие прелоадера через 2,5 секунды
setTimeout(() => {
  logToInterface("Скрываем прелоадер");
  loader.classList.add('hidden');
  document.querySelector('.container').style.display = 'flex';
}, 2500);

// Проверка анимации волн
const waves = document.querySelectorAll('.wave');
logToInterface(`Найдено волн: ${waves.length}`);

// Инициализация Web Audio API для анализа звука
async function setupAudioAnalysis(stream) {
  logToInterface("Инициализация Web Audio API...");
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioContext.createAnalyser();
  source = audioContext.createMediaStreamSource(stream);
  source.connect(analyser);
  analyser.fftSize = 256;
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  // Функция для обновления волн на основе громкости
  const waveElements = document.querySelectorAll('.wave');
  logToInterface(`Найдено волн для анимации: ${waveElements.length}`);
  if (waveElements.length === 0) {
    logToInterface("Ошибка: волны не найдены!");
    return;
  }

  function updateWaves() {
    if (!isRecording) {
      logToInterface("Запись остановлена, прекращаем обновление волн");
      return;
    }

    analyser.getByteFrequencyData(dataArray);
    const avg = dataArray.reduce((sum, val) => sum + val, 0) / bufferLength;
    const amplitude = Math.min(avg / 128, 1) * 50; // Увеличиваем амплитуду до 50px
    logToInterface(`Громкость: ${avg}, Амплитуда: ${amplitude}`);

    waveElements.forEach((wave, index) => {
      if (!wave) {
        logToInterface(`Ошибка: волна не найдена для индекса ${index}`);
        return;
      }
      // Изменяем положение и масштаб волны на основе громкости
      const translateY = amplitude * (index % 2 === 0 ? 1 : -1); // Чередуем направление
      const scale = 1 + (amplitude / 50); // Увеличиваем масштаб до 2
      wave.style.transform = `translateY(${translateY}px) scale(${scale})`;
      logToInterface(`Волна ${index + 1}: translateY(${translateY}px) scale(${scale})`);
    });

    requestAnimationFrame(updateWaves);
  }

  updateWaves();
}

// Сброс волн в исходное состояние
function resetWaves() {
  logToInterface("Сброс волн в исходное состояние...");
  const wavePaths = document.querySelectorAll('.wave-path');
  const waveElements = document.querySelectorAll('.wave');
  logToInterface(`Найдено волн для сброса: ${wavePaths.length}`);
  wavePaths.forEach((path, index) => {
    if (!path) {
      logToInterface(`Ошибка: путь волны не найден для сброса, индекс ${index}`);
      return;
    }
    path.setAttribute('d', initialWavePaths[index]);
    logToInterface(`Волна ${index + 1} сброшена (путь)`);
  });
  waveElements.forEach((wave, index) => {
    if (!wave) {
      logToInterface(`Ошибка: волна не найдена для сброса, индекс ${index}`);
      return;
    }
    wave.style.transform = 'translateY(0) scale(1)';
    logToInterface(`Волна ${index + 1} сброшена (стиль)`);
  });
}

// [Остальной код для записи]
document.getElementById('recordButton').addEventListener('click', async () => {
  logToInterface('Нажата кнопка "Начать запись"');
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
    logToInterface(`Ошибка при доступе к микрофону: ${error.message}`);
    fadeInStatus('Ошибка доступа к микрофону');
  }
});

document.getElementById('stopButton').addEventListener('click', () => {
  logToInterface('Нажата кнопка "Остановить запись"');
  mediaRecorder.stop();
  isRecording = false;
  document.getElementById('recordButton').disabled = false;
  document.getElementById('stopButton').disabled = true;

  // Остановка Web Audio API и сброс волн
  if (audioContext) {
    audioContext.close();
    audioContext = null;
    logToInterface("Web Audio API остановлен");
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
      logToInterface(`Ошибка при отправке аудио: ${error.message}`);
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