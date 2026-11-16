// Bhala website: mobile menu, and a friendly note on forms when the page is only a preview.
(function () {
  var btn = document.querySelector('.menu-btn');
  var nav = document.getElementById('nav');
  if (btn && nav) {
    btn.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    });
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) { nav.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); }
    });
  }
  if (window.BHALA_PREVIEW) {
    document.querySelectorAll('form[data-netlify]').forEach(function (f) {
      f.addEventListener('submit', function (e) {
        e.preventDefault();
        var msg = f.querySelector('.form-msg');
        if (!msg) { msg = document.createElement('p'); msg.className = 'form-msg'; msg.setAttribute('role', 'status'); f.appendChild(msg); }
        msg.textContent = 'This is a preview. On bhala.netlify.app this form sends to your Netlify inbox and email.';
      });
    });
  }
})();
