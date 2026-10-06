/* ============================================================
   Mémoire — Study Plan IB
   Enregistre le profil complet dans le navigateur.
   Une actualisation reprend la dernière page, sans recommencer.
   ============================================================ */

var MEMOIRE_KEY = 'studyPlanIB_profil';
var memoirePret = false;
var memoireDernier = '';

function memoireJson(key) {
    try {
        return JSON.parse(localStorage.getItem(key) || 'null');
    } catch (e) {
        return null;
    }
}

var MEMOIRE_PAGES = {
    panelSoutien: 'soutien',
    panelExercices: 'exercices',
    panelLegende: 'legende',
    panelEEia: 'eeia',
    panelFeries: 'feries',
    panelAide: 'aide',
    panelFeedback: 'feedback',
    panelRetours: 'retours',
    panelQuestions: 'questions',
    panelEmplois: 'emplois',
    contextModal: 'prenom',
    objectivesModal: 'objectif',
    sleepModal: 'sommeil',
    classeModal: 'classe',
    subjectsModal: 'matieres',
    travauxModal: 'travaux',
    transportModal: 'transport',
    carConfigModal: 'voiture',
    motoConfigModal: 'moto',
    activitiesModal: 'activites',
    holidaysModal: 'feries',
    freeTimeModal: 'libre',
    screenTimeModal: 'ecran',
    planningModal: 'planning'
};

function memoireEtapeActive() {
    var panneaux = document.querySelectorAll('.app-panel.active');
    var i, id;
    for (i = panneaux.length - 1; i >= 0; i--) {
        id = panneaux[i].id;
        if (MEMOIRE_PAGES[id]) return MEMOIRE_PAGES[id];
    }
    var modales = document.querySelectorAll('.context-modal.active');
    for (i = modales.length - 1; i >= 0; i--) {
        id = modales[i].id;
        if (MEMOIRE_PAGES[id]) return MEMOIRE_PAGES[id];
    }
    return 'accueil';
}

function memoireLireEtat() {
    if (typeof eeNettoyerSuivi === 'function') eeNettoyerSuivi();
    var champNom = document.getElementById('nameInput');
    if (champNom && champNom.value.trim()) {
        var saisi = champNom.value.trim().replace(/\s+/g, ' ');
        if (typeof compteNomAutorise === 'function' && !compteNomAutorise(saisi)) {
            champNom.value = userName || '';
            if (typeof compteDireNomPris === 'function') compteDireNomPris();
        } else {
            userName = saisi;
        }
    }
    if (!userName && typeof compteNomLie === 'function' && window.compteSession && window.compteSession.sub) {
        userName = compteNomLie(window.compteSession.sub) || userName;
    }

    var etape = memoireEtapeActive();
    if (etape === 'planning' || etape === 'soutien' || etape === 'exercices' || etape === 'legende' || etape === 'eeia' || etape === 'feries') window.__profilComplet = true;

    return {
        v: 1,
        savedAt: new Date().toISOString(),
        etape: etape,
        profilComplet: !!window.__profilComplet,
        userName: userName,
        targetScore: targetScore,
        weekdayWakeup: weekdayWakeup,
        saturdayWakeup: saturdayWakeup,
        sundayWakeup: sundayWakeup,
        subjects: subjects,
        optionalSubjects: optionalSubjects,
        ibYear: typeof ibYear !== 'undefined' ? ibYear : '',
        memoirLevel: typeof memoirLevel !== 'undefined' ? memoirLevel : '',
        iaLevel: typeof iaLevel !== 'undefined' ? iaLevel : '',
        iaLevels: typeof iaLevels !== 'undefined' ? iaLevels : {},
        memoirPlan: typeof memoirPlan !== 'undefined' ? memoirPlan : [],
        iaPlans: typeof iaPlans !== 'undefined' ? iaPlans : {},
        eeVus: typeof eeVus !== 'undefined' ? eeVus : {},
        eeDemandes: typeof eeDemandes !== 'undefined' ? eeDemandes : {},
        transportMode: typeof transportMode !== 'undefined' ? transportMode : '',
        carDeparture: carDeparture,
        carToSchool: carToSchool,
        carFromSchool: carFromSchool,
        motoDeparture: motoDeparture,
        motoReturn: motoReturn,
        motoToSchool: motoToSchool,
        motoFromSchool: motoFromSchool,
        selectedActivities: selectedActivities,
        holidayDays: holidayDays,
        holidayModes: holidayModes,
        holidayDropped: holidayDropped,
        sameFreeTime: sameFreeTime,
        freeTimeMinutes: freeTimeMinutes,
        freeTimeByDay: freeTimeByDay,
        weekdaySleepHours: weekdaySleepHours,
        saturdaySleepHours: saturdaySleepHours,
        sundaySleepHours: sundaySleepHours,
        phoneDays: phoneDays,
        samePhoneDuration: samePhoneDuration,
        phoneDuration: phoneDuration,
        phoneDayDurations: phoneDayDurations,
        selectedDay: selectedDay,
        customEvents: customEvents,
        exercices: typeof exercices !== 'undefined' ? exercices : [],
        currentMood: typeof currentMood !== 'undefined' ? currentMood : null,
        google: (function () {
            if (window.compteSession && window.compteSession.sub) return window.compteSession;
            if (window.compteProprietaire && window.compteProprietaire.sub) return window.compteProprietaire;
            try {
                var garde = JSON.parse(localStorage.getItem('studyPlanIB_proprietaire') || 'null');
                if (garde && garde.sub) return garde;
            } catch (e) {}
            return null;
        })()
    };
}

function memoireSet(id, value) {
    var el = document.getElementById(id);
    if (el && value != null && value !== '') el.value = value;
}

function memoireSyncChamps() {
    memoireSet('nameInput', userName);
    memoireSet('scoreValue', targetScore);
    memoireSet('weekdayWakeupInput', weekdayWakeup);
    memoireSet('saturdayWakeupInput', saturdayWakeup);
    memoireSet('sundayWakeupInput', sundayWakeup);
    memoireSet('carDepartureInput', carDeparture);
    memoireSet('carToSchoolInput', carToSchool);
    memoireSet('carFromSchoolInput', carFromSchool);
    memoireSet('motoDepartureInput', motoDeparture);
    memoireSet('motoReturnInput', motoReturn);
    memoireSet('motoToSchoolInput', motoToSchool);
    memoireSet('motoFromSchoolInput', motoFromSchool);
    var cb = document.querySelector('#screenTimeModal input[type="checkbox"]');
    if (cb) cb.checked = !!samePhoneDuration;
    if (typeof updateBedtimes === 'function') {
        try { updateBedtimes(); } catch (e) {}
    }
}

function memoireSujetsImposes(list) {
    if (!Array.isArray(list) || list.length !== 3) return false;
    var names = list.map(function (s) { return s && s.name; }).sort().join('|');
    return names === 'Anglais B|Français A|Mathématiques AA';
}

function memoireAppliquer(data, opts) {
    if (!data || typeof data !== 'object') return;
    var depuisCompte = !!(opts && opts.compte);
    if (typeof data.userName === 'string') userName = data.userName;
    if (typeof data.targetScore === 'number') targetScore = data.targetScore;
    if (data.weekdayWakeup) weekdayWakeup = data.weekdayWakeup;
    if (data.saturdayWakeup) saturdayWakeup = data.saturdayWakeup;
    if (data.sundayWakeup) sundayWakeup = data.sundayWakeup;
    var optionnelsSauves = Array.isArray(data.optionalSubjects) ? data.optionalSubjects : [];
    var anciensImposes = !depuisCompte && memoireSujetsImposes(data.subjects) && optionnelsSauves.length === 0;
    if (!anciensImposes && Array.isArray(data.subjects)) subjects = data.subjects;
    if (!anciensImposes && Array.isArray(data.optionalSubjects)) optionalSubjects = data.optionalSubjects;
    if (typeof enforceSubjectRules === 'function') enforceSubjectRules();
    if (typeof ibYear !== 'undefined' && (data.ibYear === 'DP1' || data.ibYear === 'DP2' || data.ibYear === '')) ibYear = data.ibYear;
    if (typeof majClasseAffichage === 'function') majClasseAffichage();
    if (typeof majApparenceNotes === 'function') majApparenceNotes();
    if (typeof data.memoirLevel === 'string') memoirLevel = data.memoirLevel;
    if (typeof data.iaLevel === 'string') iaLevel = data.iaLevel;
    if (typeof iaLevels !== 'undefined' && data.iaLevels && typeof data.iaLevels === 'object') iaLevels = data.iaLevels;
    if (typeof memoirPlan !== 'undefined' && Array.isArray(data.memoirPlan)) memoirPlan = typeof eeNormaliserPlan === 'function' ? eeNormaliserPlan(data.memoirPlan) : data.memoirPlan;
    if (typeof iaPlans !== 'undefined' && data.iaPlans && typeof data.iaPlans === 'object') iaPlans = typeof eeNormaliserPlans === 'function' ? eeNormaliserPlans(data.iaPlans) : data.iaPlans;
    if (typeof eeVus !== 'undefined' && data.eeVus && typeof data.eeVus === 'object') eeVus = data.eeVus;
    if (typeof eeDemandes !== 'undefined' && data.eeDemandes && typeof data.eeDemandes === 'object') eeDemandes = data.eeDemandes;
    if (typeof transportMode !== 'undefined' && typeof data.transportMode === 'string') transportMode = data.transportMode;
    if (data.carDeparture) carDeparture = data.carDeparture;
    if (data.carToSchool) carToSchool = data.carToSchool;
    if (data.carFromSchool) carFromSchool = data.carFromSchool;
    if (data.motoDeparture) motoDeparture = data.motoDeparture;
    if (data.motoReturn) motoReturn = data.motoReturn;
    if (data.motoToSchool) motoToSchool = data.motoToSchool;
    if (data.motoFromSchool) motoFromSchool = data.motoFromSchool;
    if (Array.isArray(data.selectedActivities)) selectedActivities = data.selectedActivities;
    if (Array.isArray(data.holidayDays)) holidayDays = data.holidayDays.map(Number).filter(function (n) { return n >= 0 && n <= 6; });
    if (data.holidayModes && typeof data.holidayModes === 'object') holidayModes = data.holidayModes;
    if (data.holidayDropped && typeof data.holidayDropped === 'object') holidayDropped = data.holidayDropped;
    if (typeof data.sameFreeTime === 'boolean') sameFreeTime = data.sameFreeTime;
    if (data.freeTimeMinutes != null) freeTimeMinutes = Math.min(180, Math.max(0, Number(data.freeTimeMinutes) || 0));
    if (data.freeTimeByDay && typeof data.freeTimeByDay === 'object') {
        for (var jour = 0; jour < 7; jour++) {
            var brut = data.freeTimeByDay[jour] != null ? data.freeTimeByDay[jour] : data.freeTimeByDay[String(jour)];
            freeTimeByDay[jour] = Math.min(180, Math.max(0, Number(brut) || 0));
        }
    }
    if (typeof setSleepHours === 'function') {
        if (data.weekdaySleepHours != null) setSleepHours('weekday', data.weekdaySleepHours);
        if (data.saturdaySleepHours != null) setSleepHours('saturday', data.saturdaySleepHours);
        if (data.sundaySleepHours != null) setSleepHours('sunday', data.sundaySleepHours);
    }
    if (Array.isArray(data.phoneDays)) phoneDays = data.phoneDays;
    if (typeof data.samePhoneDuration === 'boolean') samePhoneDuration = data.samePhoneDuration;
    if (data.phoneDuration) phoneDuration = data.phoneDuration;
    if (data.phoneDayDurations && typeof data.phoneDayDurations === 'object') phoneDayDurations = data.phoneDayDurations;
    if (typeof data.selectedDay === 'number') selectedDay = data.selectedDay;
    if (typeof currentMood !== 'undefined' && data.currentMood) currentMood = data.currentMood;
    if (data.profilComplet) window.__profilComplet = true;

    if (depuisCompte && Array.isArray(data.customEvents)) customEvents = data.customEvents;
    else if (!depuisCompte) {
        var events = memoireJson('studyPlanIB_customEvents_juliss');
        if (Array.isArray(events)) customEvents = events;
        else if (Array.isArray(data.customEvents)) customEvents = data.customEvents;
    }

    if (depuisCompte && Array.isArray(data.exercices) && typeof exercices !== 'undefined') exercices = data.exercices;
    else if (!depuisCompte) {
        var exos = memoireJson('studyPlanIB_exercices');
        if (Array.isArray(exos) && typeof exercices !== 'undefined') exercices = exos;
        else if (Array.isArray(data.exercices) && typeof exercices !== 'undefined') exercices = data.exercices;
    }
    if (depuisCompte) memoireEcrireMiroir(customEvents, typeof exercices !== 'undefined' ? exercices : []);

    memoireSyncChamps();
}

function memoireEcrireMiroir(events, exos) {
    try {
        localStorage.setItem('studyPlanIB_customEvents_juliss', JSON.stringify(events || []));
        localStorage.setItem('studyPlanIB_exercices', JSON.stringify(exos || []));
    } catch (e) {}
}

function memoireReinitialiser() {
    userName = '';
    targetScore = 40;
    weekdayWakeup = '06:00';
    saturdayWakeup = '07:00';
    sundayWakeup = '08:00';
    if (typeof setSleepHours === 'function') {
        setSleepHours('weekday', 8);
        setSleepHours('saturday', 8);
        setSleepHours('sunday', 8);
    } else {
        weekdaySleepHours = 8;
        saturdaySleepHours = 8;
        sundaySleepHours = 8;
    }
    subjects = [];
    optionalSubjects = [];
    if (typeof ibYear !== 'undefined') ibYear = '';
    if (typeof memoirLevel !== 'undefined') memoirLevel = '';
    if (typeof iaLevel !== 'undefined') iaLevel = '';
    if (typeof iaLevels !== 'undefined') iaLevels = {};
    if (typeof memoirPlan !== 'undefined') memoirPlan = [];
    if (typeof iaPlans !== 'undefined') iaPlans = {};
    if (typeof eeVus !== 'undefined') eeVus = {};
    if (typeof eeDemandes !== 'undefined') eeDemandes = {};
    if (typeof transportMode !== 'undefined') transportMode = '';
    carDeparture = '07:30';
    carToSchool = 30;
    carFromSchool = 40;
    motoDeparture = '07:30';
    motoReturn = '17:00';
    motoToSchool = 25;
    motoFromSchool = 25;
    selectedActivities = [];
    holidayDays = [];
    holidayModes = {};
    holidayDropped = {};
    sameFreeTime = true;
    freeTimeMinutes = 60;
    freeTimeByDay = { 0: 60, 1: 60, 2: 60, 3: 60, 4: 60, 5: 60, 6: 60 };
    phoneDays = [0, 1, 2, 3, 4, 5, 6];
    samePhoneDuration = true;
    phoneDuration = 60;
    phoneDayDurations = { 0: 60, 1: 60, 2: 60, 3: 60, 4: 60, 5: 60, 6: 60 };
    selectedDay = 0;
    customEvents = [];
    if (typeof exercices !== 'undefined') exercices = [];
    if (typeof currentMood !== 'undefined') currentMood = null;
    window.__profilComplet = false;
    memoireEcrireMiroir([], []);
    memoireSyncChamps();
}

function memoireFermerVues() {
    document.querySelectorAll('.context-modal').forEach(function (el) { el.classList.remove('active'); });
    document.querySelectorAll('.app-panel').forEach(function (el) { el.classList.remove('active'); });
}

function memoireFermerCouches() {
    if (typeof closeSideMenu === 'function') {
        try { closeSideMenu(); } catch (e) {}
    }
    if (typeof fermerCompte === 'function') {
        try { fermerCompte(); } catch (e) {}
    }
    if (typeof closeAddModal === 'function') {
        try { closeAddModal(); } catch (e) {}
    }
    if (typeof closeEditModal === 'function') {
        try { closeEditModal(); } catch (e) {}
    }
    if (typeof v3ClosePomodoro === 'function') {
        try { v3ClosePomodoro(); } catch (e) {}
    }
}

function memoireAller(etape) {
    if (!etape || etape === 'accueil') {
        memoireFermerVues();
        return;
    }
    if (etape === 'travaux') etape = 'transport';
    if (etape === 'planning' || etape === 'soutien' || etape === 'exercices' || etape === 'legende' || etape === 'eeia' || etape === 'feries' || etape === 'aide' || etape === 'feedback' || etape === 'retours' || etape === 'questions' || etape === 'emplois') {
        if (typeof demanderClasseSiBesoin === 'function' && demanderClasseSiBesoin()) return;
        document.querySelectorAll('.context-modal').forEach(function (el) {
            if (el.id !== 'planningModal') el.classList.remove('active');
        });
        var planning = document.getElementById('planningModal');
        if (planning && !planning.classList.contains('active') && typeof generatePlanning === 'function') generatePlanning();
        else if (planning) planning.classList.add('active');
        if (etape === 'planning') {
            document.querySelectorAll('.app-panel').forEach(function (el) { el.classList.remove('active'); });
        } else if (typeof navigateTo === 'function') navigateTo(etape);
        return;
    }
    memoireFermerVues();
    var cibles = {
        prenom: 'contextModal',
        objectif: 'objectivesModal',
        sommeil: 'sleepModal',
        classe: 'classeModal',
        matieres: 'subjectsModal',
        travaux: 'travauxModal',
        transport: 'transportModal',
        voiture: 'carConfigModal',
        moto: 'motoConfigModal',
        activites: 'activitiesModal',
        feries: 'holidaysModal',
        libre: 'freeTimeModal',
        ecran: 'screenTimeModal'
    };
    if (etape === 'matieres' && typeof showClassePage === 'function' && typeof ibYear !== 'undefined' && ibYear !== 'DP1' && ibYear !== 'DP2') {
        classeRetour = '';
        showClassePage();
        return;
    }
    var el = document.getElementById(cibles[etape] || '');
    if (el) el.classList.add('active');
    try {
        if (etape === 'objectif') updateScoreUI();
        if (etape === 'sommeil') updateBedtimes();
        if (etape === 'classe' && typeof renderClasse === 'function') renderClasse();
        if (etape === 'matieres') updateSubjectsUI();
        if (etape === 'travaux' && typeof renderTravaux === 'function') renderTravaux();
        if (etape === 'voiture') updateCarPrepTime();
        if (etape === 'moto') updateMotoPrepTime();
        if (etape === 'activites') renderActivities();
        if (etape === 'feries' && typeof renderHolidays === 'function') renderHolidays();
        if (etape === 'libre' && typeof renderFreeTime === 'function') renderFreeTime();
        if (etape === 'ecran') renderScreenTime();
    } catch (e) {
        console.error(e);
    }
}

var memoireNavPret = false;
var memoireNavSilence = false;

function memoireEtapeConnue(etape) {
    var connues = {
        accueil: 1, prenom: 1, objectif: 1, sommeil: 1, classe: 1, matieres: 1,
        travaux: 1, transport: 1, voiture: 1, moto: 1, activites: 1, feries: 1,
        libre: 1, ecran: 1, planning: 1, soutien: 1, exercices: 1, legende: 1,
        eeia: 1, aide: 1, feedback: 1, retours: 1, questions: 1, emplois: 1
    };
    return !!connues[etape];
}

function memoirePoserHash(etape) {
    var id = memoireEtapeConnue(etape) ? etape : 'accueil';
    var next = '#' + id;
    var state = { app: 'studyplan', etape: id };
    var url = location.pathname + location.search + next;
    var courant = history.state && history.state.app === 'studyplan' ? history.state.etape : '';
    try {
        if (courant === id && (location.hash === next || location.hash === '#' + id)) return;
        if (!memoireNavPret || memoireNavSilence) {
            history.replaceState(state, '', url);
            return;
        }
        history.pushState(state, '', url);
    } catch (e) {}
}

function memoireDepuisHistorique(etape) {
    if (!memoireEtapeConnue(etape)) etape = memoireEtapeHash() || 'accueil';
    if (!memoireEtapeConnue(etape)) etape = 'accueil';
    memoireNavSilence = true;
    try {
        memoireFermerCouches();
        memoireAller(etape);
        if (memoireEtapeActive() !== etape && etape !== 'accueil') memoireAller(etape);
    } catch (e) {
        console.error(e);
    }
    try { memoireSauvegarder(); } catch (e) {}
    memoireNavSilence = false;
}

function memoireEtapeHash() {
    return decodeURIComponent((location.hash || '').replace(/^#/, '').split('?')[0] || '');
}

function memoirePagePrecedente(etape) {
    if (etape === 'activites') {
        if (typeof transportMode !== 'undefined' && transportMode === 'voiture') return 'voiture';
        if (typeof transportMode !== 'undefined' && transportMode === 'moto') return 'moto';
        return 'transport';
    }
    var prec = {
        prenom: 'accueil',
        classe: 'prenom',
        objectif: 'classe',
        matieres: 'objectif',
        sommeil: 'matieres',
        transport: 'sommeil',
        voiture: 'transport',
        moto: 'transport',
        ecran: 'activites',
        libre: 'ecran',
        planning: 'libre',
        soutien: 'planning',
        exercices: 'planning',
        legende: 'planning',
        eeia: 'planning',
        feries: 'planning',
        aide: 'planning',
        feedback: 'planning',
        retours: 'planning',
        questions: 'planning',
        emplois: 'planning'
    };
    return prec[etape] || '';
}

function memoireHistoriqueSemer(etape) {
    var chaine = [];
    var garde = {};
    var cur = memoireEtapeConnue(etape) ? etape : 'accueil';
    while (cur && !garde[cur]) {
        chaine.unshift(cur);
        garde[cur] = true;
        cur = memoirePagePrecedente(cur);
    }
    if (!chaine.length || chaine[0] !== 'accueil') chaine.unshift('accueil');
    var i;
    for (i = 0; i < chaine.length; i++) {
        var id = chaine[i];
        var url = location.pathname + location.search + '#' + id;
        var state = { app: 'studyplan', etape: id };
        if (i === 0) history.replaceState(state, '', url);
        else history.pushState(state, '', url);
    }
}

function memoireHistoriqueActiver() {
    memoireNavSilence = true;
    try { memoireHistoriqueSemer(memoireEtapeActive()); } catch (e) { memoirePoserHash(memoireEtapeActive()); }
    memoireNavPret = true;
    memoireNavSilence = false;
    if (window.__memoireHistorique) return;
    window.__memoireHistorique = true;
    window.addEventListener('popstate', function () {
        var etape = (history.state && history.state.etape) || memoireEtapeHash() || 'accueil';
        memoireDepuisHistorique(etape);
    });
    window.addEventListener('hashchange', function () {
        var etape = memoireEtapeHash();
        if (!etape || etape === memoireEtapeActive()) return;
        if (history.state && history.state.etape === etape) return;
        memoireDepuisHistorique(etape);
    });
    window.addEventListener('pageshow', function (ev) {
        if (!ev.persisted || !memoireNavPret) return;
        memoireDepuisHistorique((history.state && history.state.etape) || memoireEtapeHash() || memoireEtapeActive());
    });
    var racine = document.getElementById('app-pages') || document.body;
    if (racine && window.MutationObserver) {
        var attente = null;
        var obs = new MutationObserver(function () {
            if (attente) clearTimeout(attente);
            attente = setTimeout(function () {
                attente = null;
                if (!memoireNavPret || memoireNavSilence) return;
                memoirePoserHash(memoireEtapeActive());
            }, 30);
        });
        obs.observe(racine, { subtree: true, attributes: true, attributeFilter: ['class'] });
    }
}

function memoireMajIndicateur() {
    var btn = document.getElementById('btnCommencer');
    if (btn && window.__profilComplet) {
        btn.textContent = 'Reprendre';
        btn.onclick = function () { memoireAller('planning'); };
    }
}

function memoireSauvegarder() {
    if (!memoirePret) return;
    try {
        var data = memoireLireEtat();
        var json = JSON.stringify(data);
        if (json === memoireDernier) return;
        memoireDernier = json;
        localStorage.setItem(MEMOIRE_KEY, json);
        localStorage.setItem('studyPlanIB_customEvents_juliss', JSON.stringify(data.customEvents || []));
        localStorage.setItem('studyPlanIB_exercices', JSON.stringify(data.exercices || []));
        if (window.compteSession && window.compteSession.sub) {
            var cleLie = MEMOIRE_KEY + ':' + window.compteSession.sub;
            var ancienLie = memoireJson(cleLie);
            var garder = typeof compteDoitGarderLie === 'function' && compteDoitGarderLie(ancienLie, data);
            if (!garder && data.google && data.google.sub && data.google.sub !== window.compteSession.sub) garder = true;
            if (!garder) localStorage.setItem(cleLie, json);
            if (!garder && data.userName && typeof compteLierNom === 'function') {
                compteLierNom(window.compteSession.sub, data.userName, window.compteSession.email || '');
            }
            if (!garder && typeof compteNuagePlanifier === 'function') compteNuagePlanifier();
        }
        memoirePoserHash(data.etape);
        memoireMajIndicateur();
        if (typeof boiteApresMemoire === 'function') boiteApresMemoire();
    } catch (e) {
        console.error('Mémoire', e);
    }
}

function memoireCleDuCompte(cle, sub) {
    if (!cle) return false;
    return cle === MEMOIRE_KEY || cle === 'studyPlanIB_customEvents_juliss' || cle === 'studyPlanIB_exercices' || cle === 'studyPlanIB_sauvegarde:locale' || cle === 'studyPlanIB_proprietaire' || cle === 'studyPlanIB_googleSession' || cle.indexOf(sub) !== -1;
}

function memoireEffacerSuite() {
    memoirePret = false;
    window.__profilComplet = false;
    var sub = (window.compteSession && window.compteSession.sub) || (window.compteProprietaire && window.compteProprietaire.sub) || '';
    window.compteSession = null;
    window.compteProprietaire = null;
    if (window.google && google.accounts && google.accounts.id) {
        try { google.accounts.id.disableAutoSelect(); } catch (e) {}
    }
    var client = '';
    try { client = localStorage.getItem('studyPlanIB_googleClientId') || ''; } catch (e) {}
    var cles = [];
    var i;
    try {
        for (i = 0; i < localStorage.length; i++) cles.push(localStorage.key(i));
        cles.forEach(function (cle) {
            if (!cle || cle.indexOf('studyPlanIB_') !== 0 || cle === 'studyPlanIB_googleClientId' || cle === 'studyPlanIB_identites') return;
            if (sub) {
                if (memoireCleDuCompte(cle, sub)) localStorage.removeItem(cle);
                return;
            }
            if (cle.indexOf('studyPlanIB_profil:') === 0 || cle.indexOf('studyPlanIB_driveFileId:') === 0) return;
            if (cle.indexOf('studyPlanIB_sauvegarde:') === 0 && cle !== 'studyPlanIB_sauvegarde:locale') return;
            localStorage.removeItem(cle);
        });
        if (client) localStorage.setItem('studyPlanIB_googleClientId', client);
        if (sub && typeof compteOublierNom === 'function') compteOublierNom(sub);
    } catch (e) {}
    try { sessionStorage.clear(); } catch (e) {}
    var propre = location.pathname.replace(/index\.html$/, '');
    location.replace(propre + location.search);
}

function memoireEffacer() {
    if (!confirm('Effacer toute la progression enregistrée sur cet appareil ?')) return;
    if (typeof sauvegardeEffacerLocal === 'function') {
        try { sauvegardeEffacerLocal(); } catch (e) {}
    }
    if (typeof compteNuageEffacer !== 'function') {
        memoireEffacerSuite();
        return;
    }
    var fait = false;
    var fin = function () {
        if (fait) return;
        fait = true;
        memoireEffacerSuite();
    };
    setTimeout(fin, 15000);
    compteNuageEffacer().then(fin, fin);
}

function memoireBrancher(nom) {
    var fn = window[nom];
    if (typeof fn !== 'function' || fn.__memoire) return;
    var wrapped = function () {
        var resultat = fn.apply(this, arguments);
        memoireSauvegarder();
        return resultat;
    };
    wrapped.__memoire = true;
    window[nom] = wrapped;
}

function memoireDemarrer() {
    var data = memoireJson(MEMOIRE_KEY);
    var aRestaurer = !!(data && (data.userName || data.profilComplet || (data.etape && data.etape !== 'accueil')));
    if (aRestaurer) {
        memoireAppliquer(data);
        if (data.google && data.google.sub && !window.compteSession) window.compteSession = data.google;
    }
    memoirePret = true;
    if (aRestaurer) {
        var etape = data.etape || 'accueil';
        if (data.profilComplet && etape === 'accueil') etape = 'planning';
        try { memoireAller(etape); } catch (e) { console.error(e); }
    }
    [
        'handleContinue', 'validateObjective', 'validateSleep', 'setIbYear', 'validateClasse', 'validateSubjects',
        'selectTransport', 'saveCarConfig', 'saveMotoConfig', 'goToScreenTime',
        'generatePlanning', 'toggleActivity', 'addCustomActivity', 'removeActivity',
        'toggleActivityDay', 'updateActivityTime', 'updateActivityDayTime', 'toggleSameTime',
        'addOptionalSubject', 'removeOptionalSubject', 'updateSubjectLevel', 'updateSubjectGrade',
        'setMemoirLevel', 'setIaStage', 'eeChoisirDebut', 'eeChoisirPlan', 'eeChoisirFinal',
        'eeAjouterPartie', 'eeBasculerPartie', 'eeRetirerPartie', 'eeRepondreValidation',
        'adjustScore', 'handleScoreInput', 'navigateTo', 'selectDay',
        'confirmAddStudy', 'confirmAddActivity', 'saveEditedEvent', 'deleteEditedEvent',
        'saveEditedEventCascade', 'addExercice', 'deleteExo', 'scheduleExo', 'selectMood',
        'setPhoneDurationValue', 'togglePhoneDay', 'v3ResetDay', 'v3PomoSetPreset', 'v3Save',
        'adjustSleepHours', 'setBedtimeFromInput', 'toggleHolidayDay', 'setHolidayMode', 'toggleHolidayDrop', 'goToHolidays',
        'adjustFreeTime', 'setSameFreeTime', 'goToFreeTime'
    ].forEach(memoireBrancher);

    setInterval(memoireSauvegarder, 1500);
    window.addEventListener('beforeunload', memoireSauvegarder);
    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden') memoireSauvegarder();
    });
    if (aRestaurer || localStorage.getItem(MEMOIRE_KEY)) memoireMajIndicateur();
}

try {
    memoireDemarrer();
} catch (e) {
    console.error(e);
    memoirePret = true;
}
