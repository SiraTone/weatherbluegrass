// CellScope Products: small, dependency-free progressive enhancement
(function () {
  'use strict';
  var d = document;

  /* Mark page as entering so CSS can stagger top-level blocks */
  var main = d.getElementById('main');
  if (main) main.classList.add('page-in');


  /* Headline word rotator (storm / reflectivity / velocity) */
  var rot = d.getElementById('rotator');
  if (rot && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var words = ['storm', 'reflectivity', 'velocity'], wi = 0;
    setInterval(function () {
      rot.classList.add('is-out');
      setTimeout(function () {
        wi = (wi + 1) % words.length;
        rot.textContent = words[wi];
        rot.classList.remove('is-out');
        rot.classList.add('is-pre');
        void rot.offsetWidth;
        rot.classList.remove('is-pre');
      }, 360);
    }, 2600);
  }

  /* Year */
  var y = d.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();

  /* Mobile nav */
  var toggle = d.getElementById('navToggle');
  var nav = d.getElementById('siteNav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.hasAttribute('data-open');
      if (open) nav.removeAttribute('data-open'); else nav.setAttribute('data-open', '');
      toggle.setAttribute('aria-expanded', String(!open));
    });
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) { nav.removeAttribute('data-open'); toggle.setAttribute('aria-expanded', 'false'); }
    });
  }

  /* Anchor landing: re-snap after images/fonts settle */
  function snap() {
    if (!location.hash) return;
    var el = d.querySelector(location.hash);
    if (el) el.scrollIntoView();
  }
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    // Blocks that already animate in on load must not also get the scroll reveal.
    var onLoad = d.querySelectorAll(
      '.page-in > .section > .container > *, .page-in > .container--tight > *, .page-in > .container > *'
    );
    var skip = new Set(onLoad);
    d.querySelectorAll('.pcard, .product, .callout, .stat, .video-grid figure, .cta, .split > *').forEach(function (el) {
      if (skip.has(el) || el.closest('footer')) return;
      el.classList.add('reveal');
      io.observe(el);
    });
  } else {
    d.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('is-in'); });
  }
  window.addEventListener('load', function () { setTimeout(snap, 60); });

  /* Videos: play what you can see, pause what you can't (saves CPU) */
  if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var vio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var v = en.target;
        if (en.isIntersecting) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
        else v.pause();
      });
    }, { threshold: 0.5 });
    d.querySelectorAll('video[autoplay]').forEach(function (v) { vio.observe(v); });
  }

  /* Contact form -> prefilled email */
  var form = d.getElementById('contactForm');
  if (form) form.addEventListener('submit', function (e) {
    e.preventDefault();
    var fd = new FormData(form);
    var subject = encodeURIComponent('CellScope inquiry: ' + (fd.get('topic') || 'General'));
    var body = encodeURIComponent('Name: ' + (fd.get('name') || '') + '\nEmail: ' + (fd.get('email') || '') + '\n\n' + (fd.get('message') || ''));
    var note = d.getElementById('formNote');
    if (note) note.textContent = 'Opening your email app…';
    location.href = 'mailto:Frymoon5@gmail.com?subject=' + subject + '&body=' + body;
  });
})();
