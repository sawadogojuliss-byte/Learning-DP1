/* Vérifie le retour visuel avant une grosse image lente et l'amorçage audio. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
const require = createRequire(process.env.STUDY_TEST_MODULES ? path.resolve(process.env.STUDY_TEST_MODULES, '../package.json') : import.meta.url);
const {chromium} = require('playwright');
const portable = process.env.STUDY_PLAYWRIGHT_SYSTEM ? null : require('@sparticuz/chromium').default;
const site = process.env.STUDY_SITE || 'http://127.0.0.1:8617/';
const browser = await chromium.launch({...(portable ? {executablePath:await portable.executablePath()} : {}), args:[...(portable ? portable.args.filter(x => x !== '--single-process') : []), '--autoplay-policy=no-user-gesture-required','--mute-audio']});
try {
  const page = await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'});
  const errors=[]; page.on('pageerror', e=>errors.push(String(e)));
  const noms = ['drive-torrent-alpin','drive-banc-au-parc'];
  const debloquer = {}, compte = {};
  const attentes = Object.fromEntries(noms.map(id=>[id,new Promise(resolve=>{debloquer[id]=resolve})]));
  await page.route('**/images/pomodoro/drive-*.webp*', async route => {
    const pathname = new URL(route.request().url()).pathname;
    const id = noms.find(n => pathname.endsWith('/'+n+'.webp'));
    if (!id || pathname.includes('/mini/')) return route.continue();
    compte[id]=(compte[id]||0)+1;
    await attentes[id];
    try { await route.continue(); } catch (_) {}
  });
  await page.addInitScript(()=>window.__STUDYPLAN_E2E=true);
  await page.goto(site,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__STUDYPLAN_READY&&!document.body.classList.contains('booting'),null,{timeout:60000});
  await page.evaluate(()=>{
    document.querySelectorAll('.context-modal.active').forEach(e=>e.classList.remove('active'));
    document.getElementById('planningModal').classList.add('active'); navigateTo('pomodoro');
    focusArreterFonds();
  });
  await page.waitForFunction(()=>document.getElementById('panelPomodoro').classList.contains('active') && !!focusFondActif,null,{timeout:30000});
  const initial = await page.evaluate(()=>({ index:focusEtat.fond, src:focusFondActif }));
  // La navigation au clavier anticipe le décodage, sans modifier le choix.
  await page.evaluate(id=>{const i=focusIndexParId(id); focusTuileTheme(FOCUS_FONDS[i],i).dispatchEvent(new Event('focus'));},noms[0]);
  await page.waitForFunction(id=>!!focusFondsEnCours[FOCUS_FONDS[focusIndexParId(id)].src],noms[0],{timeout:10000});
  assert.equal(await page.evaluate(()=>focusEtat.fond),initial.index);
  // Image complète retenue : la miniature du nouveau choix s'affiche d'abord.
  await page.evaluate(id=>focusPoserFond(focusIndexParId(id)),noms[0]);
  await page.waitForFunction(id=>document.getElementById('focusBg').style.backgroundImage.includes('/mini/'+id+'.webp'),noms[0],{timeout:15000});
  assert.equal(await page.evaluate(()=>focusFondActif), initial.src);
  // Revenir à l'ancien thème pendant le chargement ne doit pas laisser
  // sa miniature ou le téléchargement tardif écraser le dernier choix.
  await page.evaluate(i=>focusPoserFond(i),initial.index);
  assert.ok((await page.evaluate(()=>document.getElementById('focusBg').style.backgroundImage)).includes(initial.src));
  debloquer[noms[0]]();
  await page.waitForFunction(id=>!focusFondsEnCours[FOCUS_FONDS[focusIndexParId(id)].src],noms[0],{timeout:30000});
  assert.ok((await page.evaluate(()=>document.getElementById('focusBg').style.backgroundImage)).includes(initial.src));
  assert.equal(compte[noms[0]],1,'un seul téléchargement partagé');
  await page.evaluate(id=>focusPoserFond(focusIndexParId(id)),noms[1]);
  await page.waitForFunction(id=>document.getElementById('focusBg').style.backgroundImage.includes('/mini/'+id+'.webp'),noms[1],{timeout:15000});
  debloquer[noms[1]]();
  await page.waitForFunction(id=>focusFondActif === FOCUS_FONDS[focusIndexParId(id)].src,noms[1],{timeout:30000});
  assert.equal(compte[noms[1]],1,'les deux pages partagent le décodage');
  assert.equal(await page.evaluate(()=>document.getElementById('focusBg').style.backgroundImage.includes('/mini/')),false);
  // Survoler ne doit pas lancer le son ; cliquer réutilise le lecteur amorcé.
  await page.evaluate(()=>focusBasculerSons());
  const pluie=page.locator('#focusSonsGrille button[aria-label="Pluie"]');
  const requeteAudio = page.waitForRequest(req=>new URL(req.url()).pathname.endsWith('/audio/pomodoro/pluie.mp3'), {timeout:15000});
  await pluie.hover();
  await requeteAudio; // le réseau commence avant le clic, sans lecture
  await page.waitForFunction(()=>focusSonAmorce && focusSonAmorce.id==='pluie',null,{timeout:10000});
  assert.equal(await page.evaluate(()=>focusSonAmorce.audio.paused && !focusSonActif('pluie')),true);
  await page.evaluate(()=>window.__audioAmorce=focusSonAmorce.audio);
  await pluie.click();
  assert.equal(await page.evaluate(()=>focusLecteurs.pluie===window.__audioAmorce),true,'le lecteur préchargé est réutilisé');
  await page.waitForFunction(()=>focusSonActif('pluie'),null,{timeout:15000});
  await page.locator('#focusSonsGrille button[aria-label="Pluie"]').click();
  assert.equal(await page.evaluate(()=>focusSonActif('pluie')),false);
  // Le mode économie de données ne lance aucun préchargement spéculatif.
  assert.equal(await page.evaluate(()=>{const f=focusAmorcageUtile; focusAmorcageUtile=()=>false; focusPrechargerSon('ocean'); focusAmorcageUtile=f; return focusSonAmorce===null && !focusLecteurs.ocean;}),true);
  // Le geste tactile anticipe lui aussi sans lancer automatiquement le son.
  const ocean=page.locator('#focusSonsGrille button[aria-label="Océan"]');
  await ocean.dispatchEvent('pointerdown',{pointerType:'touch'});
  await page.waitForFunction(()=>focusSonAmorce && focusSonAmorce.id==='ocean',null,{timeout:10000});
  assert.equal(await page.evaluate(()=>focusSonAmorce.audio.paused),true);
  await ocean.click();
  await page.waitForFunction(()=>focusSonActif('ocean'),null,{timeout:15000});
  await page.locator('#focusSonsGrille button[aria-label="Océan"]').click();
  assert.equal(await page.evaluate(()=>focusSonActif('ocean')),false);
  assert.deepEqual(errors,[]);
  console.log('OK miniature rapide, choix successifs, dédoublonnage et amorçage silencieux des sons');
} finally {await browser.close();}
