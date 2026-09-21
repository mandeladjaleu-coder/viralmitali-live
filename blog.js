// Blog: Filter auf der Übersicht und Inhaltsverzeichnis mit aktiver Markierung. Ohne JS bleibt alles sichtbar.
(() => {
  const filter = document.querySelector('[data-blog-filter]');
  if (filter) {
    const karten = [...document.querySelectorAll('.blog-liste .blog-karte')];
    const status = document.querySelector('[data-blog-status]');
    const knoepfe = [...filter.querySelectorAll('button')];
    filter.hidden = false;
    filter.addEventListener('click', (event) => {
      const knopf = event.target.closest('button[data-filter]');
      if (!knopf) return;
      const wert = knopf.dataset.filter;
      knoepfe.forEach((k) => k.setAttribute('aria-pressed', String(k === knopf)));
      let sichtbar = 0;
      karten.forEach((karte) => {
        const passt = wert === 'alle' || karte.dataset.kategorie === wert || karte.dataset.branche === wert;
        karte.hidden = !passt;
        if (passt) sichtbar += 1;
      });
      document.querySelectorAll('.blog-liste .blog-grid').forEach((grid) => {
        grid.hidden = ![...grid.children].some((li) => !li.hidden);
      });
      if (status) status.textContent = wert === 'alle' ? '' : `${sichtbar} ${sichtbar === 1 ? 'Artikel' : 'Artikel'} in „${knopf.textContent}“`;
    });
  }

  const toc = document.querySelector('[data-toc]');
  if (toc) {
    const schmal = matchMedia('(max-width: 1060px)');
    if (schmal.matches) toc.open = false;
    const links = [...toc.querySelectorAll('a[href^="#"]')];
    const ziele = links.map((l) => document.getElementById(decodeURIComponent(l.hash.slice(1)))).filter(Boolean);
    if ('IntersectionObserver' in window && ziele.length) {
      const beobachter = new IntersectionObserver((eintraege) => {
        eintraege.forEach((e) => {
          if (!e.isIntersecting) return;
          links.forEach((l) => l.removeAttribute('aria-current'));
          toc.querySelector(`a[href="#${e.target.id}"]`)?.setAttribute('aria-current', 'true');
        });
      }, { rootMargin: '0px 0px -70% 0px' });
      ziele.forEach((z) => beobachter.observe(z));
    }
    links.forEach((l) => l.addEventListener('click', () => { if (schmal.matches) toc.open = false; }));
  }
})();
