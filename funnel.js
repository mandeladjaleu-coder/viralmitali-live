// Viral mit Ali: Projekt-Check mit eigener Terminbuchung, Content-Check und Hook-Generator.
// Antworten bleiben im Browser, bis jemand einen Termin bucht. Erst dann gehen sie über /api/buchen an das ViralmitAli OS.
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const seite = (location.pathname.split('/').filter(Boolean)[0]) || 'start';
  const zaehle = (event, position) => {
    try {
      navigator.sendBeacon?.((document.querySelector('meta[name="vma-api"]')?.content || '') + '/api/booking-event', JSON.stringify({ event, position }));
    } catch (e) { /* Messung darf nie den Weg blockieren */ }
  };

  /* ---------- Projekt-Check (Dialog, 5 Schritte + Ergebnis + Buchung) ---------- */
  const dialog = document.querySelector('[data-projekt-check]');
  if (dialog) {
    const schritte = [...dialog.querySelectorAll('.pc-schritt')];
    const balken = dialog.querySelector('.pc-fortschritt span');
    const zurueck = dialog.querySelector('[data-pc-zurueck]');
    const ergebnis = dialog.querySelector('.pc-ergebnis');
    const kopf = dialog.querySelector('.pc-kopf p');
    const kopfText = kopf?.textContent || '';
    const buchung = dialog.querySelector('[data-buchung]');
    const antworten = {};
    // Für den Rückruf-Weg im Ergebnis (lead.js) lesbar, verlässt den Browser erst beim Absenden
    window.vmaCheckAntworten = antworten;
    let aktuell = 0;
    let ausloeser = null;

    const q = (sel) => buchung?.querySelector(sel);
    const bu = buchung ? {
      auswahl: q('[data-bu-auswahl]'), titel: q('[data-bu-titel]'), status: q('[data-bu-status]'), tage: q('[data-bu-tage]'), zeiten: q('[data-bu-zeiten]'),
      form: q('[data-bu-form]'), formTitel: q('[data-bu-form] h2'), gewaehlt: q('[data-bu-gewaehlt-text]'), anders: q('[data-bu-anders]'), formFehler: q('[data-bu-formfehler]'), absenden: q('[data-bu-form] [type="submit"]'),
      ok: q('[data-bu-ok]'), okTitel: q('[data-bu-ok] h2'), okText: q('[data-bu-ok-text]'), okMail: q('[data-bu-ok-mail]'), meet: q('[data-bu-meet]'), ics: q('[data-bu-ics]'),
      notfall: q('[data-bu-notfall]'), notfallTitel: q('[data-bu-notfall] h2'), notfallText: q('[data-bu-notfall-text]')
    } : null;
    let buPosition = 'check';
    let zeitzone = 'Europe/Berlin';
    let dauer = 30;
    let gewaehlt = null;
    let ladeNr = 0;

    const zeige = (i) => {
      aktuell = i;
      if (buchung) buchung.hidden = true;
      if (kopf) kopf.textContent = kopfText;
      schritte.forEach((s, n) => { s.hidden = n !== i; });
      ergebnis.hidden = true;
      zurueck.hidden = i === 0;
      balken.style.width = `${((i + 1) / (schritte.length + 1)) * 100}%`;
      const erstes = schritte[i].querySelector('button, input');
      erstes?.focus({ preventScroll: true });
    };

    const zeigeErgebnis = () => {
      schritte.forEach((s) => { s.hidden = true; });
      if (buchung) buchung.hidden = true;
      zurueck.hidden = false;
      balken.style.width = '100%';
      ergebnis.hidden = false;
      ergebnis.querySelector('[data-pc-titel]').focus({ preventScroll: true });
    };

    const auswerten = () => {
      const passt = antworten.budget !== 'unter-1500' && antworten.start !== 'irgendwann';
      const titel = ergebnis.querySelector('[data-pc-titel]');
      const text = ergebnis.querySelector('[data-pc-text]');
      const alternative = ergebnis.querySelector('[data-pc-alternative]');
      const JE_ZIEL = {
        kunden: 'Wir verbinden Videos mit Profil, Link und DM-Setting, damit aus Zuschauern Anfragen werden. Im Gespräch schauen wir auf deine Positionierung und dein Profil.',
        recruiting: 'Für Recruiting bauen wir Arbeitgeber-Formate, die zeigen, wie es bei euch wirklich ist, und eine Kurzbewerbung ohne Anschreiben. Im Gespräch schauen wir, welche Formate zuerst Bewerbungen bringen.',
        marke: 'Wir entwickeln 2 bis 3 wiederkehrende Formate, an denen man dich erkennt. Im Gespräch schauen wir, welche Themen deine Zielgruppe wirklich sehen will.',
        verkauf: 'Wir verbinden Produktvideos mit Shop, Link und Performance-Creatives. Im Gespräch schauen wir, welches Produkt sich zuerst lohnt.'
      };
      if (passt) {
        titel.textContent = 'Das klingt nach einem Match.';
        text.textContent = JE_ZIEL[antworten.ziel] || JE_ZIEL.kunden;
        alternative.hidden = true;
      } else {
        titel.textContent = 'Lass uns trotzdem sprechen, aber realistisch.';
        text.textContent = 'Für ein komplettes Produktionspaket ist es vielleicht noch zu früh. Im Gespräch zeigen wir dir, was mit deinem Rahmen jetzt schon geht, oder du startest mit einer kostenlosen Kanal-Analyse.';
        alternative.hidden = false;
      }
      zaehle('check_complete', passt ? 'passt' : 'spaeter');
      zeigeErgebnis();
    };

    /* ----- Terminbuchung ----- */
    const fmt = (optionen) => new Intl.DateTimeFormat('de-DE', { timeZone: zeitzone, ...optionen });
    const tagSchluessel = (iso) => new Intl.DateTimeFormat('en-CA', { timeZone: zeitzone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
    const uhrzeit = (iso) => fmt({ hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
    const langDatum = (iso) => fmt({ weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(iso));
    const berlinDatum = (plusTage) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(Date.now() + plusTage * 864e5));

    const zeigeTeil = (teil) => {
      for (const k of ['auswahl', 'form', 'ok', 'notfall']) bu[k].hidden = bu[k] !== teil;
      zurueck.hidden = !(teil === bu.form || (teil === bu.auswahl && buPosition === 'check'));
    };

    const notfall = (keineTermine) => {
      bu.notfallTitel.textContent = keineTermine ? 'Gerade sind online keine Termine frei.' : 'Die Terminbuchung ist gerade nicht erreichbar.';
      bu.notfallText.textContent = keineTermine
        ? 'In den nächsten 14 Tagen ist kein Termin mehr frei. Schreib uns kurz, dann schlagen wir dir einen Termin vor.'
        : 'Das liegt an uns, nicht an dir. Schreib uns kurz oder ruf an, dann vereinbaren wir den Termin direkt.';
      zeigeTeil(bu.notfall);
      bu.notfallTitel.focus({ preventScroll: true });
    };

    const waehleZeit = (slot, knopf) => {
      gewaehlt = slot;
      bu.zeiten.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === knopf)));
      zaehle('booking_slot_select', buPosition);
      bu.gewaehlt.textContent = `${langDatum(slot.start)} um ${uhrzeit(slot.start)} Uhr, ${dauer} Minuten`;
      bu.formFehler.hidden = true;
      zeigeTeil(bu.form);
      bu.form.elements.name.focus({ preventScroll: true });
    };

    const waehleTag = (schluessel, slots, knopf) => {
      bu.tage.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === knopf)));
      bu.zeiten.replaceChildren(...slots.map((slot) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.setAttribute('aria-pressed', 'false');
        b.textContent = `${uhrzeit(slot.start)} Uhr`;
        b.setAttribute('aria-label', `${langDatum(slot.start)}, ${uhrzeit(slot.start)} Uhr`);
        b.addEventListener('click', () => waehleZeit(slot, b));
        return b;
      }));
      bu.zeiten.hidden = false;
      bu.status.textContent = `${slots.length} ${slots.length === 1 ? 'freie Zeit' : 'freie Zeiten'} am ${langDatum(slots[0].start)}.`;
    };

    const ladeSlots = async (hinweis = '') => {
      const nr = ++ladeNr;
      bu.status.textContent = hinweis || 'Freie Termine werden geladen …';
      bu.tage.replaceChildren();
      bu.zeiten.replaceChildren();
      bu.zeiten.hidden = true;
      let daten;
      try {
        const r = await fetch(`${(document.querySelector('meta[name="vma-api"]')?.content || '')}/api/slots?von=${berlinDatum(0)}&bis=${berlinDatum(13)}`, {
          headers: { accept: 'application/json' },
          ...(AbortSignal.timeout ? { signal: AbortSignal.timeout(15000) } : {})
        });
        if (!r.ok) throw new Error(String(r.status));
        daten = await r.json();
      } catch (e) {
        if (nr !== ladeNr) return;
        zaehle('booking_error', 'slots');
        notfall(false);
        return;
      }
      if (nr !== ladeNr) return;
      zeitzone = typeof daten.zeitzone === 'string' ? daten.zeitzone : 'Europe/Berlin';
      dauer = Number.isFinite(daten.dauer_min) ? daten.dauer_min : 30;
      const ab = Date.now() + 5 * 60e3;
      const nachTag = new Map();
      (daten.slots || [])
        .filter((s) => Date.parse(s.start) > ab)
        .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
        .forEach((s) => {
          const k = tagSchluessel(s.start);
          if (!nachTag.has(k)) nachTag.set(k, []);
          nachTag.get(k).push(s);
        });
      const tage = [...nachTag.entries()].slice(0, 14);
      if (!tage.length) { notfall(true); return; }
      bu.tage.replaceChildren(...tage.map(([k, slots]) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.setAttribute('aria-pressed', 'false');
        const tag = document.createElement('b');
        tag.textContent = fmt({ weekday: 'short' }).format(new Date(slots[0].start)).replace('.', '');
        const datum = document.createElement('span');
        datum.textContent = fmt({ day: '2-digit', month: '2-digit' }).format(new Date(slots[0].start));
        b.append(tag, datum);
        b.setAttribute('aria-label', `${langDatum(slots[0].start)}, ${slots.length} ${slots.length === 1 ? 'freie Zeit' : 'freie Zeiten'}`);
        b.addEventListener('click', () => waehleTag(k, slots, b));
        return b;
      }));
      bu.status.textContent = `${hinweis ? `${hinweis} ` : ''}Wähle einen Tag.`;
    };

    const oeffneBuchung = (position) => {
      buPosition = position;
      gewaehlt = null;
      schritte.forEach((s) => { s.hidden = true; });
      ergebnis.hidden = true;
      buchung.hidden = false;
      balken.style.width = '100%';
      bu.form.reset();
      bu.form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
      bu.formFehler.hidden = true;
      zeigeTeil(bu.auswahl);
      bu.titel.focus({ preventScroll: true });
      ladeSlots();
    };

    const formFehler = (text) => {
      bu.formFehler.textContent = text;
      bu.formFehler.hidden = false;
    };

    const bestaetigung = (antwort, email) => {
      const termin = antwort.termin?.start ? antwort.termin : gewaehlt;
      bu.okText.textContent = `${langDatum(termin.start)} um ${uhrzeit(termin.start)} Uhr, ${dauer} Minuten.`;
      bu.okMail.textContent = `Die Kalender-Einladung kommt per E-Mail an ${email}. Falls sie nicht auftaucht, schau kurz im Spam-Ordner nach.`;
      const meet = antwort.termin?.meet_link;
      bu.meet.hidden = !(typeof meet === 'string' && meet.startsWith('https://'));
      if (!bu.meet.hidden) bu.meet.href = meet;
      bu.ics.hidden = !(typeof antwort.ics_url === 'string' && antwort.ics_url.startsWith('https://'));
      if (!bu.ics.hidden) bu.ics.href = antwort.ics_url;
      zeigeTeil(bu.ok);
      bu.okTitel.focus({ preventScroll: true });
    };

    if (buchung) {
      bu.anders.addEventListener('click', () => { zeigeTeil(bu.auswahl); bu.titel.focus({ preventScroll: true }); });
      bu.form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!gewaehlt || bu.absenden.disabled) return;
        const f = bu.form.elements;
        const name = f.name.value.trim();
        const email = f.email.value.trim();
        const nameFalsch = name.length < 2;
        const mailFalsch = !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
        f.name.setAttribute('aria-invalid', String(nameFalsch));
        f.email.setAttribute('aria-invalid', String(mailFalsch));
        if (nameFalsch || mailFalsch) {
          formFehler(nameFalsch ? 'Bitte gib deinen Namen an.' : 'Bitte prüfe deine E-Mail-Adresse.');
          (nameFalsch ? f.name : f.email).focus();
          return;
        }
        bu.formFehler.hidden = true;
        const herkunft = window.vmaHerkunft?.() || '';
        const nachricht = [antworten.stand_text && `Stand: ${antworten.stand_text}`, f.nachricht.value.trim(), herkunft && `Herkunft: ${herkunft}`].filter(Boolean).join('\n').slice(0, 1500);
        const daten = {
          start: gewaehlt.start, name, email, telefon: f.telefon.value.trim(), firma: f.firma.value.trim(),
          branche: antworten.branche_text, ziel: antworten.ziel_text, budget: antworten.budget_text, zeitpunkt: antworten.start_text,
          nachricht, quelle: `website:${seite}:${buPosition}`, website: f.website.value
        };
        Object.keys(daten).forEach((k) => { if (daten[k] === undefined || (daten[k] === '' && k !== 'website')) delete daten[k]; });
        const knopfInhalt = bu.absenden.innerHTML;
        bu.absenden.disabled = true;
        bu.absenden.textContent = 'Termin wird gebucht …';
        zaehle('booking_submit', buPosition);
        try {
          const r = await fetch((document.querySelector('meta[name="vma-api"]')?.content || '') + '/api/buchen', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(daten) });
          const antwort = await r.json().catch(() => ({}));
          if (r.ok && antwort.ok) {
            zaehle('booking_success', buPosition);
            bestaetigung(antwort, email);
          } else if (r.status === 409) {
            zaehle('booking_error', 'belegt');
            zeigeTeil(bu.auswahl);
            bu.titel.focus({ preventScroll: true });
            ladeSlots('Dieser Termin wurde gerade vergeben. Bitte wähle eine andere Zeit.');
          } else if (r.status === 400) {
            zaehle('booking_error', 'eingabe');
            formFehler('Bitte prüfe deine Angaben und versuche es noch einmal.');
          } else {
            zaehle('booking_error', 'buchen');
            notfall(false);
          }
        } catch (e) {
          zaehle('booking_error', 'buchen');
          notfall(false);
        } finally {
          bu.absenden.disabled = false;
          bu.absenden.innerHTML = knopfInhalt;
        }
      });
    }

    dialog.addEventListener('click', (event) => {
      const wahl = event.target.closest('[data-pc-wert]');
      if (wahl) {
        const schritt = wahl.closest('.pc-schritt');
        antworten[schritt.dataset.feld] = wahl.dataset.pcWert;
        antworten[`${schritt.dataset.feld}_text`] = wahl.textContent.trim();
        if (aktuell < schritte.length - 1) zeige(aktuell + 1); else auswerten();
      }
      if (event.target === dialog) dialog.close();
    });
    zurueck.addEventListener('click', () => {
      if (buchung && !buchung.hidden) {
        if (!bu.form.hidden) { zeigeTeil(bu.auswahl); bu.titel.focus({ preventScroll: true }); } else if (buPosition === 'check') zeigeErgebnis();
        return;
      }
      if (!ergebnis.hidden) zeige(schritte.length - 1); else if (aktuell > 0) zeige(aktuell - 1);
    });
    dialog.querySelector('[data-pc-buchen]')?.addEventListener('click', () => {
      zaehle('booking_cta_click', 'check');
      oeffneBuchung('check');
    });
    dialog.querySelector('[data-pc-schliessen]')?.addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => { ladeNr++; ausloeser?.focus(); });

    document.querySelectorAll('[data-open-check]').forEach((knopf) => {
      knopf.addEventListener('click', (event) => {
        event.preventDefault();
        ausloeser = knopf;
        const vorwahl = knopf.dataset.openCheck;
        Object.keys(antworten).forEach((k) => delete antworten[k]);
        if (vorwahl) {
          const feld = schritte[0].querySelector(`[data-pc-wert="${vorwahl}"]`);
          if (feld) {
            antworten.branche = vorwahl;
            antworten.branche_text = feld.textContent.trim();
          }
        }
        dialog.showModal();
        zeige(vorwahl ? 1 : 0);
        zaehle('check_start', ['fahrschulen', 'gastronomie', 'coaches', 'unternehmer'].includes(seite) ? seite : 'start');
      });
    });

    // Direkte Termin-Links öffnen dieselbe Buchung, ohne Fragen vorab
    document.querySelectorAll('[data-open-buchung]').forEach((link) => {
      link.addEventListener('click', (event) => {
        if (!buchung) return;
        event.preventDefault();
        ausloeser = link;
        Object.keys(antworten).forEach((k) => delete antworten[k]);
        if (!dialog.open) dialog.showModal();
        if (kopf) kopf.textContent = 'Kostenloses Erstgespräch · 30 Minuten';
        oeffneBuchung(link.dataset.bookingPosition || 'direkt');
      });
    });
  }

  /* ---------- Content-Check (Scorecard) ---------- */
  document.querySelectorAll('[data-content-check]').forEach((form) => {
    const ausgabe = form.querySelector('.cc-ergebnis');
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const fragen = [...form.querySelectorAll('fieldset')];
      const offen = fragen.filter((f) => !f.querySelector('input:checked'));
      form.querySelectorAll('fieldset').forEach((f) => f.classList.toggle('fehlt', offen.includes(f)));
      if (offen.length) {
        ausgabe.hidden = false;
        ausgabe.querySelector('[data-cc-titel]').textContent = `Noch ${offen.length} ${offen.length === 1 ? 'Frage' : 'Fragen'} offen.`;
        ausgabe.querySelector('[data-cc-text]').textContent = 'Beantworte alle Fragen, dann bekommst du deine Auswertung.';
        ausgabe.querySelector('[data-cc-tipps]').innerHTML = '';
        offen[0].querySelector('input')?.focus();
        return;
      }
      const nein = fragen.filter((f) => f.querySelector('input:checked').value === 'nein');
      const punkte = fragen.length - nein.length;
      const stufe = punkte >= 7 ? 'Stark aufgestellt' : punkte >= 4 ? 'Gute Basis, klare Lücken' : 'Viel ungenutztes Potenzial';
      ausgabe.hidden = false;
      ausgabe.querySelector('[data-cc-titel]').textContent = `${punkte} von ${fragen.length} Punkten: ${stufe}.`;
      ausgabe.querySelector('[data-cc-text]').textContent = nein.length
        ? 'Hier liegt dein größter Hebel. Diese Punkte würden wir als Erstes angehen:'
        : 'Dein Content-System steht. Im Gespräch schauen wir, wo noch Skalierung drin ist.';
      const liste = ausgabe.querySelector('[data-cc-tipps]');
      liste.innerHTML = '';
      nein.slice(0, 3).forEach((f) => {
        const li = document.createElement('li');
        li.textContent = f.dataset.tipp;
        liste.appendChild(li);
      });
      ausgabe.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'nearest' });
    });
  });

  /* ---------- Sticky-Leiste auf Branchenseiten ---------- */
  const sticky = document.querySelector('[data-sticky]');
  if (sticky) {
    const hero = document.querySelector('.nf-hero, .hero');
    const pruefe = () => {
      const unten = hero ? hero.getBoundingClientRect().bottom : 600;
      const amEnde = innerHeight + scrollY >= document.documentElement.scrollHeight - 400;
      sticky.classList.toggle('sichtbar', unten < 0 && !amEnde);
    };
    addEventListener('scroll', pruefe, { passive: true });
    pruefe();
  }

  /* ---------- Hook-Generator ---------- */
  document.querySelectorAll('[data-hook-generator]').forEach((box) => {
    const daten = JSON.parse(box.querySelector('script[type="application/json"]').textContent);
    const auswahl = box.querySelector('select');
    const liste = box.querySelector('.hg-liste');
    const status = box.querySelector('.hg-status');
    const rendern = () => {
      liste.innerHTML = '';
      (daten[auswahl.value] || []).forEach((hook) => {
        const li = document.createElement('li');
        const text = document.createElement('span');
        text.textContent = hook;
        const knopf = document.createElement('button');
        knopf.type = 'button';
        knopf.textContent = 'Kopieren';
        knopf.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(hook);
            knopf.textContent = 'Kopiert';
            status.textContent = 'Hook in die Zwischenablage kopiert.';
          } catch (e) {
            status.textContent = 'Kopieren nicht möglich, markiere den Text von Hand.';
          }
          setTimeout(() => { knopf.textContent = 'Kopieren'; }, 1600);
        });
        li.append(text, knopf);
        liste.appendChild(li);
      });
    };
    auswahl.addEventListener('change', rendern);
    rendern();
  });
})();
