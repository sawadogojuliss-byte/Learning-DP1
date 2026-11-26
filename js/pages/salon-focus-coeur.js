/* Logique pure du Salon focus. Aucun accès réseau, DOM ou stockage ici.
   Les dates sont des millisecondes dans le référentiel de l'horloge du serveur.
   Le transport doit faire respecter l'autorité du propriétaire côté serveur. */
(function (root) {
    'use strict';
    var modes = ['focus', 'short', 'long'];
    var options = ['theme', 'minuteur', 'horloge', 'sons', 'musique', 'citations'];
    function texte(value, maximum) {
        return String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, maximum);
    }
    function nombre(n, min, max, defaut) {
        n = Number(n);
        return isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : defaut;
    }
    function temps(t, maintenant) {
        if (!t || modes.indexOf(t.mode) < 0) throw new Error('Minuteur invalide');
        var total = nombre(t.total, 1, 10800, 1500);
        var restant = nombre(t.restant, 0, total, total);
        var fin = nombre(t.fin, 0, 8640000000000000, 0);
        if (t.running === true && fin) restant = Math.max(0, Math.min(total, Math.ceil((fin - maintenant) / 1000)));
        var running = t.running === true && fin > 0 && restant > 0;
        return { mode: t.mode, total: total, restant: restant, running: running, fin: running ? fin : 0 };
    }
    function commande(chrono, action, maintenant, durees) {
        var c = temps(chrono, maintenant);
        if (action === 'pause') { c.running = false; c.fin = 0; }
        else if (action === 'demarrer') {
            if (!c.restant) c.restant = c.total;
            c.running = true; c.fin = maintenant + c.restant * 1000;
        } else if (action === 'reinitialiser') { c.running = false; c.fin = 0; c.restant = c.total; }
        else if (modes.indexOf(action) !== -1) {
            var minutes = durees && durees[action];
            var max = action === 'focus' ? 180 : 60;
            c.mode = action; c.total = nombre(minutes, 1, max, action === 'focus' ? 25 : action === 'short' ? 5 : 15) * 60;
            c.restant = c.total; c.running = false; c.fin = 0;
        } else throw new Error('Commande inconnue');
        return c;
    }
    function autorisations(choix) {
        var r = {}; options.forEach(function (k) { r[k] = !!(choix && choix[k] === true); }); return r;
    }
    function contenus(choix, source) {
        var selection = autorisations(choix); source = source || {};
        var r = {};
        if (selection.theme) r.theme = texte(source.theme, 80);
        if (selection.minuteur) {
            var d = source.durees || {};
            r.durees = { focus: nombre(d.focus,1,180,25), short: nombre(d.short,1,60,5), long: nombre(d.long,1,60,15) };
            if (d.seances !== undefined) r.durees.seances = nombre(d.seances,1,12,4);
        }
        if (selection.horloge) r.horloge = { police: texte(source.horloge && source.horloge.police, 40), taille: texte(source.horloge && source.horloge.taille, 40) };
        function ids(liste) {
            if (!Array.isArray(liste)) return [];
            return liste.slice(0, 20).map(function (id) { return texte(id, 40); }).filter(function (id, i, all) { return id && all.indexOf(id) === i; });
        }
        if (selection.sons) r.sons = ids(source.sons);
        if (selection.musique) r.musique = { nom: texte(source.musique && source.musique.nom,40), sons: ids(source.musique && source.musique.sons) };
        if (selection.citations) r.citation = { visible: !!(source.citation && source.citation.visible), texte: texte(source.citation && source.citation.texte, 160) };
        return r;
    }
    // Le futur transport doit créer un identifiant différent pour chaque salon,
    // sans repli prévisible si la source cryptographique est indisponible.
    function nouvelIdentifiant(source) {
        if (!source || typeof source.getRandomValues !== 'function') throw new Error('Aléa cryptographique indisponible');
        var octets = new Uint8Array(24); source.getRandomValues(octets);
        return Array.prototype.map.call(octets, function(b) { return b.toString(16).padStart(2,'0'); }).join('');
    }
    function lienInvitation(base, id) {
        if (!/^[0-9a-f]{48}$/.test(id)) throw new Error('Identifiant de salon invalide');
        var url = new URL(base);
        if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('Adresse du site invalide');
        url.search = ''; url.hash = 'salon=' + id;
        return url.href;
    }
    var api = { modes: modes.slice(), options: options.slice(), texte: texte, autorisations: autorisations, contenus: contenus, temps: temps, commande: commande, nouvelIdentifiant: nouvelIdentifiant, lienInvitation: lienInvitation };
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.SalonFocusCoeur = api;
})(typeof window === 'undefined' ? globalThis : window);
