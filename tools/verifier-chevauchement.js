/* Scénarios isolés : aucun compte, aucune écriture distante. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const file = fs.readFileSync(path.join(__dirname, '../js/pages/planning-interface.js'), 'utf8');
const source = file.slice(file.indexOf('function v3EstActivite('), file.indexOf('function v3SignalerChevauchementJour('));
const minutes = t => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
const clock = n => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
function scenario(base) {
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
console.log('ok popup : durées inchangées, alternative, cours protégé, conflit multiple, refus de chevauchement, annulation et reprise après échec');
