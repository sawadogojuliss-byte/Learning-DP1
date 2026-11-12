/* Parcours EE & IA, conservation du suivi et absence de translation sur les pages. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(process.env.STUDY_TEST_MODULES ? path.resolve(process.env.STUDY_TEST_MODULES, '../package.json') : import.meta.url);
const { chromium } = require('playwright');
const portable = process.env.STUDY_PLAYWRIGHT_SYSTEM ? null : require('@sparticuz/chromium').default;
const site = process.env.STUDY_SITE || 'http://127.0.0.1:8642/';
const browser = await chromium.launch(portable ? { executablePath: await portable.executablePath(), args: portable.args.filter(x => x !== '--single-process') } : {});
try {
  for (const viewport of [{width:320,height:568},{width:390,height:844},{width:1280,height:800}]) {
    const page = await browser.newPage({viewport, serviceWorkers:'block'});
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await page.route('**/*', r => r.request().url().startsWith(site) ? r.continue() : r.abort());
    await page.addInitScript(() => { window.__STUDYPLAN_E2E = true; });
    await page.goto(site, {waitUntil:'domcontentloaded'});
    await page.waitForFunction(() => window.__STUDYPLAN_READY && !document.body.classList.contains('booting'), null, {timeout:60000});
    await page.evaluate(() => {
      document.querySelectorAll('.context-modal.active').forEach(e => e.classList.remove('active'));
      document.getElementById('planningModal').classList.add('active');
      userName = 'Élève'; ibYear = 'DP1'; subjects = [{name:'Mathématiques', icon:'📚', level:'HL'}, {name:'Physique', icon:'🧪', level:'SL'}]; optionalSubjects = [];
      memoirLevel = ''; memoirPlan = []; iaLevels = {}; iaPlans = {}; selectedDay = 0; planningDecalageSemaine = 0; memoireSauvegarder();
    });
    // Le vrai choix dans le menu ouvre EE & IA, puis le retour volontaire fonctionne.
    await page.evaluate(() => openSideMenu());
    await page.locator('#sideMenu button[onclick*=\"eeia\"]').click();
    assert.equal(await page.locator('#panelEEia').isVisible(),true);
    await page.getByRole('button',{name:'Revenir au planning'}).click();
    assert.equal(await page.locator('#panelEEia').isVisible(),false);
    // Dès la première image, le panneau est immobile et recouvre l'écran :
    // pas de planning visible pendant l'ouverture des différentes pages.
    for (const [name,id] of [['soutien','panelSoutien'],['legende','panelLegende'],['devoirs','panelDevoirs'],['eeia','panelEEia'],['feries','panelFeries'],['seances','panelSeances'],['pomodoro','panelPomodoro'],['aide','panelAide'],['feedback','panelFeedback'],['annonce','panelAnnonce'],['exercices','panelExercices']]) {
      const info = await page.evaluate(({name,id}) => {
        navigateTo('planning'); navigateTo(name);
        const p = document.getElementById(id), r = p.getBoundingClientRect();
        return { active:p.classList.contains('active'), animation:getComputedStyle(p).animationName, transform:getComputedStyle(p).transform, x:r.x, y:r.y, w:r.width, h:r.height, hit:document.elementFromPoint(innerWidth/2,innerHeight/2)?.closest('.app-panel')?.id, hitHtml:document.elementFromPoint(innerWidth/2,innerHeight/2)?.outerHTML.slice(0,300) };
      },{name,id});
      assert.equal(info.active,true,name); assert.equal(info.animation,'none',name); assert.equal(info.transform,'none',name); assert.equal(info.x,0,name); assert.equal(info.y,0,name); assert.ok(info.w>=viewport.width-1 && info.h>=viewport.height-1,name); assert.equal(info.hit,id,name + JSON.stringify(info));
      await page.waitForTimeout(350);
      assert.equal(await page.locator('#'+id).evaluate(e=>e.classList.contains('active')),true,name+' ne revient pas seul au planning');
    }
    await page.evaluate(() => navigateTo('eeia'));
    assert.equal(await page.getByRole('heading',{name:'Ton mémoire',exact:true}).count(),1);
    assert.equal(await page.locator('#panelEEia .eeia-carte').count(),3);
    assert.equal(await page.locator('#panelEEia').getByRole('heading',{name:/Ton mémoire et tes IA/}).count(),1);
    assert.equal(await page.locator('#panelEEia').evaluate(e => e.scrollWidth <= e.clientWidth + 1),true,'pas de débordement horizontal');
    const mem = page.locator('.eeia-carte.is-memoire');
    await mem.getByRole('button',{name:'Pas commencé'}).click();
    assert.equal(await mem.getByText('Quelques pistes pour commencer').isVisible(),true);
    assert.equal(await mem.getByRole('button',{name:'Pas commencé'}).getAttribute('aria-pressed'),'true');
    await mem.getByRole('button',{name:'Plan',exact:true}).click();
    await page.locator('#eeIn-memoir--1').fill('Introduction');
    await page.locator('#eeIn-memoir--1').press('Enter');
    await page.locator('#eeIn-memoir--1').fill('Analyse');
    await mem.getByRole('button',{name:'Ajouter'}).click();
    assert.equal(await mem.getByRole('progressbar').getAttribute('aria-valuenow'),'0');
    await mem.getByRole('button',{name:/^Introduction/}).click();
    assert.equal(await mem.getByRole('progressbar').getAttribute('aria-valuenow'),'50');
    assert.equal(await page.evaluate(() => eePartiesOuvertes().some(p => p.kind === 'memoir' && p.text === 'Analyse')),true);
    assert.equal(await page.evaluate(() => eePartiesOuvertes().some(p => p.kind === 'memoir' && p.text === 'Introduction')),false);
    const math = page.locator('.eeia-carte.is-ia').filter({hasText:'Mathématiques'});
    await math.getByRole('button',{name:'Plan',exact:true}).click();
    await page.locator('#eeIn-ia-0').fill('Collecter mes données');
    await math.getByRole('button',{name:'Ajouter'}).click();
    assert.equal(await page.evaluate(() => eePartiesOuvertes().some(p => p.kind === 'ia' && p.subject === 'Mathématiques' && p.text === 'Collecter mes données')),true);
    assert.equal(await page.evaluate(() => JSON.stringify(iaPlans['Physique'] || [])), '[]');
    await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForFunction(() => window.__STUDYPLAN_READY && !document.body.classList.contains('booting'), null, {timeout:60000});
    await page.evaluate(() => { document.getElementById('planningModal').classList.add('active'); navigateTo('eeia'); });
    assert.equal(await page.locator('.eeia-carte.is-memoire [role=progressbar]').getAttribute('aria-valuenow'),'50');
    assert.equal(await page.getByRole('button',{name:/^Collecter mes données/}).count(),1);
    await page.getByRole('button',{name:'Retirer Analyse'}).click();
    assert.equal(await page.locator('.eeia-carte.is-memoire [role=progressbar]').getAttribute('aria-valuenow'),'100');
    await page.locator('.eeia-carte.is-memoire').getByRole('button',{name:'Finalisation'}).click();
    assert.equal(await page.locator('#eeRetourModal').isVisible(),true);
    assert.equal(await page.locator('#eeRetourModal').evaluate(e=>Number(getComputedStyle(e).zIndex)>Number(getComputedStyle(document.getElementById('panelEEia')).zIndex)),true);
    await page.locator('#eeRetourModal').getByRole('button',{name:'Continuer'}).click();
    assert.equal(await page.locator('#eeRetourModal').isVisible(),false);
    await page.getByRole('button',{name:'Revenir au planning'}).click();
    assert.equal(await page.locator('#panelEEia').isVisible(),false);
    assert.equal(await page.locator('#planningModal').isVisible(),true);
    await page.evaluate(() => { subjects = []; optionalSubjects = []; navigateTo('eeia'); });
    assert.equal(await page.getByText('Choisis d’abord tes matières pour suivre chaque évaluation interne.').isVisible(),true);
    assert.deepEqual(errors,[]);
    console.log(`OK navigation, EE & IA, stockage et planning ${viewport.width}×${viewport.height}`);
    await page.close();
  }
} finally { await browser.close(); }
