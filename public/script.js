// Глобальные переменные
let mediaRecorder;
let audioChunks = [];
let audioContext;
let analyser;
let source;
let isRecording = false;
const waveContainer = document.querySelector('.wave-container');
const colors = ['#a3d8f4', '#9ad2ef', '#91ccea', '#88c6e5', '#7fc0e0', '#76bada', '#6db4d5', '#64aed0', '#5ba8cb', '#52a2c6'];

// Логирование
function logToInterface(message) {
  const debugLog = document.getElementById('debugLog');
  if (debugLog) {
    debugLog.textContent = message;
  }
  console.log(message);
}

// Инициализация Telegram Web App
try {
  if (window.Telegram?.WebApp) {
    window.Telegram.WebApp.ready();
    window.Telegram.WebApp.expand();
    setTimeout(() => window.Telegram.WebApp.expand(), 500);
    logToInterface("Telegram Web App инициализирован");
  } else {
    logToInterface("Telegram Web App не найден");
  }
} catch (error) {
  logToInterface(`Ошибка инициализации Telegram: ${error.message}`);
}

// Динамическое изменение цвета шарика
const siriBall = document.getElementById('siriBall');
function animateSiriBall() {
  let hue = 0;
  setInterval(() => {
    hue = (hue + 1) % 360;
    siriBall.style.background = `hsl(${hue}, 100%, 50%)`;
  }, 50);
}
animateSiriBall();

// Показ прелоадера
const loader = document.querySelector('.loader');
if (loader) {
  loader.style.display = 'flex';
  logToInterface("Прелоадер должен быть виден");
} else {
  logToInterface("Ошибка: элемент .loader не найден");
}

// Скрытие прелоадера через 2,5 секунды
try {
  setTimeout(() => {
    if (loader) {
      logToInterface("Скрываем прелоадер");
      loader.classList.add('hidden');
      const container = document.querySelector('.container');
      if (container) {
        container.style.display = 'flex';
        logToInterface("Контейнер отображен");
      } else {
        logToInterface("Ошибка: элемент .container не найден");
      }
    } else {
      logToInterface("Ошибка: элемент .loader не найден при попытке скрыть прелоадер");
    }
  }, 2500);
} catch (error) {
  logToInterface(`Ошибка при скрытии прелоадера: ${error.message}`);
}

// Создание волн
function createWaves() {
  try {
    const waveCount = window.innerWidth < 480 ? 5 : 10;
    logToInterface(`Создаём ${waveCount} волн`);
    for (let i = 1; i <= waveCount; i++) {
      const wave = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      wave.classList.add('wave', `wave-${i}`);
      wave.setAttribute('viewBox', '0 0 1000 200');
      wave.setAttribute('preserveAspectRatio', 'none');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.classList.add('wave-path');
      path.setAttribute('d', `M0,${100 + i * 5} Q125,${85 + i * 5} 250,${100 + i * 5} T500,${100 + i * 5} T750,${100 + i * 5} T1000,${100 + i * 5} V200 H0 Z`);
      path.setAttribute('fill', `url(#gradient${i})`);
      const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
      gradient.setAttribute('id', `gradient${i}`);
      gradient.setAttribute('x1', '0%');
      gradient.setAttribute('y1', '0%');
      gradient.setAttribute('x2', '100%');
      gradient.setAttribute('y2', '0%');
      const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
      stop1.setAttribute('offset', '0%');
      stop1.setAttribute('style', `stop-color:${colors[i - 1]};stop-opacity:0.7`);
      const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
      stop2.setAttribute('offset', '100%');
      stop2.setAttribute('style', `stop-color:${colors[i % colors.length]};stop-opacity:0.7`);
      gradient.appendChild(stop1);
      gradient.appendChild(stop2);
      defs.appendChild(gradient);
      wave.appendChild(defs);
      wave.appendChild(path);
      waveContainer.appendChild(wave);
    }
    logToInterface(`Успешно создано ${waveCount} волн`);
  } catch (error) {
    logToInterface(`Ошибка при создании волн: ${error.message}`);
  }
}

// Анализ звука и изменение CSS-переменных
async function setupAudioAnalysis(stream) {
  try {
    logToInterface("Инициализация Web Audio API...");
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    analyser.fftSize = 256;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    function updateWaves() {
      if (!isRecording) {
        logToInterface("Запись остановлена, прекращаем обновление волн");
        document.documentElement.style.setProperty('--amplitude', '10px');
        document.documentElement.style.setProperty('--speed', '10s');
        return;
      }

      analyser.getByteFrequencyData(dataArray);
      const avg = dataArray.reduce((sum, val) => sum + val, 0) / bufferLength;
      const amplitude = Math.min(avg / 128, 1);
      logToInterface(`Громкость: ${avg}, Амплитуда: ${amplitude}`);

      // Изменяем CSS-переменные
      document.documentElement.style.setProperty('--amplitude', `${10 + amplitude * 20}px`);
      document.documentElement.style.setProperty('--speed', `${10 - amplitude * 5}s`);

      requestAnimationFrame(updateWaves);
    }

    updateWaves();
  } catch (error) {
    logToInterface(`Ошибка Web Audio API: ${error.message}`);
  }
}

// Сброс волн
function resetWaves() {
  try {
    logToInterface("Сброс волн в исходное состояние...");
    document.documentElement.style.setProperty('--amplitude', '10px');
    document.documentElement.style.setProperty('--speed', '10s');
  } catch (error) {
    logToInterface(`Ошибка при сбросе волн: ${error.message}`);
  }
}

// Обработчики записи
try {
  const recordButton = document.getElementById('recordButton');
  const stopButton = document.getElementById('stopButton');
  if (!recordButton || !stopButton) {
    logToInterface("Ошибка: кнопки recordButton или stopButton не найдены");
  } else {
    recordButton.addEventListener('click', async () => {
      logToInterface('Нажата кнопка "Начать запись"');
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.start();
        isRecording = true;
        recordButton.disabled = true;
        stopButton.disabled = false;
        fadeInStatus('Идёт запись...');
        document.getElementById('progressBar').style.display = 'none';
        mediaRecorder.ondataavailable = (event) => {
          audioChunks.push(event.data);
        };

        await setupAudioAnalysis(stream);
      } catch (error) {
        logToInterface(`Ошибка при доступе к микрофону: ${error.message}`);
        fadeInStatus('Ошибка доступа к микрофону');
      }
    });

    stopButton.addEventListener('click', () => {
      logToInterface('Нажата кнопка "Остановить запись"');
      mediaRecorder.stop();
      isRecording = false;
      recordButton.disabled = false;
      stopButton.disabled = true;

      if (audioContext) {
        audioContext.close();
        audioContext = null;
        logToInterface("Web Audio API остановлен");
      }
      resetWaves();

      let dots = 0;
      fadeInStatus('Обработка');
      const loadingInterval = setInterval(() => {
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
  }
} catch (error) {
  logToInterface(`Ошибка при установке обработчиков кнопок: ${error.message}`);
}

function fadeInStatus(text) {
  try {
    const status = document.getElementById('status');
    if (status) {
      status.style.opacity = '0';
      status.textContent = text;
      setTimeout(() => {
        status.style.transition = 'opacity 0.5s ease';
        status.style.opacity = '1';
      }, 10);
    } else {
      logToInterface("Ошибка: элемент #status не найден");
    }
  } catch (error) {
    logToInterface(`Ошибка при обновлении статуса: ${error.message}`);
  }
}

// Инициализация
try {
  createWaves();
  logToInterface("Инициализация завершена");
} catch (error) {
  logToInterface(`Ошибка при инициализации: ${error.message}`);
}