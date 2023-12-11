function soundPlay(index) {
    document.getElementById('fart' + index).play();
}

let sendEmailBtn = document.querySelector('#sendEmail');
sendEmailBtn.addEventListener('click', function () {
  var email = 'devmango1128@gmail.com';
  var subject = '[fartSound 사이트 문의]';
  window.location = "mailto:".concat(email, "?subject=").concat(subject);
});