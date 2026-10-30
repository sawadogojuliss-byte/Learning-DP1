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
    /* Continuer ouvre toujours l'écran suivant, même pour un profil déjà
       complet : seul le dernier écran mène au planning. */
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
   Indicateur des 10 étapes en haut de chaque écran de l'inscription.
   Il reprend le style des points existants : étapes faites en ✓,
   étape en cours en gras, étapes à venir en gris. Il suit l'écran
   réellement affiché. Le moto et la voiture comptent dans l'étape
   Transport. Le raccourci qui mène directement au planning n'affiche
   pas d'indicateur.
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

function onboardingIndicateurHTML(index) {
    var total = ONBOARDING_ETAPES.length;
    var html = '';
    var k;
    for (k = 0; k < total; k++) {
        var faite = k < index;
        var active = k === index;
        var classeEtape = (faite || active) ? 'progress-step progress-step-active' : 'progress-step progress-step-inactive';
        html += '<div class="' + classeEtape + '" style="width:1.75rem;height:1.75rem;min-width:1rem;flex:0 1 1.75rem;aspect-ratio:1 / 1;font-size:0.72rem;">'
            + (faite ? '✓' : String(k + 1)) + '</div>';
        if (k < total - 1) {
            html += '<div class="progress-line ' + (k < index ? 'progress-line-active' : 'progress-line-inactive')
                + '" style="flex:1 1 0;max-width:1.5rem;min-width:0.25rem;"></div>';
        }
    }
    return html;
}

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
    /* L'ancien bandeau écrit n'existe plus : on le retire s'il reste. */
    var ancien = document.getElementById('onboardingBandeau');
    if (ancien && ancien.parentNode) ancien.parentNode.removeChild(ancien);
    if (!cible) return;
    var indicateur = cible.querySelector('.progress-indicator');
    if (!indicateur) {
        indicateur = document.createElement('div');
        indicateur.className = 'progress-indicator';
        var parent = cible.querySelector('.context-card') || cible.querySelector('.context-center') || cible;
        parent.insertBefore(indicateur, parent.firstChild);
    }
    /* Ne reconstruire que si l'étape change : la reconstruction modifie des
       classes, et l'observateur ne doit pas relancer le même travail. */
    if (indicateur.getAttribute('data-etape') === String(index)) return;
    indicateur.setAttribute('data-etape', String(index));
    indicateur.setAttribute('role', 'group');
    indicateur.setAttribute('aria-label', 'Étape ' + (index + 1) + ' sur ' + total + ' : ' + ONBOARDING_ETAPES[index].nom);
    /* Les points sont élastiques et les traits font l'espacement : pas d'écart
       supplémentaire, sinon les dix étapes débordent sur un téléphone. */
    indicateur.style.gap = '0';
    indicateur.style.width = '100%';
    indicateur.style.boxSizing = 'border-box';
    indicateur.style.padding = '0 0.25rem';
    indicateur.innerHTML = onboardingIndicateurHTML(index);
}

if (typeof MutationObserver === 'function' && document.body) {
    new MutationObserver(onboardingRafraichirBandeau).observe(document.body, {
        attributes: true, attributeFilter: ['class'], subtree: true
    });
}
