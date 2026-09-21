// Viral mit Ali: Lead-Formulare (Rückruf, Kanal-Analyse, Leistungsanfrage), Herkunft der Besucher und Branchenfilter.
// Herkunft (UTM, Klick-IDs, externe Verweisseite) wird erst beim Absenden gelesen und geht nur mit der Anfrage oder Buchung an das ViralmitAli OS.
(() => {
  const seite = (location.pathname.split('/').filter(Boolean)[0]) || 'start';
  const zaehle = (event, position) => {
    try { navigator.sendBeacon?.((document.querySelector('meta[name="vma-api"]')?.content || '') + '/api/booking-event', JSON.stringify({ event, position })); } catch (e) { /* Messung blockiert nie */ }
  };

  /* ---------- Herkunft: nur aus der aktuellen Adresse, nichts wird im Browser gespeichert ---------- */
  // Bewusst ohne localStorage/sessionStorage (§ 25 TDDDG): UTM-Parameter und externe Verweisseite werden erst beim Absenden gelesen.
  const params = new URLSearchParams(location.search);
  window.vmaHerkunft = () => {
    const utm = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'].map((k) => (params.get(k) || '').slice(0, 60)).filter(Boolean).join(' / ');
    const klick = ['gclid', 'fbclid', 'ttclid'].find((k) => params.get(k));
    let ref = '';
    try {
      const r = document.referrer && new URL(document.referrer);
      if (r && r.hostname !== location.hostname) ref = r.hostname.replace(/^www\./, '');
    } catch (e) { /* ungültiger Referrer */ }
    return [utm && `utm: ${utm}`, klick && `Anzeige: ${{ gclid: 'Google', fbclid: 'Meta', ttclid: 'TikTok' }[klick]}`, ref && `von: ${ref}`, `Seite: ${location.pathname.slice(0, 80)}`]
      .filter(Boolean).join(' · ').slice(0, 480);
  };

  /* ---------- WhatsApp-Klicks zählen ---------- */
  document.querySelectorAll('[data-whatsapp]').forEach((a) => a.addEventListener('click', () => zaehle('whatsapp_click', seite)));

  /* ---------- Lead-Formulare ---------- */
  const TEXTE = { name: 'Bitte gib deinen Namen an.', telefon: 'Bitte gib eine Telefonnummer an, unter der wir dich erreichen.', email: 'Bitte prüfe deine E-Mail-Adresse.', profil: 'Bitte gib dein Instagram-, TikTok- oder YouTube-Profil an.', kontakt: 'Bitte gib E-Mail oder Telefon an.' };
  const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]{2,}$/;

  document.querySelectorAll('[data-lead-form]').forEach((form) => {
    const art = form.dataset.art;
    const fehler = form.querySelector('[data-lead-fehler]');
    const ok = form.parentElement.querySelector('[data-lead-ok]');
    const knopf = form.querySelector('[type="submit"]');
    const zeigeFehler = (text, feld) => {
      fehler.textContent = text;
      fehler.hidden = false;
      if (feld) { feld.setAttribute('aria-invalid', 'true'); feld.focus(); }
    };

    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
      fehler.hidden = true;
      const f = form.elements;
      const wert = (n) => (f[n] ? String(f[n].value || '').trim() : '');
      const d = { art, name: wert('name'), email: wert('email'), telefon: wert('telefon'), firma: wert('firma'), profil: wert('profil'), leistung: wert('leistung'), nachricht: wert('nachricht'), branche: wert('branche') ? (f.branche.selectedOptions?.[0]?.textContent || wert('branche')).trim() : '', website: wert('website') };
      if (d.name.length < 2) return zeigeFehler(TEXTE.name, f.name);
      if (art === 'rueckruf' && d.telefon.replace(/\D/g, '').length < 6) return zeigeFehler(TEXTE.telefon, f.telefon);
      if (d.email && !EMAIL.test(d.email)) return zeigeFehler(TEXTE.email, f.email);
      if (!d.email && !d.telefon) return zeigeFehler(TEXTE.kontakt, f.email || f.telefon);
      if (art === 'analyse' && d.profil.length < 3) return zeigeFehler(TEXTE.profil, f.profil);

      // Antworten aus dem Projekt-Check, falls der Rückruf aus dem Ergebnis kommt
      const check = form.hasAttribute('data-mit-check') ? (window.vmaCheckAntworten || {}) : {};
      const daten = {
        ...d, branche: d.branche || check.branche_text || '', ziel: check.ziel_text || '', stand: check.stand_text || '', budget: check.budget_text || '', start: check.start_text || '',
        seite: location.pathname.slice(0, 300), herkunft: window.vmaHerkunft()
      };
      Object.keys(daten).forEach((k) => { if (daten[k] === '' && k !== 'website') delete daten[k]; });

      const inhalt = knopf.innerHTML;
      knopf.disabled = true;
      knopf.textContent = 'Wird gesendet …';
      zaehle('lead_submit', art);
      try {
        const r = await fetch((document.querySelector('meta[name="vma-api"]')?.content || '') + '/api/anfrage', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(daten) });
        if (r.status === 429) throw new Error('viele');
        if (!r.ok) throw new Error(String(r.status));
        zaehle('lead_success', art);
        form.hidden = true;
        if (ok) {
          ok.hidden = false;
          const name = ok.querySelector('[data-lead-name]');
          if (name) name.textContent = d.name.split(' ')[0];
          ok.querySelector('h3, h2, p')?.focus({ preventScroll: false });
        }
      } catch (e) {
        zeigeFehler(e.message === 'viele'
          ? 'Gerade kommen sehr viele Anfragen. Versuch es in einer Minute noch einmal.'
          : 'Das hat nicht geklappt, das liegt an uns. Schreib uns bitte per WhatsApp oder E-Mail an info@innocostudio.com.');
      } finally {
        knopf.disabled = false;
        knopf.innerHTML = inhalt;
      }
    });
  });

  /* ---------- Leistungsseite: Branchenfilter ---------- */
  const filter = document.querySelector('[data-branchen-filter]');
  if (filter) {
    const knoepfe = [...filter.querySelectorAll('button[data-branche]')];
    const zeige = (b) => {
      knoepfe.forEach((k) => k.setAttribute('aria-pressed', String(k.dataset.branche === b)));
      // Pro Leistung nur die gewählte Branche zeigen; ohne JavaScript bleiben alle sechs sichtbar
      document.querySelectorAll('[data-anwendung]').forEach((el) => { el.hidden = el.dataset.anwendung !== b; });
      document.querySelectorAll('[data-lead-form] select[name="branche"]').forEach((s) => {
        if ([...s.options].some((o) => o.value === b)) s.value = b;
      });
    };
    knoepfe.forEach((k) => k.addEventListener('click', () => zeige(k.dataset.branche)));
    const start = params.get('branche') || '';
    zeige(knoepfe.some((k) => k.dataset.branche === start) ? start : knoepfe[0].dataset.branche);
  }

  /* ---------- "Diese Leistung anfragen": Formular vorbelegen ---------- */
  document.querySelectorAll('[data-leistung-anfragen]').forEach((a) => a.addEventListener('click', () => {
    const s = document.querySelector('#anfrage [name="leistung"]');
    if (s) s.value = a.dataset.leistungAnfragen;
  }));
})();
