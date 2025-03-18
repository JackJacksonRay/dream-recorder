let mediaRecorder;
let audioChunks = [];
let loadingInterval;

document.getElementById('recordButton').addEventListener('click', async () => {
  console.log('Нажата кнопка "Начать запись"');
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.start();
    document.getElementById('recordButton').disabled = true;
    document.getElementById('stopButton').disabled = false;
    fadeInStatus('Запись идёт...');
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

// Функция для плавного появления текста
function fadeInStatus(text) {
  const status = document.getElementById('status');
  status.style.opacity = '0';
  status.textContent = text;
  setTimeout(() => {
    status.style.transition = 'opacity 0.5s ease';
    status.style.opacity = '1';
  }, 10);
}