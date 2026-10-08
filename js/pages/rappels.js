/* Rappels entre camarades de la même matière.
   Anglais B est divisé : SL et HL ne se notifient pas. */

var RAPPEL_VUS = 'studyPlanIB_rappelsVus';
var RAPPEL_CACHE = 'studyPlanIB_rappels';
var RAPPEL_GROUPE = 'studyPlanIB_groupe';
var RAPPEL_JOURNEE = 'studyPlanIB_journee';
var rappelListe = [];
var rappelGroupes = [];
var rappelFlux = {};

function rappelSansAccent(nom) {
    return String(nom || '').toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/\b(hl|sl)\b/g, ' ')
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function rappelAnglaisB(nom) {
    var cle = rappelSansAccent(nom);
    return cle === 'anglais b' || cle === 'english b';
}

function rappelNiveau(nom, niveau) {
    var brut = String(niveau || '') + ' ' + String(nom || '');
    var trouve = brut.match(/\b(HL|SL)\b/i);
    return trouve ? trouve[1].toUpperCase() : '';
}

function rappelCle(nom, niveau) {
    var cle = rappelSansAccent(nom);
    if (!cle) return '';
    if (rappelAnglaisB(nom)) {
        var niv = rappelNiveau(nom, niveau);
        return niv ? cle + ' ' + niv.toLowerCase() : '';
    }
    return cle;
}

function rappelNom(nom) {
    return String(nom || '').replace(/\s+(HL|SL)\s*$/i, '').trim();
}

function rappelNomAffiche(nom, niveau) {
    var base = rappelNom(nom);
    if (rappelAnglaisB(nom)) {
        var niv = rappelNiveau(nom, niveau);
        return niv ? base + ' ' + niv : base;
    }
    return base;
}

function rappelLireJson(cle) {
    try { return JSON.parse(localStorage.getItem(cle) || 'null'); } catch (e) { return null; }
}

function rappelMesMatieres() {
    var map = {};
    var liste = [];
    if (typeof subjects !== 'undefined' && Array.isArray(subjects)) liste = liste.concat(subjects);
    if (typeof optionalSubjects !== 'undefined' && Array.isArray(optionalSubjects)) liste = liste.concat(optionalSubjects);
    liste.forEach(function (s) {
        if (!s || !s.name) return;
        var cle = rappelCle(s.name, s.level);
        if (cle) map[cle] = rappelNomAffiche(s.name, s.level);
    });
    return map;
}

function rappelTrouverMatiere(nom, niveau) {
    var cle = rappelCle(nom, niveau);
    var liste = [];
    if (typeof subjects !== 'undefined' && Array.isArray(subjects)) liste = liste.concat(subjects);
    if (typeof optionalSubjects !== 'undefined' && Array.isArray(optionalSubjects)) liste = liste.concat(optionalSubjects);
    var i;
    for (i = 0; i < liste.length; i++) {
        if (liste[i] && rappelCle(liste[i].name, liste[i].level) === cle) return liste[i];
    }
    return { name: rappelNom(nom) || 'Matière', level: rappelNiveau(nom, niveau), icon: '📝' };
}

function rappelJaiExercice(matiere, niveau) {
    var cle = rappelCle(matiere, niveau);
    if (!cle) return false;
    var liste = (typeof exercices !== 'undefined' && Array.isArray(exercices)) ? exercices : [];
    var i;
    for (i = 0; i < liste.length; i++) {
        var exo = liste[i];
        if (!exo || rappelCle(exo.subject, exo.level) !== cle || !exo.scheduledSlot) continue;
        return true;
    }
    var evs = (typeof customEvents !== 'undefined' && Array.isArray(customEvents)) ? customEvents : [];
    for (i = 0; i < evs.length; i++) {
        var ev = evs[i];
        if (!ev) continue;
        var titre = String(ev.title || '');
        if (ev.source !== 'exercice' && !/^Exercices\s+/i.test(titre)) continue;
        var sujet = titre.replace(/^Exercices\s+/i, '').replace(/\s*\(Partie[^)]*\)\s*$/i, '');
        if (rappelCle(sujet, ev.level || niveau) === cle) return true;
    }
    return false;
}

function rappelVus() {
    var vus = rappelLireJson(RAPPEL_VUS);
    return Array.isArray(vus) ? vus : [];
}

function rappelMemeClasse(item) {
    var moi = typeof ibYear !== 'undefined' ? String(ibYear || '').trim().toLowerCase() : '';
    var eux = item && item.classe ? String(item.classe).trim().toLowerCase() : '';
    if (!moi || !eux) return true;
    return moi === eux;
}

function rappelEnAttente() {
    var moi = typeof boiteAppareil === 'function' ? boiteAppareil() : '';
    var cles = rappelMesMatieres();
    var vus = rappelVus();
    var out = [];
    var deja = {};
    rappelListe.forEach(function (item) {
        if (!item || (item.type && item.type !== 'rappel') || !item.id) return;
        var cle = rappelCle(item.matiere, item.niveau);
        if (!cle || !cles[cle]) return;
        if (!rappelMemeClasse(item)) return;
        if (moi && item.appareil === moi) return;
        if (vus.indexOf(item.id) !== -1) return;
        if (rappelJaiExercice(item.matiere, item.niveau)) return;
        if (deja[item.id]) return;
        deja[item.id] = true;
        out.push(item);
    });
    return out;
}

function rappelCompte() {
    return rappelEnAttente().length;
}

function rappelJourneeLire() {
    var data = rappelLireJson(RAPPEL_JOURNEE);
    return data && typeof data === 'object' ? data : {};
}

function rappelJourneeDue() {
    if (!window.__profilComplet) return false;
    var data = rappelJourneeLire();
    var ref = data.answeredAt || data.askedAt || '';
    if (!ref) return true;
    var age = Date.now() - new Date(ref).getTime();
    if (!isFinite(age)) return true;
    return age >= (data.answeredAt ? 5 : 3) * 3600000;
}

function rappelPeutOuvrir() {
    return rappelCompte() > 0 || rappelJourneeDue();
}

function rappelIngerer(items) {
    if (!Array.isArray(items)) return;
    var map = {};
    rappelListe.forEach(function (item) {
        if (item && item.id) map[item.id] = item;
    });
    items.forEach(function (item) {
        if (!item || item.type !== 'rappel' || !item.id || !rappelCle(item.matiere, item.niveau)) return;
        var deja = map[item.id];
        if (!deja || String(item.at || '') >= String(deja.at || '')) map[item.id] = item;
    });
    rappelListe = Object.keys(map).map(function (k) { return map[k]; }).slice(-400);
    try { localStorage.setItem(RAPPEL_CACHE, JSON.stringify(rappelListe)); } catch (e) {}
}

function rappelBadge(n) {
    ['btnAssistant', 'menuAssistant'].forEach(function (id) {
        var el = document.getElementById(id);
        if (!el) return;
        el.style.position = 'relative';
        var badge = el.querySelector('.ia-rappel-num');
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'ia-rappel-num';
            badge.setAttribute('aria-hidden', 'true');
            badge.style.cssText = 'position:absolute;top:-0.35rem;right:-0.35rem;min-width:1.15rem;height:1.15rem;padding:0 0.28rem;border-radius:999px;background:#dc2626;color:#fff;font-size:0.68rem;font-weight:800;line-height:1.15rem;text-align:center;box-shadow:0 0 0 2px #fff;';
            el.appendChild(badge);
        }
        badge.textContent = n > 0 ? String(n) : '';
        badge.style.display = n > 0 ? 'inline-block' : 'none';
    });
}

function rappelBouton(texte, fn) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = texte;
    btn.style.cssText = 'border:none;border-radius:999px;padding:0.4rem 0.7rem;font:inherit;font-size:0.75rem;font-weight:700;cursor:pointer;background:#ecfdf5;color:#047857;';
    btn.onclick = fn;
    return btn;
}

function rappelActions(parent) {
    var actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:0.4rem;margin-top:0.65rem;flex-wrap:wrap;align-items:center;';
    parent.appendChild(actions);
    return actions;
}

function rappelTexte(item) {
    var matiere = rappelNomAffiche(item.matiere, item.niveau) || 'ta classe';
    return 'Un autre élève de ta classe a prévu une plage horaire pour un exercice de ' + matiere + '. C\'est la même chose pour toi. Est-ce que tu as le même exercice ?';
}

function rappelIgnorer(id) {
    var vus = rappelVus();
    if (vus.indexOf(id) === -1) vus.push(id);
    try { localStorage.setItem(RAPPEL_VUS, JSON.stringify(vus.slice(-500))); } catch (e) {}
    var noeud = document.getElementById('rappel-' + id);
    if (noeud) noeud.remove();
    delete rappelFlux[id];
    if (typeof iaAfficherEntree === 'function') iaAfficherEntree();
}

function rappelDemanderDeadline(item) {
    if (typeof iaBulle !== 'function') return;
    var matiere = rappelNomAffiche(item.matiere, item.niveau) || 'cette matière';
    var bulle = iaBulle('assistant', 'D\'accord. Pour quelle date dois-tu rendre cet exercice de ' + matiere + ' ?');
    if (!bulle) return;
    var actions = rappelActions(bulle);
    var date = document.createElement('input');
    date.type = 'date';
    date.min = new Date().toISOString().slice(0, 10);
    date.style.cssText = 'border:1px solid #a7f3d0;border-radius:0.6rem;padding:0.35rem 0.5rem;font:inherit;font-size:0.78rem;';
    var ok = rappelBouton('Voir les créneaux', function () {
        if (!date.value) return;
        rappelFlux[item.id] = { deadline: date.value, duration: (rappelFlux[item.id] && rappelFlux[item.id].duration) || 60 };
        rappelProposer(item);
    });
    actions.appendChild(date);
    actions.appendChild(ok);
    var fil = document.getElementById('iaFil');
    if (fil) fil.scrollTop = fil.scrollHeight;
}

function rappelLibelleDuree(minutes) {
    if (minutes >= 60 && minutes % 60 === 0) return (minutes / 60) + ' h';
    if (minutes > 60) return Math.floor(minutes / 60) + ' h ' + (minutes % 60);
    return minutes + ' min';
}

function rappelProposer(item) {
    if (typeof iaBulle !== 'function' || typeof findAvailableSlots !== 'function') return;
    var flux = rappelFlux[item.id] || { deadline: '', duration: 60 };
    if (!flux.deadline) return rappelDemanderDeadline(item);
    var ancien = document.getElementById('rappel-slots-' + item.id);
    if (ancien) ancien.remove();
    var sujet = rappelTrouverMatiere(item.matiere, item.niveau);
    var brouillon = { subject: sujet.name, level: sujet.level || '', duration: flux.duration || 60, deadline: flux.deadline };
    var slots = [];
    try { slots = findAvailableSlots(brouillon) || []; } catch (e) { slots = []; }
    slots = slots.slice(0, 4);
    var intro = slots.length
        ? 'Je peux le placer sans superposer un autre créneau. Je pars sur ' + rappelLibelleDuree(brouillon.duration) + '. Choisis une solution, ou change la durée.'
        : 'Je ne trouve pas de créneau libre avant cette date. Donne-moi une autre deadline.';
    var bulle = iaBulle('assistant', intro);
    if (!bulle) return;
    if (bulle.parentNode) bulle.parentNode.id = 'rappel-slots-' + item.id;
    var actions = rappelActions(bulle);
    [30, 45, 60, 90].forEach(function (minutes) {
        actions.appendChild(rappelBouton(rappelLibelleDuree(minutes), function () {
            rappelFlux[item.id].duration = minutes;
            rappelProposer(item);
        }));
    });
    if (!slots.length) {
        actions.appendChild(rappelBouton('Autre date', function () { rappelDemanderDeadline(item); }));
    }
    slots.forEach(function (slot, index) {
        actions.appendChild(rappelBouton(slot.label || (slot.startTime + '–' + slot.endTime), function () {
            rappelPlacer(item, slot, index);
        }));
    });
    var fil = document.getElementById('iaFil');
    if (fil) fil.scrollTop = fil.scrollHeight;
}

function rappelPlacer(item, slot) {
    if (!slot || typeof applyExerciseSlot !== 'function') return;
    var flux = rappelFlux[item.id] || { deadline: '', duration: 60 };
    var sujet = rappelTrouverMatiere(item.matiere, item.niveau);
    var exo = null;
    var liste = (typeof exercices !== 'undefined' && Array.isArray(exercices)) ? exercices : null;
    if (!liste) return;
    var i;
    for (i = 0; i < liste.length; i++) {
        if (liste[i] && !liste[i].done && !liste[i].scheduledSlot && rappelCle(liste[i].subject, liste[i].level) === rappelCle(item.matiere, item.niveau)) {
            exo = liste[i];
            break;
        }
    }
    if (!exo) {
        exo = {
            id: 'exo-' + Date.now(),
            subject: sujet.name,
            subjectIcon: sujet.icon || '📝',
            subjectGrade: sujet.grade,
            level: sujet.level || rappelNiveau(item.matiere, item.niveau),
            text: 'Exercice de ' + rappelNomAffiche(sujet.name, sujet.level),
            duration: flux.duration || 60,
            deadline: flux.deadline,
            done: false,
            addedAt: new Date().toISOString(),
            scheduledSlot: null
        };
        liste.push(exo);
    } else {
        exo.duration = flux.duration || exo.duration || 60;
        exo.deadline = flux.deadline || exo.deadline;
        exo.level = exo.level || sujet.level || '';
    }
    try {
        applyExerciseSlot(exo, slot, 'Exercices ' + exo.subject + (slot.isSplit ? ' (Partie 1)' : ''));
    } catch (e) {
        if (typeof iaBulle === 'function') iaBulle('assistant', 'Je n\'ai pas pu le placer sur ce créneau. Choisis-en un autre.');
        return;
    }
    exo.scheduledSlot = (slot.dateStr || '') + ' · ' + slot.startTime + '–' + slot.endTime;
    if (typeof refreshPlanningAfterExercise === 'function') refreshPlanningAfterExercise(slot.planDay);
    else {
        try { localStorage.setItem('studyPlanIB_exercices', JSON.stringify(liste)); } catch (e2) {}
    }
    if (typeof rappelPublierExercice === 'function') rappelPublierExercice(exo, slot);
    var badge = document.getElementById('exoCountBadge');
    if (badge) badge.textContent = liste.length + ' exercice' + (liste.length > 1 ? 's' : '');
    rappelIgnorer(item.id);
    if (typeof iaBulle === 'function') {
        iaBulle('assistant', 'C\'est dans ton planning' + (slot.dateStr ? ', le ' + slot.dateStr : '') + ' de ' + slot.startTime + ' à ' + slot.endTime + '. La deadline est le ' + flux.deadline + '.');
    }
}

function rappelCommencer(item) {
    var flux = rappelFlux[item.id];
    if (flux && flux.deadline) rappelProposer(item);
    else rappelDemanderDeadline(item);
}

function rappelPoser() {
    var fil = document.getElementById('iaFil');
    if (!fil || typeof iaBulle !== 'function') return;
    rappelEnAttente().forEach(function (item) {
        if (document.getElementById('rappel-' + item.id)) return;
        var bulle = iaBulle('assistant', rappelTexte(item));
        if (!bulle) return;
        if (bulle.parentNode) bulle.parentNode.id = 'rappel-' + item.id;
        var actions = rappelActions(bulle);
        actions.appendChild(rappelBouton('Oui', function () { rappelCommencer(item); }));
        actions.appendChild(rappelBouton('Non', function () { rappelIgnorer(item.id); }));
    });
    rappelPoserJournee();
    fil.scrollTop = fil.scrollHeight;
}

function rappelReponseJournee(mood) {
    if (mood === 'motive') return 'Cette énergie est bonne. Garde-la pour une matière qui compte, et arrête-toi avant d\'être vidé(e).';
    if (mood === 'bien') return 'Content de l\'entendre. Si une matière te bloque, on peut la placer dans un trou du planning.';
    if (mood === 'fatigue') return 'Repose-toi un peu. Une journée fatiguée avance mieux avec une seule chose claire, pas avec tout le programme.';
    if (mood === 'stresse') return 'C\'est lourd, et tu n\'as pas à tout régler ce soir. On prend une chose, puis tu souffles.';
    return 'Quand la journée est difficile, on réduit. Dis-moi la matière qui pèse, et on trouve un petit créneau, pas une montagne.';
}

function rappelNoterJournee(mood) {
    if (typeof currentMood !== 'undefined') currentMood = mood;
    var data = rappelJourneeLire();
    data.answeredAt = new Date().toISOString();
    data.mood = mood;
    data.historique = Array.isArray(data.historique) ? data.historique.slice(-40) : [];
    data.historique.push({ at: data.answeredAt, mood: mood });
    try { localStorage.setItem(RAPPEL_JOURNEE, JSON.stringify(data)); } catch (e) {}
    if (typeof memoireSauvegarder === 'function') memoireSauvegarder();
    var noeud = document.getElementById('rappel-journee');
    if (noeud) noeud.remove();
    if (typeof iaBulle === 'function') iaBulle('assistant', rappelReponseJournee(mood));
    if (typeof iaAfficherEntree === 'function') iaAfficherEntree();
}

function rappelPoserJournee() {
    if (!rappelJourneeDue() || typeof iaBulle !== 'function') return;
    if (document.getElementById('rappel-journee')) return;
    var bulle = iaBulle('assistant', 'Comment s\'est passée ta journée ?');
    if (!bulle || !bulle.parentNode) return;
    bulle.parentNode.id = 'rappel-journee';
    var data = rappelJourneeLire();
    data.askedAt = new Date().toISOString();
    try { localStorage.setItem(RAPPEL_JOURNEE, JSON.stringify(data)); } catch (e) {}
    var actions = rappelActions(bulle);
    [
        ['Bien', 'bien'],
        ['Motivé(e)', 'motive'],
        ['Fatigué(e)', 'fatigue'],
        ['Stressé(e)', 'stresse'],
        ['Difficile', 'perdu']
    ].forEach(function (choix) {
        actions.appendChild(rappelBouton(choix[0], function () { rappelNoterJournee(choix[1]); }));
    });
}

function rappelPublierExercice(exo, slot) {
    if (!exo || !slot || !rappelCle(exo.subject, exo.level)) return;
    if (typeof boiteAppareil !== 'function' || typeof boiteEnvoyerDistant !== 'function') return;
    var ident = 'r_' + boiteAppareil() + '_' + String(exo.id || exo.subject || 'x').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);
    var record = {
        type: 'rappel',
        id: ident,
        appareil: boiteAppareil(),
        at: new Date().toISOString(),
        nom: typeof boiteNom === 'function' ? boiteNom() : '',
        classe: typeof ibYear !== 'undefined' ? (ibYear || '') : '',
        matiere: exo.subject || '',
        niveau: exo.level || rappelNiveau(exo.subject, ''),
        jour: slot.planDay,
        debut: slot.startTime || '',
        fin: slot.endTime || '',
        exo: exo.id || ''
    };
    rappelIngerer([record]);
    boiteEnvoyerDistant(record).catch(function () {});
    if (typeof iaAfficherEntree === 'function') iaAfficherEntree();
}

function rappelPublierCohorte() {
    if (!window.__profilComplet || typeof boiteAppareil !== 'function' || typeof boiteEnvoyerDistant !== 'function') return;
    var matieres = [];
    var liste = [];
    if (typeof subjects !== 'undefined' && Array.isArray(subjects)) liste = liste.concat(subjects);
    if (typeof optionalSubjects !== 'undefined' && Array.isArray(optionalSubjects)) liste = liste.concat(optionalSubjects);
    liste.forEach(function (s) {
        if (!s || !s.name || !rappelCle(s.name, s.level) || matieres.length >= 12) return;
        matieres.push(rappelNomAffiche(s.name, s.level));
    });
    if (!matieres.length) return;
    var empreinte = matieres.join('|');
    if (localStorage.getItem(RAPPEL_GROUPE) === empreinte) return;
    var record = {
        type: 'groupe',
        id: 'g_' + boiteAppareil(),
        appareil: boiteAppareil(),
        at: new Date().toISOString(),
        nom: typeof boiteNom === 'function' ? boiteNom() : '',
        classe: typeof ibYear !== 'undefined' ? (ibYear || '') : '',
        matieres: matieres
    };
    boiteEnvoyerDistant(record).then(function () {
        try { localStorage.setItem(RAPPEL_GROUPE, empreinte); } catch (e) {}
    }).catch(function () {});
}

function rappelOuvrirSiBesoin() {
    if (!window.__profilComplet || !rappelPeutOuvrir()) return;
    var raison = rappelCompte() > 0 ? 'exo' : 'journee';
    try {
        if (raison === 'exo' && sessionStorage.getItem('studyPlanIB_chatOuvert_exo') === '1' && !rappelJourneeDue()) return;
        if (raison === 'exo') sessionStorage.setItem('studyPlanIB_chatOuvert_exo', '1');
    } catch (e) {}
    var panel = document.getElementById('panelAssistant');
    if (panel && panel.classList.contains('active')) {
        rappelPoser();
        return;
    }
    if (typeof navigateTo === 'function') navigateTo('assistant');
}

function rappelAfficher() {
    if (typeof iaAfficherEntree === 'function') iaAfficherEntree();
    else rappelBadge(rappelCompte());
}

function rappelCharger() {
    var cache = rappelLireJson(RAPPEL_CACHE);
    if (Array.isArray(cache)) rappelIngerer(cache);
    rappelAfficher();
    var travaux = [];
    travaux.push(fetch('data/rappels.json?v=' + Date.now(), { cache: 'no-store' }).then(function (res) {
        return res.ok ? res.json() : null;
    }).then(function (doc) {
        if (!doc) return;
        if (Array.isArray(doc.groupes)) rappelGroupes = doc.groupes;
        if (Array.isArray(doc.exercices)) {
            rappelIngerer(doc.exercices.map(function (item) {
                item.type = item.type || 'rappel';
                return item;
            }));
        }
    }).catch(function () {}));
    if (typeof boiteLireNtfy === 'function') {
        travaux.push(boiteLireNtfy().then(function (items) {
            rappelIngerer(items || []);
        }).catch(function () {}));
    }
    return Promise.all(travaux).then(function () {
        rappelAfficher();
        rappelPublierCohorte();
        rappelOuvrirSiBesoin();
    });
}

function rappelDemarrer() {
    rappelCharger();
    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') rappelCharger();
    });
}

rappelDemarrer();
