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

function memoireEtapeActive() {
    var panneaux = [
        ['panelSoutien', 'soutien'],
        ['panelExercices', 'exercices'],
        ['panelLegende', 'legende'],
        ['panelEEia', 'eeia'],
        ['panelFeries', 'feries']
    ];
    var modales = [
        ['contextModal', 'prenom'],
        ['objectivesModal', 'objectif'],
        ['sleepModal', 'sommeil'],
        ['classeModal', 'classe'],
        ['subjectsModal', 'matieres'],
        ['travauxModal', 'travaux'],
        ['transportModal', 'transport'],
        ['carConfigModal', 'voiture'],
        ['motoConfigModal', 'moto'],
        ['activitiesModal', 'activites'],
        ['holidaysModal', 'feries'],
        ['freeTimeModal', 'libre'],
        ['screenTimeModal', 'ecran'],
        ['planningModal', 'planning']
    ];
    var i, el;
    for (i = 0; i < panneaux.length; i++) {
        el = document.getElementById(panneaux[i][0]);
        if (el && el.classList.contains('active')) return panneaux[i][1];
    }
    for (i = 0; i < modales.length; i++) {
        el = document.getElementById(modales[i][0]);
        if (el && el.classList.contains('active')) return modales[i][1];
    }
    return 'accueil';
}

function memoireLireEtat() {
    if (typeof eeNettoyerSuivi === 'function') eeNettoyerSuivi();
    var champNom = document.getElementById('nameInput');
    if (champNom && champNom.value.trim()) userName = champNom.value.trim();

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
        google: window.compteSession || null
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
    else {
        var events = memoireJson('studyPlanIB_customEvents_juliss');
        if (Array.isArray(events)) customEvents = events;
        else if (Array.isArray(data.customEvents)) customEvents = data.customEvents;
    }

    if (depuisCompte && Array.isArray(data.exercices) && typeof exercices !== 'undefined') exercices = data.exercices;
    else {
        var exos = memoireJson('studyPlanIB_exercices');
        if (Array.isArray(exos) && typeof exercices !== 'undefined') exercices = exos;
        else if (Array.isArray(data.exercices) && typeof exercices !== 'undefined') exercices = data.exercices;
    }

    memoireSyncChamps();
}

function memoireFermerVues() {
    document.querySelectorAll('.context-modal').forEach(function (el) { el.classList.remove('active'); });
    document.querySelectorAll('.app-panel').forEach(function (el) { el.classList.remove('active'); });
}

function memoireAller(etape) {
    if (!etape || etape === 'accueil') {
        memoireFermerVues();
        return;
    }
    if (etape === 'travaux') etape = 'transport';
    if (etape === 'planning' || etape === 'soutien' || etape === 'exercices' || etape === 'legende' || etape === 'eeia' || etape === 'feries') {
        if (typeof demanderClasseSiBesoin === 'function' && demanderClasseSiBesoin()) return;
        var planning = document.getElementById('planningModal');
        if (planning && !planning.classList.contains('active')) generatePlanning();
        if (etape === 'soutien') navigateTo('soutien');
        else if (etape === 'exercices') navigateTo('exercices');
        else if (etape === 'legende') navigateTo('legende');
        else if (etape === 'eeia') navigateTo('eeia');
        else if (etape === 'feries') navigateTo('feries');
        else navigateTo('planning');
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

function memoirePoserHash(etape) {
    var next = '#' + (etape || 'accueil');
    if (location.hash === next) return;
    try { history.replaceState(null, '', next); } catch (e) {}
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
            if (!garder) localStorage.setItem(cleLie, json);
            if (!garder && typeof compteNuagePlanifier === 'function') compteNuagePlanifier();
        }
        memoirePoserHash(data.etape);
        memoireMajIndicateur();
    } catch (e) {
        console.error('Mémoire', e);
    }
}

function memoireEffacerSuite() {
    memoirePret = false;
    window.__profilComplet = false;
    window.compteSession = null;
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
            if (cle && cle.indexOf('studyPlanIB_') === 0) localStorage.removeItem(cle);
        });
        if (client) localStorage.setItem('studyPlanIB_googleClientId', client);
    } catch (e) {}
    try { sessionStorage.clear(); } catch (e) {}
    var propre = location.pathname.replace(/index\.html$/, '');
    location.replace(propre + location.search);
}

function memoireEffacer() {
    if (!confirm('Effacer toute la progression enregistrée sur cet appareil ?')) return;
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
