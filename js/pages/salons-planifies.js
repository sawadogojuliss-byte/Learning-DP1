/* Salons planifiés : interface séparée du minuteur immédiat.
   L'adresse du service est configurée uniquement après son déploiement. */
(function () {
    'use strict';
    var endpoint = '', charge = false, rafraichit = false, annuaire = [], demandeId = '', signature = '';
    function $(id) { return document.getElementById(id); }
    function el(tag, classe, texte) { var e=document.createElement(tag);if(classe)e.className=classe;if(texte!==undefined)e.textContent=texte;return e; }
    function statut(texte, erreur) { var e=$('salonsPlanifiesStatut');if(e){e.textContent=texte;e.classList.toggle('erreur',!!erreur);} }
    function idDemande() { var a=new Uint8Array(16);crypto.getRandomValues(a);return Array.prototype.map.call(a,function(x){return x.toString(16).padStart(2,'0');}).join(''); }
    function message(code) {
        return ({'auth-requise':'Connecte-toi avec Google pour utiliser les salons planifiés.', 'google-requis':'Connecte-toi avec ton compte Google.', 'classe-requise':'Choisis d’abord ton année DP1 ou DP2 dans ton profil.', 'date-invalide':'Choisis une date comprise entre 15 minutes et 30 jours à partir de maintenant.', 'invite-indisponible':'Un camarade n’est plus disponible ou a atteint la limite d’invitations.', 'limite-quotidienne':'La limite quotidienne de salons planifiés est atteinte.', 'identifiant-utilise':'Cette demande a déjà été utilisée avec d’autres informations.'})[code] || 'Service indisponible. Vérifie ta connexion ou réessaie plus tard.';
    }
    function utilisateur() {
        var user=window.firebase && firebase.auth && firebase.auth().currentUser;
        if(!user || user.isAnonymous || !(user.providerData||[]).some(function(p){return p.providerId==='google.com';})) throw new Error('auth-requise');
        return user;
    }
    async function appeler(action, donnees) {
        if(!endpoint)throw new Error('indisponible');
        var user=utilisateur(), token=await user.getIdToken();
        // Apps Script reçoit le jeton uniquement dans le corps, jamais dans l'URL.
        var res=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(Object.assign({actionSalons:action,jeton:token},donnees||{})),cache:'no-store',credentials:'omit',redirect:'follow',referrerPolicy:'no-referrer'});
        var data=await res.json().catch(function(){return {};});
        if(!firebase.auth().currentUser || firebase.auth().currentUser.uid!==user.uid)throw new Error('auth-requise');
        if(!res.ok || data.success!==true)throw new Error(data.error || 'indisponible');
        return data.resultat;
    }
    function dateLisible(ms, zone) { try {return new Intl.DateTimeFormat('fr-FR',{timeZone:zone,weekday:'long',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit',timeZoneName:'short'}).format(new Date(ms));} catch(e){return new Date(ms).toLocaleString('fr-FR');} }
    function carteSalon(salon) {
        var carte=el('article','salons-programme-carte');
        var haut=el('div','salons-programme-texte');
        haut.appendChild(el('span','salons-programme-surtexte',salon.annule?'SÉANCE ANNULÉE':salon.role==='organisateur'?'TON SALON':'INVITATION'));
        haut.appendChild(el('strong','salons-programme-nom',salon.nom));
        haut.appendChild(el('span','salons-programme-date',dateLisible(salon.debut,salon.fuseau)));carte.appendChild(haut);
        if(salon.lien && !salon.annule){var lien=el('a','salons-programme-lien','Rejoindre ↗');lien.href=salon.lien;carte.appendChild(lien);}
        else if(!salon.annule)carte.appendChild(el('span','salons-programme-attente',salon.role==='organisateur'?'Lien disponible 10 min avant':'Lien disponible 5 min avant'));
        if(salon.role==='organisateur'&&!salon.annule && salon.debut>Date.now()) {
            var bouton=el('button','salons-programme-annuler','Annuler');bouton.type='button';bouton.addEventListener('click',async function(){
                if(!window.confirm('Annuler cette séance et fermer le salon ?'))return;
                bouton.disabled=true;try{await appeler('annuler',{id:salon.id});await actualiser();}catch(e){statut(message(e.message),true);bouton.disabled=false;}
            });carte.appendChild(bouton);
        }
        return carte;
    }
    function afficherAnnuaire(data) {
        annuaire=data.eleves||[];var cont=$('salonsPlanifiesEleves');cont.textContent='';
        ['DP1','DP2'].forEach(function(classe){
            var groupe=annuaire.filter(function(e){return e.classe===classe;});var field=el('fieldset','salons-programme-groupe');
            field.appendChild(el('legend','',classe+' · '+groupe.length));
            if(!groupe.length)field.appendChild(el('p','salons-programme-vide','Aucun camarade inscrit pour le moment.'));
            groupe.forEach(function(membre){var label=el('label','salons-programme-personne');var check=el('input');check.type='checkbox';check.value=membre.id;check.name='salonsInvite';label.appendChild(check);label.appendChild(el('span','',membre.nom));field.appendChild(label);});cont.appendChild(field);
        });
        $('salonsPlanifiesVisible').checked=!!data.visible;
        $('salonsPlanifiesLimite').hidden=!data.limiteAtteinte;
    }
    async function actualiser() {
        if(rafraichit || !endpoint)return;rafraichit=true;
        try {
            var data=await appeler('liste'), zone=$('salonsPlanifiesListe');zone.textContent='';
            if(data.salons.length) { data.salons.forEach(function(s){zone.appendChild(carteSalon(s));});if(data.limiteAtteinte)zone.appendChild(el('p','salons-programme-attente','La liste atteint sa limite : certaines séances ne sont pas affichées.'));$('salonsPlanifiesBandeau').hidden=false; }
            else $('salonsPlanifiesBandeau').hidden=true;
        } catch(e) { if($('salonsPlanifiesBandeau'))$('salonsPlanifiesBandeau').hidden=true; }
        finally {rafraichit=false;}
    }
    async function ouvrir() {
        if(!endpoint){statut('La planification n’est pas encore activée. Les salons immédiats restent disponibles.',true);return;}
        statut('Chargement des camarades…',false);
        try {afficherAnnuaire(await appeler('membres'));statut('',false);$('salonsPlanifiesForm').hidden=false;}
        catch(e){statut(message(e.message),true);}
    }
    async function sauvegarderVisibilite(event) {
        var toggle=event.target, valeur=toggle.checked;toggle.disabled=true;
        try{await appeler('inscription',{visible:valeur});statut(valeur?'Tu apparais dans la liste et tu acceptes les invitations.':'Tu n’apparais plus dans la liste et les futurs rappels d’invitation sont désactivés.',false);await ouvrir();}
        catch(e){toggle.checked=!valeur;statut(message(e.message),true);}finally{toggle.disabled=false;}
    }
    async function programmer(event) {
        event.preventDefault();var bouton=$('salonsPlanifiesValider'), nom=$('salonsPlanifiesNom').value.trim(), debut=new Date($('salonsPlanifiesDate').value).getTime();
        var invites=Array.prototype.map.call(document.querySelectorAll('#salonsPlanifiesEleves input:checked'),function(e){return e.value;});
        var fuseau=Intl.DateTimeFormat().resolvedOptions().timeZone;
        if(!nom || !Number.isFinite(debut) || debut<Date.now()+15*60000 || debut>Date.now()+30*86400000) {statut('Choisis un nom et une date entre 15 minutes et 30 jours à partir de maintenant.',true);return;}
        if(invites.length>20){statut('Choisis au maximum 20 camarades.',true);return;}
        var contenu=JSON.stringify([nom,debut,fuseau,invites]);
        if(signature!==contenu){signature=contenu;demandeId=idDemande();}
        bouton.disabled=true;statut('Enregistrement de la séance…',false);
        try {
            var resultat=await appeler('creer',{nom:nom,debut:debut,fuseau:fuseau,invites:invites,demandeId:demandeId});
            statut(resultat.annule ? 'Cette séance identique a déjà été annulée. Change les détails pour en créer une nouvelle.' : resultat.deja ? 'Cette séance existe déjà : aucun rappel supplémentaire n’a été créé.' : 'Séance enregistrée. Tu recevras le lien environ 10 minutes avant ; tes invités, 5 minutes avant.',!!resultat.annule);
            $('salonsPlanifiesForm').hidden=true;$('salonsPlanifiesNom').value='';$('salonsPlanifiesDate').value='';demandeId='';signature='';await actualiser();
        } catch(e) {statut(message(e.message)+' Si l’enregistrement n’a pas été confirmé, utilise le même formulaire pour réessayer.',true);}
        finally {bouton.disabled=false;}
    }
    function init() {
        var racine=$('salonCreer'), rappel=$('iaRappel');if(!racine||!rappel)return;
        var section=el('section','salons-planification');section.innerHTML='<button type="button" id="salonsPlanifiesOuvrir" class="salons-programme-ouvrir">✦ Planifier une séance à l’avance <span>↗</span></button><p id="salonsPlanifiesStatut" class="salons-programme-statut" role="status" aria-live="polite"></p><form id="salonsPlanifiesForm" hidden><p class="salons-programme-intro">Un rendez-vous pour avancer ensemble. Ton lien arrive 10 minutes avant et celui de tes invités 5 minutes avant. Un léger retard est possible.</p><label for="salonsPlanifiesNom">Nom de la séance</label><input id="salonsPlanifiesNom" type="text" maxlength="60" required placeholder="Ex. Révisions de mathématiques"><label for="salonsPlanifiesDate">Date et heure locales</label><input id="salonsPlanifiesDate" type="datetime-local" required><label class="salons-programme-visibilite"><input id="salonsPlanifiesVisible" type="checkbox"><span>Je souhaite apparaître dans la liste et recevoir des invitations. Mon adresse reste privée.</span></label><p class="salons-programme-liste-titre">Inviter des camarades <small>· 20 maximum</small></p><div id="salonsPlanifiesEleves" class="salons-programme-eleves"></div><p id="salonsPlanifiesLimite" hidden>La liste atteint sa limite : tous les membres ne sont pas affichés.</p><button class="salons-programme-valider" id="salonsPlanifiesValider" type="submit">Planifier ma séance ↗</button></form>';
        racine.insertAdjacentElement('afterend',section);
        var bandeau=el('section','salons-programme-bandeau');bandeau.id='salonsPlanifiesBandeau';bandeau.hidden=true;bandeau.innerHTML='<div class="salons-programme-bandeau-inner"><p class="salons-programme-surtexte">ENSEMBLE, À VOTRE RYTHME</p><h2>Vos prochaines séances</h2><div id="salonsPlanifiesListe" class="salons-programme-liste"></div></div>';rappel.insertAdjacentElement('afterend',bandeau);
        $('salonsPlanifiesOuvrir').addEventListener('click',ouvrir);$('salonsPlanifiesVisible').addEventListener('change',sauvegarderVisibilite);$('salonsPlanifiesForm').addEventListener('submit',programmer);
        fetch('data/salons-planifies.json',{cache:'no-store'}).then(function(r){if(!r.ok)throw new Error();return r.json();}).then(function(config){
            // Ne jamais envoyer un jeton Google à une adresse arbitraire.
            if(config.url==='https://script.google.com/macros/s/AKfycbyj9XN-o0AJa34uk7e98ZTcVNGovwWVcZSeKIitj9iOGPQmjnCCd3_hwApgJXlYAmAqjA/exec')endpoint=config.url;
            if(endpoint){actualiser();setInterval(actualiser,60000);if(window.firebase && firebase.auth)firebase.auth().onAuthStateChanged(function(){
                $('salonsPlanifiesListe').textContent='';$('salonsPlanifiesBandeau').hidden=true;
                $('salonsPlanifiesEleves').textContent='';$('salonsPlanifiesForm').hidden=true;
                actualiser();
            });}
        }).catch(function(){});
    }
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
