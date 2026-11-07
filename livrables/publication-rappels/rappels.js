/* Rappels locaux : une occurrence du planning, sur cet appareil. Un onglet
   Studyplan doit rester ouvert : une page web ne peut pas garantir une alarme
   lorsque le navigateur est fermé. Aucun envoi de données à un serveur. */
(function () {
    'use strict';
    var CLE = 'studyPlanIB_rappelsActivites_v1';
    var timer;
    var enCours = false;
    function proprietaire() { return window.compteSession && window.compteSession.sub ? String(window.compteSession.sub) : 'invite'; }
    function lire() {
        try { var data = JSON.parse(localStorage.getItem(CLE) || '[]'); return Array.isArray(data) ? data : []; }
        catch (e) { return []; }
    }
    function ecrire(data) { localStorage.setItem(CLE, JSON.stringify(data)); }
    function cle(r) { return JSON.stringify([r.owner, r.date, r.day, String(r.id)]); }
    function dateHeure(date, heure) {
        if (!/^\d{4}-\d\d-\d\d$/.test(date) || !/^\d\d:\d\d$/.test(heure)) return null;
        var d = date.split('-').map(Number), h = heure.split(':').map(Number);
        var valeur = new Date(d[0], d[1]-1, d[2], h[0], h[1], 0, 0);
        if (valeur.getFullYear() !== d[0] || valeur.getMonth() !== d[1]-1 || valeur.getDate() !== d[2] || valeur.getHours() !== h[0] || valeur.getMinutes() !== h[1]) return null;
        return valeur;
    }
    function evenement(r) {
        try {
            var date = dateHeure(r.date, '12:00');
            if (!date || typeof generateDayEvents !== 'function') return null;
            return generateDayEvents(r.day, date).find(function (ev) { return ev && String(ev.id) === String(r.id); }) || null;
        } catch (e) { return null; }
    }
    function actif() {
        if (!window.editingEvent && typeof editingEvent === 'undefined') return null;
        var ev = typeof editingEvent !== 'undefined' ? editingEvent : null;
        if (!ev || typeof planningDateSelectionnee !== 'function') return null;
        return {owner:proprietaire(), date:planningCleDate(planningDateSelectionnee(selectedDay)), day:selectedDay, id:String(ev.id)};
    }
    function message(texte) { var el = document.getElementById('rappelActiviteMessage'); if (el) el.textContent = texte; }
    function peindre() {
        var b = document.getElementById('rappelActiviteBouton');
        if (!b) return;
        var r = actif(), existant = r && lire().some(function (a) { return cle(a) === cle(r) && !a.envoye; });
        b.setAttribute('aria-pressed', existant ? 'true' : 'false');
        b.textContent = existant ? '🔔 Rappel activé — désactiver' : '🔔 Me rappeler 5 minutes avant';
        if (existant && (!('Notification' in window) || Notification.permission !== 'granted'))
            message('Rappel sauvegardé, mais les notifications sont bloquées dans ce navigateur. Autorise-les dans ses réglages.');
        else message(existant ? 'Rappel activé pour cette date sur cet appareil. Garde Studyplan ouvert.' : 'Pour cette date, sur cet appareil. Garde Studyplan ouvert pour recevoir le rappel.');
    }
    function installerUI() {
        var bouton = document.getElementById('editSaveButton');
        if (!bouton || document.getElementById('rappelActiviteBouton')) return;
        var bloc = document.createElement('div'); bloc.className = 'rappel-activite';
        var b = document.createElement('button'); b.type = 'button'; b.id = 'rappelActiviteBouton';
        var p = document.createElement('p'); p.id = 'rappelActiviteMessage'; p.setAttribute('role','status');
        bloc.appendChild(b); bloc.appendChild(p); bouton.parentElement.insertBefore(bloc, bouton);
        b.addEventListener('click', basculer);
    }
    async function basculer() {
        var r = actif(); if (!r) return;
        var liste = lire(); var k = cle(r);
        if (liste.some(function (a) { return cle(a) === k && !a.envoye; })) {
            try { ecrire(liste.filter(function (a) { return cle(a) !== k; })); }
            catch (e) { message('Impossible de sauvegarder ce changement sur cet appareil.'); return; }
            peindre(); relancer(); return;
        }
        var ev = typeof editingEvent !== 'undefined' ? editingEvent : null;
        if (!ev || document.getElementById('editEventTitle').value.trim() !== String(ev.title).trim() || document.getElementById('editEventStart').value !== ev.startTime || document.getElementById('editEventEnd').value !== ev.endTime) {
            message('Enregistre d’abord tes modifications, puis active le rappel.'); return;
        }
        var heure = dateHeure(r.date, ev.startTime);
        if (!heure || heure.getTime()-300000 <= Date.now()) { message('Il est trop tard pour rappeler cette activité 5 minutes avant.'); return; }
        if (!('Notification' in window) || !window.isSecureContext) { message('Les notifications ne sont pas disponibles dans ce navigateur.'); return; }
        var permission = Notification.permission;
        if (permission === 'default') {
            try { permission = await Notification.requestPermission(); }
            catch (e) { message('Impossible de demander l’autorisation de notification.'); return; }
        }
        if (permission !== 'granted') { message('Autorise les notifications de Studyplan dans les réglages du navigateur pour activer le rappel.'); return; }
        // L'utilisateur peut avoir fermé la fenêtre pendant la demande d'autorisation.
        var actuel = actif();
        if (!actuel || cle(actuel) !== k || proprietaire() !== r.owner) return;
        r.title = ev.title; r.startTime = ev.startTime; r.envoye = false;
        try { ecrire(lire().filter(function (a) { return cle(a) !== k; }).concat([r])); }
        catch (e) { message('Impossible d’enregistrer le rappel sur cet appareil.'); return; }
        peindre(); relancer();
    }
    async function notifier(r, ev, heure) {
        var options = { body: ev.title + ' commence à ' + ev.startTime + '.', icon: new URL('images/logo.png', document.baseURI).href,
            tag: 'studyplan-rappel-' + r.date + '-' + r.day + '-' + r.id, data: {url: new URL('./', document.baseURI).href} };
        var reg = null;
        try { if ('serviceWorker' in navigator) reg = await navigator.serviceWorker.getRegistration(); } catch (e) {}
        if (reg && typeof reg.showNotification === 'function') {
            try { await reg.showNotification('Studyplan — activité à venir', options); return true; } catch (e) {}
        }
        try { new Notification('Studyplan — activité à venir', options); return true; }
        catch (e) { return false; }
    }
    async function envoyer(r) {
        var lockName = 'studyplan-rappel-' + cle(r);
        var action = async function () {
            var liste = lire(), courant = liste.find(function (a) { return cle(a) === cle(r) && !a.envoye; });
            if (!courant || proprietaire() !== courant.owner || Notification.permission !== 'granted') return;
            var ev = evenement(courant), heure = ev && dateHeure(courant.date, ev.startTime), maintenant = Date.now();
            if (!heure || maintenant < heure.getTime()-300000 || maintenant >= heure.getTime()) return;
            if (await notifier(courant, ev, heure)) {
                // Verrou inter-onglets : le statut est écrit avant la libération.
                liste = lire();
                var cible = liste.find(function (a) { return cle(a) === cle(courant) && !a.envoye; });
                if (cible) { cible.envoye = true; cible.envoyeAt = maintenant; try { ecrire(liste); } catch (e) {} }
            }
        };
        if (navigator.locks && navigator.locks.request) await navigator.locks.request(lockName, action);
        else await action();
    }
    async function verifier() {
        clearTimeout(timer);
        if (enCours) return;
        enCours = true;
        var delai = 30000;
        try {
            var maintenant = Date.now(), owner = proprietaire();
            var liste = lire();
            // Nettoyage différé sans effacer les rappels d'autres profils actifs.
            var propre = liste.filter(function (r) { var d = dateHeure(r.date, '23:59'); return d && d.getTime() > maintenant - 172800000; });
            if (propre.length !== liste.length) { try { ecrire(propre); } catch (e) {} }
            for (var i = 0; i < propre.length; i++) {
                var r = propre[i];
                if (r.owner !== owner || r.envoye) continue;
                var ev = evenement(r), h = ev && dateHeure(r.date, ev.startTime);
                if (!h) continue; // Une activité supprimée ne doit pas créer une fausse alerte.
                var avant = h.getTime() - 300000 - maintenant;
                if (avant <= 0 && maintenant < h.getTime() && 'Notification' in window && Notification.permission === 'granted') await envoyer(r);
                else if (avant > 0) delai = Math.min(delai, Math.max(100, avant));
            }
        } finally { enCours = false; timer = setTimeout(verifier, delai); }
    }
    function relancer() { clearTimeout(timer); if (!enCours) verifier(); }
    var ouvrirOriginal = window.openEditModal;
    if (typeof ouvrirOriginal === 'function') window.openEditModal = function () {
        var resultat = ouvrirOriginal.apply(this, arguments);
        if (typeof editingEvent !== 'undefined' && editingEvent) { installerUI(); peindre(); }
        return resultat;
    };
    window.addEventListener('storage', function (event) { if (event.key === CLE) { peindre(); relancer(); } });
    window.addEventListener('focus', relancer);
    window.addEventListener('online', relancer);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) relancer(); });
    setTimeout(relancer, 2500);
})();
