/* ============================================================
   EE & IA
   Le pourcentage suit les parties du plan, pas les anciennes étapes.
   Les parties non cochées vont dans l'emploi du temps.
   ============================================================ */

let memoirLevel = '';
let iaLevel = '';
let iaLevels = {};
let memoirPlan = [];
let iaPlans = {};
let eeVus = {};
let eeDemandes = {};
let eeQuestionCourante = null;
let eeModalOuvert = false;

var EE_SOLUTIONS_FIXES = [
    'Aller voir ton professeur pour trouver un thème',
    'Faire des recherches en ligne',
    'Relire des exemples de travaux déjà acceptés',
    'Noter deux ou trois idées, puis en choisir une avec ton professeur'
];

function eeEchap(str) {
    return String(str == null ? '' : str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function eePourcents(n) {
    var out = [];
    var i;
    if (!n) return out;
    var base = Math.floor(100 / n);
    var extra = 100 - base * n;
    for (i = 0; i < n; i++) out.push(base + (i < extra ? 1 : 0));
    return out;
}

function eeIdPartie() {
    return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function eeTextePartie(valeur) {
    return String(valeur || '').replace(/\s+/g, ' ').trim().slice(0, 80);
}

function eeNormaliserPlan(list) {
    if (!Array.isArray(list)) return [];
    return list.map(function (p) {
        if (!p) return null;
        var id = String(p.id || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 24);
        var text = eeTextePartie(p.text);
        if (!id || !text) return null;
        return { id: id, text: text, done: !!p.done };
    }).filter(Boolean).slice(0, 20);
}

function eeNormaliserPlans(obj) {
    var out = {};
    if (!obj || typeof obj !== 'object') return out;
    Object.keys(obj).forEach(function (nom) {
        if (!nom || nom.length > 80) return;
        out[nom] = eeNormaliserPlan(obj[nom]);
    });
    return out;
}

function eeDateCle(date) {
    var n = date || new Date();
    return n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0') + '-' + String(n.getDate()).padStart(2, '0');
}

function eeDateLimite(jours) {
    var n = new Date();
    n.setDate(n.getDate() + jours);
    return eeDateCle(n);
}

function eeNettoyerSuivi() {
    var garde = eeDateLimite(-14);
    Object.keys(eeVus || {}).forEach(function (cle) {
        var item = eeVus[cle];
        var date = item && item.date ? item.date : cle.slice(0, 10);
        if (date < garde) delete eeVus[cle];
    });
    Object.keys(eeDemandes || {}).forEach(function (cle) {
        if (cle.slice(0, 10) < garde) delete eeDemandes[cle];
    });
}

function eeJourIndex() {
    var jour = new Date().getDay();
    return jour === 0 ? 6 : jour - 1;
}

function eeMinutesMaintenant() {
    var n = new Date();
    return n.getHours() * 60 + n.getMinutes();
}

function eeMomentFini(startTime, endTime, maintenant) {
    if (typeof timeToMinutes !== 'function') return false;
    var debut = timeToMinutes(startTime);
    var fin = timeToMinutes(endTime);
    var now = maintenant;
    if (fin <= debut) fin += 1440;
    if (now < debut && fin > 1440) now += 1440;
    return now >= fin;
}

function eeCleSuivi(date, partId, endTime) {
    return date + '|' + partId + '|' + endTime;
}

function memoirLevelLabel() {
    if (memoirLevel === 'debut') return 'Pas commencé';
    if (memoirLevel === 'plan') return 'Plan';
    if (memoirLevel === 'final') return 'Finalisation';
    if (memoirLevel === 'recherche') return 'Recherche';
    if (memoirLevel === 'brouillon') return 'Brouillon';
    return 'Recherche et rédaction';
}

function iaStageId(name) {
    if (iaLevels && iaLevels[name]) return iaLevels[name];
    return '';
}

function iaLevelLabel(name) {
    var id = name ? iaStageId(name) : iaLevel;
    if (id === 'debut') return 'Pas commencé';
    if (id === 'plan') return 'Plan';
    if (id === 'final') return 'Finalisation';
    if (id === 'criteres') return 'Critères';
    if (id === 'collecte') return 'Collecte';
    if (id === 'brouillon') return 'Brouillon';
    return 'critères et brouillon';
}

function eeSujets() {
    var list = [];
    if (typeof chosenSubjects === 'function') list = chosenSubjects();
    else list = (typeof subjects !== 'undefined' ? subjects : []).concat(typeof optionalSubjects !== 'undefined' ? optionalSubjects : []);
    return list.filter(function (s) { return s && s.name; });
}

function eePlanDe(kind, index) {
    if (kind === 'memoir') {
        memoirPlan = eeNormaliserPlan(memoirPlan);
        return memoirPlan;
    }
    var sujet = eeSujets()[index];
    if (!sujet) return [];
    if (!iaPlans || typeof iaPlans !== 'object') iaPlans = {};
    iaPlans[sujet.name] = eeNormaliserPlan(iaPlans[sujet.name]);
    return iaPlans[sujet.name];
}

function eeNiveauDe(kind, index) {
    if (kind === 'memoir') return memoirLevel;
    var sujet = eeSujets()[index];
    return sujet ? iaStageId(sujet.name) : '';
}

function eeDefinirNiveau(kind, index, id) {
    if (kind === 'memoir') {
        memoirLevel = id;
        return true;
    }
    var sujet = eeSujets()[index];
    if (!sujet) return false;
    if (!iaLevels || typeof iaLevels !== 'object') iaLevels = {};
    iaLevels[sujet.name] = id;
    return true;
}

function eeAvancement(plan) {
    var parts = eePourcents(plan.length);
    var fait = 0;
    var nFait = 0;
    var i;
    for (i = 0; i < plan.length; i++) {
        if (plan[i].done) {
            fait += parts[i];
            nFait++;
        }
    }
    return { n: plan.length, nFait: nFait, pourcent: fait, parts: parts };
}

function eeEstFinalise(kind, subject) {
    if (kind === 'memoir') return memoirLevel === 'final';
    if (!subject || typeof iaStageId !== 'function') return false;
    return iaStageId(subject) === 'final';
}

function eeMemoirActif() {
    if (eeEstFinalise('memoir')) return false;
    if (typeof memoirLevel === 'string' && memoirLevel) return true;
    return Array.isArray(memoirPlan) && memoirPlan.some(function (p) { return p && !p.done; });
}

function eeIaCommencee(name) {
    if (!name || eeEstFinalise('ia', name)) return false;
    var niveau = typeof iaStageId === 'function' ? iaStageId(name) : '';
    if (niveau) return true;
    var plan = iaPlans && iaPlans[name];
    return Array.isArray(plan) && plan.some(function (p) { return p && !p.done; });
}

function eeIasActives() {
    return eeSujets().filter(function (s) { return s && eeIaCommencee(s.name); });
}

function eeIaDuJour(dayIndex) {
    var sujets = eeIasActives();
    if (!sujets.length) return null;
    var jour = Number(dayIndex);
    if (!isFinite(jour) || jour < 0) jour = 0;
    if (jour === 6 && eeMemoirActif()) return null;
    return sujets[jour % sujets.length];
}

function eeTacheEgale(kind, subject, turn) {
    var ouvertes = eePartiesOuvertes().filter(function (p) {
        return p.kind === kind && (kind === 'memoir' || p.subject === subject);
    });
    if (ouvertes.length) {
        if (turn && !turn.partiesVues) turn.partiesVues = {};
        var cle = kind + '|' + (subject || '');
        var i = turn && turn.partiesVues ? (turn.partiesVues[cle] || 0) : 0;
        if (turn && turn.partiesVues) turn.partiesVues[cle] = i + 1;
        return ouvertes[i % ouvertes.length];
    }
    if (kind === 'memoir') return { kind: 'memoir', subject: '', partId: 'memoir-suivi', text: 'Avancer le mémoire', icon: '📖' };
    var sujet = eeSujets().filter(function (s) { return s && s.name === subject; })[0];
    return { kind: 'ia', subject: subject, partId: 'ia-suivi', text: 'Avancer l’évaluation interne', icon: (sujet && sujet.icon) || '📋' };
}

function eeTraceTravail(e, kind, subject) {
    if (!e) return false;
    var titre = String(e.title || '');
    var sous = String(e.subtitle || '');
    var id = String(e.id || '');
    var remplace = String(e.replacesId || '');
    if (kind === 'memoir') {
        return e.type === 'memoir' || (e.planTask && e.planTask.kind === 'memoir') || titre === 'Mémoire' || sous === 'Mémoire' || id.indexOf('memoir') === 0 || remplace.indexOf('memoir') === 0;
    }
    if (e.planTask && e.planTask.kind === 'ia' && (!subject || e.planTask.subject === subject)) return true;
    if ((e.type === 'ia' || id.indexOf('ia-') === 0 || remplace.indexOf('ia-') === 0) && (!subject || titre.indexOf(subject) !== -1 || sous.indexOf(subject) !== -1 || id.indexOf(subject) !== -1 || remplace.indexOf(subject) !== -1)) return true;
    return (titre.indexOf('Évaluation interne') === 0 || sous.indexOf('Évaluation interne') === 0) && (!subject || titre.indexOf(subject) !== -1 || sous.indexOf(subject) !== -1);
}

function eeRetirerDuPlanning(kind, subject) {
    if (typeof customEvents !== 'undefined' && Array.isArray(customEvents)) {
        customEvents = customEvents.filter(function (e) { return !eeTraceTravail(e, kind, subject); });
        if (typeof v3Save === 'function') v3Save();
        else {
            try { localStorage.setItem('studyPlanIB_customEvents_juliss', JSON.stringify(customEvents)); } catch (e) {}
        }
    }
}

function eePartiesOuvertes() {
    var list = [];
    if (!eeEstFinalise('memoir')) {
        eeNormaliserPlan(memoirPlan).forEach(function (p) {
            if (!p.done) list.push({ kind: 'memoir', subject: '', partId: p.id, text: p.text, icon: '📖' });
        });
    }
    eeSujets().forEach(function (sujet) {
        if (eeEstFinalise('ia', sujet.name)) return;
        eeNormaliserPlan(iaPlans && iaPlans[sujet.name]).forEach(function (p) {
            if (!p.done) list.push({ kind: 'ia', subject: sujet.name, partId: p.id, text: p.text, icon: sujet.icon || '📋' });
        });
    });
    return list;
}

function eeProchaineTache(dayIndex, turn) {
    if (!turn) turn = { tacheN: 0 };
    if (typeof turn.tacheN !== 'number') turn.tacheN = 0;
    var file = eeIasActives().map(function (s) { return { kind: 'ia', subject: s.name }; });
    if (eeMemoirActif()) file.push({ kind: 'memoir', subject: '' });
    if (!file.length) return null;
    if (!turn.tacheN) turn.tacheN = Number(dayIndex) || 0;
    var meta = file[turn.tacheN % file.length];
    turn.tacheN++;
    return eeTacheEgale(meta.kind, meta.subject, turn);
}

function eeBlocTache(tache, cursor, dur, clock) {
    return {
        id: 'plantask-' + tache.partId + '-' + cursor,
        title: tache.kind === 'memoir' ? ('Mémoire · ' + tache.text) : ('Évaluation interne · ' + tache.subject),
        subtitle: tache.kind === 'memoir' ? 'Mémoire' : tache.text,
        startTime: clock(cursor),
        endTime: clock(cursor + dur),
        type: tache.kind === 'memoir' ? 'memoir' : 'ia',
        icon: tache.icon || (tache.kind === 'memoir' ? '📖' : '📋'),
        editable: true,
        kind: 'flex',
        planTask: {
            kind: tache.kind,
            subject: tache.subject || '',
            partId: tache.partId,
            text: tache.text
        }
    };
}

function eePartieFaite(kind, subject, partId) {
    var plan = kind === 'memoir' ? eeNormaliserPlan(memoirPlan) : eeNormaliserPlan(iaPlans && iaPlans[subject]);
    var i;
    for (i = 0; i < plan.length; i++) {
        if (plan[i].id === partId) return !!plan[i].done;
    }
    return true;
}

function eeMarquerFaite(kind, subject, partId) {
    var plan = kind === 'memoir' ? memoirPlan : (iaPlans && iaPlans[subject]);
    if (!Array.isArray(plan)) return;
    plan.forEach(function (p) {
        if (p && p.id === partId) p.done = true;
    });
}

function eeBarre(pourcent, accent) {
    return '<div style="height:0.55rem;border-radius:999px;background:#f3f4f6;overflow:hidden;margin-top:0.45rem;">'
        + '<div style="width:' + pourcent + '%;height:100%;border-radius:999px;background:' + accent + ';transition:width 0.25s;"></div>'
        + '</div>';
}

function eeBoutonChoix(label, actif, accent, wash, action) {
    return '<button type="button" onclick="' + action + '" style="text-align:left;width:100%;border:1.5px solid ' + (actif ? accent : '#e7e5e4') + ';background:' + (actif ? wash : 'white') + ';border-radius:1rem;padding:0.8rem 0.9rem;cursor:pointer;font-weight:750;color:#1c1917;font-size:0.9rem;">'
        + (actif ? '✓ ' : '') + eeEchap(label) + '</button>';
}

function eePanneauSolutions() {
    return '<div style="margin-top:0.85rem;padding:0.9rem;border-radius:1rem;background:#fffbeb;border:1px solid #fde68a;">'
        + '<ol style="margin:0;padding-left:1.15rem;color:#44403c;font-size:0.86rem;line-height:1.45;">'
        + EE_SOLUTIONS_FIXES.map(function (texte) { return '<li style="margin:0.28rem 0;">' + eeEchap(texte) + '</li>'; }).join('')
        + '</ol>'
        + '<p style="margin:0.8rem 0 0;padding:0.7rem 0.75rem;border-radius:0.8rem;background:white;color:#1c1917;font-size:0.84rem;line-height:1.45;">Une fois cette étape finie, fais des recherches pour comprendre les critères d’évaluation.</p>'
        + '</div>';
}

function eePanneauPlan(kind, index, plan, accent) {
    var av = eeAvancement(plan);
    var html = '<div style="margin-top:0.85rem;">'
        + '<div style="display:flex;gap:0.45rem;">'
        + '<input id="eeIn-' + kind + '-' + index + '" maxlength="80" placeholder="Ex. : Introduction" onkeydown="if(event.key===\'Enter\'){event.preventDefault();eeAjouterPartie(\'' + kind + '\',' + index + ');}" style="flex:1;min-width:0;border:1.5px solid #e7e5e4;border-radius:0.8rem;padding:0.7rem 0.75rem;font-size:0.9rem;">'
        + '<button type="button" onclick="eeAjouterPartie(\'' + kind + '\',' + index + ')" style="border:none;background:' + accent + ';color:white;border-radius:0.8rem;padding:0.7rem 0.85rem;font-weight:800;cursor:pointer;">Ajouter</button>'
        + '</div>';
    if (!av.n) {
        html += '</div>';
        return html;
    }
    plan.forEach(function (partie, i) {
        html += '<div style="display:flex;align-items:center;gap:0.45rem;margin-top:0.4rem;">'
            + '<button type="button" onclick="eeBasculerPartie(\'' + kind + '\',' + index + ',\'' + partie.id + '\')" style="flex:1;min-width:0;text-align:left;border:1.5px solid ' + (partie.done ? '#86efac' : '#e7e5e4') + ';background:' + (partie.done ? '#f0fdf4' : 'white') + ';border-radius:0.85rem;padding:0.7rem 0.75rem;cursor:pointer;display:flex;align-items:center;gap:0.55rem;">'
            + '<span style="width:1.35rem;height:1.35rem;border-radius:0.4rem;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:0.75rem;font-weight:800;color:' + (partie.done ? 'white' : '#a8a29e') + ';background:' + (partie.done ? '#16a34a' : '#f5f5f4') + ';">' + (partie.done ? '✓' : '') + '</span>'
            + '<span style="flex:1;min-width:0;color:#1c1917;font-size:0.88rem;">' + eeEchap(partie.text) + '</span>'
            + '<strong style="color:' + accent + ';font-size:0.85rem;">' + av.parts[i] + ' %</strong>'
            + '</button>'
            + '<button type="button" onclick="eeRetirerPartie(\'' + kind + '\',' + index + ',\'' + partie.id + '\')" title="Retirer" style="border:none;background:transparent;color:#a8a29e;cursor:pointer;font-size:1rem;padding:0.35rem;">×</button>'
            + '</div>';
    });
    html += '<p style="margin:0.7rem 0 0;color:#78716c;font-size:0.78rem;line-height:1.4;">Les parties non cochées de ton plan seront mises dans ton emploi du temps pour que tu puisses avancer dans tes travaux.</p></div>';
    return html;
}

function eeCarteTravail(opts) {
    var plan = eePlanDe(opts.kind, opts.index);
    var av = eeAvancement(plan);
    var niveau = eeNiveauDe(opts.kind, opts.index);
    var html = '<article style="margin-bottom:0.9rem;padding:0.95rem;border-radius:1.1rem;background:white;border:1px solid #e7e5e4;">'
        + '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:0.75rem;">'
        + '<div style="min-width:0;"><p style="margin:0 0 0.15rem;font-size:0.68rem;letter-spacing:0.16em;text-transform:uppercase;font-weight:800;color:' + opts.accent + ';">' + eeEchap(opts.kicker) + '</p>'
        + '<h3 style="margin:0;font-size:1.02rem;color:#1c1917;">' + (opts.icon ? '<span style="margin-right:0.35rem;">' + eeEchap(opts.icon) + '</span>' : '') + eeEchap(opts.titre) + '</h3></div>'
        + '<span style="font-size:1.35rem;font-weight:800;color:' + opts.accent + ';white-space:nowrap;">' + av.pourcent + ' %</span>'
        + '</div>'
        + eeBarre(av.pourcent, opts.accent)
        + (av.n ? '<p style="margin:0.45rem 0 0.8rem;color:#78716c;font-size:0.76rem;">' + av.nFait + ' partie' + (av.nFait > 1 ? 's' : '') + ' terminée' + (av.nFait > 1 ? 's' : '') + ' sur ' + av.n + '</p>' : '')
        + '<div style="display:flex;flex-direction:column;gap:0.4rem;' + (av.n ? '' : 'margin-top:0.8rem;') + '">'
        + eeBoutonChoix('Pas commencé', niveau === 'debut', opts.accent, opts.wash, 'eeChoisirDebut(\'' + opts.kind + '\',' + opts.index + ')')
        + eeBoutonChoix('Plan', niveau === 'plan', opts.accent, opts.wash, 'eeChoisirPlan(\'' + opts.kind + '\',' + opts.index + ')')
        + eeBoutonChoix('Finalisation', niveau === 'final', opts.accent, opts.wash, 'eeChoisirFinal(\'' + opts.kind + '\',' + opts.index + ')')
        + '</div>';
    if (niveau === 'debut') html += eePanneauSolutions();
    if (niveau === 'plan') html += eePanneauPlan(opts.kind, opts.index, plan, opts.accent);
    html += '</article>';
    return html;
}

function renderEEia() {
    var body = document.getElementById('eeiaBody');
    if (!body) return;
    var html = '<p style="margin:0 0 1rem;color:#57534e;font-size:0.86rem;line-height:1.45;">Le pourcentage suit les parties de ton plan. Appuie sur Pas commencé pour les pistes de départ, puis sur Plan pour saisir tes parties.</p>';
    html += eeCarteTravail({
        kind: 'memoir',
        index: -1,
        kicker: 'EE',
        titre: 'Mémoire',
        icon: '',
        accent: '#9f1239',
        wash: '#fff1f2'
    });
    html += '<section style="margin-top:0.4rem;">'
        + '<p style="margin:0 0 0.2rem;font-size:0.68rem;letter-spacing:0.18em;text-transform:uppercase;font-weight:800;color:#1d4ed8;">IA</p>'
        + '<h2 style="margin:0 0 0.75rem;font-size:1.15rem;color:#1c1917;">Évaluations internes</h2>';
    var sujets = eeSujets();
    if (!sujets.length) {
        html += '<p style="margin:0;color:#6b7280;font-size:0.88rem;">Choisis d’abord tes matières pour suivre chaque évaluation interne.</p>';
    }
    sujets.forEach(function (sujet, index) {
        html += eeCarteTravail({
            kind: 'ia',
            index: index,
            kicker: 'IA',
            titre: sujet.name,
            icon: sujet.icon || '📋',
            accent: '#1d4ed8',
            wash: '#eff6ff'
        });
    });
    html += '</section>';
    body.innerHTML = html;
    eeSuiviPlanning();
}

function eeApresChangement() {
    renderEEia();
    var planning = document.getElementById('planningModal');
    if (planning && planning.classList.contains('active') && typeof renderPlanning === 'function') {
        try { renderPlanning(); } catch (e) {}
    }
    if (typeof memoireSauvegarder === 'function') {
        try { memoireSauvegarder(); } catch (e) {}
    }
}

function eeChoisirDebut(kind, index) {
    if (!eeDefinirNiveau(kind, index, 'debut')) return;
    eeApresChangement();
}

function eeChoisirPlan(kind, index) {
    if (!eeDefinirNiveau(kind, index, 'plan')) return;
    eeApresChangement();
}

function eeChoisirFinal(kind, index) {
    if (!eeDefinirNiveau(kind, index, 'final')) return;
    var nom = 'ton mémoire';
    var sujet = null;
    if (kind !== 'memoir') {
        sujet = eeSujets()[index];
        nom = sujet ? ('l’évaluation interne de ' + sujet.name) : 'cette évaluation interne';
    }
    eeRetirerDuPlanning(kind === 'memoir' ? 'memoir' : 'ia', sujet ? sujet.name : '');
    eeOuvrirMessage(eeHtmlFinal(nom));
    eeApresChangement();
}

function eeAjouterPartie(kind, index) {
    var champ = document.getElementById('eeIn-' + kind + '-' + index);
    var texte = eeTextePartie(champ ? champ.value : '');
    if (!texte) return;
    var plan = eePlanDe(kind, index);
    if (plan.length >= 20) return;
    plan.push({ id: eeIdPartie(), text: texte, done: false });
    eeDefinirNiveau(kind, index, 'plan');
    eeApresChangement();
}

function eeBasculerPartie(kind, index, partId) {
    var plan = eePlanDe(kind, index);
    plan.forEach(function (p) {
        if (p.id === partId) p.done = !p.done;
    });
    eeApresChangement();
}

function eeRetirerPartie(kind, index, partId) {
    if (kind === 'memoir') memoirPlan = eePlanDe(kind, index).filter(function (p) { return p.id !== partId; });
    else {
        var sujet = eeSujets()[index];
        if (sujet) iaPlans[sujet.name] = eePlanDe(kind, index).filter(function (p) { return p.id !== partId; });
    }
    eeApresChangement();
}

function eeAssurerModal() {
    if (document.getElementById('eeRetourModal')) return;
    var el = document.createElement('div');
    el.id = 'eeRetourModal';
    el.style.cssText = 'display:none;position:fixed;inset:0;z-index:120;background:rgba(17,24,39,0.55);align-items:center;justify-content:center;padding:1rem;';
    el.innerHTML = '<div id="eeRetourCarte" style="max-width:26rem;width:100%;background:white;border-radius:1.25rem;padding:1.35rem 1.2rem;box-shadow:0 24px 60px rgba(0,0,0,0.18);"></div>';
    document.body.appendChild(el);
}

function eeOuvrirMessage(html) {
    if (typeof document === 'undefined') return;
    eeQuestionCourante = null;
    eeAssurerModal();
    document.getElementById('eeRetourCarte').innerHTML = html;
    document.getElementById('eeRetourModal').style.display = 'flex';
    eeModalOuvert = true;
}

function eeFermerMessage() {
    var modal = document.getElementById('eeRetourModal');
    if (modal) modal.style.display = 'none';
    eeModalOuvert = false;
    eeQuestionCourante = null;
    eeVerifierRetours();
}

function eeHtmlFinal(nom) {
    return '<p style="margin:0 0 0.35rem;font-size:0.72rem;letter-spacing:0.16em;text-transform:uppercase;font-weight:800;color:#059669;">Félicitations</p>'
        + '<h3 style="margin:0 0 0.55rem;font-size:1.28rem;color:#1c1917;line-height:1.3;">Tu passes à la finalisation de ' + eeEchap(nom) + '.</h3>'
        + '<p style="margin:0 0 1.1rem;color:#44403c;font-size:0.95rem;line-height:1.45;">C’est un pas de plus vers l’obtention de l’IB.</p>'
        + '<button type="button" onclick="eeFermerMessage()" style="width:100%;border:none;background:#059669;color:white;border-radius:0.85rem;padding:0.8rem 1rem;font-weight:800;cursor:pointer;">Continuer</button>';
}

function eeHtmlBravo(texte) {
    return '<p style="margin:0 0 0.35rem;font-size:0.72rem;letter-spacing:0.16em;text-transform:uppercase;font-weight:800;color:#059669;">Bravo</p>'
        + '<h3 style="margin:0 0 0.55rem;font-size:1.28rem;color:#1c1917;line-height:1.3;">Tu as terminé « ' + eeEchap(texte) + ' ».</h3>'
        + '<p style="margin:0 0 1.1rem;color:#44403c;font-size:0.95rem;line-height:1.45;">C’est un pas de plus vers l’obtention de l’IB.</p>'
        + '<button type="button" onclick="eeFermerMessage()" style="width:100%;border:none;background:#059669;color:white;border-radius:0.85rem;padding:0.8rem 1rem;font-weight:800;cursor:pointer;">Continuer</button>';
}

function eeHtmlQuestion(q) {
    var ou = q.kind === 'memoir' ? 'Mémoire' : ('Évaluation interne · ' + (q.subject || ''));
    return '<p style="margin:0 0 0.35rem;font-size:0.72rem;letter-spacing:0.16em;text-transform:uppercase;font-weight:800;color:#9f1239;">Après le créneau</p>'
        + '<h3 style="margin:0 0 0.55rem;font-size:1.22rem;color:#1c1917;line-height:1.3;">As-tu validé cette partie de ton plan ?</h3>'
        + '<p style="margin:0 0 0.3rem;font-size:1.02rem;font-weight:800;color:#1c1917;">tâche (' + eeEchap(q.text) + ')</p>'
        + '<p style="margin:0 0 1.1rem;color:#78716c;font-size:0.84rem;">' + eeEchap(ou) + ' · ' + eeEchap(q.startTime || '') + ' → ' + eeEchap(q.endTime || '') + '</p>'
        + '<div style="display:flex;flex-direction:column;gap:0.5rem;">'
        + '<button type="button" onclick="eeRepondreValidation(true)" style="width:100%;border:none;background:#9f1239;color:white;border-radius:0.85rem;padding:0.8rem 1rem;font-weight:800;cursor:pointer;">Oui, c’est fait</button>'
        + '<button type="button" onclick="eeRepondreValidation(false)" style="width:100%;border:1.5px solid #e7e5e4;background:white;color:#44403c;border-radius:0.85rem;padding:0.75rem 1rem;font-weight:700;cursor:pointer;">Pas encore</button>'
        + '</div>';
}

function eeClorePartie(partId, valeur) {
    Object.keys(eeVus || {}).forEach(function (cle) {
        var item = eeVus[cle];
        if (!item || item.partId !== partId || eeDemandes[cle]) return;
        if (eeCreneauPasse(item)) eeDemandes[cle] = valeur;
    });
}

function eeRepondreValidation(oui) {
    var q = eeQuestionCourante;
    if (!q) {
        eeFermerMessage();
        return;
    }
    eeDemandes[q.key] = oui ? 'oui' : 'non';
    eeClorePartie(q.partId, oui ? 'oui' : 'non');
    if (oui) eeMarquerFaite(q.kind, q.subject, q.partId);
    eeQuestionCourante = null;
    if (oui) {
        eeOuvrirMessage(eeHtmlBravo(q.text));
        eeApresChangement();
        return;
    }
    eeFermerMessage();
    eeApresChangement();
}

function eeProfilPret() {
    if (window.__profilComplet) return true;
    var planning = typeof document !== 'undefined' ? document.getElementById('planningModal') : null;
    return !!(planning && planning.classList.contains('active'));
}

function eeNoterCreneauxVus() {
    if (!eeProfilPret() || typeof generateDayEvents !== 'function' || typeof timeToMinutes !== 'function') return;
    var events;
    try { events = generateDayEvents(eeJourIndex()); } catch (e) { return; }
    var date = eeDateCle();
    (events || []).forEach(function (ev) {
        if (!ev || !ev.planTask || !ev.planTask.partId) return;
        var cle = eeCleSuivi(date, ev.planTask.partId, ev.endTime);
        if (eeDemandes[cle] || eeVus[cle]) return;
        eeVus[cle] = {
            date: date,
            kind: ev.planTask.kind,
            subject: ev.planTask.subject || '',
            partId: ev.planTask.partId,
            text: ev.planTask.text,
            startTime: ev.startTime,
            endTime: ev.endTime
        };
    });
}

function eeCreneauPasse(item) {
    if (!item || !item.date) return false;
    var aujourdhui = eeDateCle();
    if (item.date < aujourdhui) return true;
    if (item.date > aujourdhui) return false;
    return eeMomentFini(item.startTime, item.endTime, eeMinutesMaintenant());
}

function eeVerifierRetours() {
    if (eeModalOuvert || typeof document === 'undefined' || document.visibilityState === 'hidden') return;
    if (!eeProfilPret() || typeof timeToMinutes !== 'function') return;
    var limite = eeDateLimite(-1);
    var due = null;
    Object.keys(eeVus || {}).forEach(function (cle) {
        if (due) return;
        var item = eeVus[cle];
        if (!item || eeDemandes[cle] || !item.date || item.date < limite) return;
        if (!eeCreneauPasse(item)) return;
        if (eePartieFaite(item.kind, item.subject, item.partId)) {
            eeDemandes[cle] = 'oui';
            return;
        }
        due = {
            key: cle,
            kind: item.kind,
            subject: item.subject || '',
            partId: item.partId,
            text: item.text,
            startTime: item.startTime,
            endTime: item.endTime
        };
    });
    if (!due) return;
    eeQuestionCourante = due;
    eeAssurerModal();
    document.getElementById('eeRetourCarte').innerHTML = eeHtmlQuestion(due);
    document.getElementById('eeRetourModal').style.display = 'flex';
    eeModalOuvert = true;
}

function eeSuiviPlanning() {
    eeNoterCreneauxVus();
    eeVerifierRetours();
}

function setMemoirLevel(id) {
    memoirLevel = id;
    renderEEia();
}

function setIaStage(index, id) {
    eeDefinirNiveau('ia', index, id);
    renderEEia();
}

function setIaLevel(id) {
    iaLevel = id;
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

if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') eeSuiviPlanning();
    });
    setInterval(function () {
        eeSuiviPlanning();
    }, 20000);
}
