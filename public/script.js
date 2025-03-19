let mediaRecorder;
let audioChunks = [];
let loadingInterval;

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

// Динамические волны
const wavePaths = [
  document.getElementById('wave-path-1'),
  document.getElementById('wave-path-2'),
  document.getElementById('wave-path-3')
];

const gradients = [
  document.getElementById('gradient-1'),
  document.getElementById('gradient-2'),
  document.getElementById('gradient-3')
];

// Цвета для градиентов
const colorSets = [
  ['#ffb6c1', '#a3d8f4'],
  ['#a3d8f4', '#d4a5a5'],
  ['#d4a5a5', '#ffb6c1']
];

// Функция для генерации нового пути волны
function generateWavePath(basePath, offset) {
  const points = basePath.split('C').map((part, index) => {
    if (index === 0) return part;
    const [control1, control2, end] = part.split(' ').filter(p => p);
    const newY = parseFloat(control1.split(',')[1]) + Math.sin(Date.now() / 1000 + offset) * 10;
    return `${control1.split(',')[0]},${newY} ${control2} ${end}`;
  });
  return points.join('C');
}

// Функция для изменения цветов
function updateWaveColors() {
  gradients.forEach((gradient, index) => {
    const hueShift = Math.sin(Date.now() / 3000 + index) * 20;
    const color1 = colorSets[index][0];
    const color2 = colorSets[index][1];
    gradient.innerHTML = `
      <stop offset="0%" stop-color="${color1}" stop-opacity="0.6" />
      <stop offset="100%" stop-color="${color2}" stop-opacity="0.6" />
    `;
  });
}

// Функция для анимации волн
function animateWaves() {
  wavePaths.forEach((path, index) => {
    path.setAttribute('d', generateWavePath(path.getAttribute('d'), index));
  });
  updateWaveColors();
  requestAnimationFrame(animateWaves);
}

// Запуск анимации волн
animateWaves();

// [Остальной код для записи остался прежним]
document.getElementById('recordButton').addEventListener('click', async () => {
  console.log('Нажата кнопка "Начать запись"');
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.start();
    document.getElementById('recordButton').disabled = true;
    document.getElementById('stopButton').disabled = false;
    fadeInStatus('Идёт запись...');
    document.getElementById('progressBar').style.display = 'none';
    mediaRecorder.ondataavailable = (event) => {
      audioChunks.push(event.data);
    };
  } catch (error) {
    console.error('Ошибка при доступе к микрофону:', error);
    fadeInStatus('Ошибка доступа к микрофону');
  }
});

document.getElementById('stopButton').addEventListener('click', () => {
  console.log('Нажата кнопка "Остановить запись"');
  mediaRecorder.stop();
  document.getElementById('recordButton').disabled = false;
  document.getElementById('stopButton').disabled = true;

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