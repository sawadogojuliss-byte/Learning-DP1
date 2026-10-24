/* Lot 15 : navigateur réel, cache à jour et planning accessible hors réseau. */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const VERSION = /var version = '([^']+)'/.exec(readFileSync(new URL('../js/boot.js', import.meta.url), 'utf8'))[1];
const SITE = 'https://sawadogojuliss-byte.github.io/Learning-DP1/';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ serviceWorkers: 'allow' });
const page = await context.newPage();
await page.addInitScript(() => { window.__STUDYPLAN_E2E = true; }); /* profil de test local seulement */
try {
    await page.goto(SITE, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => window.__STUDYPLAN_READY && !document.body.classList.contains('booting'), null, { timeout: 60000 });
    const initial = await page.evaluate(() => performance.getEntriesByType('resource').reduce((a, e) => {
        if (e.name.startsWith(location.origin)) { a.requetes++; a.octets += e.transferSize || 0; }
        return a;
    }, { requetes: 1, octets: 0 }));
    await page.evaluate(() => {
        localStorage.setItem('studyPlanIB_profil', JSON.stringify({ profilComplet: true, etape: 'planning', userName: 'Test hors ligne',
            subjects: [{ name: 'Mathématiques', icon: '🔢', level: 'HL', grade: 5 }], optionalSubjects: [],
            weekdayWakeup: '05:30', saturdayWakeup: '08:00', sundayWakeup: '09:00', selectedActivities: [], phoneDays: [],
            ibYear: 'DP1', targetScore: 36 }));
    });
    await page.waitForFunction(async (version) => {
        if (!navigator.serviceWorker.controller?.scriptURL.includes('v=' + version)) return false;
        return (await caches.keys()).includes('study-plan-coquille-' + version);
    }, VERSION, { timeout: 90000 });
    /* Installation atomique : la coquille entière, pas seulement l'index. */
    await page.waitForFunction(async (version) => {
        const key = 'study-plan-coquille-' + version;
        if (!(await caches.keys()).includes(key)) return false;
        const c = await caches.open(key);
        return !!(await c.match(new URL('index.html?v=' + version, location.href))) &&
            !!(await c.match(new URL('pages/planning.html?v=' + version, location.href))) &&
            !!(await c.match(new URL('js/pages/planning-moteur.js?v=' + version, location.href)));
    }, VERSION, { timeout: 90000 });
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => window.__STUDYPLAN_READY && !document.body.classList.contains('booting'), null, { timeout: 60000 });
    const chaud = await page.evaluate(() => performance.getEntriesByType('resource').reduce((a, e) => {
        if (e.name.startsWith(location.origin) && e.transferSize > 0) { a.requetes++; a.octets += e.transferSize; }
        return a;
    }, { requetes: 1, octets: 0 }));
    await context.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => window.__STUDYPLAN_READY && !document.body.classList.contains('booting'), null, { timeout: 60000 });
    const result = await page.evaluate(() => {
        generatePlanning();
        return { cartes: document.querySelectorAll('#eventsContainer [data-v3-idx]').length,
            panneaux: document.getElementById('panelPlanning')?.classList.contains('active') ||
                document.getElementById('planningModal')?.classList.contains('active') };
    });
    console.log('Démarrage réseau :', initial, 'après mise en cache :', chaud, 'hors ligne :', result);
    if (!result.cartes || !result.panneaux) throw new Error('Planning hors ligne indisponible : ' + JSON.stringify(result));
} finally {
    await browser.close();
}
