/* ============================================================
   PAGE Habitudes
   Préparation du matin et du soir, petit-déjeuner et dîner.
   Le planning n'utilise ces faits qu'après validation.
   Vue : pages/onboarding-habitudes.html
   ============================================================ */

var habitudesDefinies = false;
var prepMatinMinutes = 30;
var prepSoirMinutes = 30;
var petitDejHeure = '';
var petitDejMinutes = 30;
var dinerHeure = '';
var dinerMinutes = 45;
var habitudesSuite = '';
var habitudesBrouillon = null;

function habitudesVersMinutes(valeur) {
    var parts = String(valeur || '').split(':');
    if (parts.length < 2) return NaN;
    var h = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10);
    if (!isFinite(h) || !isFinite(m) || h < 0 || h > 23 || m < 0 || m > 59) return NaN;
    return h * 60 + m;
}

function habitudesHorloge(mins) {
    var total = ((Math.round(Number(mins) || 0) % 1440) + 1440) % 1440;
    return String(Math.floor(total / 60)).padStart(2, '0') + ':' + String(total % 60).padStart(2, '0');
}

function habitudesHeureValide(valeur) {
    return isFinite(habitudesVersMinutes(valeur));
}

function habitudesDuree(valeur, defaut, min, max) {
    var n = Number(valeur);
    if (!isFinite(n)) n = defaut;
    n = Math.round(n);
    if (n < min) n = min;
    if (n > max) n = max;
    return n;
}

function habitudesTexteDuree(mins) {
    mins = Math.round(Number(mins) || 0);
    if (mins < 60) return mins + ' min';
    var h = Math.floor(mins / 60);
    var m = mins % 60;
    return m ? h + ' h ' + String(m).padStart(2, '0') : h + ' h';
}

function habitudesActives() {
    return habitudesDefinies === true;
}

function habitudesRepas(id) {
    if (!habitudesActives()) return { mode: 'defaut' };
    var heure = id === 'dinner' ? dinerHeure : petitDejHeure;
    var duree = id === 'dinner' ? dinerMinutes : petitDejMinutes;
    var defaut = id === 'dinner' ? 45 : 30;
    if (!habitudesHeureValide(heure)) return { mode: 'omis' };
    return { mode: 'fixe', heure: heure, duree: habitudesDuree(duree, defaut, 10, 120) };
}

function habitudesDureeMatin() {
    if (!habitudesActives()) return { mode: 'defaut', duree: 30 };
    return { mode: 'fixe', duree: habitudesDuree(prepMatinMinutes, 30, 5, 180) };
}

function habitudesDureeSoir() {
    if (!habitudesActives()) return { mode: 'defaut', duree: 0 };
    return { mode: 'fixe', duree: habitudesDuree(prepSoirMinutes, 30, 5, 180) };
}

function habitudesChevaucheCours(heure, duree) {
    if (!habitudesHeureValide(heure)) return false;
    var start = habitudesVersMinutes(heure);
    var end = start + habitudesDuree(duree, 30, 1, 240);
    return start < (16 * 60 + 35) && (8 * 60) < end;
}

function habitudesChevauche(aHeure, aDuree, bHeure, bDuree) {
    if (!habitudesHeureValide(aHeure) || !habitudesHeureValide(bHeure)) return false;
    var a0 = habitudesVersMinutes(aHeure);
    var b0 = habitudesVersMinutes(bHeure);
    var a1 = a0 + habitudesDuree(aDuree, 30, 1, 240);
    var b1 = b0 + habitudesDuree(bDuree, 30, 1, 240);
    return a0 < b1 && b0 < a1;
}

function habitudesSuiteEffective() {
    if (habitudesSuite === 'planning' || habitudesSuite === 'transport') return habitudesSuite;
    return window.__profilComplet ? 'planning' : 'transport';
}

function habitudesErreur(message) {
    var el = document.getElementById('habitsError');
    if (!el) return;
    el.style.display = message ? 'block' : 'none';
    el.textContent = message || '';
}

function habitudesBrouillonInitial() {
    var petitDejChoix = '';
    var dinerChoix = '';
    if (habitudesDefinies) {
        petitDejChoix = habitudesHeureValide(petitDejHeure) ? 'heure' : 'aucun';
        dinerChoix = habitudesHeureValide(dinerHeure) ? 'heure' : 'aucun';
    }
    return {
        prepMatin: habitudesDuree(prepMatinMinutes, 30, 5, 180),
        prepSoir: habitudesDuree(prepSoirMinutes, 30, 5, 180),
        petitDejChoix: petitDejChoix,
        petitDejHeure: habitudesHeureValide(petitDejHeure) ? petitDejHeure : '07:00',
        petitDejMinutes: habitudesDuree(petitDejMinutes, 30, 10, 120),
        dinerChoix: dinerChoix,
        dinerHeure: habitudesHeureValide(dinerHeure) ? dinerHeure : '19:00',
        dinerMinutes: habitudesDuree(dinerMinutes, 45, 10, 120)
    };
}

function peindreChoixRepas(cle, choix) {
    var heureBtn = document.getElementById(cle + 'BtnHeure');
    var aucunBtn = document.getElementById(cle + 'BtnAucun');
    var champs = document.getElementById(cle + 'Champs');
    var vide = document.getElementById(cle + 'Vide');
    var actif = choix === 'heure';
    var aucun = choix === 'aucun';
    if (heureBtn) {
        heureBtn.style.background = actif ? (cle === 'diner' ? '#ecfdf5' : '#faf5ff') : 'white';
        heureBtn.style.borderColor = actif ? (cle === 'diner' ? '#10b981' : '#a855f7') : (cle === 'diner' ? '#a7f3d0' : '#e9d5ff');
    }
    if (aucunBtn) {
        aucunBtn.style.background = aucun ? '#f3f4f6' : 'white';
        aucunBtn.style.borderColor = aucun ? '#6b7280' : '#e5e7eb';
        aucunBtn.style.color = aucun ? '#111827' : '#6b7280';
    }
    if (champs) champs.style.display = actif ? 'block' : 'none';
    if (vide) vide.style.display = aucun ? 'block' : 'none';
}

function renderHabitudes() {
    if (!habitudesBrouillon) habitudesBrouillon = habitudesBrouillonInitial();
    var b = habitudesBrouillon;
    var prepMatin = document.getElementById('prepMatinLabel');
    var prepSoir = document.getElementById('prepSoirLabel');
    if (prepMatin) prepMatin.textContent = habitudesTexteDuree(b.prepMatin);
    if (prepSoir) prepSoir.textContent = habitudesTexteDuree(b.prepSoir);
    var petitInput = document.getElementById('petitDejHeureInput');
    var dinerInput = document.getElementById('dinerHeureInput');
    if (petitInput && b.petitDejHeure) petitInput.value = b.petitDejHeure;
    if (dinerInput && b.dinerHeure) dinerInput.value = b.dinerHeure;
    var petitDuree = document.getElementById('petitDejDureeLabel');
    var dinerDuree = document.getElementById('dinerDureeLabel');
    if (petitDuree) petitDuree.textContent = habitudesTexteDuree(b.petitDejMinutes);
    if (dinerDuree) dinerDuree.textContent = habitudesTexteDuree(b.dinerMinutes);
    var petitFin = document.getElementById('petitDejFinLabel');
    var dinerFin = document.getElementById('dinerFinLabel');
    if (petitFin) petitFin.textContent = 'fin ' + habitudesHorloge(habitudesVersMinutes(b.petitDejHeure) + b.petitDejMinutes);
    if (dinerFin) dinerFin.textContent = 'fin ' + habitudesHorloge(habitudesVersMinutes(b.dinerHeure) + b.dinerMinutes);
    peindreChoixRepas('petitDej', b.petitDejChoix);
    peindreChoixRepas('diner', b.dinerChoix);
}

function showHabitsPage(suite) {
    habitudesSuite = suite === 'planning' ? 'planning' : (suite === 'transport' ? 'transport' : habitudesSuiteEffective());
    habitudesBrouillon = habitudesBrouillonInitial();
    document.querySelectorAll('.context-modal').forEach(function (el) {
        if (el.id !== 'habitsModal') el.classList.remove('active');
    });
    document.querySelectorAll('.app-panel').forEach(function (el) { el.classList.remove('active'); });
    var modal = document.getElementById('habitsModal');
    if (modal) modal.classList.add('active');
    habitudesErreur('');
    renderHabitudes();
}

function hideHabitsPage() {
    var modal = document.getElementById('habitsModal');
    if (modal) modal.classList.remove('active');
    habitudesBrouillon = null;
    if (habitudesSuiteEffective() === 'planning') {
        var planning = document.getElementById('planningModal');
        if (planning) planning.classList.add('active');
        return;
    }
    var sleep = document.getElementById('sleepModal');
    if (sleep) sleep.classList.add('active');
    if (typeof updateBedtimes === 'function') updateBedtimes();
}

function ajusterHabitude(cle, delta) {
    if (!habitudesBrouillon) habitudesBrouillon = habitudesBrouillonInitial();
    if (cle === 'prepMatin') habitudesBrouillon.prepMatin = habitudesDuree(habitudesBrouillon.prepMatin + delta, 30, 5, 180);
    else if (cle === 'prepSoir') habitudesBrouillon.prepSoir = habitudesDuree(habitudesBrouillon.prepSoir + delta, 30, 5, 180);
    else if (cle === 'petitDej') habitudesBrouillon.petitDejMinutes = habitudesDuree(habitudesBrouillon.petitDejMinutes + delta, 30, 10, 120);
    else if (cle === 'diner') habitudesBrouillon.dinerMinutes = habitudesDuree(habitudesBrouillon.dinerMinutes + delta, 45, 10, 120);
    habitudesErreur('');
    renderHabitudes();
}

function choisirRepas(cle, choix) {
    if (!habitudesBrouillon) habitudesBrouillon = habitudesBrouillonInitial();
    if (cle === 'petitDej') habitudesBrouillon.petitDejChoix = choix;
    else habitudesBrouillon.dinerChoix = choix;
    habitudesErreur('');
    renderHabitudes();
}

function majHeureRepas(cle, valeur) {
    if (!habitudesBrouillon) habitudesBrouillon = habitudesBrouillonInitial();
    if (!habitudesHeureValide(valeur)) return;
    if (cle === 'petitDej') {
        habitudesBrouillon.petitDejHeure = valeur;
        habitudesBrouillon.petitDejChoix = 'heure';
    } else {
        habitudesBrouillon.dinerHeure = valeur;
        habitudesBrouillon.dinerChoix = 'heure';
    }
    habitudesErreur('');
    renderHabitudes();
}

function habitudesMessageFormulaire(b) {
    if (!b || (b.petitDejChoix !== 'heure' && b.petitDejChoix !== 'aucun')) {
        return 'Indique l\'heure du petit-déjeuner, ou choisis Aucun.';
    }
    if (b.dinerChoix !== 'heure' && b.dinerChoix !== 'aucun') {
        return 'Indique l\'heure du dîner, ou choisis Aucun.';
    }
    if (b.petitDejChoix === 'heure' && !habitudesHeureValide(b.petitDejHeure)) {
        return 'L\'heure du petit-déjeuner n\'est pas valide.';
    }
    if (b.dinerChoix === 'heure' && !habitudesHeureValide(b.dinerHeure)) {
        return 'L\'heure du dîner n\'est pas valide.';
    }
    if (b.petitDejChoix === 'heure' && habitudesVersMinutes(b.petitDejHeure) + b.petitDejMinutes > 1440) {
        return 'Le petit-déjeuner dépasse minuit. Avance l\'heure ou raccourcis la durée.';
    }
    if (b.dinerChoix === 'heure' && habitudesVersMinutes(b.dinerHeure) + b.dinerMinutes > 1440) {
        return 'Le dîner dépasse minuit. Avance l\'heure ou raccourcis la durée.';
    }
    if (b.petitDejChoix === 'heure' && habitudesChevaucheCours(b.petitDejHeure, b.petitDejMinutes)) {
        return 'Le petit-déjeuner tombe pendant les cours (8 h 00 – 16 h 35). Choisis une autre heure, ou Aucun.';
    }
    if (b.dinerChoix === 'heure' && habitudesChevaucheCours(b.dinerHeure, b.dinerMinutes)) {
        return 'Le dîner tombe pendant les cours (8 h 00 – 16 h 35). Choisis une autre heure, ou Aucun.';
    }
    if (b.petitDejChoix === 'heure' && b.dinerChoix === 'heure' && habitudesChevauche(b.petitDejHeure, b.petitDejMinutes, b.dinerHeure, b.dinerMinutes)) {
        return 'Le petit-déjeuner et le dîner se chevauchent. Écarte leurs horaires.';
    }
    return '';
}

function habitudesOublierCorrections() {
    if (typeof customEvents === 'undefined' || !Array.isArray(customEvents)) return;
    var ids = { breakfast: 1, dinner: 1, prep: 1, prepSoir: 1 };
    customEvents = customEvents.filter(function (e) {
        return !(e && ids[e.replacesId]);
    });
    if (typeof v3Save === 'function') {
        try { v3Save(); } catch (e) {}
        return;
    }
    try { localStorage.setItem('studyPlanIB_customEvents_juliss', JSON.stringify(customEvents)); } catch (err) {}
}

function appliquerHabitudes(data) {
    if (!data || typeof data !== 'object') return;
    if (typeof data.habitudesDefinies === 'boolean') habitudesDefinies = data.habitudesDefinies;
    if (data.prepMatinMinutes != null) prepMatinMinutes = habitudesDuree(data.prepMatinMinutes, 30, 5, 180);
    if (data.prepSoirMinutes != null) prepSoirMinutes = habitudesDuree(data.prepSoirMinutes, 30, 5, 180);
    if (typeof data.petitDejHeure === 'string') petitDejHeure = habitudesHeureValide(data.petitDejHeure) ? data.petitDejHeure : '';
    if (data.petitDejMinutes != null) petitDejMinutes = habitudesDuree(data.petitDejMinutes, 30, 10, 120);
    if (typeof data.dinerHeure === 'string') dinerHeure = habitudesHeureValide(data.dinerHeure) ? data.dinerHeure : '';
    if (data.dinerMinutes != null) dinerMinutes = habitudesDuree(data.dinerMinutes, 45, 10, 120);
    habitudesBrouillon = null;
}

function validateHabits() {
    if (!habitudesBrouillon) habitudesBrouillon = habitudesBrouillonInitial();
    var petitInput = document.getElementById('petitDejHeureInput');
    var dinerInput = document.getElementById('dinerHeureInput');
    if (petitInput && habitudesHeureValide(petitInput.value)) habitudesBrouillon.petitDejHeure = petitInput.value;
    if (dinerInput && habitudesHeureValide(dinerInput.value)) habitudesBrouillon.dinerHeure = dinerInput.value;
    var message = habitudesMessageFormulaire(habitudesBrouillon);
    if (message) {
        habitudesErreur(message);
        return;
    }
    var b = habitudesBrouillon;
    prepMatinMinutes = b.prepMatin;
    prepSoirMinutes = b.prepSoir;
    petitDejHeure = b.petitDejChoix === 'heure' ? b.petitDejHeure : '';
    petitDejMinutes = b.petitDejMinutes;
    dinerHeure = b.dinerChoix === 'heure' ? b.dinerHeure : '';
    dinerMinutes = b.dinerMinutes;
    habitudesDefinies = true;
    habitudesBrouillon = null;
    habitudesOublierCorrections();
    if (typeof memoireSauvegarder === 'function') {
        try { memoireSauvegarder(); } catch (e) {}
    }
    var suite = habitudesSuiteEffective();
    var modal = document.getElementById('habitsModal');
    if (modal) modal.classList.remove('active');
    if (suite === 'planning') {
        if (typeof generatePlanning === 'function') generatePlanning();
        else {
            var planning = document.getElementById('planningModal');
            if (planning) planning.classList.add('active');
            if (typeof planningActualiser === 'function') planningActualiser();
        }
        return;
    }
    if (typeof showTransportPage === 'function') showTransportPage();
}
