"use strict";

(() => {
  // Глобальная переменная для хранения Telegram User ID (будет установлена после инициализации)
  let telegramUserId = null;
  let mediaRecorder;
  let audioChunks = [];
  let audioContext;
  let analyser;
  let source;
  let isRecording = false;
  let recordStartTime = 0;
  let timerInterval = null;
  const waveContainer = document.querySelector(".wave-container");
  const colors = [
    "#ff7070", "#ffb670", "#ffe570", "#a3d8f4", "#91ccea", "#88c6e5", "#76bada", "#64aed0", "#5ba8cb", "#52a2c6"
  ];

  // Функция для логирования
  function logToInterface(message) {
    const debugLog = document.getElementById("debugLog");
    if (debugLog) {
      debugLog.textContent = message;
    }
    console.log(message);
  }

  // Асинхронное получение Telegram User ID через Telegram WebApp
  async function getTelegramUserId() {
    return new Promise((resolve) => {
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.ready();
        window.Telegram.WebApp.expand();
        const checkUserId = () => {
          if (
            window.Telegram.WebApp.initDataUnsafe &&
            window.Telegram.WebApp.initDataUnsafe.user &&
            window.Telegram.WebApp.initDataUnsafe.user.id
          ) {
            telegramUserId = window.Telegram.WebApp.initDataUnsafe.user.id;
            console.log("Telegram User ID установлен:", telegramUserId);
            resolve(telegramUserId);
          } else {
            setTimeout(checkUserId, 100);
          }
        };
        checkUserId();
      } else {
        console.warn("Telegram WebApp не найден");
        resolve(null);
      }
    });
  }

  // Управление отображением прелоадера и основного контейнера
  function toggleLoader(show) {
    const loader = document.querySelector(".loader");
    const container = document.querySelector(".container");
    if (loader && container) {
      if (show) {
        loader.style.display = "block";
        container.style.display = "none";
      } else {
        loader.style.display = "none";
        container.style.display = "block";
      }
    } else {
      console.error("Элементы прелоадера или контейнера не найдены");
    }
  }

  // Создание и анимация волн с асинхронными настройками
  function createWaves() {
    try {
      waveContainer.innerHTML = "";
      const waveCount = window.innerWidth < 480 ? 5 : 10;
      logToInterface(`Создаём ${waveCount} волн`);
      for (let i = 1; i <= waveCount; i++) {
        const wave = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        wave.classList.add("wave", `wave-${i}`);
        wave.setAttribute("viewBox", "0 0 1000 200");
        wave.setAttribute("preserveAspectRatio", "none");

        // Для разнообразия оттенков используем случайный цвет из массива
        const color1 = colors[Math.floor(Math.random() * colors.length)];
        const color2 = colors[Math.floor(Math.random() * colors.length)];

        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.classList.add("wave-path");
        path.setAttribute(
          "d",
          `M0,${100 + i * 4} Q125,${80 + i * 4} 250,${100 + i * 4} T500,${100 + i * 4} T750,${100 + i * 4} T1000,${100 + i * 4} V200 H0 Z`
        );
        path.setAttribute("fill", `url(#gradient${i})`);

        const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
        const gradient = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient");
        gradient.setAttribute("id", `gradient${i}`);
        gradient.setAttribute("x1", "0%");
        gradient.setAttribute("y1", "0%");
        gradient.setAttribute("x2", "100%");
        gradient.setAttribute("y2", "0%");

        const stop1 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
        stop1.setAttribute("offset", "0%");
        stop1.setAttribute("style", `stop-color:${color1};stop-opacity:0.8`);
        const stop2 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
        stop2.setAttribute("offset", "100%");
        stop2.setAttribute("style", `stop-color:${color2};stop-opacity:0.8`);

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

  // Инициализация Web Audio API и анализ звука (усиленная реакция на громкость)
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
          resetWaves();
          return;
        }
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((sum, val) => sum + val, 0) / bufferLength;
        // Усиливаем реакцию: увеличиваем амплитуду в 2 раза
        const amplitude = Math.min((avg / 128) * 2, 1);
        logToInterface(`Громкость: ${avg.toFixed(2)}, Амплитуда: ${amplitude.toFixed(2)}`);

        // Обновляем CSS-переменные: базовое значение плюс пропорциональное увеличение
        document.documentElement.style.setProperty("--amplitude", `${10 + amplitude * 30}px`);
        // Вычисляем скорость как обратную величину амплитуды (чем громче, тем быстрее)
        document.documentElement.style.setProperty("--speed", `${10 - amplitude * 6}s`);

        requestAnimationFrame(updateWaves);
      }
      updateWaves();
    } catch (error) {
      logToInterface(`Ошибка Web Audio API: ${error.message}`);
    }
  }

  // Сброс значений волн до исходных
  function resetWaves() {
    document.documentElement.style.setProperty("--amplitude", "10px");
    document.documentElement.style.setProperty("--speed", "10s");
  }

  // Плавное обновление статуса
  function fadeInStatus(text) {
    const status = document.getElementById("status");
    if (!status) {
      logToInterface("Ошибка: элемент #status не найден");
      return;
    }
    status.style.opacity = "0";
    status.textContent = text;
    setTimeout(() => {
      status.style.transition = "opacity 0.5s ease";
      status.style.opacity = "1";
    }, 10);
  }

  // Таймер записи
  function startTimer() {
    recordStartTime = Date.now();
    const timerElement = document.getElementById("timer");
    timerInterval = setInterval(() => {
      const elapsed = Date.now() - recordStartTime;
      const hours = Math.floor(elapsed / 3600000);
      const minutes = Math.floor((elapsed % 3600000) / 60000);
      const seconds = Math.floor((elapsed % 60000) / 1000);
      timerElement.textContent = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }, 1000);
  }

  function stopTimer() {
    clearInterval(timerInterval);
    const timerElement = document.getElementById("timer");
    timerElement.textContent = "00:00:00";
  }

  // Инициализация обработчиков записи
  function initRecordHandlers() {
    const recordButton = document.getElementById("recordButton");
    const stopButton = document.getElementById("stopButton");
    if (!recordButton || !stopButton) {
      logToInterface("Ошибка: кнопки не найдены");
      return;
    }

    recordButton.addEventListener("click", async () => {
      logToInterface('Нажата кнопка "Начать запись"');
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.start();
        isRecording = true;
        recordButton.disabled = true;
        stopButton.disabled = false;
        fadeInStatus("Идёт запись...");
        document.getElementById("progressBar").style.display = "none";
        audioChunks = [];
        mediaRecorder.ondataavailable = (event) => {
          audioChunks.push(event.data);
        };
        startTimer();
        await setupAudioAnalysis(stream);
      } catch (error) {
        logToInterface(`Ошибка доступа к микрофону: ${error.message}`);
        fadeInStatus("Ошибка доступа к микрофону");
      }
    });

    stopButton.addEventListener("click", () => {
      logToInterface('Нажата кнопка "Остановить запись"');
      if (mediaRecorder && mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
      }
      isRecording = false;
      recordButton.disabled = false;
      stopButton.disabled = true;
      stopTimer();
      if (audioContext) {
        audioContext.close();
        audioContext = null;
        logToInterface("Web Audio API остановлен");
      }
      resetWaves();

      let dots = 0;
      fadeInStatus("Обработка");
      const loadingInterval = setInterval(() => {
        dots = (dots + 1) % 4;
        document.getElementById("status").textContent = "Обработка" + ".".repeat(dots);
      }, 500);

      const progressBar = document.getElementById("progressBar");
      progressBar.style.display = "block";
      let progress = 0;
      const progressInterval = setInterval(() => {
        progress += 10;
        if (progress <= 90) {
          progressBar.style.width = `${progress}%`;
        }
      }, 1000);

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
        const formData = new FormData();
        formData.append("audio", audioBlob, "recording.webm");

        // Если Telegram User ID не получен – прекращаем отправку с ошибкой
        if (!telegramUserId) {
          console.error("Telegram User ID не получен. Убедитесь, что вы нажали 'Start' в чате с ботом.");
          fadeInStatus("Ошибка: не получен Telegram User ID. Нажмите 'Start' в чате с ботом.");
          clearInterval(loadingInterval);
          clearInterval(progressInterval);
          progressBar.style.display = "none";
          return;
        } else {
          formData.append("userId", telegramUserId);
          console.log("Передан userId:", telegramUserId);
        }

        try {
          const response = await fetch("/transcribe", {
            method: "POST",
            body: formData,
          });
          const result = await response.json();
          clearInterval(loadingInterval);
          clearInterval(progressInterval);
          progressBar.style.width = "100%";
          setTimeout(() => {
            progressBar.style.display = "none";
          }, 500);
          fadeInStatus(`Текст: ${result.text}`);
        } catch (error) {
          logToInterface(`Ошибка при отправке аудио: ${error.message}`);
          clearInterval(loadingInterval);
          clearInterval(progressInterval);
          progressBar.style.display = "none";
          fadeInStatus("Ошибка при обработке аудио");
        }
      };
    });
  }

  // Инициализация приложения
  async function initApp() {
    toggleLoader(true);
    await getTelegramUserId(); // Ждем, пока данные пользователя будут получены
    createWaves();
    initRecordHandlers();
    toggleLoader(false);
    logToInterface("Инициализация завершена");
  }

  window.addEventListener("DOMContentLoaded", initApp);
})();
