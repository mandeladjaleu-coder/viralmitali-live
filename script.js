const menu = document.querySelector('.menu');
const nav = document.querySelector('#nav');
const progress = document.querySelector('.scroll-progress');

menu?.addEventListener('click', () => {
  const open = menu.getAttribute('aria-expanded') === 'true';
  menu.setAttribute('aria-expanded', String(!open));
  menu.querySelector('.sr-only').textContent = open ? 'Menü öffnen' : 'Menü schließen';
  nav?.classList.toggle('open', !open);
});

nav?.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => {
    menu?.setAttribute('aria-expanded', 'false');
    nav.classList.remove('open');
  });
});

const updateProgress = () => {
  if (!progress) return;
  const distance = document.documentElement.scrollHeight - innerHeight;
  progress.style.width = `${distance > 0 ? Math.min(100, scrollY / distance * 100) : 0}%`;
};
addEventListener('scroll', updateProgress, { passive: true });
updateProgress();

document.querySelectorAll('[data-booking-position]').forEach((link) => {
  link.addEventListener('click', () => {
    const payload = JSON.stringify({
      event: 'booking_cta_click',
      position: link.dataset.bookingPosition
    });
    navigator.sendBeacon?.('/api/booking-event', payload);
  });
});

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Hero-Video: startet stumm von selbst. Blockiert der Browser das (Stromsparmodus, reduzierte Bewegung),
// erscheint ein Play-Knopf, damit das Video trotzdem mit einem Tipp läuft.
const heroVideo = document.querySelector('.phone video');
const heroPlay = document.querySelector('[data-hero-play]');
if (heroVideo && heroPlay) {
  heroVideo.muted = true;
  const zeigeKnopf = () => { heroPlay.hidden = false; };
  heroPlay.addEventListener('click', () => {
    heroVideo.play().then(() => { heroPlay.hidden = true; }).catch(zeigeKnopf);
  });
  heroVideo.addEventListener('playing', () => { heroPlay.hidden = true; });
  if (reduced) {
    heroVideo.removeAttribute('autoplay');
    heroVideo.pause();
    zeigeKnopf();
  } else {
    heroVideo.play().catch(zeigeKnopf);
    // Manche iPhones lehnen still ab, ohne Fehler: nach kurzer Zeit nachsehen
    setTimeout(() => { if (heroVideo.paused) zeigeKnopf(); }, 2500);
  }
}

// Kundenvideos: eigener Play/Pause-Knopf statt nativer Controls, die in Safari Inline-Styles brauchen und die CSP verletzen
const kundenVideos = [...document.querySelectorAll('.video-player')].map((player) => {
  const video = player.querySelector('video');
  const knopf = player.querySelector('[data-video-play]');
  const name = knopf.getAttribute('aria-label').replace(/ abspielen$/, '');
  const setze = (laeuft) => {
    knopf.classList.toggle('laeuft', laeuft);
    knopf.setAttribute('aria-label', `${name} ${laeuft ? 'pausieren' : 'abspielen'}`);
    knopf.firstElementChild.textContent = laeuft ? '❚❚' : '▶';
  };
  knopf.addEventListener('click', () => {
    if (video.paused) {
      kundenVideos.forEach((andere) => { if (andere !== video) andere.pause(); });
      video.play();
    } else {
      video.pause();
    }
  });
  video.addEventListener('click', () => { if (!video.paused) video.pause(); });
  video.addEventListener('play', () => setze(true));
  video.addEventListener('pause', () => setze(false));
  video.addEventListener('ended', () => setze(false));
  return video;
});

// Cases als Coverflow: aktive Karte in der Mitte, Nachbarn gedreht dahinter
const flow = document.querySelector('[data-coverflow]');
const cards = flow ? [...flow.querySelectorAll('.case-card')] : [];
const zurueckKnopf = document.querySelector('[data-case-zurueck]');
const weiterKnopf = document.querySelector('[data-case-weiter]');
const caseName = document.querySelector('[data-case-name]');
let aktiv = 0;
const schmal = matchMedia('(max-width: 640px)');

const zeigeCase = (index) => {
  aktiv = (index + cards.length) % cards.length;
  cards.forEach((card, i) => {
    let offset = i - aktiv;
    if (offset > cards.length / 2) offset -= cards.length;
    if (offset < -cards.length / 2) offset += cards.length;
    const abstand = Math.abs(offset);
    card.classList.toggle('aktiv', offset === 0);
    card.setAttribute('aria-hidden', schmal.matches || offset === 0 ? 'false' : 'true');
    if (!schmal.matches) {
      card.style.transform = `translateX(${offset * 250}px) translateZ(${-abstand * 160}px) rotateY(${offset * -24}deg)`;
      card.style.zIndex = String(10 - abstand);
      card.style.opacity = abstand > 2 ? '0' : String(1 - abstand * 0.28);
      card.style.filter = offset === 0 ? 'none' : 'brightness(.7)';
    }
  });
  if (caseName) caseName.textContent = `${cards[aktiv].querySelector('h3')?.textContent || ''} · ${aktiv + 1} / ${cards.length}`;
};

if (cards.length) {
  cards.forEach((card, i) => card.addEventListener('click', () => {
    if (!schmal.matches) zeigeCase(i);
  }));
  const geheZu = (ziel) => {
    ziel = (ziel + cards.length) % cards.length;
    if (schmal.matches) cards[ziel].scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', inline: 'center', block: 'nearest' });
    zeigeCase(ziel);
  };
  zurueckKnopf?.addEventListener('click', () => geheZu(aktiv - 1));
  weiterKnopf?.addEventListener('click', () => geheZu(aktiv + 1));
  // Auf dem Handy wird gewischt: Name und Zähler folgen der Karte in der Mitte
  flow.addEventListener('scroll', () => {
    if (!schmal.matches) return;
    const mitte = flow.scrollLeft + flow.clientWidth / 2;
    const i = cards.reduce((best, c, n) => (Math.abs(c.offsetLeft + c.offsetWidth / 2 - mitte) < Math.abs(cards[best].offsetLeft + cards[best].offsetWidth / 2 - mitte) ? n : best), 0);
    if (i !== aktiv) zeigeCase(i);
  }, { passive: true });
  flow.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowRight') zeigeCase(aktiv + 1);
    if (event.key === 'ArrowLeft') zeigeCase(aktiv - 1);
  });
  schmal.addEventListener('change', () => {
    cards.forEach((card) => { card.style.transform = ''; card.style.opacity = ''; card.style.filter = ''; card.style.zIndex = ''; });
    zeigeCase(aktiv);
  });
  zeigeCase(0);
}

// Kennzahlen zählen beim ersten Sichtkontakt hoch; Endwert steht schon im HTML
const kennzahlen = document.querySelectorAll('.stats-oben strong');
if (!reduced && 'IntersectionObserver' in window) {
  const format = new Intl.NumberFormat('de-DE');
  const zaehlBeobachter = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      zaehlBeobachter.unobserve(entry.target);
      const element = entry.target;
      const ziel = element.textContent;
      const teile = ziel.match(/^([\d.]+)(.*)$/);
      if (!teile) return;
      const wert = Number(teile[1].replace(/\./g, ''));
      const start = performance.now();
      const schritt = (jetzt) => {
        const anteil = Math.min(1, (jetzt - start) / 1400);
        element.textContent = anteil < 1 ? format.format(Math.round(wert * (1 - (1 - anteil) ** 3))) + teile[2] : ziel;
        if (anteil < 1) requestAnimationFrame(schritt);
      };
      requestAnimationFrame(schritt);
    });
  }, { threshold: 0.6 });
  kennzahlen.forEach((element) => zaehlBeobachter.observe(element));
}

const reveals = document.querySelectorAll('.reveal');
if (reduced || !('IntersectionObserver' in window)) {
  reveals.forEach((element) => element.classList.add('in'));
} else {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -60px' });
  reveals.forEach((element) => observer.observe(element));
}
