/* Test d'intégration DOM et moteur réel, hors réseau et sans compte.
   Dépendance facultative : npm install --no-save jsdom@26
   Puis : node tools/tester-chevauchement-dom.cjs */
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { JSDOM, ResourceLoader, VirtualConsole } = require('jsdom');
const root = path.resolve(__dirname, '..');
(async () => {
    const server = http.createServer(async (req, res) => {
        try {
            const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
            const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
            if (!file.startsWith(root + path.sep)) throw new Error('forbidden');
            res.end(await fs.readFile(file));
        } catch { res.statusCode = 404; res.end('not found'); }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const url = `http://127.0.0.1:${server.address().port}/`;
    class LocalOnly extends ResourceLoader { fetch(u, opts) { return u.startsWith(url) ? super.fetch(u, opts) : null; } }
    const errors = [];
    const consoleDOM = new VirtualConsole();
    consoleDOM.on('jsdomError', error => errors.push(error.message));
    let dom;
    try {
        dom = await JSDOM.fromURL(url, { resources: new LocalOnly(), runScripts: 'dangerously', pretendToBeVisual: true,
            virtualConsole: consoleDOM, beforeParse(w) {
                w.fetch = (u, opts) => fetch(new URL(u, url), opts);
                w.Element.prototype.scrollIntoView = function () {};
                w.CSS = { escape: s => String(s).replace(/[^a-zA-Z0-9_-]/g, '\\$&') };
                w.matchMedia = () => ({ matches:false, addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){} });
                w.alert = () => {};
            } });
        const w = dom.window;
        for (let i = 0; i < 150 && !w.__STUDYPLAN_READY; i++) await new Promise(r => setTimeout(r, 100));
        assert.equal(w.__STUDYPLAN_READY, true, 'chargement de l’application');
        const exec = code => w.eval(code);
        const json = code => JSON.parse(exec(`JSON.stringify(${code})`));
        const click = selector => { const el = w.document.querySelector(selector); assert.ok(el, selector); assert.equal(el.disabled, false, `${selector} désactivé`); el.click(); };
        const set = (id, value) => { const el = w.document.getElementById(id); el.value = value; el.dispatchEvent(new w.Event('input', { bubbles: true })); };
        const openAdd = () => {
            set('activityNameInput', 'Lecture'); set('activityStartInput', '18:15'); set('activityEndInput', '18:45');
            exec('confirmAddActivity()');
            assert.ok(w.document.getElementById('chevauchementPopup'));
        };
        const reset = () => exec(`v3FermerChoixChevauchement(); localStorage.clear(); customEvents=[]; selectedDay=0; planningDecalageSemaine=0;
            selectedActivities=[{name:'Sport',icon:'⚽',days:[0],sameTime:true,startTime:'18:00',endTime:'19:00'}];
            weekdayWakeup='06:00'; weekdaySleepHours=8; emploiFige=null;`);
        const snapshot = () => json(`({customEvents, stored:localStorage.getItem('studyPlanIB_customEvents_juliss')})`);
        reset();
        openAdd();
        assert.match(w.document.querySelector('#chevEtapeInitiale').textContent, /Activité déjà prévue/);
        click('[data-autre-creneau]');
        assert.equal(w.document.querySelector('#chevEtapeInitiale').hidden, true);
        assert.equal(w.document.querySelector('#chevauchementAutres').hidden, false);
        const libres = [...w.document.querySelectorAll('.chev-proposition-libre')].filter(x => !x.hidden);
        if (!libres.length) assert.equal(w.document.querySelector('[data-aucun-horaire]').hidden, false);
        click('[data-filtre-horaire="occupes"]');
        assert.ok([...w.document.querySelectorAll('.chev-proposition-occupee')].some(x => !x.hidden));
        click('[data-retour-autres]');
        assert.equal(w.document.querySelector('#chevEtapeInitiale').hidden, false);
        click('[data-remplacer]');
        assert.equal(w.document.querySelector('#chevEtapeInitiale').hidden, true);
        assert.equal(w.document.querySelector('[data-continuer]').disabled, true);
        assert.match(w.document.querySelector('#chevRetraitVerdict').textContent, /Sport/);
        click('#chevListeRetraits input');
        assert.match(w.document.querySelector('#chevRetraitVerdict').textContent, /Sport/);
        const before = snapshot();
        click('[data-continuer]');
        assert.equal(w.document.querySelector('#chevauchementApercu').hidden, false);
        assert.deepEqual(snapshot(), before, 'aperçu sans sauvegarde');
        const preview = w.document.querySelector('#chevauchementApercu').textContent;
        assert.match(preview, /Sport/);
        assert.match(preview, /Autres changements dus au recalcul/);
        click('#chevauchementApercu [data-confirmer]');
        assert.equal(w.document.getElementById('chevauchementPopup'), null, 'retrait confirmé');
        const current = json(`generateDayEvents(0).map(e=>[e.title,e.startTime,e.endTime])`);
        assert.ok(current.some(e => e[0] === 'Lecture' && e[1] === '18:15'));
        assert.ok(!current.some(e => e[0] === 'Sport'));
        assert.ok(JSON.parse(exec(`localStorage.getItem('studyPlanIB_customEvents_juliss')`)).some(e=>e.title==='Lecture'));
        exec('emploiFige=null');
        assert.deepEqual(json(`generateDayEvents(0).map(e=>[e.title,e.startTime,e.endTime])`), current, 'le résultat survit à un recalcul');

        // Choix d'un horaire occupé, retour et suppression explicite.
        reset(); openAdd(); click('[data-autre-creneau]'); click('[data-filtre-horaire="occupes"]');
        const occupied = [...w.document.querySelectorAll('.chev-proposition-occupee')].find(b => b.querySelector('strong').textContent === '18:00 → 18:30');
        assert.ok(occupied); occupied.click();
        assert.equal(w.document.querySelector('#chevTitre').textContent, 'Ton créneau choisi');
        assert.match(w.document.querySelector('#chevEtapeInitiale').textContent, /Sport/);
        click('[data-remplacer]');
        assert.equal(w.document.querySelector('[data-continuer-selection]').disabled, true);
        click('#chevListeRetraits input');
        assert.equal(w.document.querySelector('[data-continuer-selection]').disabled, false);
        click('[data-continuer-selection]');
        assert.match(w.document.querySelector('#chevauchementApercu').textContent, /Sport/);
        click('[data-retour-apercu]');
        assert.equal(w.document.querySelector('#chevRemplacement').hidden, false);
        click('[data-retour-selection]');
        assert.equal(w.document.querySelector('#chevEtapeInitiale').hidden, false);
        click('[data-autre-creneau]');
        assert.equal(w.document.querySelector('#chevSelectionActions').hidden, true);
        click('#chevauchementAutres [data-annuler]');
        assert.equal(w.document.getElementById('chevauchementPopup'), null);
        assert.deepEqual(json('customEvents'), []);

        // Un état changé entre l’aperçu et la confirmation n’est jamais appliqué.
        reset(); openAdd(); click('[data-remplacer]'); click('#chevListeRetraits input'); click('[data-continuer]');
        exec(`customEvents.push({id:'autre',day:0,title:'Autre',startTime:'21:10',endTime:'21:20',type:'activity',pinned:true})`);
        const stale = json('customEvents');
        click('#chevauchementApercu [data-confirmer]');
        assert.ok(w.document.getElementById('chevauchementPopup'));
        assert.match(w.document.getElementById('chevauchementErreur').textContent, /changé|conflit/);
        assert.deepEqual(json('customEvents'), stale);
        click('[data-retour-apercu]');
        assert.equal(w.document.getElementById('chevauchementErreur').textContent, '');

        // Édition d'un créneau du moteur vers Sport.
        reset(); exec(`openEditModal('dinner','Dîner','19:00','19:45','meal','🍽️'); selectedDay=0;`);
        set('editEventStart','18:15'); set('editEventEnd','18:45'); exec('saveEditedEvent()');
        assert.ok(w.document.getElementById('chevauchementPopup'));
        assert.match(w.document.getElementById('chevIntro').textContent, /Dîner.*Sport/);
        click('[data-remplacer]'); click('#chevListeRetraits input');
        const avantEdition = snapshot(); click('[data-continuer]');
        assert.deepEqual(snapshot(), avantEdition);
        click('#chevauchementApercu [data-confirmer]');
        if (w.document.querySelector('[data-confirmer-essentiel]')) click('[data-confirmer-essentiel]');
        assert.equal(w.document.getElementById('chevauchementPopup'), null, 'édition appliquée');
        assert.ok(json('generateDayEvents(0)').some(e => e.id === 'dinner' && e.startTime === '18:15'));

        // Semaine future : seules des exceptions datées sont écrites.
        reset(); exec('planningDecalageSemaine=1; selectedDay=0'); openAdd();
        click('[data-remplacer]'); click('#chevListeRetraits input');
        const avantDate = snapshot(); click('[data-continuer]');
        assert.deepEqual(snapshot(), avantDate);
        click('#chevauchementApercu [data-confirmer]');
        if (w.document.querySelector('[data-confirmer-essentiel]')) click('[data-confirmer-essentiel]');
        assert.equal(w.document.getElementById('chevauchementPopup'), null, 'modification datée appliquée');
        const dates = json('customEvents');
        assert.ok(dates.length >= 2 && dates.every(e => e.date), 'événements limités à la date sélectionnée');
        assert.ok(json('v3EvenementsJour(0)').some(e => e.title === 'Lecture'));
        exec('planningDecalageSemaine=0; emploiFige=null');
        assert.ok(json('generateDayEvents(0)').some(e => e.title === 'Sport'), 'semaine actuelle inchangée');
        assert.ok(!json('generateDayEvents(0)').some(e => e.title === 'Lecture'));

        // Un essentiel retiré exige une confirmation supplémentaire.
        reset();
        exec(`v3OuvrirChoixChevauchement({mode:'ajout',day:0,title:'Lecture',start:'12:30',end:'13:00',excludeIds:[],conflits:v3ConflitsCreneau(0,'12:30','13:00',[])})`);
        click('[data-remplacer]'); click('#chevListeRetraits input'); click('[data-continuer]');
        const avantEssentiel = snapshot(); click('#chevauchementApercu [data-confirmer]');
        assert.match(w.document.getElementById('chevConfirmEssentiels').textContent, /Déjeuner/);
        assert.deepEqual(snapshot(), avantEssentiel);
        click('[data-renoncer-essentiel]');
        assert.deepEqual(snapshot(), avantEssentiel);
        click('#chevauchementApercu [data-annuler]');
        assert.equal(w.document.getElementById('chevauchementPopup'), null);
        reset();
        exec(`v3OuvrirChoixChevauchement({mode:'ajout',day:0,title:'Lecture',start:'12:30',end:'13:00',excludeIds:[],conflits:v3ConflitsCreneau(0,'12:30','13:00',[])})`);
        click('[data-remplacer]'); click('#chevListeRetraits input'); click('[data-continuer]');
        click('#chevauchementApercu [data-confirmer]');
        assert.ok(w.document.querySelector('[data-confirmer-essentiel]'));
        click('[data-confirmer-essentiel]');
        assert.equal(w.document.getElementById('chevauchementPopup'), null, 'confirmation essentielle appliquée');
        assert.ok(json('generateDayEvents(0)').some(e => e.title === 'Lecture' && e.startTime === '12:30'));
        assert.ok(!json('generateDayEvents(0)').some(e => e.id === 'lunch'));

        // Cas contrôlés : déplacement, horaire libre et conflits multiples.
        reset(); exec(`
          planningDateEdition = () => ''; planningJourModifiable = () => true;
          selectedActivities=[]; customEvents=[]; selectedDay=0;
          window.__testEvents=[{id:'sport',title:'Sport',type:'activity',editable:true,startTime:'18:00',endTime:'19:00'}];
          generateDayEvents = () => window.__testEvents.filter(e => !customEvents.some(r => r.deleted && r.replacesId === e.id))
            .map(e => { const r=customEvents.find(c=>c.replacesId===e.id&&!c.deleted); return r ? {...e,startTime:r.startTime,endTime:r.endTime} : {...e}; })
            .concat(customEvents.filter(e=>!e.replacesId&&!e.deleted));
          v3Save=()=>{window.__testSaves=(window.__testSaves||0)+1}; renderPlanning=()=>{}; closeAddModal=()=>{}; v3Toast=()=>{};
          window.__testSaves=0;
        `);
        openAdd(); assert.ok(w.document.querySelector('[data-deplacer]'));
        click('[data-deplacer]');
        assert.match(w.document.querySelector('#chevauchementApercu').textContent, /Sport.*19:00 → 20:00/s);
        assert.equal(exec('window.__testSaves'), 0);
        click('#chevauchementApercu [data-confirmer]');
        assert.equal(exec('window.__testSaves'), 1);
        assert.ok(json('generateDayEvents(0)').some(e=>e.id==='sport' && e.startTime==='19:00'));
        assert.ok(json('generateDayEvents(0)').some(e=>e.title==='Lecture'));
        exec('customEvents=[]; window.__testSaves=0'); openAdd(); click('[data-autre-creneau]');
        const free = [...w.document.querySelectorAll('.chev-proposition-libre')].find(b=>b.querySelector('strong').textContent==='19:00 → 19:30');
        assert.ok(free && !free.hidden); free.click();
        assert.match(w.document.querySelector('#chevauchementApercu').textContent, /Aucun autre créneau/);
        click('#chevauchementApercu [data-confirmer]');
        assert.equal(exec('window.__testSaves'), 1);
        assert.ok(json('generateDayEvents(0)').some(e=>e.id==='sport' && e.startTime==='18:00'));
        assert.ok(json('generateDayEvents(0)').some(e=>e.title==='Lecture' && e.startTime==='19:00'));
        exec(`customEvents=[]; window.__testSaves=0;
          window.__testEvents.push({id:'danse',title:'Danse',type:'activity',editable:true,startTime:'18:15',endTime:'18:45'});`);
        openAdd(); click('[data-remplacer]');
        const inputs = [...w.document.querySelectorAll('#chevListeRetraits input')]; assert.equal(inputs.length, 2);
        inputs[0].click(); assert.equal(w.document.querySelector('[data-continuer]').disabled, true);
        inputs[1].click(); assert.equal(w.document.querySelector('[data-continuer]').disabled, false);
        click('[data-continuer]');
        assert.match(w.document.querySelector('#chevauchementApercu').textContent, /Sport.*Danse/s);
        click('#chevauchementApercu [data-confirmer]');
        assert.deepEqual(json('generateDayEvents(0).map(e=>e.title)'), ['Lecture']);
        assert.equal(exec('window.__testSaves'), 1);
        // Un essentiel modifié par le recalcul est lui aussi annoncé et protégé.
        exec(`customEvents=[]; window.__testSaves=0;
          window.__testEvents=[{id:'sport',title:'Sport',type:'activity',editable:true,startTime:'18:00',endTime:'19:00'},
            {id:'prep',title:'Préparation',type:'prep',startTime:'10:00',endTime:'11:00'}];
          window.__generatorAvant = generateDayEvents;
          generateDayEvents = (...args) => window.__generatorAvant(...args).map(e =>
            e.id==='prep' && customEvents.some(r=>r.deleted) ? {...e,startTime:'11:00',endTime:'12:00'} : e);
        `);
        openAdd(); click('[data-remplacer]'); click('#chevListeRetraits input'); click('[data-continuer]');
        assert.match(w.document.querySelector('#chevauchementApercu').textContent, /Préparation.*10:00.*11:00.*12:00/s);
        click('#chevauchementApercu [data-confirmer]');
        assert.match(w.document.getElementById('chevConfirmEssentiels').textContent, /Préparation/);
        assert.equal(exec('window.__testSaves'), 0);
        click('[data-confirmer-essentiel]');
        assert.equal(exec('window.__testSaves'), 1);
        assert.equal(w.document.getElementById('chevauchementPopup'), null);
        assert.deepEqual(errors, [], 'erreurs JavaScript : ' + errors.join(' | '));
        console.log('ok : DOM et moteur réel — ajout, recalcul affiché, confirmation, édition, annulation, sélection, retour, état périmé et essentiel');
    } finally { if (dom) dom.window.close(); await new Promise(r => server.close(r)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
