/* Lot 15 : navigateur réel, cache à jour et planning accessible hors réseau. */
import { chromium } from 'playwright';
const SITE = 'https://sawadogojuliss-byte.github.io/Learning-DP1/';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ serviceWorkers: 'allow' });
const page = await context.newPage();
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
    await page.waitForFunction(async () => {
        if (!navigator.serviceWorker.controller) return false;
        return (await caches.keys()).some(k => k.startsWith('study-plan-coquille-'));
    }, null, { timeout: 90000 });
    /* Installation atomique : la coquille entière, pas seulement l'index. */
    await page.waitForFunction(async () => {
        const key = (await caches.keys()).find(k => k.startsWith('study-plan-coquille-'));
        if (!key) return false;
        const c = await caches.open(key);
        return !!(await c.match(new URL('pages/planning.html?v=20261024q', location.href))) &&
            !!(await c.match(new URL('js/pages/planning-moteur.js?v=20261024q', location.href)));
    }, null, { timeout: 90000 });
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
        navigateTo('planning');
        renderPlanning();
        return { cartes: document.querySelectorAll('#eventsContainer [data-v3-idx]').length,
            panneaux: document.getElementById('panelPlanning')?.classList.contains('active') ||
                document.getElementById('planningModal')?.classList.contains('active') };
    });
    if (!result.cartes || !result.panneaux) throw new Error('Planning hors ligne indisponible : ' + JSON.stringify(result));
    console.log('Démarrage réseau :', initial, 'après mise en cache :', chaud, 'hors ligne :', result);
} finally {
    await browser.close();
}
