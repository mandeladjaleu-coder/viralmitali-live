// Aufrufe-Zähler "für Kunden generiert".
// Vorgabe Mandela, 21.09.2026: Start bei 900 Mio. Aufrufen, jeden Monat kommen 60 bis 75 Mio. dazu.
// Die Zahl hängt nur an der Uhrzeit: Jeder Besucher sieht zur selben Zeit denselben Wert, sie läuft nie rückwärts.
// Jeder Monat bekommt eine eigene Rate zwischen 60 und 75 Mio., jeder Tag schwankt leicht darum (fest aus dem Datum abgeleitet),
// innerhalb des Tages läuft der Zähler abends schneller als nachts, wie echte Aufrufe.

export const START_MS = Date.UTC(2026, 8, 20, 22, 0, 0); // 21.09.2026, 00:00 Uhr in München
export const BASIS = 900_000_000;
export const MONAT_MIN = 60_000_000;
export const MONAT_MAX = 75_000_000;
const TAG_MS = 86_400_000;
const TAGE_PRO_MONAT = 30.436875;
const AMPLITUDE = 0.55; // Tagesschwankung: nachts etwa halb so schnell wie im Mittel, abends gut 1,5-fach
const SPITZE_UTC_H = 18.5; // Höchste Rate gegen 20:30 Uhr deutscher Zeit

// Fester Pseudozufall je Tag (0 bis 1), gleich für alle Besucher
const zufall = (tag) => {
  let x = (tag + 0x9e3779b9) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0;
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
};

// Jeder Monat (ab Start) hat seine eigene Rate zwischen 60 und 75 Mio., jeder Tag schwankt darum um bis zu ±12 %
export const monatsAufrufe = (monat) => MONAT_MIN + (MONAT_MAX - MONAT_MIN) * zufall(100000 + monat);
export const tagesAufrufe = (tag) => (monatsAufrufe(Math.floor(tag / TAGE_PRO_MONAT)) / TAGE_PRO_MONAT) * (0.88 + 0.24 * zufall(tag));

// Anteil des Tages, der bis zum Bruchteil f (0 bis 1) schon gelaufen ist, mit Sinus-Tagesprofil. F(0)=0, F(1)=1, streng steigend.
const phase = ((SPITZE_UTC_H - 6) / 24) * 2 * Math.PI;
export const tagesAnteil = (f) => f - (AMPLITUDE / (2 * Math.PI)) * (Math.cos(2 * Math.PI * f - phase) - Math.cos(-phase));

export const aufrufeZu = (jetzt = Date.now()) => {
  const vergangen = jetzt - START_MS;
  if (vergangen <= 0) return BASIS;
  const tage = Math.floor(vergangen / TAG_MS);
  let summe = BASIS;
  for (let d = 0; d < tage; d++) summe += tagesAufrufe(d);
  summe += tagesAufrufe(tage) * tagesAnteil((vergangen - tage * TAG_MS) / TAG_MS);
  return Math.floor(summe);
};

const format = new Intl.NumberFormat('de-DE');
export const zahlText = (n) => format.format(n);

const starte = () => {
  const felder = [...document.querySelectorAll('[data-aufrufe-zaehler]')];
  if (!felder.length) return;
  const ruhig = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Platz für die Zahl in 30 Tagen reservieren, damit nichts springt
  const breite = `${zahlText(aufrufeZu(Date.now() + 30 * TAG_MS)).length}ch`;
  felder.forEach((el) => { el.style.minWidth = breite; });
  const tick = () => {
    const text = zahlText(aufrufeZu());
    felder.forEach((el) => { if (el.textContent !== text) el.textContent = text; });
    // Unregelmäßiger Takt wie bei echten Zählern, bei reduzierter Bewegung nur alle 5 Sekunden
    setTimeout(tick, ruhig ? 5000 : 280 + Math.random() * 720);
  };
  tick();
};

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', starte); else starte();
}
