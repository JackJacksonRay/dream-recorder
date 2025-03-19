// Упрощённая реализация шума Перлина
function perlinNoise(x) {
  const n = Math.sin(x * 12.9898) * 43758.5453;
  return n - Math.floor(n);
}

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
function log(message) {
  const debugLog = document.getElementById('debugLog');
  debugLog.textContent = message;
  console.log(message);
}

// Инициализация Telegram Web App
function initTelegram() {
  if (window.Telegram?.WebApp) {
    window.Telegram.WebApp.ready();
    window.Telegram.WebApp.expand();
    setTimeout(() => window.Telegram.WebApp.expand(), 500);
    log("Telegram Web App инициализирован");
  }
}

// Показ и скрытие прелоадера
function initLoader() {
  const loader = document.querySelector('.loader');
  setTimeout(() => {
    loader.classList.add('hidden');
    document.querySelector('.container').style.display = 'flex';
    log("Прелоадер скрыт");
  }, 2500);
}

// Создание волн
function createWaves() {
  const waveCount = window.innerWidth < 480 ? 5 : 10;
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
}

// Анимация волн
const waves = document.querySelectorAll('.wave');
const wavePaths = document.querySelectorAll('.wave-path');
const waveParams = Array.from(waves).map(() => ({
  baseAmplitude: Math.random() * 10 + 5,
  baseSpeed: Math.random() * 0.5 + 0.5,
  phase: Math.random() * Math.PI * 2,
}));

function animateWaves() {
  const time = Date.now() * 0.001;
  wavePaths.forEach((path, index) => {
    const param = waveParams[index];
    const yOffset = 100 + (index + 1) * 5;
    const noise = perlinNoise(time * param.baseSpeed + param.phase);
    const amplitude = param.baseAmplitude * (1 + noise);
    const waveHeight = amplitude * Math.sin(time * param.baseSpeed + param.phase);
    path.setAttribute('d', `M0,${yOffset + waveHeight} Q125,${yOffset - waveHeight} 250,${yOffset + waveHeight} T500,${yOffset + waveHeight} T750,${yOffset + waveHeight} T1000,${yOffset + waveHeight} V200 H0 Z`);
  });
  requestAnimationFrame(animateWaves);
}

// Анализ звука
async function setupAudioAnalysis(stream) {
  try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    analyser.fftSize = 256;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    let lastUpdate = 0;

    function updateWaveParams() {
      if (!isRecording) return;
      const now = Date.now();
      if (now - lastUpdate < 100) {
        requestAnimationFrame(updateWaveParams);
        return;
      }
      lastUpdate = now;

      analyser.getByteFrequencyData(dataArray);
      const avg = dataArray.reduce((sum, val) => sum + val, 0) / bufferLength;
      const amplitude = Math.min(avg / 128, 1);
      waveParams.forEach(param => {
        param.baseSpeed = (Math.random() * 0.5 + 0.5) * (1 + amplitude * 2);
        param.baseAmplitude = (Math.random() * 10 + 5) * (1 + amplitude);
      });
      requestAnimationFrame(updateWaveParams);
    }
    updateWaveParams();
  } catch (e) {
    log(`Ошибка Web Audio API: ${e.message}`);
  }
}

// Сброс волн
function resetWaves() {
  waveParams.forEach(param => {
    param.baseSpeed = Math.random() * 0.5 + 0.5;
    param.baseAmplitude = Math.random() * 10 + 5;
  });
}

// Обработчики записи
function initRecording() {
  document.getElementById('recordButton').addEventListener('click', async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.start();
      isRecording = true;
      document.getElementById('recordButton').disabled = true;
      document.getElementById('stopButton').disabled = false;
      fadeInStatus('Идёт запись...');
      document.getElementById('progressBar').style.display = 'none';
      mediaRecorder.ondataavailable = (event) => audioChunks.push(event.data);
      await setupAudioAnalysis(stream);
    } catch (e) {
      log(`Ошибка микрофона: ${e.message}`);
      fadeInStatus('Ошибка доступа к микрофону');
    }
  });

  document.getElementById('stopButton').addEventListener('click', () => {
    mediaRecorder.stop();
    isRecording = false;
    document.getElementById('recordButton').disabled = false;
    document.getElementById('stopButton').disabled = true;
    if (audioContext) audioContext.close();
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
      if (progress <= 90) progressBar.style.width = `${progress}%`;
    }, 1000);

    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      try {
        const response = await fetch('/transcribe', { method: 'POST', body: formData });
        const result = await response.json();
        clearInterval(loadingInterval);
        clearInterval(progressInterval);
        progressBar.style.width = '100%';
        setTimeout(() => progressBar.style.display = 'none', 500);
        fadeInStatus(`Текст: ${result.text}`);
      } catch (e) {
        log(`Ошибка отправки: ${e.message}`);
        clearInterval(loadingInterval);
        clearInterval(progressInterval);
        progressBar.style.display = 'none';
        fadeInStatus('Ошибка при обработке');
      }
      audioChunks = [];
    };
  });
}

function fadeInStatus(text) {
  const status = document.getElementById('status');
  status.style.opacity = '0';
  status.textContent = text;
  setTimeout(() => status.style.opacity = '1', 10);
}

// Инициализация
initTelegram();
initLoader();
createWaves();
animateWaves();
initRecording();