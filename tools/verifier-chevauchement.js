/* Scénarios isolés : aucun compte, aucune écriture distante. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const file = fs.readFileSync(path.join(__dirname, '../js/pages/planning-interface.js'), 'utf8');
const source = file.slice(file.indexOf('function v3EstActivite('), file.indexOf('function v3SignalerChevauchementJour('));
const moteur = fs.readFileSync(path.join(__dirname, '../js/pages/planning-moteur.js'), 'utf8');
const moteurSource = moteur.slice(moteur.indexOf('function generateDayEvents('), moteur.indexOf('function planningDepuisProgression('));
const minutes = t => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
const clock = n => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
function scenario(base, utiliserMoteur = false) {
    let saves = 0;
    let closed = 0;
    const storage = new Map();
    const ctx = vm.createContext({
        localStorage: { setItem: (key, value) => storage.set(key, value), getItem: key => storage.get(key) || null },
        console, window: {}, customEvents: [], selectedActivities: [], selectedDay: 0,
        weekdayWakeup: '06:00', saturdayWakeup: '07:00', sundayWakeup: '08:00',
        bedtimeForDay: () => '22:00', COURS_FIN: 985,
        timeToMinutes: minutes, v3M2T: clock, validateNewEventTime: (start, end) => ({ valid: minutes(end) > minutes(start) }),
        v3FindOverride: () => null, generateEventId: (type, name, day) => type + '-' + name + '-' + day + '-new',
        v3Save: () => { saves++; }, closeAddModal: () => { closed++; }, closeEditModal: () => { closed++; },
        renderPlanning: () => {}, v3Toast: () => {}, v3SyncExoLabels: () => {},
        document: { getElementById: () => null },
        emploiNePasSauver: 0,
    });
    ctx.generateDayEvents = () => {
        const records = ctx.customEvents;
        const out = base.map(ev => {
            const ov = records.find(item => item.replacesId === ev.id);
            return ov ? { ...ev, startTime: ov.startTime, endTime: ov.endTime } : { ...ev };
        });
        return out.concat(records.filter(ev => !ev.replacesId).map(ev => ({ ...ev })));
    };
    vm.runInContext(source, ctx);
    if (utiliserMoteur) {
        Object.assign(ctx, {
            emploiGelSuspendu: true, v3Repas: events => events,
            planningGarantirJour: events => events,
            planningSansExercicesFaits: events => events,
            genererJourBrut: () => base.map(ev => {
                const ov = ctx.customEvents.find(item => item.replacesId === ev.id && !item.deleted);
                return ov ? { ...ev, startTime: ov.startTime, endTime: ov.endTime } : { ...ev };
            }).concat(ctx.customEvents.filter(ev => !ev.replacesId && !ev.deleted).map(ev => ({ ...ev })))
        });
        vm.runInContext(moteurSource, ctx);
    }
    const current = { mode: 'ajout', day: 0, title: 'Lecture', type: 'activity', icon: '📖',
        start: '18:30', end: '19:00', excludeIds: [], conflits: [base.find(ev => ev.id === 'sport')] };
    return { ctx, current, get saves() { return saves; }, get closed() { return closed; },
        eval: (code, extra = {}) => { Object.assign(ctx, extra); return vm.runInContext(code, ctx); } };
}
const sport = { id: 'sport', title: 'Sport', startTime: '18:00', endTime: '19:00', type: 'activity', editable: true };
const s = scenario([sport]);
let deplacement = s.eval('v3DestinationDeplacement(current, current.conflits[0])', { current: s.current });
assert.deepEqual(JSON.parse(JSON.stringify(deplacement)), {
    utilisateur: { start: '18:30', end: '19:00' }, conflitId: 'sport', autre: { start: '19:00', end: '20:00' }
});
assert.equal(s.saves, 0, 'la proposition ne doit pas enregistrer');
const journee = s.eval('v3PropositionsCreneau(current)', { current: s.current });
assert.ok(journee.length > 4 && journee.some(p => p.start < '12:00') && journee.some(p => p.start >= '19:00'),
    'les propositions couvrent le matin et le soir, pas seulement quatre créneaux');
assert.ok(journee.some(p => p.start === '18:00' && p.conflits.some(ev => ev.id === 'sport')),
    'un créneau occupé est proposé avec le nom de son activité');
assert.ok(journee.some(p => p.start === '19:00' && p.conflits.length === 0),
    'les horaires libres restent proposés');
assert.ok(journee.every(p => minutes(p.end) - minutes(p.start) === 30), 'la durée est préservée');
assert.equal(s.saves, 0, 'la recherche de toute la journée ne doit rien écrire');
assert.equal(s.eval('v3AppliquerChoixChevauchement(current, deplacement)', { deplacement }), true);
assert.equal(s.saves, 1, 'les deux changements sont sauvegardés une fois');
assert.equal(s.closed, 1);
assert.equal(s.ctx.customEvents.find(ev => ev.replacesId === 'sport').endTime, '20:00');
assert.equal(s.ctx.customEvents.find(ev => ev.title === 'Lecture').endTime, '19:00');
const option = scenario([sport]);
assert.equal(option.eval('v3AppliquerChoixChevauchement(current, choix)', { current: option.current,
    choix: { utilisateur: { start: '19:00', end: '19:30' } } }), true);
assert.equal(option.ctx.customEvents.length, 1, 'un autre horaire ne modifie pas Sport');
const bloque = scenario([sport,
    { id: 'avant', title: 'Avant', startTime: '06:00', endTime: '18:00', type: 'study' },
    { id: 'apres', title: 'Après', startTime: '19:00', endTime: '22:00', type: 'study' }]);
assert.equal(bloque.eval('v3DestinationDeplacement(current, current.conflits[0])', { current: bloque.current }), null);
assert.equal(bloque.eval('v3VerifierChoixChevauchement(current, choix).valid', { current: bloque.current,
    choix: { utilisateur: { start: '18:00', end: '18:30' }, conflitId: 'sport', autre: { start: '18:30', end: '19:30' } } }), false,
    'une destination dans un créneau occupé doit être refusée');
const recouvrement = scenario([sport]);
assert.equal(recouvrement.eval('v3VerifierChoixChevauchement(current, choix).valid', { current: recouvrement.current,
    choix: { utilisateur: { start: '18:30', end: '19:00' }, conflitId: 'sport', autre: { start: '18:30', end: '19:30' } } }), false,
    'les deux nouvelles positions ne peuvent pas se chevaucher');
const cours = scenario([{ ...sport, type: 'school' }]);
assert.equal(cours.eval('v3DestinationDeplacement(current, current.conflits[0])', { current: cours.current }), null,
    'on ne déplace pas un cours');
const plusieurs = scenario([sport, { ...sport, id: 'danse', title: 'Danse', startTime: '18:15', endTime: '18:45' }]);
plusieurs.current.conflits = plusieurs.ctx.generateDayEvents().filter(ev => ev.type === 'activity');
assert.equal(plusieurs.eval('v3DestinationDeplacement(current, current.conflits[0])', { current: plusieurs.current }), null);
const annulation = scenario([sport]);
annulation.eval('v3FermerChoixChevauchement()');
assert.equal(annulation.saves, 0);
const different = scenario([sport]);
different.ctx.generateDayEvents = () => [{ ...sport, startTime: '21:00', endTime: '22:00' }];
assert.equal(different.eval('v3AppliquerChoixChevauchement(current, choix)', { current: different.current,
    choix: { utilisateur: { start: '19:00', end: '19:30' } } }), false,
    'le résultat simulé doit correspondre avant la sauvegarde');
assert.equal(different.saves, 0);
assert.equal(different.ctx.customEvents.length, 0);
const erreurSauvegarde = scenario([sport]);
erreurSauvegarde.ctx.v3Save = () => {
    erreurSauvegarde.ctx.localStorage.setItem('studyPlanIB_customEvents_juliss', JSON.stringify(erreurSauvegarde.ctx.customEvents));
    throw new Error('erreur après l’écriture locale');
};
assert.equal(erreurSauvegarde.eval('v3AppliquerChoixChevauchement(current, choix)', { current: erreurSauvegarde.current,
    choix: { utilisateur: { start: '19:00', end: '19:30' } } }), false);
assert.equal(erreurSauvegarde.ctx.customEvents.length, 0);
assert.equal(erreurSauvegarde.ctx.localStorage.getItem('studyPlanIB_customEvents_juliss'), '[]',
    'un échec tardif doit restaurer la copie locale');
// Le moteur régénère les créneaux fondamentaux : vérifier le résultat réel,
// puis une seconde génération (gel/rechargement) et aucune suppression tacite.
const base = [sport, { id: 'danse', title: 'Danse', type: 'activity', startTime: '18:15', endTime: '18:45' },
    { id: 'prep', title: 'Préparation', type: 'prep', startTime: '17:50', endTime: '18:10' },
    { id: 'sleep', title: 'Coucher', type: 'sleep', startTime: '22:00', endTime: '06:00' }];
const remplace = scenario(base, true);
const opts = { current: remplace.current, choix: { utilisateur: { start: '18:30', end: '19:00' },
    supprimerIds: ['sport', 'danse'], type: 'remplacer' } };
assert.equal(remplace.eval('v3VerifierChoixChevauchement(current, choix).valid', opts), true);
assert.equal(remplace.eval('v3AppliquerChoixChevauchement(current, choix)', opts), true);
assert.equal(remplace.saves, 1);
assert.deepEqual(remplace.ctx.generateDayEvents(0).map(e => e.id).sort(), ['activity-Lecture-0-new', 'prep', 'sleep']);
assert.deepEqual(remplace.ctx.generateDayEvents(0).find(e => e.title === 'Lecture').endTime, '19:00');
assert.equal(remplace.ctx.customEvents.filter(e => e.deleted && e.remplacementConflit).length, 2);
assert.equal(remplace.ctx.generateDayEvents(0).some(e => e.id === 'prep'), true, 'Préparation préservée sans case cochée');
const exact = scenario(base, true);
assert.equal(exact.eval('v3AppliquerChoixChevauchement(current, choix)', { current: exact.current,
    choix: { utilisateur: { start: '18:00', end: '19:00' }, sourceId: 'sport',
        type: 'remplacerExact', supprimerIds: ['sport', 'danse', 'prep'] } }), true);
assert.equal(exact.ctx.generateDayEvents(0).find(e => e.title === 'Lecture').endTime, '19:00');
assert.deepEqual(exact.ctx.generateDayEvents(0).map(e => e.id).sort(), ['activity-Lecture-0-new', 'sleep']);
const nonChoisi = scenario(base, true);
assert.equal(nonChoisi.eval('v3VerifierChoixChevauchement(current, choix).valid', { current: nonChoisi.current,
    choix: { utilisateur: { start: '18:30', end: '19:00' }, supprimerIds: ['sport'] } }), false);
assert.equal(nonChoisi.eval('v3VerifierChoixChevauchement(current, choix).valid', { current: nonChoisi.current,
    choix: { utilisateur: { start: '18:30', end: '19:00' }, supprimerIds: ['sport', 'prep', 'danse'] } }), false,
    'impossible de supprimer un bloc qui ne chevauche pas le résultat');
assert.equal(nonChoisi.saves, 0);
const essentiel = scenario([{ id: 'wakeup', title: 'Réveil', type: 'wakeup', startTime: '06:00', endTime: '06:10' },
    { id: 'prep', title: 'Préparation', type: 'prep', startTime: '06:10', endTime: '06:30' },
    { id: 'sleep', title: 'Coucher', type: 'sleep', startTime: '22:00', endTime: '06:00' }], true);
const matin = { utilisateur: { start: '06:00', end: '06:30' }, supprimerIds: ['wakeup', 'prep'] };
assert.equal(essentiel.eval('v3VerifierChoixChevauchement(current, choix).valid', { current: essentiel.current, choix: matin }), true);
assert.equal(essentiel.eval('v3AppliquerChoixChevauchement(current, choix)', { current: essentiel.current, choix: matin }), true);
assert.deepEqual(essentiel.ctx.generateDayEvents(0).map(e => e.id).sort(), ['activity-Lecture-0-new', 'sleep']);
const reintroduit = scenario([sport], true);
reintroduit.ctx.planningSansExercicesFaits = events => events.concat({ ...sport });
const force = { utilisateur: { start: '18:30', end: '19:00' }, supprimerIds: ['sport'] };
assert.equal(reintroduit.eval('v3AppliquerChoixChevauchement(current, choix)', { current: reintroduit.current, choix: force }), true,
    'un bloc régénéré reste masqué par le choix explicite');
const echecs = scenario([sport], false);
echecs.ctx.generateDayEvents = () => [{ ...sport }, { id: 'activity-Lecture-0-new', title: 'Lecture', startTime: '18:30', endTime: '19:00' }];
assert.equal(echecs.eval('v3AppliquerChoixChevauchement(current, choix)', { current: echecs.current, choix: force }), false,
    'ne pas prétendre supprimer si le moteur refuse de masquer');
assert.equal(echecs.ctx.customEvents.length, 0);
assert.equal(echecs.saves, 0);
const decalageImplicite = scenario([sport, { id: 'prep', title: 'Préparation', type: 'prep',
    startTime: '17:30', endTime: '18:00' }], true);
decalageImplicite.ctx.planningSansExercicesFaits = events => events.map(ev =>
    ev.id === 'prep' && decalageImplicite.ctx.customEvents.some(e => e.deleted)
        ? { ...ev, startTime: '17:40', endTime: '18:10' } : ev);
assert.equal(decalageImplicite.eval('v3AppliquerChoixChevauchement(current, choix)', {
    current: decalageImplicite.current, choix: force }), false,
    'ne jamais déplacer Préparation sans accord, même lors de la régénération');
assert.equal(decalageImplicite.saves, 0);
assert.equal(decalageImplicite.ctx.customEvents.length, 0);
console.log('ok popup : durées inchangées, alternative, cours protégé, conflit multiple, refus de chevauchement, annulation et reprise après échec');
