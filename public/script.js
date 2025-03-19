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

// Сброс волн в исходное состояние
function resetWaves() {
  logToInterface("Сброс волн в исходное состояние...");
  const wavePaths = document.querySelectorAll('.wave-path');
  logToInterface(`Найдено волн для сброса: ${wavePaths.length}`);
  wavePaths.forEach((path, index) => {
    if (!path) {
      logToInterface(`Ошибка: путь волны не найден для сброса, индекс ${index}`);
      return;
    }
    path.setAttribute('d', initialWavePaths[index]);
    logToInterface(`Волна ${index + 1} сброшена`);
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

  // Сброс волн
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