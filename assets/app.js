// CellScope Products — nav, year, contact form (static, no backend)
(function () {
  var toggle = document.getElementById('navToggle');
  var nav = document.getElementById('siteNav');
  if (toggle && nav) toggle.addEventListener('click', function () { nav.classList.toggle('open'); });

  var y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();

  var form = document.getElementById('contactForm');
  if (form) form.addEventListener('submit', function (e) {
    e.preventDefault();
    var data = new FormData(form);
    var subject = encodeURIComponent('CellScope inquiry: ' + (data.get('topic') || 'General'));
    var body = encodeURIComponent(
      'Name: ' + (data.get('name') || '') + '\n' +
      'Email: ' + (data.get('email') || '') + '\n\n' +
      (data.get('message') || '')
    );
    // TODO: replace with your real inbox
    window.location.href = 'mailto:hello@cellscope.example?subject=' + subject + '&body=' + body;
    var note = document.getElementById('formNote');
    if (note) note.textContent = 'Opening your email app…';
  });
})();
