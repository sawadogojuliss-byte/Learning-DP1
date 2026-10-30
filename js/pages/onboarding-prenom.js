/* ============================================================
   PAGE Prénom
   Saisie du prénom et passage à l'objectif.
   Vue : pages/onboarding-prenom.html
   ============================================================ */

let userName = '';

function prenomErreur(message) {
    var el = document.getElementById('nameError');
    if (!el) return;
    el.textContent = message;
    el.classList.add('show');
}

function handleContinue() {
    const name = document.getElementById('nameInput').value.trim().replace(/\s+/g, ' ');
    
    if (!name) {
        prenomErreur('Merci d\'entrer ton prénom');
        return;
    }

    document.getElementById('nameError').classList.remove('show');
    userName = name;
    if (window.compteSession && window.compteSession.sub && typeof compteLierNom === 'function') {
        compteLierNom(window.compteSession.sub, name, window.compteSession.email || '');
    }
    classeRetour = '';
    if (window.__profilComplet && typeof memoireAller === 'function') {
        memoireAller('planning');
        return;
    }
    showClassePage();
}

function showObjectivesPage() {
    ['contextModal', 'classeModal', 'subjectsModal', 'sleepModal'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.classList.remove('active');
    });
    document.getElementById('objectivesModal').classList.add('active');
    updateScoreUI();
}

function hideObjectivesPage() {
    document.getElementById('objectivesModal').classList.remove('active');
    if (typeof showClassePage === 'function') showClassePage();
    else document.getElementById('contextModal').classList.add('active');
}

document.getElementById('nameInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        handleContinue();
    }
});


/* ------------------------------------------------------------
   Bandeau d'étapes : « Étape N sur 10 » en haut de chaque écran
   de l'inscription. Il suit l'écran réellement affiché. Le moto et
   la voiture comptent dans l'étape Transport. Le raccourci qui
   mène directement au planning n'affiche pas de bandeau.
   ------------------------------------------------------------ */
var ONBOARDING_ETAPES = [
    { ecrans: ['contextModal'], nom: 'Prénom' },
    { ecrans: ['objectivesModal'], nom: 'Objectif' },
    { ecrans: ['classeModal'], nom: 'Classe' },
    { ecrans: ['subjectsModal'], nom: 'Matières' },
    { ecrans: ['sleepModal'], nom: 'Sommeil' },
    { ecrans: ['habitsModal'], nom: 'Habitudes' },
    { ecrans: ['transportModal', 'motoConfigModal', 'carConfigModal'], nom: 'Transport' },
    { ecrans: ['activitiesModal'], nom: 'Activités' },
    { ecrans: ['screenTimeModal'], nom: 'Écran' },
    { ecrans: ['freeTimeModal'], nom: 'Temps libre' }
];

function onboardingRafraichirBandeau() {
    var total = ONBOARDING_ETAPES.length;
    var index = -1;
    var cible = null;
    ONBOARDING_ETAPES.forEach(function (etape, i) {
        if (cible) return;
        etape.ecrans.forEach(function (id) {
            var el = document.getElementById(id);
            if (!cible && el && el.classList.contains('active')) { cible = el; index = i; }
        });
    });
    var bandeau = document.getElementById('onboardingBandeau');
    if (!cible) {
        if (bandeau && bandeau.parentNode) bandeau.parentNode.removeChild(bandeau);
        return;
    }
    if (!bandeau) {
        bandeau = document.createElement('div');
        bandeau.id = 'onboardingBandeau';
        bandeau.setAttribute('aria-label', 'Progression de l\'inscription');
    }
    var segments = '';
    for (var k = 0; k < total; k++) {
        var couleur = k <= index ? '#059669' : '#d1fae5';
        segments += '<span style="flex:1;height:6px;border-radius:999px;background:' + couleur + ';"></span>';
    }
    bandeau.innerHTML =
        '<p style="margin:0 0 0.4rem;font-size:0.78rem;font-weight:800;color:#047857;letter-spacing:0.04em;text-transform:uppercase;">'
        + 'Étape ' + (index + 1) + ' sur ' + total + ' · ' + ONBOARDING_ETAPES[index].nom + '</p>'
        + '<div style="display:flex;gap:4px;margin:0 auto 1rem;max-width:22rem;">' + segments + '</div>';
    var parent = cible.querySelector('.context-center') || cible;
    if (bandeau.parentNode !== parent || parent.firstChild !== bandeau) {
        parent.insertBefore(bandeau, parent.firstChild);
    }
}

if (typeof MutationObserver === 'function' && document.body) {
    new MutationObserver(onboardingRafraichirBandeau).observe(document.body, {
        attributes: true, attributeFilter: ['class'], subtree: true
    });
}
