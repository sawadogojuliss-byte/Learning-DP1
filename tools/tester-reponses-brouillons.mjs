/* Questions et Retours, navigateur réel et services simulés ; aucun mail réel. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(process.env.STUDY_TEST_MODULES ? path.resolve(process.env.STUDY_TEST_MODULES, '../package.json') : import.meta.url);
const { chromium } = require('playwright');
const portable = process.env.STUDY_PLAYWRIGHT_SYSTEM ? null : require('@sparticuz/chromium').default;
const base = process.env.STUDY_SITE || 'http://127.0.0.1:8695/';
const browser = await chromium.launch(portable ? { executablePath: await portable.executablePath(), args: portable.args.filter(x => x !== '--single-process') } : {});
try {
 for (const width of [390, 1280]) {
  const page = await browser.newPage({viewport:{width,height:900},serviceWorkers:'block'});
  await page.route('**/*', r => r.request().url().startsWith(base) ? r.continue() : r.abort());
  await page.addInitScript(() => { window.__STUDYPLAN_E2E = true; });
  await page.goto(base, {waitUntil:'domcontentloaded'});
  await page.waitForFunction(() => window.__STUDYPLAN_READY && !document.body.classList.contains('booting'), null, {timeout:60000});
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    document.querySelectorAll('.app-panel.active,.context-modal.active').forEach(el=>el.classList.remove('active'));
    document.getElementById('panelQuestions').classList.add('active');
    boiteEstAdmin = () => true;
    boiteListesCache = { questions:[{id:'q-test',at:'2026-01-01T10:00:00Z',nom:'Alice',email:'alice@example.org',texte:'Question fictive'}], feedbacks:[], reponses:[], emplois:[], profils:[] };
    boiteRendreQuestions(boiteListesCache); boiteRendreRetours(boiteListesCache);
    window.__envois = 0; window.__historiques = 0;
    boiteEnvoyerMail = () => { __envois++; return new Promise((resolve,reject)=>{window.__ok=resolve; window.__ko=reject;}); };
    boiteEcrireBoite = () => { __historiques++; return window.__echecHistorique ? Promise.reject(Error('refus')) : Promise.resolve(true); };
    langueAnalyser = () => new Promise(resolve=>{window.__analyse=resolve});
    boiteBrancherAdmin();
  });
  const q = page.locator('#questionsListe [data-reponse-texte]');
  const r = page.locator('#retoursListe [data-reponse-texte]');
  await q.fill('Texte personnel de réponse');
  await q.focus(); await q.evaluate(el=>el.setSelectionRange(3, 8));
  await page.evaluate(()=>{ window.__ancienChamp=document.querySelector('#questionsListe [data-reponse-texte]'); boiteRendreQuestions(boiteListesCache); });
  assert.equal(await q.inputValue(), 'Texte personnel de réponse');
  assert.deepEqual(await q.evaluate(el=>[el===window.__ancienChamp,document.activeElement===el,el.selectionStart,el.selectionEnd]),[true,true,3,8]);
  // Les deux pages ne mélangent pas les brouillons de la même question.
  await r.evaluate(el=>{el.value='Autre brouillon distinct'; el.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.evaluate(()=>{boiteRendreRetours(boiteListesCache);boiteRendreQuestions(boiteListesCache);});
  assert.equal(await r.inputValue(), 'Autre brouillon distinct');
  assert.equal(await q.inputValue(), 'Texte personnel de réponse');
  await page.locator('#questionsListe [data-repondre]').click();
  await page.evaluate(()=>boiteRendreQuestions(boiteListesCache));
  assert.equal(await page.locator('#questionsListe [data-repondre]').isDisabled(),true);
  await page.evaluate(()=>__analyse([{debut:0,fin:5,type:'orthographe',message:'À vérifier',suggestions:[]} ]));
  await page.waitForSelector('#questionsListe [data-repondre-quand-meme]');
  await page.evaluate(()=>boiteRendreQuestions(boiteListesCache));
  assert.equal(await page.locator('#questionsListe [data-repondre-quand-meme]').count(),1);
  await page.locator('#questionsListe [data-repondre-quand-meme]').click();
  await page.evaluate(()=>{boiteRendreQuestions(boiteListesCache);boiteRendreRetours(boiteListesCache)});
  assert.equal(await q.evaluate(el=>el.readOnly),true);
  assert.equal(await page.evaluate(()=>__envois),1);
  // Même question, autre page : aucun deuxième envoi simultané.
  await page.evaluate(()=>boiteRepondre('q-test',document.querySelector('#retoursListe [data-repondre]'),true));
  assert.equal(await page.evaluate(()=>__envois),1);
  await page.evaluate(()=>__ok({success:true,id:'abcdefghijklmnopqrstuvwx'}));
  await page.waitForFunction(()=>__historiques===1 && !!document.querySelector('#questionsListe input:checked'));
  assert.equal(await r.inputValue(),'Autre brouillon distinct');
  assert.equal(await page.locator('#retoursListe [data-repondre]').isDisabled(),true);
  assert.match(await page.locator('#retoursListe [data-reponse-statut]').textContent(),/Copie ton texte/);
  // Si l'historique échoue après acceptation, ne pas renvoyer le mail.
  await page.evaluate(()=>{
    boiteListesCache = {questions:[{id:'q2',at:'2026-01-02T10:00:00Z',nom:'Bob',email:'bob@example.org',texte:'Question'}],feedbacks:[],reponses:[],emplois:[],profils:[]};
    boiteRendreQuestions(boiteListesCache); window.__echecHistorique=true;
    const el=document.querySelector('#questionsListe [data-reponse-texte="q2"]'); el.value='Réponse acceptée';
    boiteRepondre('q2',el.closest('article').querySelector('[data-repondre]'),true);
  });
  await page.evaluate(()=>__ok({success:true,id:'abcdefghijklmnopqrstuvwx'}));
  await page.waitForFunction(()=>document.querySelector('#questionsListe [data-reponse-statut]')?.textContent.includes('historique non enregistré'));
  assert.equal(await page.locator('#questionsListe [data-repondre]').isDisabled(),true);
  assert.equal(await page.locator('#questionsListe [data-reponse-texte]').inputValue(),'Réponse acceptée');
  await page.evaluate(()=>boiteRendreQuestions(boiteListesCache));
  assert.match(await page.locator('#questionsListe [data-reponse-statut]').textContent(),/Ne renvoie pas/);
  assert.equal(await page.evaluate(()=>__envois),2);
  // La déconnexion efface les brouillons privés, sans localStorage.
  await page.evaluate(()=>boiteNettoyerSession());
  assert.equal(await r.count(),0);
  await page.close();
 }
 console.log('ok réponses : brouillons, focus, validation, envoi unique, autre page et déconnexion (services simulés)');
} finally {await browser.close()}
