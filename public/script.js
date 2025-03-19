let mediaRecorder;
let audioChunks = [];
let loadingInterval;

// Check and initialize Telegram Web App
if (window.Telegram?.WebApp) {
    window.Telegram.WebApp.ready();
    window.Telegram.WebApp.expand();
    // Multiple calls for reliability
    setTimeout(() => {
        window.Telegram.WebApp.expand();
    }, 500);
    setTimeout(() => {
        window.Telegram.WebApp.expand();
    }, 1000);
}

// Show loader initially
const loader = document.querySelector('.loader');
loader.style.display = 'flex';
console.log("Preloader should be visible");

// Hide loader after 2500ms (2.5 seconds)
setTimeout(() => {
    console.log("Hiding loader");
    loader.classList.add('hidden');
    document.querySelector('.container').style.display = 'flex';
}, 2500);

document.getElementById('recordButton').addEventListener('click', async () => {
    console.log('Start recording');
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.start();
        document.getElementById('recordButton').disabled = true;
        document.getElementById('stopButton').disabled = false;
        fadeInStatus('Recording...');
        document.getElementById('progressBar').style.display = 'none';
        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
        };
    } catch (error) {
        console.error('Microphone access error:', error);
        fadeInStatus('Microphone access error');
    }
});

document.getElementById('stopButton').addEventListener('click', () => {
    console.log('Stop recording');
    mediaRecorder.stop();
    document.getElementById('recordButton').disabled = false;
    document.getElementById('stopButton').disabled = true;

    let dots = 0;
    fadeInStatus('Processing');
    loadingInterval = setInterval(() => {
        dots = (dots + 1) % 4;
        document.getElementById('status').textContent = 'Processing' + '.'.repeat(dots);
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
            fadeInStatus(`Text: ${result.text}`);
        } catch (error) {
            console.error('Error sending audio:', error);
            clearInterval(loadingInterval);
            clearInterval(progressInterval);
            progressBar.style.display = 'none';
            fadeInStatus('Error processing audio');
        }
        audioChunks = [];
    };
});

// Function to fade status text
function fadeInStatus(text) {
    const status = document.getElementById('status');
    status.style.opacity = '0';
    status.textContent = text;
    setTimeout(() => {
        status.style.transition = 'opacity 0.5s ease';
        status.style.opacity = '1';
    }, 10);
}