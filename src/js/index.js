function soundPlay(index) {
    document.getElementById('fart' + index).play();
}

let sendEmailBtn = document.querySelector('#sendEmail');
sendEmailBtn.addEventListener('click', function () {
  var email = 'devmango1128@gmail.com';
  var subject = '[fartSound 사이트 문의]';
  window.location = "mailto:".concat(email, "?subject=").concat(subject);
});

document.getElementById('audio-input').addEventListener('change', function(event) {
    const audioInput = event.target;
    if (audioInput.files.length === 0) {
        alert('오디오 파일을 선택해주세요.');
        return;
    }

    const audioFile = audioInput.files[0];
    const resultElement = document.getElementById('result');

    // 간단한 분석 로직
    const reader = new FileReader();
    reader.onload = function(event) {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        audioContext.decodeAudioData(event.target.result, function(buffer) {
            const duration = buffer.duration;
            const rms = calculateRMS(buffer.getChannelData(0));

            let result = '';
            let resultClass = '';

            if (rms > 0.02) {
                result = '건강한 방귀';
                resultClass = 'healthy';
            } else {
                result = '건강에 문제가 있을 수 있습니다';
                resultClass = 'unhealthy';
            }

            resultElement.innerHTML = `<span class="${resultClass}">결과: ${result}</span><br><span class="result-details">(길이: ${duration.toFixed(2)}초, RMS: ${rms.toFixed(5)})</span>`;
        });
    };
    reader.readAsArrayBuffer(audioFile);
});

function calculateRMS(audioData) {
    let sum = 0;
    for (let i = 0; i < audioData.length; i++) {
        sum += audioData[i] * audioData[i];
    }
    return Math.sqrt(sum / audioData.length);
}

