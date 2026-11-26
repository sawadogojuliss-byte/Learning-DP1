/* Salons planifiés : interface séparée du minuteur immédiat.
   L'adresse du service est configurée uniquement après son déploiement. */
(function () {
    'use strict';
    var URL_SERVICE = 'https://script.google.com/macros/s/AKfycbyj9XN-o0AJa34uk7e98ZTcVNGovwWVcZSeKIitj9iOGPQmjnCCd3_hwApgJXlYAmAqjA/exec', cleEssai = 'studyPlanIB_essaiSalons', essaiActif = null;
    var endpoint = '', rafraichit = false, rafraichirEncore = false, annuaire = [], demandeId = '', signature = '', invitationsVues = {}, configCharge = null;
    function $(id) { return document.getElementById(id); }
    function el(tag, classe, texte) { var e=document.createElement(tag);if(classe)e.className=classe;if(texte!==undefined)e.textContent=texte;return e; }
    function statut(texte, erreur) { var e=$('salonsPlanifiesStatut');if(e){e.textContent=texte;e.classList.toggle('erreur',!!erreur);} }
    function idDemande() { var a=new Uint8Array(16);crypto.getRandomValues(a);return Array.prototype.map.call(a,function(x){return x.toString(16).padStart(2,'0');}).join(''); }
    function message(code) {
        return ({'auth-requise':'Connecte-toi avec Google pour utiliser les salons planifiés.', 'google-requis':'Connecte-toi avec ton compte Google.', 'classe-requise':'Choisis d’abord ton année DP1 ou DP2 dans ton profil.', 'date-invalide':'Choisis une date comprise entre 15 minutes et 30 jours à partir de maintenant.', 'fin-invalide':'Choisis une heure de fin après le début, dans une limite de 12 heures.', 'inscription-requise':'Inscris-toi dans la liste des camarades pour accepter.', 'invitation-terminee':'Cette invitation est annulée ou la séance a déjà commencé.', 'invite-indisponible':'Un camarade n’est plus disponible ou a atteint la limite d’invitations.', 'limite-quotidienne':'La limite quotidienne de salons planifiés est atteinte.', 'identifiant-utilise':'Cette demande a déjà été utilisée avec d’autres informations.'})[code] || 'Service indisponible. Vérifie ta connexion ou réessaie plus tard.';
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
        var attente=salon.role==='invite' && salon.reponse!=='accepte' && salon.reponse!=='refuse';
        haut.appendChild(el('span','salons-programme-surtexte',salon.annule?'SÉANCE ANNULÉE':salon.role==='organisateur'?'TON SALON':attente?'INVITATION':salon.reponse==='accepte'?'INVITATION ACCEPTÉE':'INVITATION REFUSÉE'));
        if(salon.role==='invite')haut.appendChild(el('strong','salons-programme-organisateur',(salon.organisateurNom || 'Un camarade')+' veut faire une séance'));
        haut.appendChild(el('strong','salons-programme-nom',salon.nom));
        haut.appendChild(el('span','salons-programme-date',dateLisible(salon.debut,salon.fuseau)+(salon.fin?' → '+dateLisible(salon.fin,salon.fuseau):'')));carte.appendChild(haut);
        if(salon.role==='invite'&&!salon.annule && salon.debut>Date.now()) {
            ['accepte','refuse'].forEach(function(reponse){
                if(salon.reponse===reponse)return;
                var bouton=el('button',reponse==='accepte'?'salons-programme-accepter':'salons-programme-annuler',reponse==='accepte'?'Accepter':'Refuser');bouton.type='button';
                bouton.addEventListener('click',async function(){
                    bouton.disabled=true;
                    try {await appeler('repondre',{id:salon.id,reponse:reponse});await actualiser();}
                    catch(e){$('salonsPlanifiesErreur').textContent=message(e.message);bouton.disabled=false;}
                });carte.appendChild(bouton);
            });
        }
        if(salon.lien && !salon.annule){var lien=el('a','salons-programme-lien','Rejoindre ↗');lien.href=salon.lien;carte.appendChild(lien);}
        else if(!salon.annule && (salon.role==='organisateur'||salon.reponse==='accepte'))carte.appendChild(el('span','salons-programme-attente',salon.role==='organisateur'?'Lien disponible 10 min avant':'Rappel et lien environ 5 min avant'));
        if(salon.role==='organisateur'&&!salon.annule && salon.debut>Date.now()) {
            var bouton=el('button','salons-programme-annuler','Annuler');bouton.type='button';bouton.addEventListener('click',async function(){
                if(!window.confirm('Annuler cette séance et fermer le salon ?'))return;
                bouton.disabled=true;try{await appeler('annuler',{id:salon.id});await actualiser();}catch(e){$('salonsPlanifiesErreur').textContent=message(e.message);bouton.disabled=false;}
            });carte.appendChild(bouton);
        }
        return carte;
    }
    function carteHistorique(salon) {
        var carte=el('article','salons-programme-histoire');
        carte.appendChild(el('span','salons-programme-histoire-icone','✦'));
        var texte=el('div','salons-programme-histoire-texte');
        texte.appendChild(el('span','salons-programme-surtexte',salon.role==='organisateur'?'ORGANISÉ PAR TOI':'SALON REJOINT'));
        texte.appendChild(el('strong','salons-programme-nom',salon.nom));
        texte.appendChild(el('span','salons-programme-date',dateLisible(salon.debut,salon.fuseau)+(salon.fin?' → '+dateLisible(salon.fin,salon.fuseau):'')));
        if(salon.role!=='organisateur')texte.appendChild(el('span','salons-programme-date','Avec '+(salon.organisateurNom || 'un camarade')));
        carte.appendChild(texte);return carte;
    }
    function onglet(nom) {
        ['avenir','histoire'].forEach(function(x){var bouton=$('salonsOnglet'+x);bouton.setAttribute('aria-selected',String(nom===x));$(x==='avenir'?'salonsPlanifiesListe':'salonsPlanifiesHistorique').hidden=nom!==x;});
    }
    function ouvrirAnnonces(ouvrir) {
        $('salonsPlanifiesBandeau').hidden=!ouvrir;$('salonsPlanifiesAnnonce').setAttribute('aria-expanded',String(ouvrir));
        if(ouvrir){$('salonsFermerAnnonces').focus();}else {$('salonsPlanifiesAnnonce').focus();}
    }
    async function noterParticipation(detail) {
        if(!detail || !/^[a-f0-9]{48}$/.test(detail.id) || !window.firebase || !firebase.auth)return;
        try {
            if(configCharge)await configCharge;if(!endpoint)return;
            var authPrincipale=firebase.auth(), principal=authPrincipale.currentUser;
            if(!principal && typeof authPrincipale.onAuthStateChanged==='function')principal=await new Promise(function(resolve){
                var termine=false, retirer=null, timer=setTimeout(function(){fin(null);},12000);
                function fin(user){if(termine)return;termine=true;clearTimeout(timer);if(retirer)retirer();resolve(user);}
                retirer=authPrincipale.onAuthStateChanged(fin,function(){fin(null);});if(termine && retirer)retirer();
            });
            var authSalon=detail.identite==='invite'?firebase.app('salon-focus-invite').auth():firebase.auth();
            var personne=authSalon.currentUser;
            if(!principal || principal.isAnonymous || !personne || personne.uid!==detail.uid)return;
            var jetonSalon=await personne.getIdToken();
            await appeler('participer',{salonId:detail.id,jetonSalon:jetonSalon});
        } catch(e) { /* La séance continue même si l'historique est indisponible. */ }
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
        if(essaiActif && Date.now()>=essaiActif.fin){endpoint='';essaiActif=null;try{sessionStorage.removeItem(cleEssai);}catch(_){}$('salonsPlanifiesAnnonce').hidden=true;$('salonsPlanifiesBandeau').hidden=true;statut('L’essai est terminé sur cet onglet.',false);return;}
        if(!endpoint)return;if(rafraichit){rafraichirEncore=true;return;}rafraichit=true;
        try {
            var data=await appeler('liste'), zone=$('salonsPlanifiesListe'), historique=$('salonsPlanifiesHistoriqueListe'), bouton=$('salonsPlanifiesAnnonce');zone.textContent='';historique.textContent='';
            var salons=data.salons.filter(function(s){return (s.fin || s.debut)>Date.now();});
            var passes=(data.historique || []).filter(function(s){return (s.fin || s.debut)<=Date.now();}).sort(function(a,b){return b.debut-a.debut;});
            var enAttente=salons.filter(function(s){return s.role==='invite' && !s.annule && s.debut>Date.now() && (!s.reponse || s.reponse==='attente');});
            var nouveau=enAttente.some(function(s){return !invitationsVues[s.id];});
            enAttente.forEach(function(s){invitationsVues[s.id]=true;});
            bouton.hidden=false; bouton.textContent='✉ Invitations'+(enAttente.length?' · '+enAttente.length:'');
            bouton.setAttribute('aria-label',enAttente.length+' invitation(s) en attente');
            $('salonsCompteAvenir').textContent=salons.length; $('salonsCompteHistoire').textContent=passes.length;
            $('salonsOngletavenir').textContent='À venir · '+salons.length;$('salonsOnglethistoire').textContent='Mon histoire · '+passes.length;
            if(nouveau){onglet('avenir');ouvrirAnnonces(true);}
            if(salons.length)salons.forEach(function(s){zone.appendChild(carteSalon(s));});
            else zone.appendChild(el('p','salons-programme-vide-clair','Rien de prévu pour le moment. Une belle séance t’attend peut-être bientôt.'));
            if(passes.length)passes.forEach(function(s){historique.appendChild(carteHistorique(s));});
            else historique.appendChild(el('p','salons-programme-vide-clair','Les salons planifiés que tu rejoins apparaîtront ici après leur fin.'));
            $('salonsEffacerHistoire').hidden=!passes.length;
            if(data.limiteAtteinte)zone.appendChild(el('p','salons-programme-attente','La liste atteint sa limite : certaines séances ne sont pas affichées.'));
            $('salonsPlanifiesErreur').textContent='';
        } catch(e) {
            if(endpoint && window.firebase && firebase.auth && firebase.auth().currentUser){$('salonsPlanifiesAnnonce').hidden=false;$('salonsPlanifiesErreur').textContent='Impossible de charger les invitations pour le moment.';}
        } finally {rafraichit=false;if(rafraichirEncore){rafraichirEncore=false;actualiser();}}
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
        event.preventDefault();var bouton=$('salonsPlanifiesValider'), nom=$('salonsPlanifiesNom').value.trim(), debut=new Date($('salonsPlanifiesDate').value).getTime(), fin=new Date($('salonsPlanifiesFin').value).getTime();
        var invites=Array.prototype.map.call(document.querySelectorAll('#salonsPlanifiesEleves input:checked'),function(e){return e.value;});
        var fuseau=Intl.DateTimeFormat().resolvedOptions().timeZone;
        if(!nom || !Number.isFinite(debut) || debut<Date.now()+15*60000 || debut>Date.now()+30*86400000) {statut('Choisis un nom et une date entre 15 minutes et 30 jours à partir de maintenant.',true);return;}
        if(!Number.isFinite(fin) || fin<=debut || fin>debut+12*3600000){statut(message('fin-invalide'),true);return;}
        if(invites.length>20){statut('Choisis au maximum 20 camarades.',true);return;}
        var contenu=JSON.stringify([nom,debut,fin,fuseau,invites]);
        if(signature!==contenu){signature=contenu;demandeId=idDemande();}
        bouton.disabled=true;statut('Enregistrement de la séance…',false);
        try {
            var resultat=await appeler('creer',{nom:nom,debut:debut,fin:fin,fuseau:fuseau,invites:invites,demandeId:demandeId});
            statut(resultat.annule ? 'Cette séance identique a déjà été annulée. Change les détails pour en créer une nouvelle.' : resultat.deja ? 'Cette séance existe déjà : aucun rappel supplémentaire n’a été créé.' : 'Séance enregistrée. Tu recevras le lien environ 10 minutes avant ; les invités qui acceptent, 5 minutes avant.',!!resultat.annule);
            $('salonsPlanifiesForm').hidden=true;$('salonsPlanifiesNom').value='';$('salonsPlanifiesDate').value='';$('salonsPlanifiesFin').value='';demandeId='';signature='';await actualiser();
        } catch(e) {statut(message(e.message)+' Si l’enregistrement n’a pas été confirmé, utilise le même formulaire pour réessayer.',true);}
        finally {bouton.disabled=false;}
    }
    function init() {
        var racine=$('salonCreer'), flamme=$('joursFlamme'), header=flamme && flamme.closest('header');if(!racine||!flamme||!header)return;
        var section=el('section','salons-planification');section.innerHTML='<button type="button" id="salonsPlanifiesOuvrir" class="salons-programme-ouvrir">✦ Planifier une séance à l’avance <span>↗</span></button><p id="salonsPlanifiesStatut" class="salons-programme-statut" role="status" aria-live="polite"></p><form id="salonsPlanifiesForm" hidden><p class="salons-programme-intro">Fonction en test : la livraison des rappels n’est pas encore garantie. Ton lien est prévu 10 minutes avant et celui des invités qui acceptent 5 minutes avant ; retrouve aussi le lien dans tes invitations.</p><label for="salonsPlanifiesNom">Nom de la séance</label><input id="salonsPlanifiesNom" type="text" maxlength="60" required placeholder="Ex. Révisions de mathématiques"><label for="salonsPlanifiesDate">Date et heure locales</label><input id="salonsPlanifiesDate" type="datetime-local" required><label for="salonsPlanifiesFin">Fin de la séance</label><input id="salonsPlanifiesFin" type="datetime-local" required><label class="salons-programme-visibilite"><input id="salonsPlanifiesVisible" type="checkbox"><span>Je souhaite apparaître dans la liste et recevoir des invitations. Mon adresse reste privée.</span></label><p class="salons-programme-liste-titre">Inviter des camarades <small>· 20 maximum</small></p><div id="salonsPlanifiesEleves" class="salons-programme-eleves"></div><p id="salonsPlanifiesLimite" hidden>La liste atteint sa limite : tous les membres ne sont pas affichés.</p><button class="salons-programme-valider" id="salonsPlanifiesValider" type="submit">Planifier ma séance ↗</button></form>';
        racine.insertAdjacentElement('afterend',section);
        var boutonAnnonce=el('button','salons-programme-notification','✉ Invitations');boutonAnnonce.type='button';boutonAnnonce.id='salonsPlanifiesAnnonce';boutonAnnonce.hidden=true;boutonAnnonce.setAttribute('aria-expanded','false');boutonAnnonce.setAttribute('aria-controls','salonsPlanifiesBandeau');flamme.insertAdjacentElement('beforebegin',boutonAnnonce);
        var bandeau=el('section','salons-programme-bandeau');bandeau.id='salonsPlanifiesBandeau';bandeau.hidden=true;bandeau.setAttribute('role','dialog');bandeau.setAttribute('aria-modal','true');bandeau.setAttribute('aria-label','Invitations et séances');bandeau.innerHTML='<div class="salons-programme-bandeau-inner"><header class="salons-annonces-hero"><div class="salons-annonces-haut"><span class="salons-annonces-marque">✦ STUDYPLAN · ENSEMBLE</span><button type="button" id="salonsFermerAnnonces" class="salons-annonces-fermer" aria-label="Fermer les invitations">✕</button></div><p class="salons-annonces-kicker">UNE PLACE POUR SE RETROUVER</p><h2>Les beaux moments<br>commencent ensemble<span>.</span></h2><p class="salons-annonces-intro">Tes invitations, tes prochaines séances et les moments partagés. Fonction en test : les rappels peuvent être retardés ou ne pas arriver.</p><div class="salons-annonces-stats"><div><strong id="salonsCompteAvenir">0</strong><span>à venir</span></div><div><strong id="salonsCompteHistoire">0</strong><span>dans ton histoire</span></div></div></header><div class="salons-annonces-contenu"><div class="salons-annonces-tabs" role="tablist" aria-label="Séances"><button type="button" id="salonsOngletavenir" role="tab" aria-selected="true" aria-controls="salonsPlanifiesListe">À venir</button><button type="button" id="salonsOnglethistoire" role="tab" aria-selected="false" aria-controls="salonsPlanifiesHistorique">Mon histoire</button></div><p id="salonsPlanifiesErreur" role="status"></p><div id="salonsPlanifiesListe" class="salons-programme-liste" role="tabpanel"></div><div id="salonsPlanifiesHistorique" role="tabpanel" hidden><p class="salons-annonces-explication">Tes salons planifiés rejoints, après leur fin. L’historique est personnel et peut être incomplet si la connexion échoue.</p><div id="salonsPlanifiesHistoriqueListe" class="salons-programme-liste"></div><button type="button" id="salonsEffacerHistoire" class="salons-effacer-histoire" hidden>Effacer mon historique</button></div></div></div>';header.insertAdjacentElement('afterend',bandeau);
        boutonAnnonce.addEventListener('click',function(){ouvrirAnnonces(bandeau.hidden);if(!bandeau.hidden)actualiser();});
        $('salonsFermerAnnonces').addEventListener('click',function(){ouvrirAnnonces(false);});
        bandeau.addEventListener('keydown',function(e){
            if(e.key==='Escape'){e.preventDefault();ouvrirAnnonces(false);return;}
            if(e.key!=='Tab')return;
            var focusables=Array.prototype.filter.call(bandeau.querySelectorAll('button:not([disabled]),a[href]'),function(x){return x.getClientRects().length>0;});
            if(!focusables.length)return;
            var premier=focusables[0], dernier=focusables[focusables.length-1];
            if(e.shiftKey && document.activeElement===premier){e.preventDefault();dernier.focus();}
            else if(!e.shiftKey && document.activeElement===dernier){e.preventDefault();premier.focus();}
        });
        $('salonsOngletavenir').addEventListener('click',function(){onglet('avenir');});$('salonsOnglethistoire').addEventListener('click',function(){onglet('histoire');});
        $('salonsEffacerHistoire').addEventListener('click',async function(){if(!window.confirm('Effacer ton historique personnel des salons planifiés ?'))return;try{await appeler('effacer-historique');await actualiser();}catch(e){$('salonsPlanifiesErreur').textContent=message(e.message);}});
        window.addEventListener('studyplan:salon-rejoint',function(e){noterParticipation(e.detail);});
        $('salonsPlanifiesOuvrir').addEventListener('click',ouvrir);$('salonsPlanifiesVisible').addEventListener('change',sauvegarderVisibilite);$('salonsPlanifiesForm').addEventListener('submit',programmer);
        configCharge=fetch('data/salons-planifies.json',{cache:'no-store'}).then(function(r){if(!r.ok)throw new Error();return r.json();}).then(function(config){
            // Aucun jeton ne peut partir vers une URL autre que celle contrôlée.
            var publicActive=config.url===URL_SERVICE, minuterie=null, uidCourant='';
            var panneauEssai=null;
            try {
                if(!publicActive && new URL(location.href).searchParams.get('essai-salons')==='1') {
                    panneauEssai=el('div','salons-essai');panneauEssai.innerHTML='<strong>Essai privé des salons planifiés</strong><p>Sur cet onglet et ce compte uniquement. Les séances et mails de test sont réels. Les élèves ne sont pas invités automatiquement.</p><button type="button" id="salonsEssaiActiver">Activer l’essai pour mon compte</button><span id="salonsEssaiStatut" role="status"></span>';
                    header.insertAdjacentElement('afterend',panneauEssai);
                }
            } catch(_) {}
            function lireEssai(user){
                try{var e=JSON.parse(sessionStorage.getItem(cleEssai)||'null');return e && user && !user.isAnonymous && e.uid===user.uid && Number.isFinite(e.fin) && e.fin>Date.now() && e.fin<=Date.now()+6*3600000 ? e : null;}catch(_){return null;}
            }
            function demarrer(user) {
                var e=publicActive?null:lireEssai(user);essaiActif=e;
                endpoint=publicActive||e?URL_SERVICE:'';
                if(endpoint){if(!minuterie)minuterie=setInterval(actualiser,60000);actualiser();}
                if(panneauEssai)$('salonsEssaiStatut').textContent=e?' Essai actif sur cet onglet.':'';
            }
            if(panneauEssai)$('salonsEssaiActiver').addEventListener('click',function(){
                var user;
                try {user=utilisateur();}catch(_){$('salonsEssaiStatut').textContent=' Connecte-toi d’abord avec Google.';return;}
                if(!window.confirm('Activer l’essai pour ton compte dans cet onglet ? Les séances créées et les éventuels rappels seront réels.'))return;
                try {sessionStorage.setItem(cleEssai,JSON.stringify({uid:user.uid,fin:Date.now()+6*3600000}));}catch(_){$('salonsEssaiStatut').textContent=' Impossible d’activer l’essai dans ce navigateur.';return;}
                demarrer(user);
            });
            if(window.firebase && firebase.auth)firebase.auth().onAuthStateChanged(function(user){
                var uid=user && user.uid || '';
                if(uidCourant!==uid){$('salonsPlanifiesListe').textContent='';$('salonsPlanifiesBandeau').hidden=true;$('salonsPlanifiesAnnonce').hidden=true;$('salonsPlanifiesAnnonce').setAttribute('aria-expanded','false');invitationsVues={};$('salonsPlanifiesEleves').textContent='';$('salonsPlanifiesForm').hidden=true;}
                uidCourant=uid;demarrer(user);
            }); else if(publicActive)demarrer(null);
        }).catch(function(){});
    }
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
