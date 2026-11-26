/* Salons planifiés : interface séparée du minuteur immédiat.
   L'adresse du service est configurée uniquement après son déploiement. */
(function () {
    'use strict';
    var URL_SERVICE = 'https://script.google.com/macros/s/AKfycbyj9XN-o0AJa34uk7e98ZTcVNGovwWVcZSeKIitj9iOGPQmjnCCd3_hwApgJXlYAmAqjA/exec', cleEssai = 'studyPlanIB_essaiSalons', essaiActif = null;
    var endpoint = '', rafraichit = false, rafraichirEncore = false, annuaire = [], demandeId = '', signature = '', invitationsVues = Object.create(null), demandesEnAttente = [], compteNotifications = '', configCharge = null, chargerConfiguration = null, generationCompte = 0;
    function $(id) { return document.getElementById(id); }
    function el(tag, classe, texte) { var e=document.createElement(tag);if(classe)e.className=classe;if(texte!==undefined)e.textContent=texte;return e; }
    function statut(texte, erreur) { var e=$('salonsPlanifiesStatut');if(e){e.textContent=texte;e.classList.toggle('erreur',!!erreur);} }
    function idDemande() { var a=new Uint8Array(16);crypto.getRandomValues(a);return Array.prototype.map.call(a,function(x){return x.toString(16).padStart(2,'0');}).join(''); }
    function message(code) {
        return ({'auth-requise':'Connecte-toi avec Google pour utiliser les salons planifiés.', 'google-requis':'Connecte-toi avec ton compte Google.', 'classe-requise':'Choisis d’abord ton année DP1 ou DP2 dans ton profil.', 'date-invalide':'Choisis une date comprise entre 15 minutes et 30 jours à partir de maintenant.', 'fin-invalide':'Choisis une heure de fin après le début, dans une limite de 12 heures.', 'inscription-requise':'Inscris-toi dans la liste des camarades pour accepter.', 'invitation-terminee':'Cette demande est annulée ou la séance a déjà commencé.', 'invite-indisponible':'Un camarade n’est plus disponible ou a atteint la limite de demandes.', 'annuaire-indisponible':'Impossible de charger l’annuaire. Réessaie plus tard.', 'annuaire-limite':'L’annuaire est trop volumineux pour être chargé.', 'limite-quotidienne':'La limite quotidienne de salons planifiés est atteinte.', 'identifiant-utilise':'Cette demande a déjà été utilisée avec d’autres informations.'})[code] || 'Service indisponible. Vérifie ta connexion ou réessaie plus tard.';
    }
    function utilisateur() {
        var user=window.firebase && firebase.auth && firebase.auth().currentUser;
        if(!user || user.isAnonymous || !(user.providerData||[]).some(function(p){return p.providerId==='google.com';})) throw new Error('auth-requise');
        return user;
    }
    async function appeler(action, donnees) {
        if(!endpoint)throw new Error('indisponible');
        var user=utilisateur(), generation=generationCompte, token=await user.getIdToken();
        if(generation!==generationCompte || firebase.auth().currentUser!==user)throw new Error('compte-change');
        // Apps Script reçoit le jeton uniquement dans le corps, jamais dans l'URL.
        var res=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(Object.assign({actionSalons:action,jeton:token},donnees||{})),cache:'no-store',credentials:'omit',redirect:'follow',referrerPolicy:'no-referrer'});
        var data=await res.json().catch(function(){return {};});
        if(generation!==generationCompte || firebase.auth().currentUser!==user)throw new Error('compte-change');
        if(!res.ok || data.success!==true)throw new Error(data.error || 'indisponible');
        return data.resultat;
    }
    function dateLisible(ms, zone) { try {return new Intl.DateTimeFormat('fr-FR',{timeZone:zone,weekday:'long',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit',timeZoneName:'short'}).format(new Date(ms));} catch(e){return new Date(ms).toLocaleString('fr-FR');} }
    function carteSalon(salon) {
        var carte=el('article','salons-programme-carte');
        var haut=el('div','salons-programme-texte');
        var attente=salon.role==='invite' && salon.reponse!=='accepte' && salon.reponse!=='refuse';
        haut.appendChild(el('span','salons-programme-surtexte',salon.annule?'SÉANCE ANNULÉE':salon.role==='organisateur'?'TON SALON':attente?'DEMANDE':salon.reponse==='accepte'?'DEMANDE ACCEPTÉE':'DEMANDE REFUSÉE'));
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
    // Les demandes vues sont propres au compte et au navigateur. L'ouverture
    // de la liste marque les demandes affichées comme lues, sans les accepter.
    function cleNotifications() {return compteNotifications ? 'studyPlanIB_seances_vues_v1_'+encodeURIComponent(compteNotifications) : '';}
    function lireVues() {
        var vues=Object.create(null);
        try {
            var valeurs=JSON.parse(localStorage.getItem(cleNotifications()) || '[]');
            if(Array.isArray(valeurs))valeurs.slice(-500).forEach(function(id){if(typeof id==='string' && id.length<=128)vues[id]=true;});
        } catch(_) {}
        return vues;
    }
    function majNotification() {
        var bouton=$('salonsPlanifiesAnnonce'), badge=$('salonsPlanifiesBadge');if(!bouton || !badge)return;
        var nombre=demandesEnAttente.filter(function(s){return !invitationsVues[s.id];}).length;
        badge.hidden=!nombre;badge.textContent=nombre>99?'99+':String(nombre);
        bouton.setAttribute('aria-label',nombre ? 'Séances : '+nombre+' demande'+(nombre>1?'s':'')+' non lue'+(nombre>1?'s':'') : 'Séances : aucune demande non lue');
    }
    function marquerVues() {
        demandesEnAttente.forEach(function(s){invitationsVues[s.id]=true;});
        try {if(cleNotifications())localStorage.setItem(cleNotifications(),JSON.stringify(Object.keys(invitationsVues).slice(-500)));}catch(_){}
        majNotification();
    }
    function ouvrirAnnonces(ouvrir) {
        $('salonsPlanifiesBandeau').hidden=!ouvrir;$('salonsPlanifiesAnnonce').setAttribute('aria-expanded',String(ouvrir));
        if(ouvrir){onglet('avenir');marquerVues();$('salonsFermerAnnonces').focus();}else {$('salonsPlanifiesAnnonce').focus();}
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
    function initiales(nom) {
        return String(nom || '').trim().split(/\s+/).filter(Boolean).slice(0,2).map(function(mot){return Array.from(mot)[0] || '';}).join('').toLocaleUpperCase('fr') || '✦';
    }
    function majSelection() {
        var n=document.querySelectorAll('#salonsPlanifiesEleves input[name=salonsInvite]:checked').length;
        $('salonsPlanifiesSelection').textContent=n+' / 20 sélectionné'+(n>1?'s':'');
    }
    function afficherAnnuaire(data) {
        annuaire=data.eleves||[];var cont=$('salonsPlanifiesEleves');cont.textContent='';
        ['DP1','DP2'].forEach(function(classe){
            var groupe=annuaire.filter(function(e){return e.classe===classe;});var field=el('fieldset','salons-programme-groupe');
            var legend=el('legend','salons-programme-classe',classe);field.appendChild(legend);
            var entete=el('div','salons-programme-groupe-entete');
            entete.appendChild(el('span','salons-programme-groupe-titre','La promo '+classe));
            entete.appendChild(el('span','salons-programme-groupe-compte',groupe.length+' '+(groupe.length>1?'élèves':'élève')));field.appendChild(entete);
            if(!groupe.length){
                var vide=el('div','salons-programme-vide');vide.appendChild(el('span','salons-programme-vide-icone','✦'));vide.appendChild(el('span','','Pas encore de camarades à afficher.'));field.appendChild(vide);
            }
            groupe.forEach(function(membre){
                var label=el('label','salons-programme-personne');
                var check=el('input','salons-programme-personne-check');check.type='checkbox';check.value=membre.id;check.name='salonsInvite';
                var avatar=el('span','salons-programme-avatar',initiales(membre.nom));avatar.setAttribute('aria-hidden','true');
                var detail=el('span','salons-programme-personne-detail');detail.appendChild(el('strong','salons-programme-personne-nom',membre.nom));detail.appendChild(el('span','salons-programme-personne-promo',classe+' · Studyplan'));
                label.appendChild(check);label.appendChild(avatar);label.appendChild(detail);
                check.addEventListener('change',function(){label.classList.toggle('selectionnee',check.checked);majSelection();});field.appendChild(label);
            });cont.appendChild(field);
        });
        majSelection();
        $('salonsPlanifiesVisible').checked=!!data.visible;
        $('salonsPlanifiesVisible').closest('label').hidden=!!data.annuaireAutomatique;
        $('salonsPlanifiesAnnuaireInfo').hidden=!data.annuaireAutomatique;
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
            demandesEnAttente=enAttente;
            bouton.hidden=false;
            if(!$('salonsPlanifiesBandeau').hidden && !$('salonsPlanifiesListe').hidden)marquerVues();else majNotification();
            $('salonsCompteAvenir').textContent=salons.length; $('salonsCompteHistoire').textContent=passes.length;
            $('salonsOngletavenir').textContent='Séances de pomodoro · '+salons.length;$('salonsOnglethistoire').textContent='Mon historique · '+passes.length;
            if(salons.length)salons.forEach(function(s){zone.appendChild(carteSalon(s));});
            else zone.appendChild(el('p','salons-programme-vide-clair','Rien de prévu pour le moment. Une belle séance t’attend peut-être bientôt.'));
            if(passes.length)passes.forEach(function(s){historique.appendChild(carteHistorique(s));});
            else historique.appendChild(el('p','salons-programme-vide-clair','Les salons planifiés que tu rejoins apparaîtront ici après leur fin.'));
            $('salonsEffacerHistoire').hidden=!passes.length;
            if(data.limiteAtteinte)zone.appendChild(el('p','salons-programme-attente','La liste atteint sa limite : certaines séances ne sont pas affichées.'));
            $('salonsPlanifiesErreur').textContent='';
        } catch(e) {
            if(e.message!=='compte-change' && endpoint && window.firebase && firebase.auth && firebase.auth().currentUser){$('salonsPlanifiesAnnonce').hidden=false;$('salonsPlanifiesErreur').textContent='Impossible de charger les séances pour le moment.';}
        } finally {rafraichit=false;if(rafraichirEncore){rafraichirEncore=false;actualiser();}}
    }
    async function ouvrir() {
        statut('Connexion au service de planification…',false);
        if(!chargerConfiguration || !await chargerConfiguration()) {statut('Impossible de vérifier le service. Vérifie ta connexion puis réessaie.',true);return;}
        if(!endpoint){statut('La planification n’est pas disponible sur cet onglet. Les salons immédiats restent disponibles.',true);return;}
        statut('Préparation de la séance…',false);
        try {afficherAnnuaire(await appeler('membres'));statut('',false);$('salonsPlanifiesForm').hidden=false;}
        catch(e){if(e.message!=='compte-change')statut(message(e.message),true);}
    }
    async function sauvegarderVisibilite(event) {
        var toggle=event.target, valeur=toggle.checked;toggle.disabled=true;
        try{await appeler('inscription',{visible:valeur});statut(valeur?'Tu apparais dans la liste et tu acceptes les demandes de séance.':'Tu n’apparais plus dans la liste et les futurs rappels de séance sont désactivés.',false);await ouvrir();}
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
        var racine=$('salonCreer'), flamme=$('joursFlamme'), header=flamme && flamme.closest('header');if(!racine||!flamme||!header||$('salonsPlanifiesOuvrir'))return;
        var section=el('section','salons-planification');section.innerHTML='<button type="button" id="salonsPlanifiesOuvrir" class="salons-programme-ouvrir">✦ Planifier une séance à l’avance <span>↗</span></button><p id="salonsPlanifiesStatut" class="salons-programme-statut" role="status" aria-live="polite"></p><form id="salonsPlanifiesForm" hidden><p class="salons-programme-intro">Fonction en test : la livraison des rappels n’est pas encore garantie. Ton lien est prévu 10 minutes avant et celui des invités qui acceptent 5 minutes avant ; retrouve aussi le lien dans tes séances.</p><label for="salonsPlanifiesNom">Nom de la séance</label><input id="salonsPlanifiesNom" type="text" maxlength="60" required placeholder="Ex. Révisions de mathématiques"><label for="salonsPlanifiesDate">Date et heure locales</label><input id="salonsPlanifiesDate" type="datetime-local" required><label for="salonsPlanifiesFin">Fin de la séance</label><input id="salonsPlanifiesFin" type="datetime-local" required><label class="salons-programme-visibilite"><input id="salonsPlanifiesVisible" type="checkbox"><span>Je souhaite apparaître dans la liste et recevoir des demandes de séance. Mon adresse reste privée.</span></label><p id="salonsPlanifiesAnnuaireInfo" class="salons-programme-intro" hidden>Les noms et classes DP1 et DP2 des élèves dont le mail est enregistré sont visibles dans cette liste. Les adresses restent privées.</p><div class="salons-programme-liste-en-tete"><div><span class="salons-programme-surtitre">BIEN MIEUX ENSEMBLE</span><p class="salons-programme-liste-titre">Choisis tes camarades</p></div><span id="salonsPlanifiesSelection" class="salons-programme-selection" aria-live="polite">0 / 20 sélectionné</span></div><p class="salons-programme-liste-aide">Compose ton équipe pour cette séance · 20 personnes maximum</p><div id="salonsPlanifiesEleves" class="salons-programme-eleves"></div><p id="salonsPlanifiesLimite" hidden>La liste atteint sa limite : tous les membres ne sont pas affichés.</p><button class="salons-programme-valider" id="salonsPlanifiesValider" type="submit">Planifier ma séance ↗</button></form>';
        racine.insertAdjacentElement('afterend',section);
        var boutonAnnonce=el('button','salons-programme-notification');boutonAnnonce.type='button';boutonAnnonce.id='salonsPlanifiesAnnonce';boutonAnnonce.hidden=true;boutonAnnonce.setAttribute('aria-label','Séances : aucune demande non lue');boutonAnnonce.setAttribute('aria-expanded','false');boutonAnnonce.setAttribute('aria-controls','salonsPlanifiesBandeau');boutonAnnonce.innerHTML='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3" stroke="currentColor" stroke-width="1.8"/><path d="m4.5 7 6.1 4.6a2.3 2.3 0 0 0 2.8 0L19.5 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg><span id="salonsPlanifiesBadge" class="salons-programme-badge" aria-hidden="true" hidden></span>';flamme.insertAdjacentElement('beforebegin',boutonAnnonce);
        var bandeau=el('section','salons-programme-bandeau');bandeau.id='salonsPlanifiesBandeau';bandeau.hidden=true;bandeau.setAttribute('role','dialog');bandeau.setAttribute('aria-modal','true');bandeau.setAttribute('aria-label','Séances');bandeau.innerHTML='<div class="salons-programme-bandeau-inner"><header class="salons-annonces-hero"><div class="salons-annonces-haut"><span class="salons-annonces-marque">✦ STUDYPLAN · ENSEMBLE</span><button type="button" id="salonsFermerAnnonces" class="salons-annonces-fermer" aria-label="Fermer les séances">✕</button></div><p class="salons-annonces-kicker">UNE PLACE POUR SE RETROUVER</p><h2>Les beaux moments<br>commencent ensemble<span>.</span></h2><p class="salons-annonces-intro">Tes demandes, tes prochaines séances et les moments partagés. Fonction en test : les rappels peuvent être retardés ou ne pas arriver.</p><div class="salons-annonces-stats"><div><strong id="salonsCompteAvenir">0</strong><span>à venir</span></div><div><strong id="salonsCompteHistoire">0</strong><span>dans ton histoire</span></div></div></header><div class="salons-annonces-contenu"><div class="salons-annonces-tabs" role="tablist" aria-label="Séances"><button type="button" id="salonsOngletavenir" role="tab" aria-selected="true" aria-controls="salonsPlanifiesListe">Séances de pomodoro</button><button type="button" id="salonsOnglethistoire" role="tab" aria-selected="false" aria-controls="salonsPlanifiesHistorique">Mon historique</button></div><p id="salonsPlanifiesErreur" role="status"></p><div id="salonsPlanifiesListe" class="salons-programme-liste" role="tabpanel"></div><div id="salonsPlanifiesHistorique" role="tabpanel" hidden><p class="salons-annonces-explication">Tes salons planifiés rejoints, après leur fin. L’historique est personnel et peut être incomplet si la connexion échoue.</p><div id="salonsPlanifiesHistoriqueListe" class="salons-programme-liste"></div><button type="button" id="salonsEffacerHistoire" class="salons-effacer-histoire" hidden>Effacer mon historique</button></div></div></div>';header.insertAdjacentElement('afterend',bandeau);
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
        $('salonsOngletavenir').addEventListener('click',function(){onglet('avenir');marquerVues();});$('salonsOnglethistoire').addEventListener('click',function(){onglet('histoire');});
        $('salonsEffacerHistoire').addEventListener('click',async function(){if(!window.confirm('Effacer ton historique personnel des salons planifiés ?'))return;try{await appeler('effacer-historique');await actualiser();}catch(e){$('salonsPlanifiesErreur').textContent=message(e.message);}});
        window.addEventListener('studyplan:salon-rejoint',function(e){noterParticipation(e.detail);});
        window.addEventListener('storage',function(e){if(cleNotifications() && e.key===cleNotifications()){invitationsVues=lireVues();majNotification();}});
        $('salonsPlanifiesOuvrir').addEventListener('click',ouvrir);$('salonsPlanifiesVisible').addEventListener('change',sauvegarderVisibilite);$('salonsPlanifiesForm').addEventListener('submit',programmer);
        var configurationPrete=false;
        chargerConfiguration=function(){
            if(configurationPrete)return Promise.resolve(true);
            if(configCharge)return configCharge;
            configCharge=fetch('data/salons-planifies.json',{cache:'no-store'}).then(function(r){if(!r.ok)throw new Error();return r.json();}).then(function(config){
            // Aucun jeton ne peut partir vers une URL autre que celle contrôlée.
            var publicActive=config.url===URL_SERVICE, minuterie=null, uidCourant='', authBranchee=false;
            if(config.url && !publicActive)throw new Error('configuration-invalide');
            if(publicActive)endpoint=URL_SERVICE;
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
            function brancherAuth(){
                if(authBranchee)return true;
                try {
                    if(!window.firebase || typeof firebase.auth!=='function' || (firebase.apps && !firebase.apps.length))return false;
                    firebase.auth().onAuthStateChanged(function(user){
                        var uid=user && user.uid || '';
                        if(uidCourant!==uid){generationCompte++;$('salonsPlanifiesListe').textContent='';$('salonsPlanifiesHistoriqueListe').textContent='';$('salonsPlanifiesErreur').textContent='';$('salonsCompteAvenir').textContent='0';$('salonsCompteHistoire').textContent='0';$('salonsEffacerHistoire').hidden=true;$('salonsPlanifiesBandeau').hidden=true;$('salonsPlanifiesAnnonce').hidden=true;$('salonsPlanifiesAnnonce').setAttribute('aria-expanded','false');compteNotifications=uid;invitationsVues=uid?lireVues():Object.create(null);demandesEnAttente=[];majNotification();$('salonsPlanifiesEleves').textContent='';$('salonsPlanifiesForm').hidden=true;statut('',false);}
                        uidCourant=uid;demarrer(user);
                    });
                    authBranchee=true;return true;
                } catch(_){return false;}
            }
            window.addEventListener('focus',brancherAuth);
            document.addEventListener('visibilitychange',function(){if(!document.hidden)brancherAuth();});
            $('salonsPlanifiesOuvrir').addEventListener('click',brancherAuth);
            if(!brancherAuth()){
                if(publicActive)demarrer(null);
                // Firebase est chargé à la demande par Mon compte, parfois
                // après ce module ; ne pas perdre l'événement de connexion.
                var tentativesAuth=0, attendreAuth=setInterval(function(){
                    if(brancherAuth() || ++tentativesAuth>=60)clearInterval(attendreAuth);
                },2000);
            }
            configurationPrete=true;return true;
        }).catch(function(){return false;}).then(function(ok){if(!ok)configCharge=null;return ok;});
            return configCharge;
        };
        chargerConfiguration();
    }
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
