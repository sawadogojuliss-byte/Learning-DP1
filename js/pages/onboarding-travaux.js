/* ============================================================
   EE & IA
   Avancement du mémoire et de chaque évaluation interne.
   La page d'onboarding n'est plus affichée.
   ============================================================ */

let memoirLevel = '';
let iaLevel = '';
let iaLevels = {};

const MEMOIR_STAGES = [
    { id: 'debut', name: 'Pas commencé', hint: 'Le sujet n’est pas encore choisi.' },
    { id: 'recherche', name: 'Recherche', hint: 'Tu rassembles des sources.' },
    { id: 'plan', name: 'Plan', hint: 'La question et le plan sont posés.' },
    { id: 'brouillon', name: 'Brouillon', hint: 'Tu es en train d’écrire.' },
    { id: 'final', name: 'Finalisation', hint: 'Tu relis et tu corriges.' }
];

const IA_STAGES = [
    { id: 'debut', name: 'Pas commencées', hint: 'Les critères ne sont pas encore lancés.' },
    { id: 'criteres', name: 'Critères', hint: 'Tu comprends ce qui est demandé.' },
    { id: 'collecte', name: 'Collecte', hint: 'Tu rassembles données et exemples.' },
    { id: 'brouillon', name: 'Brouillon', hint: 'Le travail est en cours d’écriture.' },
    { id: 'final', name: 'Finalisation', hint: 'Tu peaufines avant de rendre.' }
];

function eeEchap(str) {
    return String(str == null ? '' : str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function stagePourcentage(stageId, stages) {
    var index = -1;
    var i;
    for (i = 0; i < stages.length; i++) {
        if (stages[i].id === stageId) index = i;
    }
    if (index < 0 || !stages.length) return 0;
    return Math.round(((index + 1) * 100) / stages.length);
}

function partEtape(stages) {
    if (!stages.length) return 0;
    return Math.round(100 / stages.length);
}

function memoirLevelLabel() {
    var found = MEMOIR_STAGES.find(function (s) { return s.id === memoirLevel; });
    return found ? found.name : 'Recherche et rédaction';
}

function iaStageId(name) {
    if (iaLevels && iaLevels[name]) return iaLevels[name];
    return '';
}

function iaLevelLabel(name) {
    var id = name ? iaStageId(name) : iaLevel;
    var found = IA_STAGES.find(function (s) { return s.id === id; });
    return found ? found.name : 'critères et brouillon';
}

function eeSujets() {
    var list = [];
    if (typeof chosenSubjects === 'function') list = chosenSubjects();
    else list = (typeof subjects !== 'undefined' ? subjects : []).concat(typeof optionalSubjects !== 'undefined' ? optionalSubjects : []);
    return list.filter(function (s) { return s && s.name; });
}

function setMemoirLevel(id) {
    memoirLevel = id;
    renderEEia();
    if (typeof renderPlanning === 'function') {
        try { renderPlanning(); } catch (e) {}
    }
}

function setIaStage(index, id) {
    var sujet = eeSujets()[index];
    if (!sujet) return;
    if (!iaLevels || typeof iaLevels !== 'object') iaLevels = {};
    iaLevels[sujet.name] = id;
    renderEEia();
    if (typeof renderPlanning === 'function') {
        try { renderPlanning(); } catch (e) {}
    }
}

function eeCarteEtape(stage, index, selectedId, stages, action) {
    var selectedIndex = -1;
    var i;
    for (i = 0; i < stages.length; i++) {
        if (stages[i].id === selectedId) selectedIndex = i;
    }
    var on = index <= selectedIndex;
    var current = stage.id === selectedId;
    var accent = action.indexOf('setMemoirLevel') === 0 ? '#9f1239' : '#1d4ed8';
    var wash = action.indexOf('setMemoirLevel') === 0 ? '#fff1f2' : '#eff6ff';
    return '<button type="button" onclick="' + action + '" style="text-align:left;width:100%;border:1.5px solid ' + (current ? accent : '#e7e5e4') + ';background:' + (on ? wash : 'white') + ';border-radius:1rem;padding:0.8rem 0.9rem;cursor:pointer;display:flex;gap:0.75rem;align-items:flex-start;">'
        + '<span style="width:1.55rem;height:1.55rem;border-radius:999px;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:0.72rem;font-weight:800;color:' + (on ? 'white' : '#78716c') + ';background:' + (on ? accent : '#f5f5f4') + ';">' + (on ? '✓' : (index + 1)) + '</span>'
        + '<span><span style="display:block;font-weight:750;color:#1c1917;font-size:0.9rem;">' + eeEchap(stage.name) + '</span><span style="display:block;margin-top:0.12rem;color:#78716c;font-size:0.76rem;line-height:1.35;">' + eeEchap(stage.hint) + '</span></span>'
        + '</button>';
}

function eeBarre(pourcent, accent) {
    return '<div style="height:0.55rem;border-radius:999px;background:#f3f4f6;overflow:hidden;margin-top:0.45rem;">'
        + '<div style="width:' + pourcent + '%;height:100%;border-radius:999px;background:' + accent + ';transition:width 0.25s;"></div>'
        + '</div>';
}

function renderEEia() {
    var body = document.getElementById('eeiaBody');
    if (!body) return;
    var partIa = partEtape(IA_STAGES);
    var html = '<section style="margin-bottom:1.25rem;padding:1.1rem;border-radius:1.35rem;background:linear-gradient(180deg,#fff7f7,#fff);border:1px solid #f1f0ee;">'
        + '<p style="margin:0 0 0.2rem;font-size:0.68rem;letter-spacing:0.18em;text-transform:uppercase;font-weight:800;color:#9f1239;">EE</p>'
        + '<h2 style="margin:0 0 0.35rem;font-size:1.15rem;color:#1c1917;">Mémoire</h2>'
        + '<p style="margin:0 0 0.85rem;color:#78716c;font-size:0.8rem;">Indique où tu en es.</p>'
        + '<div style="display:flex;flex-direction:column;gap:0.45rem;">'
        + MEMOIR_STAGES.map(function (stage, i) {
            return eeCarteEtape(stage, i, memoirLevel, MEMOIR_STAGES, 'setMemoirLevel(\'' + stage.id + '\')');
        }).join('')
        + '</div></section>';

    html += '<section style="padding:1.1rem;border-radius:1.35rem;background:linear-gradient(180deg,#f8fafc,#fff);border:1px solid #f1f0ee;">'
        + '<p style="margin:0 0 0.2rem;font-size:0.68rem;letter-spacing:0.18em;text-transform:uppercase;font-weight:800;color:#1d4ed8;">IA</p>'
        + '<h2 style="margin:0 0 0.35rem;font-size:1.15rem;color:#1c1917;">Évaluations internes</h2>'
        + '<p style="margin:0 0 0.9rem;color:#78716c;font-size:0.8rem;">Chaque étape vaut ' + partIa + ' %. Le pourcentage avance quand tu coches une étape.</p>';

    var sujets = eeSujets();
    if (!sujets.length) {
        html += '<p style="margin:0;color:#6b7280;font-size:0.88rem;">Choisis d’abord tes matières pour suivre chaque évaluation interne.</p>';
    }
    sujets.forEach(function (sujet, index) {
        var stade = iaStageId(sujet.name);
        var pourcent = stagePourcentage(stade, IA_STAGES);
        html += '<article style="margin-bottom:0.9rem;padding:0.95rem;border-radius:1.1rem;background:white;border:1px solid #e7e5e4;">'
            + '<div style="display:flex;align-items:center;justify-content:space-between;gap:0.75rem;">'
            + '<div style="display:flex;align-items:center;gap:0.55rem;min-width:0;"><span style="font-size:1.25rem;">' + eeEchap(sujet.icon || '📋') + '</span><strong style="color:#1c1917;font-size:0.95rem;">' + eeEchap(sujet.name) + '</strong></div>'
            + '<span style="font-size:1.15rem;font-weight:800;color:#1d4ed8;">' + pourcent + ' %</span>'
            + '</div>'
            + eeBarre(pourcent, '#1d4ed8')
            + '<div style="display:flex;flex-direction:column;gap:0.4rem;margin-top:0.75rem;">'
            + IA_STAGES.map(function (stage, i) {
                return eeCarteEtape(stage, i, stade, IA_STAGES, 'setIaStage(' + index + ',\'' + stage.id + '\')');
            }).join('')
            + '</div></article>';
    });
    html += '</section>';
    body.innerHTML = html;
}

function showTravauxPage() {
    if (typeof showTransportPage === 'function') showTransportPage();
}

function hideTravauxPage() {
    var sujets = document.getElementById('subjectsModal');
    if (sujets) sujets.classList.add('active');
}

function renderTravaux() {}

function validateTravaux() {
    if (typeof showTransportPage === 'function') showTransportPage();
}

function setIaLevel(id) {
    iaLevel = id;
}
