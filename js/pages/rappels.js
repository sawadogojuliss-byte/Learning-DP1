/* Rappels d'exercices entre camarades de la même matière.
   Anglais B est exclu : les enseignants ne sont pas les mêmes. */

var RAPPEL_VUS = 'studyPlanIB_rappelsVus';
var RAPPEL_CACHE = 'studyPlanIB_rappels';
var RAPPEL_GROUPE = 'studyPlanIB_groupe';
var rappelListe = [];
var rappelGroupes = [];
var rappelSession = false;

function rappelSansAccent(nom) {
    return String(nom || '').toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/\b(hl|sl)\b/g, ' ')
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function rappelExclu(nom) {
    var cle = rappelSansAccent(nom);
    return !cle || cle === 'anglais b' || cle === 'english b' || cle.indexOf('anglais b ') === 0 || cle.indexOf('english b ') === 0;
}

function rappelCle(nom) {
    return rappelSansAccent(nom);
}

function rappelNom(nom) {
    return String(nom || '').replace(/\s+(HL|SL)\s*$/i, '').trim();
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
        if (!s || !s.name || rappelExclu(s.name)) return;
        map[rappelCle(s.name)] = rappelNom(s.name);
    });
    return map;
}

function rappelJaiExercice(matiere) {
    var cle = rappelCle(matiere);
    var liste = (typeof exercices !== 'undefined' && Array.isArray(exercices)) ? exercices : [];
    var i;
    for (i = 0; i < liste.length; i++) {
        var exo = liste[i];
        if (!exo || rappelCle(exo.subject) !== cle || !exo.scheduledSlot) continue;
        return true;
    }
    var evs = (typeof customEvents !== 'undefined' && Array.isArray(customEvents)) ? customEvents : [];
    for (i = 0; i < evs.length; i++) {
        var ev = evs[i];
        if (!ev) continue;
        var titre = String(ev.title || '');
        if (ev.source !== 'exercice' && !/^Exercices\s+/i.test(titre)) continue;
        var sujet = titre.replace(/^Exercices\s+/i, '').replace(/\s*\(Partie[^)]*\)\s*$/i, '');
        if (rappelCle(sujet) === cle) return true;
    }
    return false;
}

function rappelVus() {
    var vus = rappelLireJson(RAPPEL_VUS);
    return Array.isArray(vus) ? vus : [];
}

function rappelEnAttente() {
    var moi = typeof boiteAppareil === 'function' ? boiteAppareil() : '';
    var cles = rappelMesMatieres();
    var vus = rappelVus();
    var out = [];
    var deja = {};
    rappelListe.forEach(function (item) {
        if (!item || (item.type && item.type !== 'rappel') || !item.id) return;
        if (rappelExclu(item.matiere)) return;
        var cle = rappelCle(item.matiere);
        if (!cles[cle]) return;
        if (moi && item.appareil === moi) return;
        if (vus.indexOf(item.id) !== -1) return;
        if (rappelJaiExercice(item.matiere)) return;
        if (deja[item.id]) return;
        deja[item.id] = true;
        out.push(item);
    });
    return out;
}

function rappelCompte() {
    return rappelEnAttente().length;
}

function rappelIngerer(items) {
    if (!Array.isArray(items)) return;
    var map = {};
    rappelListe.forEach(function (item) {
        if (item && item.id) map[item.id] = item;
    });
    items.forEach(function (item) {
        if (!item || item.type !== 'rappel' || !item.id || rappelExclu(item.matiere)) return;
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

function rappelTexte(item) {
    var jours = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
    var matiere = rappelNom(item.matiere) || 'cette matière';
    var quand = '';
    if (typeof item.jour === 'number' && jours[item.jour]) quand = jours[item.jour];
    if (item.debut && item.fin) quand = (quand ? quand + ' de ' : '') + item.debut + ' à ' + item.fin;
    else if (item.debut) quand = (quand ? quand + ' à ' : '') + item.debut;
    return 'Tu fais ' + matiere + '. Un camarade a placé un exercice' + (quand ? ' ' + quand : '') + '. Tu n\'en as pas dans cette matière. Tu en as un ?';
}

function rappelIgnorer(id) {
    var vus = rappelVus();
    if (vus.indexOf(id) === -1) vus.push(id);
    try { localStorage.setItem(RAPPEL_VUS, JSON.stringify(vus.slice(-500))); } catch (e) {}
    var noeud = document.getElementById('rappel-' + id);
    if (noeud) noeud.remove();
    if (typeof iaAfficherEntree === 'function') iaAfficherEntree();
}

function rappelPoser() {
    var fil = document.getElementById('iaFil');
    if (!fil || typeof iaBulle !== 'function') return;
    rappelEnAttente().forEach(function (item) {
        if (document.getElementById('rappel-' + item.id)) return;
        var bulle = iaBulle('assistant', rappelTexte(item));
        if (!bulle) return;
        if (bulle.parentNode) bulle.parentNode.id = 'rappel-' + item.id;
        var actions = document.createElement('div');
        actions.style.cssText = 'display:flex;gap:0.4rem;margin-top:0.65rem;flex-wrap:wrap;';
        var oui = document.createElement('button');
        var non = document.createElement('button');
        oui.type = 'button';
        non.type = 'button';
        oui.textContent = 'Oui, j\'en ai un';
        non.textContent = 'Non, je l\'ajoute';
        [oui, non].forEach(function (btn) {
            btn.style.cssText = 'border:none;border-radius:999px;padding:0.4rem 0.7rem;font:inherit;font-size:0.75rem;font-weight:700;cursor:pointer;background:#ecfdf5;color:#047857;';
        });
        oui.onclick = function () { rappelIgnorer(item.id); };
        non.onclick = function () {
            if (typeof navigateTo === 'function') navigateTo('exercices');
        };
        actions.appendChild(oui);
        actions.appendChild(non);
        bulle.appendChild(actions);
    });
    fil.scrollTop = fil.scrollHeight;
}

function rappelPublierExercice(exo, slot) {
    if (!exo || !slot || rappelExclu(exo.subject)) return;
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
        niveau: exo.level || '',
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
        if (!s || !s.name || rappelExclu(s.name) || matieres.length >= 12) return;
        matieres.push((s.name + (s.level ? ' ' + s.level : '')).trim());
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
    if (rappelSession || !window.__profilComplet || rappelCompte() <= 0) return;
    try {
        if (sessionStorage.getItem('studyPlanIB_rappelOuvert') === '1') return;
        sessionStorage.setItem('studyPlanIB_rappelOuvert', '1');
    } catch (e) {}
    rappelSession = true;
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
