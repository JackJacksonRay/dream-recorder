"use strict";

(() => {
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
    "#a3d8f4", "#9ad2ef", "#91ccea", "#88c6e5", "#7fc0e0",
    "#76bada", "#6db4d5", "#64aed0", "#5ba8cb", "#52a2c6"
  ];

  function logToInterface(message) {
    const debugLog = document.getElementById("debugLog");
    if (debugLog) debugLog.textContent = message;
    console.log(message);
  }

  async function getTelegramUserId() {
    return new Promise((resolve) => {
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.ready();
        window.Telegram.WebApp.expand();
        const checkUserId = () => {
          if (window.Telegram.WebApp.initDataUnsafe?.user?.id) {
            telegramUserId = window.Telegram.WebApp.initDataUnsafe.user.id;
            logToInterface("Telegram User ID установлен: " + telegramUserId);
            resolve(telegramUserId);
          } else {
            setTimeout(checkUserId, 100);
          }
        };
        checkUserId();
      } else {
        logToInterface("Telegram Web App не найден");
        resolve(null);
      }
    });
  }

  function toggleLoader(show) {
    const loader = document.querySelector(".loader");
    const container = document.querySelector(".container");
    if (loader && container) {
      if (show) {
        loader.classList.remove("hidden");
        container.classList.add("hidden");
      } else {
        loader.classList.add("hidden");
        container.classList.remove("hidden");
      }
    }
  }

  function createWaves() {
    waveContainer.innerHTML = "";
    const waveCount = window.innerWidth < 480 ? 5 : 10;
    for (let i = 1; i <= waveCount; i++) {
      const wave = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      wave.classList.add("wave", `wave-${i}`);
      wave.setAttribute("viewBox", "0 0 1000 200");
      wave.setAttribute("preserveAspectRatio", "none");

      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.classList.add("wave-path");
      path.setAttribute(
        "d",
        `M0,${100 + i * 5} Q125,${85 + i * 5} 250,${100 + i * 5} T500,${100 + i * 5} T750,${100 + i * 5} T1000,${100 + i * 5} V200 H0 Z`
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
      stop1.setAttribute("style", `stop-color:${colors[i - 1]};stop-opacity:0.7`);
      const stop2 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
      stop2.setAttribute("offset", "100%");
      stop2.setAttribute("style", `stop-color:${colors[i % colors.length]};stop-opacity:0.7`);

      gradient.appendChild(stop1);
      gradient.appendChild(stop2);
      defs.appendChild(gradient);
      wave.appendChild(defs);
      wave.appendChild(path);
      waveContainer.appendChild(wave);
    }
  }

  async function setupAudioAnalysis(stream) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    analyser.fftSize = 256;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    function updateWaves() {
      if (!isRecording) {
        resetWaves();
        return;
      }
      analyser.getByteFrequencyData(dataArray);
      const avg = dataArray.reduce((sum, val) => sum + val, 0) / bufferLength;
      const amplitude = Math.min(avg / 128, 1);
      document.documentElement.style.setProperty("--amplitude", `${10 + amplitude * 20}px`);
      document.documentElement.style.setProperty("--speed", `${10 - amplitude * 5}s`);
      requestAnimationFrame(updateWaves);
    }
    updateWaves();
  }

  function resetWaves() {
    document.documentElement.style.setProperty("--amplitude", "10px");
    document.documentElement.style.setProperty("--speed", "10s");
  }

  function fadeInStatus(text) {
    const status = document.getElementById("status");
    status.style.opacity = "0";
    status.textContent = text;
    setTimeout(() => {
      status.style.transition = "opacity 0.5s ease";
      status.style.opacity = "1";
    }, 10);
  }

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
    document.getElementById("timer").textContent = "00:00:00";
  }

  function initRecordHandlers() {
    const recordButton = document.getElementById("recordButton");
    const stopButton = document.getElementById("stopButton");

    recordButton.addEventListener("click", async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.start();
      isRecording = true;
      recordButton.disabled = true;
      stopButton.disabled = false;
      fadeInStatus("Идёт запись...");
      document.getElementById("progressBar").style.display = "none";
      audioChunks = [];
      mediaRecorder.ondataavailable = (event) => audioChunks.push(event.data);
      startTimer();
      await setupAudioAnalysis(stream);
    });

    stopButton.addEventListener("click", () => {
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
        if (progress <= 90) progressBar.style.width = `${progress}%`;
      }, 1000);

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
        const formData = new FormData();
        formData.append("audio", audioBlob, "recording.webm");
        formData.append("userId", telegramUserId);

        try {
          const response = await fetch("/transcribe", {
            method: "POST",
            body: formData,
          });
          const result = await response.json();
          clearInterval(loadingInterval);
          clearInterval(progressInterval);
          progressBar.style.width = "100%";
          setTimeout(() => progressBar.style.display = "none", 500);
          fadeInStatus("Запись обработана");
        } catch (error) {
          clearInterval(loadingInterval);
          clearInterval(progressInterval);
          progressBar.style.display = "none";
          fadeInStatus("Ошибка при обработке");
          logToInterface("Ошибка отправки: " + error.message);
        }
      };
    });
  }

  async function initApp() {
    toggleLoader(true);
    await getTelegramUserId();
    createWaves();
    initRecordHandlers();
    toggleLoader(false);
    logToInterface("Приложение готово");
  }

  window.addEventListener("DOMContentLoaded", initApp);
})();