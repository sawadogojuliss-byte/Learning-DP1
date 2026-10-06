/* ============================================================
   Assistant — uniquement le compte admin Juliss Owen.
   Il répond à partir de son planning, de ses matières et de
   ses exercices. Aucun autre compte ne voit cette section.
   ============================================================ */

var IA_CLE = 'studyPlanIB_iaJuliss';
var iaContexte = { sujet: '', exercices: [] };
var iaBranche = false;

function iaNormaliser(s) {
    return String(s || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function iaEstJuliss() {
    var nom = typeof userName !== 'undefined' ? userName : '';
    var mots = typeof boiteMots === 'function' ? boiteMots(nom) : iaNormaliser(nom).split(' ').filter(Boolean);
    var attendus = ['sawadogo', 'juliss', 'bill', 'owen'];
    return attendus.every(function (mot) { return mots.indexOf(mot) !== -1; });
}

function iaPrenom() {
    return 'Juliss';
}

function iaEchap(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function iaJourCle(date) {
    var d = date || new Date();
    var m = d.getMonth() + 1;
    var j = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (j < 10 ? '0' : '') + j;
}

function iaIndexJour(date) {
    var n = (date || new Date()).getDay();
    return n === 0 ? 6 : n - 1;
}

function iaNomJour(index) {
    var noms = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
    return noms[index] || '';
}

function iaLire() {
    try { return JSON.parse(localStorage.getItem(IA_CLE) || 'null') || {}; } catch (e) { return {}; }
}

function iaEcrire(data) {
    try { localStorage.setItem(IA_CLE, JSON.stringify(data)); } catch (e) {}
}

function iaMatieres() {
    if (typeof chosenSubjects === 'function') return chosenSubjects().filter(Boolean);
    return (typeof subjects !== 'undefined' ? subjects : []).concat(typeof optionalSubjects !== 'undefined' ? optionalSubjects : []).filter(Boolean);
}

function iaExercices() {
    return (typeof exercices !== 'undefined' && Array.isArray(exercices) ? exercices : []).filter(Boolean);
}

function iaDateExercice(exo) {
    return String(exo && exo.deadline || '').slice(0, 10);
}

function iaExercicesDu(jour) {
    return iaExercices().filter(function (exo) {
        return exo && !exo.done && iaDateExercice(exo) === jour;
    });
}

function iaExercicesRetard(jour) {
    return iaExercices().filter(function (exo) {
        return exo && !exo.done && iaDateExercice(exo) && iaDateExercice(exo) < jour;
    });
}

function iaExercicesSemaine(jour) {
    var fin = new Date();
    fin.setDate(fin.getDate() + 7);
    var limite = iaJourCle(fin);
    return iaExercices().filter(function (exo) {
        var d = iaDateExercice(exo);
        return exo && !exo.done && d && d >= jour && d <= limite;
    });
}

function iaEvenements(index) {
    if (typeof generateDayEvents !== 'function') return [];
    try { return generateDayEvents(index) || []; } catch (e) { return []; }
}

function iaMinutes(heure) {
    if (typeof timeToMinutes === 'function') return timeToMinutes(heure);
    var p = String(heure || '0:0').split(':');
    return (parseInt(p[0], 10) || 0) * 60 + (parseInt(p[1], 10) || 0);
}

function iaMaintenant() {
    var d = new Date();
    return d.getHours() * 60 + d.getMinutes();
}

function iaLigneExercice(exo) {
    var nom = exo.subject || 'Matière';
    var texte = exo.text ? ' — ' + exo.text : '';
    return (exo.subjectIcon || '✏️') + ' ' + nom + texte + (exo.deadline ? ' · limite ' + exo.deadline : '');
}

function iaResumeExercices(liste, vide) {
    if (!liste.length) return vide;
    return liste.slice(0, 6).map(function (exo, i) { return (i + 1) + '. ' + iaLigneExercice(exo); }).join('\n');
}

function iaResumeJour(index) {
    var evs = iaEvenements(index).filter(function (ev) {
        return ev && ev.id !== 'wakeup' && ev.id !== 'sleep' && ev.title;
    });
    if (!evs.length) return 'Aucun créneau enregistré pour ' + iaNomJour(index) + '.';
    return evs.slice(0, 8).map(function (ev) {
        return (ev.icon || '•') + ' ' + (ev.startTime || '') + '–' + (ev.endTime || '') + ' ' + ev.title;
    }).join('\n');
}

function iaProchain(index) {
    var maintenant = iaMaintenant();
    var evs = iaEvenements(index).filter(function (ev) { return ev && ev.endTime && ev.id !== 'sleep'; });
    var i;
    for (i = 0; i < evs.length; i++) {
        if (iaMinutes(evs[i].endTime) > maintenant) return evs[i];
    }
    return null;
}

function iaPriorites() {
    return iaMatieres().filter(function (s) {
        if (!s) return false;
        if (s.level === 'HL') return true;
        if (typeof noteMatiere === 'function') {
            var n = noteMatiere(s);
            return n != null && n <= 4;
        }
        return false;
    });
}

function iaMatiereCitee(texte) {
    var n = iaNormaliser(texte);
    return iaMatieres().find(function (s) {
        return s && s.name && n.indexOf(iaNormaliser(s.name)) !== -1;
    }) || null;
}

function iaContient(n, mots) {
    var phrase = ' ' + n + ' ';
    return mots.some(function (mot) {
        if (mot.length <= 3) return phrase.indexOf(' ' + mot + ' ') !== -1;
        return n.indexOf(mot) !== -1;
    });
}

function iaRepondre(question) {
    var brut = String(question || '').trim();
    var n = iaNormaliser(brut);
    var auj = iaJourCle(new Date());
    var demainDate = new Date();
    demainDate.setDate(demainDate.getDate() + 1);
    var demain = iaJourCle(demainDate);
    var index = iaIndexJour(new Date());
    var indexDemain = iaIndexJour(demainDate);
    var duJour = iaExercicesDu(auj);
    var retard = iaExercicesRetard(auj);
    var matiere = iaMatiereCitee(brut);

    if (!n || iaContient(n, ['bonjour', 'salut', 'bonsoir', 'hello', 'coucou'])) {
        return iaBriefingTexte();
    }
    if (iaContient(n, ['merci', 'super', 'parfait', 'genial', 'top'])) {
        return 'Avec plaisir, ' + iaPrenom() + '. Je reste là si un exercice ou un créneau change.';
    }
    if (iaContient(n, ['qui es tu', 'ton nom', 't es qui', 'tu es qui'])) {
        return 'Je suis l’assistant de Study Plan IB, réservé à ton compte. Je lis ton emploi du temps, tes matières et tes exercices, puis je te rappelle ce qui compte aujourd’hui.';
    }
    if (iaContient(n, ['fini', 'termine', 'terminé', 'fait', 'coche'])) {
        var cible = matiere
            ? iaExercices().find(function (exo) { return !exo.done && exo.subject === matiere.name; })
            : (iaContexte.exercices[0] || duJour[0] || retard[0]);
        if (!cible) return 'Je ne vois pas quel exercice cocher. Donne la matière, par exemple : « j’ai fini l’exercice de physique ».';
        cible.done = true;
        try { localStorage.setItem('studyPlanIB_exercices', JSON.stringify(exercices)); } catch (e) {}
        if (typeof memoireSauvegarder === 'function') memoireSauvegarder();
        iaPoserRappel();
        return 'C’est noté : « ' + (cible.text || cible.subject) + ' » est terminé. Il reste ' + iaExercices().filter(function (exo) { return exo && !exo.done; }).length + ' exercice' + (iaExercices().filter(function (exo) { return exo && !exo.done; }).length > 1 ? 's' : '') + ' en cours.';
    }
    if (iaContient(n, ['demain']) || (iaContexte.sujet === 'planning' && iaContient(n, ['suivant', 'apres', 'après']))) {
        iaContexte.sujet = 'planning';
        return 'Demain, ' + iaNomJour(indexDemain) + ' :\n' + iaResumeJour(indexDemain) + '\n\nExercices à rendre demain :\n' + iaResumeExercices(iaExercicesDu(demain), 'Aucun.');
    }
    if (iaContient(n, ['maintenant', 'en ce moment', 'prochain', 'que faire', 'quoi faire', 'focus', 'reviser', 'réviser'])) {
        var prochain = iaProchain(index);
        var priorite = iaPriorites()[0];
        var ligne = prochain
            ? 'Là, tu es sur « ' + prochain.title + ' » jusqu’à ' + prochain.endTime + '.'
            : 'Je ne vois plus de créneau aujourd’hui.';
        var suite = priorite
            ? ' La priorité suivante est ' + priorite.name + (priorite.level ? ' (' + priorite.level + ')' : '') + '.'
            : '';
        var exo = duJour[0] || retard[0];
        var rappel = exo ? '\nAvant de fermer la journée, pense à : ' + iaLigneExercice(exo) + '.' : '\nAucun exercice n’est dû aujourd’hui.';
        iaContexte.sujet = 'focus';
        return ligne + suite + rappel;
    }
    if (iaContient(n, ['exercice', 'exercices', 'devoir', 'devoirs', 'rappel', 'deadline', 'limite', 'rendre'])) {
        iaContexte.sujet = 'exercices';
        iaContexte.exercices = retard.concat(duJour);
        var texte = iaPrenom() + ', voici tes exercices.\n\n';
        texte += 'Aujourd’hui :\n' + iaResumeExercices(duJour, 'Rien à rendre aujourd’hui.') + '\n\n';
        texte += 'En retard :\n' + iaResumeExercices(retard, 'Aucun retard.') + '\n\n';
        texte += 'Les 7 prochains jours :\n' + iaResumeExercices(iaExercicesSemaine(auj), 'Rien de prévu.');
        texte += '\n\nTu peux me dire « j’ai fini » suivi de la matière pour le cocher.';
        return texte;
    }
    if (iaContient(n, ['planning', 'emploi', 'emploi du temps', 'journee', 'journée', 'aujourd', 'creneau', 'créneau', 'horaire'])) {
        iaContexte.sujet = 'planning';
        return 'Ton ' + iaNomJour(index) + ' :\n' + iaResumeJour(index);
    }
    if (iaContient(n, ['priorit', 'faible', 'hl', 'note', 'bulletin', 'matiere', 'matière', 'matieres', 'matières'])) {
        var liste = iaPriorites();
        if (matiere) liste = [matiere].concat(liste.filter(function (s) { return s.name !== matiere.name; }));
        if (!liste.length) return 'Aucune matière HL ou sous 4/7 n’est enregistrée. Tes matières : ' + (iaMatieres().map(function (s) { return s.name; }).join(', ') || 'aucune') + '.';
        return 'À travailler en premier :\n' + liste.slice(0, 6).map(function (s, i) {
            var note = typeof noteMatiere === 'function' ? noteMatiere(s) : null;
            return (i + 1) + '. ' + (s.icon || '') + ' ' + s.name + (s.level ? ' · ' + s.level : '') + (note != null ? ' · ' + note + '/7' : '');
        }).join('\n');
    }
    if (iaContient(n, ['memoire', 'mémoire', 'ee', 'ia', 'evaluation interne', 'évaluation'])) {
        var ee = typeof memoirLevel !== 'undefined' && memoirLevel ? memoirLevel : 'pas encore choisi';
        return 'Mémoire : ' + ee + '. Ouvre la section EE & IA du menu pour le détail des étapes. Je peux aussi te redonner les exercices du jour si tu veux enchaîner.';
    }
    if (iaContient(n, ['briefing', 'resume', 'résumé', 'bilan', 'programme'])) {
        return iaBriefingTexte();
    }
    if (iaContient(n, ['aide', 'comment', 'ajouter', 'fonctionne', 'site'])) {
        return 'Tu peux ajouter un exercice dans Mes Exercices, changer une matière dans les paramètres, et télécharger l’emploi du temps depuis Mon compte. Dis-moi plutôt ce que tu veux faire : exercices, planning, ou priorités.';
    }
    if (matiere) {
        var noteM = typeof noteMatiere === 'function' ? noteMatiere(matiere) : null;
        var lies = iaExercices().filter(function (exo) { return !exo.done && exo.subject === matiere.name; });
        iaContexte.exercices = lies;
        return matiere.name + (matiere.level ? ' est en ' + matiere.level : '') + (noteM != null ? ', dernière note ' + noteM + '/7' : '') + '.\n' + (lies.length ? 'Exercices liés :\n' + iaResumeExercices(lies, '') : 'Aucun exercice en cours pour cette matière.');
    }
    if (iaContient(n, ['pourquoi', 'comment', 'quand', 'quoi', 'quel', 'quelle', 'est ce', 'peux tu', 'tu peux'])) {
        return 'Je peux t’aider sur trois choses concrètes : tes exercices du jour, ton emploi du temps, et les matières à prioriser. ' + iaPhraseRappel(duJour, retard);
    }
    return 'Je n’ai pas saisi la question exactement, ' + iaPrenom() + '. ' + iaPhraseRappel(duJour, retard) + ' Tu peux me demander « exercices », « planning » ou « priorités ».';
}

function iaPhraseRappel(duJour, retard) {
    if (retard.length) return 'Tu as ' + retard.length + ' exercice' + (retard.length > 1 ? 's' : '') + ' en retard.';
    if (duJour.length) return 'Tu as ' + duJour.length + ' exercice' + (duJour.length > 1 ? 's' : '') + ' à rendre aujourd’hui.';
    return 'Aucun exercice n’est dû aujourd’hui.';
}

function iaBriefingTexte() {
    var auj = iaJourCle(new Date());
    var index = iaIndexJour(new Date());
    var duJour = iaExercicesDu(auj);
    var retard = iaExercicesRetard(auj);
    var prochain = iaProchain(index);
    iaContexte.sujet = 'briefing';
    iaContexte.exercices = retard.concat(duJour);
    var texte = 'Bonjour ' + iaPrenom() + '. Voici ta journée.\n\n';
    texte += iaPhraseRappel(duJour, retard) + '\n';
    if (duJour.length) texte += iaResumeExercices(duJour, '') + '\n';
    if (retard.length) texte += '\nEn retard :\n' + iaResumeExercices(retard, '') + '\n';
    texte += '\n' + (prochain ? 'Prochain créneau : ' + prochain.title + ' jusqu’à ' + prochain.endTime + '.' : 'Plus de créneau prévu aujourd’hui.');
    var prio = iaPriorites()[0];
    if (prio) texte += '\nPriorité : ' + prio.name + (prio.level ? ' ' + prio.level : '') + '.';
    return texte;
}

function iaPuces() {
    return [
        ['Exercices du jour', 'Quels exercices ai-je aujourd’hui ?'],
        ['Planning', 'Quel est mon planning aujourd’hui ?'],
        ['Maintenant', 'Que dois-je faire maintenant ?'],
        ['Priorités', 'Quelles matières sont prioritaires ?'],
        ['Demain', 'Et demain ?']
    ];
}

function iaAfficherPuces() {
    var hote = document.getElementById('iaPuces');
    if (!hote) return;
    hote.innerHTML = iaPuces().map(function (puce) {
        return '<button type="button" onclick="iaQuestion(\'' + iaEchap(puce[1]).replace(/'/g, '&#39;') + '\')" style="flex:0 0 auto;border:1.5px solid #d1fae5;background:#f0fdf4;color:#065f46;border-radius:999px;padding:0.35rem 0.7rem;font-size:0.75rem;font-weight:700;cursor:pointer;">' + iaEchap(puce[0]) + '</button>';
    }).join('');
}

function iaAjouterBulle(role, texte) {
    var fil = document.getElementById('iaFil');
    if (!fil) return;
    var moi = role === 'moi';
    var bulle = document.createElement('div');
    bulle.style.cssText = 'max-width:88%;padding:0.75rem 0.9rem;border-radius:1rem;white-space:pre-wrap;line-height:1.45;font-size:0.9rem;' + (moi
        ? 'margin-left:auto;background:#059669;color:white;border-bottom-right-radius:0.3rem;'
        : 'margin-right:auto;background:white;color:#111827;border:1px solid #e5e7eb;border-bottom-left-radius:0.3rem;');
    bulle.textContent = texte;
    fil.appendChild(bulle);
    fil.scrollTop = fil.scrollHeight;
}

function iaHistorique() {
    var data = iaLire();
    return Array.isArray(data.messages) ? data.messages : [];
}

function iaMemoriser(role, texte) {
    var data = iaLire();
    var messages = Array.isArray(data.messages) ? data.messages : [];
    messages.push({ role: role, texte: texte, at: new Date().toISOString() });
    data.messages = messages.slice(-40);
    iaEcrire(data);
}

function iaQuestion(texte) {
    var champ = document.getElementById('iaSaisie');
    if (champ) champ.value = texte;
    iaEnvoyer();
}

function iaEnvoyer(event) {
    if (event && event.preventDefault) event.preventDefault();
    if (!iaEstJuliss()) return false;
    var champ = document.getElementById('iaSaisie');
    var texte = champ ? champ.value.trim() : '';
    if (!texte) return false;
    if (champ) champ.value = '';
    iaAjouterBulle('moi', texte);
    iaMemoriser('moi', texte);
    var reponse = iaRepondre(texte);
    iaAjouterBulle('ia', reponse);
    iaMemoriser('ia', reponse);
    return false;
}

function iaBriefing() {
    if (!iaEstJuliss()) return;
    var texte = iaBriefingTexte();
    iaAjouterBulle('ia', texte);
    iaMemoriser('ia', texte);
    var data = iaLire();
    data.briefing = iaJourCle(new Date());
    iaEcrire(data);
}

function iaOuvrir() {
    if (!iaEstJuliss()) {
        if (typeof navigateTo === 'function') navigateTo('planning');
        return;
    }
    var fil = document.getElementById('iaFil');
    if (fil && !fil.dataset.pret) {
        fil.dataset.pret = '1';
        iaHistorique().forEach(function (msg) { iaAjouterBulle(msg.role, msg.texte); });
        iaAfficherPuces();
    }
    var data = iaLire();
    if (data.briefing !== iaJourCle(new Date())) iaBriefing();
    var champ = document.getElementById('iaSaisie');
    if (champ) champ.focus();
}

function iaTexteRappel() {
    var auj = iaJourCle(new Date());
    var duJour = iaExercicesDu(auj);
    var retard = iaExercicesRetard(auj);
    if (!duJour.length && !retard.length) return '';
    var morceaux = [];
    if (duJour.length) morceaux.push(duJour.length + ' exercice' + (duJour.length > 1 ? 's' : '') + ' aujourd’hui');
    if (retard.length) morceaux.push(retard.length + ' en retard');
    var noms = duJour.concat(retard).slice(0, 3).map(function (exo) { return exo.subject || 'exercice'; });
    return iaPrenom() + ', tu as ' + morceaux.join(' et ') + (noms.length ? ' : ' + noms.join(', ') : '') + '.';
}

function iaPoserRappel() {
    var bandeau = document.getElementById('iaRappel');
    if (!iaEstJuliss()) {
        if (bandeau) {
            bandeau.hidden = true;
            bandeau.style.display = 'none';
        }
        var bouton = document.getElementById('menuAssistant');
        if (bouton) bouton.style.display = 'none';
        return;
    }
    var boutonMenu = document.getElementById('menuAssistant');
    if (boutonMenu) boutonMenu.style.display = 'flex';
    if (!bandeau) return;
    var texte = iaTexteRappel();
    var data = iaLire();
    if (!texte || data.rappelCache === iaJourCle(new Date())) {
        bandeau.hidden = true;
        bandeau.style.display = 'none';
        return;
    }
    bandeau.hidden = false;
    bandeau.style.display = 'flex';
    bandeau.innerHTML = '<button type="button" onclick="navigateTo(\'assistant\')" style="flex:1;border:none;background:transparent;color:white;text-align:left;font:inherit;font-weight:700;cursor:pointer;">' + iaEchap(texte) + ' Ouvrir l’assistant.</button><button type="button" onclick="iaCacherRappel()" style="border:none;background:transparent;color:white;font-weight:800;cursor:pointer;">✕</button>';
    if (data.toast !== iaJourCle(new Date()) && typeof v3Toast === 'function') {
        data.toast = iaJourCle(new Date());
        iaEcrire(data);
        v3Toast(texte, 'info');
    }
}

function iaCacherRappel() {
    var data = iaLire();
    data.rappelCache = iaJourCle(new Date());
    iaEcrire(data);
    var bandeau = document.getElementById('iaRappel');
    if (bandeau) {
        bandeau.hidden = true;
        bandeau.style.display = 'none';
    }
}

function iaBrancher() {
    if (iaBranche) return;
    iaBranche = true;
    if (typeof renderPlanning === 'function' && !renderPlanning.__ia) {
        var original = renderPlanning;
        var wrapped = function () {
            var resultat = original.apply(this, arguments);
            try { iaPoserRappel(); } catch (e) {}
            return resultat;
        };
        wrapped.__ia = true;
        window.renderPlanning = wrapped;
    }
    if (typeof openSideMenu === 'function' && !openSideMenu.__ia) {
        var menu = openSideMenu;
        var wrapMenu = function () {
            var resultat = menu.apply(this, arguments);
            try { iaPoserRappel(); } catch (e) {}
            return resultat;
        };
        wrapMenu.__ia = true;
        window.openSideMenu = wrapMenu;
    }
}

iaBrancher();
if (document.readyState !== 'loading') iaPoserRappel();
