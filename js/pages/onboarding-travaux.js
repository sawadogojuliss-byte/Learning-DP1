/* ============================================================
   PAGE Mémoire et évaluations internes
   Après les matières. L'élève indique son niveau.
   Vue : pages/onboarding-travaux.html
   ============================================================ */

let memoirLevel = '';
let iaLevel = '';

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

function memoirLevelLabel() {
    const found = MEMOIR_STAGES.find(function (s) { return s.id === memoirLevel; });
    return found ? found.name : 'Recherche et rédaction';
}

function iaLevelLabel() {
    const found = IA_STAGES.find(function (s) { return s.id === iaLevel; });
    return found ? found.name : 'critères et brouillon';
}

function showTravauxPage() {
    ['subjectsModal', 'transportModal'].forEach(function (id) {
        const el = document.getElementById(id);
        if (el) el.classList.remove('active');
    });
    document.getElementById('travauxModal').classList.add('active');
    renderTravaux();
}

function hideTravauxPage() {
    document.getElementById('travauxModal').classList.remove('active');
    document.getElementById('subjectsModal').classList.add('active');
    if (typeof updateSubjectsUI === 'function') updateSubjectsUI();
}

function setMemoirLevel(id) {
    memoirLevel = id;
    renderTravaux();
}

function setIaLevel(id) {
    iaLevel = id;
    renderTravaux();
}

function travauxCard(stage, index, selected, kind) {
    const on = selected === stage.id;
    const accent = kind === 'memoir' ? '#9f1239' : '#1d4ed8';
    const wash = kind === 'memoir' ? '#fff1f2' : '#eff6ff';
    const action = kind === 'memoir' ? 'setMemoirLevel' : 'setIaLevel';
    return '<button type="button" onclick="' + action + '(\'' + stage.id + '\')" style="text-align:left;border:1.5px solid ' + (on ? accent : '#e7e5e4') + ';background:' + (on ? wash : 'white') + ';border-radius:1rem;padding:0.85rem 0.95rem;cursor:pointer;display:flex;gap:0.8rem;align-items:flex-start;box-shadow:' + (on ? '0 10px 24px rgba(15,23,42,0.06)' : 'none') + ';transition:all 0.2s;">'
        + '<span style="width:1.7rem;height:1.7rem;border-radius:999px;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:0.72rem;font-weight:800;color:' + (on ? 'white' : '#78716c') + ';background:' + (on ? accent : '#f5f5f4') + ';">' + (index + 1) + '</span>'
        + '<span><span style="display:block;font-weight:750;color:#1c1917;font-size:0.92rem;">' + stage.name + '</span><span style="display:block;margin-top:0.15rem;color:#78716c;font-size:0.78rem;line-height:1.35;">' + stage.hint + '</span></span>'
        + '</button>';
}

function travauxSection(title, kicker, stages, selected, kind) {
    const accent = kind === 'memoir' ? '#9f1239' : '#1d4ed8';
    const wash = kind === 'memoir' ? 'linear-gradient(180deg,#fff7f7,#fff)' : 'linear-gradient(180deg,#f8fafc,#fff)';
    return '<section style="margin-bottom:1.1rem;padding:1.1rem;border-radius:1.35rem;background:' + wash + ';border:1px solid #f1f0ee;">'
        + '<p style="margin:0 0 0.2rem;font-size:0.68rem;letter-spacing:0.18em;text-transform:uppercase;font-weight:800;color:' + accent + ';">' + kicker + '</p>'
        + '<h2 style="margin:0 0 0.85rem;font-size:1.2rem;color:#1c1917;">' + title + '</h2>'
        + '<div style="display:flex;flex-direction:column;gap:0.5rem;">' + stages.map(function (stage, i) { return travauxCard(stage, i, selected, kind); }).join('') + '</div>'
        + '</section>';
}

function renderTravaux() {
    const body = document.getElementById('travauxBody');
    if (!body) return;
    body.innerHTML = travauxSection('Où en es-tu dans le mémoire ?', 'Mémoire', MEMOIR_STAGES, memoirLevel, 'memoir')
        + travauxSection('Où en es-tu dans les évaluations internes ?', 'Évaluations internes', IA_STAGES, iaLevel, 'ia');
    const btn = document.getElementById('travauxContinueBtn');
    if (btn) {
        const ready = !!(memoirLevel && iaLevel);
        btn.disabled = !ready;
        btn.style.opacity = ready ? '1' : '0.55';
    }
}

function validateTravaux() {
    if (memoirLevel && iaLevel && typeof showTransportPage === 'function') showTransportPage();
}
