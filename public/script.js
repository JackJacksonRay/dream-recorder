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

// Проверка, найдены ли элементы
console.log("Wave paths:", wavePaths);
console.log("Gradients:", gradients);

if (wavePaths.every(path => path) && gradients.every(gradient => gradient)) {
  console.log("Все элементы волн найдены, анимация запущена.");
} else {
  console.error("Не удалось найти все элементы волн или градиентов!");
}

// Базовая анимация волн (без динамического изменения формы пока)
function animateWaves() {
  wavePaths.forEach((path, index) => {
    const baseY = parseFloat(path.getAttribute('d').split('C')[1].split(',')[1]);
    const newY = baseY + Math.sin(Date.now() / 1000 + index) * 10;
    const newPath = path.getAttribute('d').replace(/C[\s\S]*?(\d+,\d+)/, `C${newY}`);
    path.setAttribute('d', newPath);
  });
  requestAnimationFrame(animateWaves);
}

// Запуск анимации волн
if (wavePaths.every(path => path)) {
  animateWaves();
}

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