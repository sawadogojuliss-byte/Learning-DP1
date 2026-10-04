/* ============================================================
   PAGE Classe
   Choix DP1 ou DP2, avant les matières.
   Vue : pages/onboarding-classe.html
   ============================================================ */

let ibYear = '';
let classeRetour = '';

function showClassePage() {
    ['contextModal', 'objectivesModal', 'subjectsModal', 'sleepModal'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.classList.remove('active');
    });
    document.getElementById('classeModal').classList.add('active');
    renderClasse();
}

function hideClassePage() {
    document.getElementById('classeModal').classList.remove('active');
    if (classeRetour === 'planning' && window.__profilComplet && typeof generatePlanning === 'function') {
        classeRetour = '';
        generatePlanning();
        return;
    }
    document.getElementById('contextModal').classList.add('active');
}

function setIbYear(year) {
    if (year !== 'DP1' && year !== 'DP2') return;
    ibYear = year;
    renderClasse();
    majClasseAffichage();
}

function validateClasse() {
    if (ibYear !== 'DP1' && ibYear !== 'DP2') return;
    var versPlanning = classeRetour === 'planning' || (window.__profilComplet && classeRetour !== 'sujets');
    classeRetour = '';
    if (versPlanning && typeof generatePlanning === 'function') {
        document.getElementById('classeModal').classList.remove('active');
        generatePlanning();
        return;
    }
    showObjectivesPage();
}

function demanderClasseSiBesoin() {
    if (ibYear === 'DP1' || ibYear === 'DP2') return false;
    classeRetour = 'planning';
    showClassePage();
    return true;
}

function majClasseAffichage() {
    var el = document.getElementById('menuClasseLabel');
    if (!el) return;
    el.textContent = (ibYear === 'DP1' || ibYear === 'DP2') ? (ibYear + ' · Enko Ouaga') : 'Enko Ouaga';
}

function classeCarte(year, titre, detail, accent, wash) {
    var on = ibYear === year;
    return '<button type="button" onclick="setIbYear(\'' + year + '\')" style="text-align:left;width:min(100%,16.5rem);border:2px solid ' + (on ? accent : '#e7e5e4') + ';background:' + (on ? wash : 'white') + ';border-radius:1.35rem;padding:1.35rem 1.2rem;cursor:pointer;box-shadow:' + (on ? '0 16px 32px rgba(15,23,42,0.08)' : '0 8px 18px rgba(15,23,42,0.04)') + ';transition:all 0.2s;">'
        + '<span style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;">'
        + '<span style="width:3.1rem;height:3.1rem;border-radius:1rem;display:flex;align-items:center;justify-content:center;font-weight:800;color:white;background:' + accent + ';font-size:0.95rem;">' + year + '</span>'
        + '<span style="width:1.45rem;height:1.45rem;border-radius:999px;border:2px solid ' + (on ? accent : '#d6d3d1') + ';background:' + (on ? accent : 'white') + ';color:white;display:flex;align-items:center;justify-content:center;font-size:0.75rem;">' + (on ? '✓' : '') + '</span>'
        + '</span>'
        + '<span style="display:block;font-size:1.35rem;font-weight:800;color:#1c1917;">' + titre + '</span>'
        + '<span style="display:block;margin-top:0.3rem;color:#78716c;font-size:0.86rem;line-height:1.4;">' + detail + '</span>'
        + '</button>';
}

function renderClasse() {
    var host = document.getElementById('classeChoices');
    if (!host) return;
    host.innerHTML = classeCarte('DP1', 'DP1', 'Première année du diplôme', '#059669', '#ecfdf5')
        + classeCarte('DP2', 'DP2', 'Deuxième année du diplôme', '#0f766e', '#f0fdfa');
    var btn = document.getElementById('classeContinueBtn');
    if (btn) {
        var pret = ibYear === 'DP1' || ibYear === 'DP2';
        btn.disabled = !pret;
        btn.style.opacity = pret ? '1' : '0.45';
        btn.style.cursor = pret ? 'pointer' : 'not-allowed';
    }
    majClasseAffichage();
}
