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
    document.getElementById('status').textContent = 'Запись идёт...';
    document.getElementById('progressBar').style.display = 'none'; // Скрываем полоску
    mediaRecorder.ondataavailable = (event) => {
      audioChunks.push(event.data);
    };
  } catch (error) {
    console.error('Ошибка при доступе к микрофону:', error);
    document.getElementById('status').textContent = 'Ошибка доступа к микрофону';
  }
});

document.getElementById('stopButton').addEventListener('click', () => {
  console.log('Нажата кнопка "Остановить запись"');
  mediaRecorder.stop();
  document.getElementById('recordButton').disabled = false;
  document.getElementById('stopButton').disabled = true;

  // Запускаем анимацию "Обработка..." с точками
  let dots = 0;
  document.getElementById('status').textContent = 'Обработка';
  loadingInterval = setInterval(() => {
    dots = (dots + 1) % 4;
    document.getElementById('status').textContent = 'Обработка' + '.'.repeat(dots);
  }, 500);

  // Показываем и анимируем полоску прогресса
  const progressBar = document.getElementById('progressBar');
  progressBar.style.display = 'block';
  let progress = 0;
  const progressInterval = setInterval(() => {
    progress += 10;
    if (progress <= 90) { // Не доходит до 100%, пока не получим ответ
      progressBar.style.width = `${progress}%`;
    }
  }, 1000); // Увеличиваем каждую секунду

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
      
      // Останавливаем анимацию и завершаем прогресс
      clearInterval(loadingInterval);
      clearInterval(progressInterval);
      progressBar.style.width = '100%'; // Завершаем полоску
      setTimeout(() => {
        progressBar.style.display = 'none'; // Скрываем после завершения
      }, 500);
      document.getElementById('status').textContent = `Текст: ${result.text}`;
    } catch (error) {
      console.error('Ошибка при отправке аудио:', error);
      clearInterval(loadingInterval);
      clearInterval(progressInterval);
      progressBar.style.display = 'none';
      document.getElementById('status').textContent = 'Ошибка при обработке аудио';
    }
    audioChunks = [];
  };
});