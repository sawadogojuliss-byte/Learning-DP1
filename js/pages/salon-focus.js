/* Salon focus — interface indépendante du transport.
   Version d'essai : seules les options explicitement cochées sont transmises. */
(function () {
    'use strict';
    var coeur = window.SalonFocusCoeur;
    var transport = window.SALON_FOCUS_TRANSPORT || null;
    var session = null, salle = null, arreterEcoute = null, timer = null;
    var invitation = window.__salonInvitation || null, reprise = null, verifierHote = false;
    try { var ancien = JSON.parse(sessionStorage.getItem('studyPlanIB_salon_session') || 'null');
        if (ancien && /^[a-f0-9]{48}$/.test(ancien.id) && ['hote','invite'].indexOf(ancien.role) >= 0 && (!invitation || invitation===ancien.id)) { invitation=ancien.id; reprise=ancien; }
    } catch (e) {}
    // Ce repère ne donne aucun droit : le serveur vérifie toujours le compte.
    try { var repereHote=JSON.parse(localStorage.getItem('studyPlanIB_salon_hote') || 'null');
        if (!reprise && invitation && repereHote && repereHote.id===invitation && repereHote.jusqua>Date.now()) reprise={id:invitation,role:'hote'};
    } catch (e) {}
    try { delete window.__salonInvitation; } catch (e) { window.__salonInvitation = null; }
    var occupe = false, connecte = false, audioAutorise = false, lecteurs = {}, signatureAudio = '';
    var fondMontre = '', playlistChoisie = null, local = null, sonsPersonnels = [], generationAudio = 0;
    var volumeSalon = 1, discret = false, signalFin = 'visuel', contexteSignal = null, finObservee = 0, signalees = {};
    var objectifTimer = null, fileMembre = Promise.resolve(), signatureGroupe = '', partageInitialise = false, miniSalon=null;
    try {
        var preference = JSON.parse(localStorage.getItem('studyPlanIB_salon_preferences') || '{}');
        volumeSalon = typeof preference.volume === 'number' ? Math.max(0, Math.min(1, preference.volume)) : 1;
        discret = preference.discret === true;
        if (['visuel','son','aucun'].indexOf(preference.signal) >= 0) signalFin = preference.signal;
    } catch (e) {}
    var $ = function (id) { return document.getElementById(id); };
    // Les mêmes classes visuelles ne doivent pas devenir des descendants de la
    // barre Pomodoro personnelle (sélecteurs, tests et navigation restent isolés).
    function isolerEcranSalon() { var e=$('salonEcran'),p=$('panelPomodoro');if(e && p && e.parentNode!==p)p.appendChild(e); }
    isolerEcranSalon();
    function statut(id, message) { var el = $(id), valeur = message || ''; if (el && el.textContent !== valeur) el.textContent = valeur; }
    function propriete(el, cle, valeur) { if(el && el[cle]!==valeur) el[cle]=valeur; }
    function attribut(el, cle, valeur) { if(el && el.getAttribute(cle)!==valeur) el.setAttribute(cle,valeur); }
    function heure() { return session && typeof session.maintenant === 'function' ? session.maintenant() : Date.now(); }
    function options() { var r={}; document.querySelectorAll('[name="salonPartage"]').forEach(function (e) { r[e.value] = e.checked; }); return coeur.autorisations(r); }
    function adresseSalon(id) {
        try { var u=new URL(location.href);u.hash=id?'salon='+id:'';history.replaceState(history.state,'',u.href); } catch(e) {}
    }
    // La navigation du site emploie aussi le fragment pour ses pages.
    // Conserver le lien secret pendant toute la session, y compris en arrière-plan.
    var poserHashPersonnel=window.memoirePoserHash;
    if(typeof poserHashPersonnel==='function') window.memoirePoserHash=function(){
        var resultat=poserHashPersonnel.apply(this,arguments);
        if(session || invitation)adresseSalon(session ? session.id : invitation);
        return resultat;
    };
    window.addEventListener('load',function(){
        // Le nettoyage général de navigation s'exécute lui aussi à load et
        // peut masquer Pomodoro après une reprise très rapide depuis le cache.
        if(invitation || (session && $('salonEcran') && !$('salonEcran').hidden)) {
            ouvrirPomodoro();adresseSalon(session ? session.id : invitation);
        }
    });
    var protections = null, editionPartage = false;
    var fichesSalon = ['objectif','groupe','preferences','bilan'];
    function installerFiches() {
        var menu=document.querySelector('#focusReglages .focus-tiroir-liste');
        var contenu=document.querySelector('#focusReglages .focus-tiroir-contenu');
        var labels={objectif:'Objectif',groupe:'Groupe',preferences:'Préférences',bilan:'Bilan'};
        var icones={objectif:'✦',groupe:'♧',preferences:'☷',bilan:'◷'};
        fichesSalon.forEach(function(nom){
            var id='reunion-'+nom, carte=document.querySelector('[data-salon-fiche="'+nom+'"]');
            if(!carte || document.querySelector('#focusReglages [data-page="'+id+'"]'))return;
            if(FOCUS_ONGLETS.indexOf(id)<0)FOCUS_ONGLETS.push(id);
            var li=document.createElement('li');li.dataset.reunionOnglet=nom;li.hidden=true;
            var bouton=document.createElement('button');bouton.type='button';bouton.className='focus-tiroir-item';bouton.dataset.onglet=id;
            var icone=document.createElement('span');icone.className='salon-menu-icone';icone.setAttribute('aria-hidden','true');icone.textContent=icones[nom];
            var texte=document.createElement('span');texte.textContent=labels[nom];bouton.appendChild(icone);bouton.appendChild(texte);
            bouton.addEventListener('click',function(){focusChoisirOnglet(id);});li.appendChild(bouton);menu.appendChild(li);
            var page=document.createElement('section');page.className='focus-tiroir-page salon-reglage-page';page.dataset.page=id;page.hidden=true;
            var titre=document.createElement('div');titre.className='focus-page-titre';var h=document.createElement('h2');h.textContent=labels[nom];titre.appendChild(h);page.appendChild(titre);
            carte.hidden=false;page.appendChild(carte);contenu.appendChild(page);
        });
    }
    function protegerReglages(invite) {
        var ids=['focusDureeSeances','focusDureeFocus','focusDureeShort','focusDureeLong'];
        if (!protections) {
            var boutons=Array.from(document.querySelectorAll('#focusReglages .focus-seances-haut .focus-stepper button'));
            var champs=ids.map($).filter(Boolean).concat(boutons);
            var onglets=Array.from(document.querySelectorAll('#focusReglages [data-onglet="salon"],#focusReglages [data-onglet="statistiques"]')).map(function(e){return e.closest('li');});
            protections={champs:champs.map(function(e){return {el:e,disabled:e.disabled};}),onglets:onglets.map(function(e){return {el:e,hidden:e.hidden};})};
        }
        protections.champs.forEach(function(x){x.el.disabled=invite?true:x.disabled;});
        protections.onglets.forEach(function(x){x.el.hidden=session?true:x.hidden;});
        document.querySelectorAll('#focusReglages [data-reunion-onglet]').forEach(function(e){e.hidden=!session;});
    }
    var choisirOngletPersonnel=focusChoisirOnglet;
    focusChoisirOnglet=function(id) {
        if(session && (id==='statistiques' || (id==='salon' && !editionPartage))) return;
        if(!session && id.indexOf('reunion-')===0)return;
        return choisirOngletPersonnel.apply(this,arguments);
    };
    window.salonOuvrirFiche=function(nom) {
        if(!session || fichesSalon.indexOf(nom)<0)return;
        if($('focusReglages').hidden)focusBasculerReglages();
        focusChoisirOnglet('reunion-'+nom);
    };
    window.salonOuvrirReglages=function() { if(!session)return;focusBasculerReglages();if(!$('focusReglages').hidden)focusChoisirOnglet('themes'); };
    window.salonOuvrirTaches=function() { if(session)focusBasculerTaches(); };
    window.salonOuvrirSons=function() { if(session)focusBasculerSons(); };
    window.salonMasquer=function(){if(!session)return;$('salonEcran').hidden=true;$('salonRaccourci').hidden=false;focusMaison();};
    window.salonBasculerAstuce=function(){if(!session)return;var el=$('salonAstuce');el.hidden=!el.hidden;$('salonBtnAstuce').classList.toggle('is-on',!el.hidden);if(salle && salle.chrono)el.textContent=FOCUS_ASTUCES[salle.chrono.mode]||'';};
    window.salonFermerMini=function(){ $('salonPipLocal').hidden=true;if(miniSalon&&!miniSalon.closed)miniSalon.close();miniSalon=null; };
    window.salonMiniLecteur=function(){
        if(!session)return;
        if((miniSalon&&!miniSalon.closed)||!$('salonPipLocal').hidden){window.salonFermerMini();return;}
        if(window.documentPictureInPicture && documentPictureInPicture.requestWindow){
            documentPictureInPicture.requestWindow({width:384,height:216}).then(function(w){
                if(!session){w.close();return;}miniSalon=w;w.document.open();w.document.write(focusPipHtml());w.document.close();
                var b=w.document.getElementById('pipPlay');if(b)b.onclick=function(){if(session && session.role==='hote')window.salonBasculer();};
                w.addEventListener('pagehide',function(){miniSalon=null;});peindre();
            }).catch(function(){$('salonPipLocal').hidden=false;peindre();});
        }else {$('salonPipLocal').hidden=false;peindre();}
    };
    function peindreMini(c){
        var temps=focusTexte(c.restant), hote=session.role==='hote';
        statut('salonPipTemps',temps);$('salonPipPlay').hidden=!hote;$('salonPipPlay').textContent=c.running?'❚❚':'▶';
        if(miniSalon&&!miniSalon.closed){var doc=miniSalon.document,t=doc.getElementById('pipTime'),b=doc.getElementById('pipPlay'),scene=doc.getElementById('pipScene');
            if(t)t.textContent=temps;if(b){b.style.display=hote?'flex':'none';var play=b.querySelector('.pip-ico-play'),pause=b.querySelector('.pip-ico-pause');if(play)play.style.display=c.running?'none':'block';if(pause)pause.style.display=c.running?'block':'none';b.setAttribute('aria-label',c.running?'Pause':'Démarrer');}
            if(scene)scene.style.backgroundImage=$('salonDecor').style.backgroundImage;
        }
    }
    function resumeSelection() {
        var selection=document.querySelectorAll('[name="salonPartage"]:checked').length;
        statut('salonSelectionResume',selection ? selection+' élément'+(selection>1?'s':'')+' partagé'+(selection>1?'s':'')+' en plus du chrono.' : 'Aucun élément supplémentaire partagé.');
    }
    function etatPersonnel() {
        var r = focusLireReglages(), f = FOCUS_FONDS[focusEtat.fond] || FOCUS_FONDS[0];
        return { theme: f && f.id !== 'personnel-local' ? f.id : '', themeLocal: f ? f.id : '', durees: focusDurees(),
            horloge: { police:r.police, taille:r.taille },
            sons: Array.isArray(focusAmbianceChoisie) ? focusAmbianceChoisie.filter(function(id){return !!focusSonParId(id);}) : [],
            musique: playlistChoisie || { nom:'', sons:[] },
            citation: { visible:r.citation, texte:focusCitationDuJour() } };
    }
    // Le lecteur Studyplan joue les playlists comme un ensemble de sons.
    var jouerListe = focusJouerListe;
    focusJouerListe = function (liste) {
        playlistChoisie = { nom:coeur.texte(liste && liste.nom,40), sons:(liste && liste.sons || []).slice(0,20) };
        return jouerListe.apply(this, arguments);
    };
    function selectionPartagee() { return coeur.contenus(options(), etatPersonnel()); }
    function erreur(e) {
        if (!navigator.onLine) return 'Connexion interrompue. Réessaie quand le réseau revient.';
        if (e && e.code === 'auth-required') return 'Connecte-toi à ton compte Google pour créer ou reprendre ton salon.';
        if (e && e.code === 'auth/operation-not-allowed') return 'La connexion anonyme doit être activée pour les invités.';
        if (e && e.code === 'room-locked') return 'Ce salon est verrouillé : les nouvelles entrées sont suspendues.';
        if (e && e.code === 'clock-unavailable') return 'Impossible de synchroniser l’heure du salon. Vérifie ta connexion.';
        if (e && (e.code === 'room-closed' || e.code === 'not-found' || e.code === 'removed')) return 'Ce salon est fermé, expiré ou introuvable.';
        if (e && e.code === 'revision-conflict') return 'Le salon a changé. Attends la synchronisation puis réessaie.';
        if (e && e.code === 'permission-denied') return 'Accès refusé. Le service du salon doit être configuré ou ce lien n’est plus valide.';
        return 'Impossible de joindre le salon pour le moment. Réessaie.';
    }
    function pret() {
        if (!$('salonCreer')) return;
        isolerEcranSalon();
        var actif = !!(transport && typeof transport.creer === 'function' && typeof transport.rejoindre === 'function');
        $('salonCreer').disabled = !actif;
        statut('salonStatutCreation', actif ? 'Version d’essai : les invités rejoignent avec un pseudo. Le lien donne accès au salon.' : 'Le service de salon n’est pas encore activé.');
        $('salonBadge').textContent = actif ? 'Version d’essai' : 'En préparation';
        if (invitation) {
            var dialog=$('salonInvitation');
            // Le dialogue doit être visible avant d'ouvrir la page Pomodoro.
            if (dialog && dialog.parentNode !== document.body) document.body.appendChild(dialog);
            if (reprise && reprise.role === 'invite') $('salonPseudo').value=coeur.texte(reprise.pseudo,30);
            // Présenter le salon derrière la carte avant de demander le pseudo.
            ouvrirPomodoro();adresseSalon(invitation);$('salonEcran').hidden=false;$('salonEcran').classList.add('salon-attente-invitation');
            $('salonTitre').textContent='Salon focus';$('salonPhase').textContent='Concentration';$('salonTemps').textContent='--:--';
            decor((FOCUS_FONDS[focusEtat.fond] || FOCUS_FONDS[0]).id,true);
            if (dialog && !dialog.open) dialog.showModal();
            if (!actif) { $('salonRejoindreBouton').disabled=true; statut('salonInvitationStatut','Le service de salon n’est pas encore activé.'); }
            else if (typeof transport.reprendre==='function') verifierOrganisateur();
            else formulaireInvite();
            if (actif && typeof transport.apercu==='function') {
                var idApercu=invitation;
                transport.apercu(idApercu).then(function(data){
                    if(invitation!==idApercu || session || !data)return;
                    $('salonTitre').textContent=coeur.texte(data.nom,60);
                    try {var c=coeur.temps(data.chrono,data.maintenant);$('salonTemps').textContent=focusTexte(c.restant);statut('salonPhase',({focus:'Concentration',short:'Pause courte',long:'Pause longue'})[c.mode]);}catch(e){}
                    var selection=coeur.autorisations(data.options), part=coeur.contenus(selection,data.partage||{});
                    if(selection.theme && part.theme)decor(part.theme,false);
                    $('salonCitation').textContent=selection.citations && part.citation && part.citation.visible?part.citation.texte:'';
                }).catch(function(){if(invitation===idApercu && !session)statut('salonInvitationStatut','Aperçu indisponible. Tu peux essayer de rejoindre.');});
            }
        }
    }
    function formulaireInvite() {
        verifierHote=false;$('salonInvitationTitre').textContent='Rejoins le salon';
        $('salonInvitationDescription').textContent='Choisis le nom que les autres verront dans le salon. Tu peux rejoindre sans compte.';
        $('salonPseudo').hidden=false;$('salonPseudo').required=true;$('salonPseudoLabel').hidden=false;
        $('salonRejoindreBouton').textContent='Entrer dans le salon';$('salonRejoindreBouton').disabled=false;$('salonInvitationOrganisateur').hidden=false;$('salonInvitationInvite').hidden=true;statut('salonInvitationStatut','');
    }
    function verifierOrganisateur() {
        if(!invitation || occupe || !transport || typeof transport.reprendre!=='function')return;
        var id=invitation, hoteConnu=!!(reprise && reprise.role==='hote');verifierHote=true;occupe=true;
        $('salonInvitationTitre').textContent='Connexion au salon';$('salonInvitationDescription').textContent='Vérification de ton accès…';
        $('salonPseudo').hidden=true;$('salonPseudo').required=false;$('salonPseudoLabel').hidden=true;
        $('salonRejoindreBouton').textContent='Vérification…';$('salonRejoindreBouton').disabled=true;$('salonInvitationOrganisateur').hidden=true;$('salonInvitationInvite').hidden=true;statut('salonInvitationStatut','');
        Promise.resolve().then(function(){return transport.reprendre(id);}).then(function(s){
            if(invitation!==id)return;occupe=false;invitation=null;reprise=null;verifierHote=false;$('salonInvitation').close();ouvrirPomodoro();commencer(s,null,'');
        }).catch(function(e){
            if(invitation!==id)return;occupe=false;
            if(!hoteConnu && e && (e.code==='auth-required' || e.code==='permission-denied')) { formulaireInvite();return; }
            $('salonInvitationTitre').textContent=hoteConnu?'Reprendre ton salon':'Vérifier ton accès';
            $('salonInvitationDescription').textContent=hoteConnu?'Reconnecte-toi pour retrouver ton salon et son minuteur.':'La vérification n’a pas abouti. Réessaie avant de rejoindre.';
            $('salonRejoindreBouton').textContent='Réessayer';$('salonRejoindreBouton').disabled=false;$('salonInvitationInvite').hidden=!hoteConnu;statut('salonInvitationStatut',erreur(e));
        });
    }
    window.salonChoisirInvite=function(){if(!invitation || occupe)return;reprise=null;formulaireInvite();};
    window.salonVerifierOrganisateur=function(){if(!invitation || occupe)return;reprise={id:invitation,role:'hote'};verifierOrganisateur();};
    function init() {
        if (!window.__STUDYPLAN_READY) { setTimeout(init, 80); return; }
        document.querySelectorAll('[name="salonPartage"]').forEach(function(e){e.addEventListener('change',resumeSelection);});
        installerFiches();resumeSelection();pret();
    }
    setTimeout(init,0);
    function commencer(s, initial, pseudo) {
        if (!s || !/^[a-f0-9]{48}$/.test(s.id) || ['hote','invite'].indexOf(s.role) < 0 || typeof s.maintenant !== 'function' || typeof s.observer !== 'function' || typeof s.modifier !== 'function' || typeof s.quitter !== 'function' || typeof s.fermer !== 'function') throw new Error('Session invalide');
        session = s;
        if(s.role==='hote')try {localStorage.setItem('studyPlanIB_salon_hote',JSON.stringify({id:s.id,jusqua:Date.now()+12*60*60*1000}));} catch(e) {}
        adresseSalon(s.id);document.body.classList.add('salon-actif');$('salonEcran').classList.remove('salon-attente-invitation');protegerReglages(s.role==='invite');
        try { sessionStorage.setItem('studyPlanIB_salon_session',JSON.stringify({id:s.id,role:s.role,pseudo:coeur.texte(pseudo,30)})); } catch(e) {}
        local = initial || etatPersonnel(); salle = null; connecte = false; fondMontre = ''; signatureGroupe=''; signatureParticipants=''; finObservee=0; signalees={}; partageInitialise=false;
        editionPartage=false;
        $('salonObjectif').value=''; $('salonObjectifFait').checked=false; $('salonObjectifPartager').checked=false;
        try { var obj=JSON.parse(sessionStorage.getItem('studyPlanIB_salon_objectif_'+s.id)||'{}'); $('salonObjectif').value=coeur.texte(obj.texte,160); $('salonObjectifFait').checked=obj.fait===true; } catch(e) {}
        $('salonVolume').value=Math.round(volumeSalon*100); $('salonVolumeValeur').textContent=Math.round(volumeSalon*100)+' %';
        $('salonDiscret').checked=discret; $('salonSignal').value=signalFin; $('salonSignalVisuel').hidden=true;
        // Un minuteur personnel actif est explicitement mis en pause pour ne pas
        // laisser deux sessions et deux annonces tourner en parallèle.
        var minuteurPersonnelPause = !!focusEtat.running;
        if (minuteurPersonnelPause) focusPause();
        sonsPersonnels = Object.keys(focusLecteurs).filter(focusSonActif);
        focusCouperSon();
        if (typeof focusFermer === 'function') focusFermer('focusReglages');
        $('salonEcran').hidden = false; $('salonRaccourci').hidden = true;if($('salonRaccourci').parentNode!==document.body)document.body.appendChild($('salonRaccourci'));
        $('salonLienCarte').hidden=!(initial && s.role==='hote');$('salonLienAffiche').value=coeur.lienInvitation(document.baseURI,s.id);
        statut('salonLienStatut','Seules les personnes qui ont ce lien peuvent rejoindre.');statut('salonGroupePartageStatut','');
        $('salonCommandes').hidden = session.role !== 'hote';$('salonPipInvite').hidden=false;
        $('salonAttente').hidden = session.role === 'hote';
        $('salonReglages').hidden = session.role !== 'hote';
        $('salonQuitterBouton').textContent = session.role === 'hote' ? 'Fermer le salon' : 'Quitter le salon';
        statut('salonMessage',minuteurPersonnelPause ? 'Ton minuteur personnel a été mis en pause pendant le salon.' : '');
        arreterEcoute = session.observer(function (data, etat) {
            connecte = !!(etat && etat.connecte);
            if (data && salle && Number(data.revision) < Number(salle.revision)) return;
            if (data && data.ferme) { finirLocal('Le salon a été fermé par son organisateur.',session.role==='invite'); return; }
            if (data) {
                salle = data;
                if (session.uid && data.organisateurUid) {
                    session.role = data.organisateurUid === session.uid ? 'hote' : 'invite';protegerReglages(session.role==='invite');
                    try { var memo=JSON.parse(sessionStorage.getItem('studyPlanIB_salon_session')||'{}'); memo.role=session.role; sessionStorage.setItem('studyPlanIB_salon_session',JSON.stringify(memo)); } catch(e) {}
                }
                if (session.role === 'hote' && !playlistChoisie && data.options && data.options.musique && data.partage && data.partage.musique)
                    playlistChoisie = coeur.contenus({musique:true},{musique:data.partage.musique}).musique;
            }
            statut('salonEtatConnexion', connecte ? '● Connecté en direct' : '○ Reconnexion en cours');
            peindre();
        }, function (e) { if(e && (e.code==='removed' || e.code==='room-closed')) { finirLocal(e.code==='removed'?'Tu as été retiré du salon.':'Le salon est fermé ou a expiré.'); return; } connecte=false;statut('salonEtatConnexion','○ Connexion interrompue');statut('salonMessage',erreur(e));peindre(); });
        timer = setInterval(peindre,250);
        peindre();
    }
    function ouvrirPomodoro() {
        document.querySelectorAll('.context-modal.active').forEach(function (e) { e.classList.remove('active'); });
        var planning=$('planningModal'); if (planning) planning.classList.add('active');
        navigateTo('pomodoro');
    }
    window.salonCreer = function () {
        if (!transport || occupe || session) return;
        var nom = coeur.texte($('salonNom').value,60);
        if (!nom) { statut('salonStatutCreation','Donne un nom à ton salon.'); $('salonNom').focus(); return; }
        var perso = etatPersonnel(), partage = selectionPartagee();
        var chrono = coeur.commande({mode:'focus',total:1500,restant:1500,running:false,fin:0},'focus',Date.now(),perso.durees);
        occupe=true;$('salonCreer').disabled=true;statut('salonStatutCreation','Création en cours…');
        transport.creer({nom:nom, options:options(), partage:partage, chrono:chrono}).then(function (s) {
            occupe=false;commencer(s,perso);
        }).catch(function (e) { occupe=false;$('salonCreer').disabled=false;statut('salonStatutCreation',erreur(e)); });
    };
    window.salonRejoindre = function (event) {
        event.preventDefault(); if (!transport || occupe || !invitation) return false;
        if(verifierHote){verifierOrganisateur();return false;}
        var estHote = !!(reprise && reprise.role === 'hote');
        var pseudo=coeur.texte($('salonPseudo').value,30);
        if (!estHote && !pseudo) { statut('salonInvitationStatut','Choisis un pseudo.'); $('salonPseudo').focus();return false; }
        occupe=true;$('salonRejoindreBouton').disabled=true;statut('salonInvitationStatut','Connexion au salon…');
        var operation = estHote && typeof transport.reprendre === 'function' ? transport.reprendre(invitation) : estHote ? Promise.reject(new Error('Reprise indisponible')) : transport.rejoindre(invitation,pseudo);
        Promise.resolve(operation).then(function (s) {
            invitation=null;reprise=null;occupe=false;$('salonInvitation').close();ouvrirPomodoro();commencer(s,null,pseudo);
        }).catch(function (e) { occupe=false;$('salonRejoindreBouton').disabled=false;statut('salonInvitationStatut',erreur(e)); });
        return false;
    };
    window.salonAnnulerInvitation = function () { invitation=null;reprise=null;occupe=false;verifierHote=false;adresseSalon(null);$('salonEcran').hidden=true;$('salonEcran').classList.remove('salon-attente-invitation');try{sessionStorage.removeItem('studyPlanIB_salon_session');}catch(e){} $('salonInvitation').close(); };
    function envoyer(changement) {
        if (!session || session.role !== 'hote' || !salle || !connecte || occupe) { statut('salonMessage','Attends la connexion au salon avant de modifier le minuteur.');return Promise.resolve(false); }
        occupe=true;peindre();
        return session.modifier(salle.revision, changement).then(function (nouveau) { if (nouveau && (!salle || nouveau.revision >= salle.revision)) salle=nouveau;occupe=false;peindre();return true; },function (e) {
            occupe=false;statut('salonMessage',erreur(e));peindre();return false;
        });
    }
    function action(nom) {
        if (!salle || !salle.chrono) return;
        var d = salle.partage && salle.partage.durees || etatPersonnel().durees;
        var c=coeur.commande(salle.chrono,nom,heure(),d);
        envoyer({chrono:c});
    }
    window.salonBasculer=function () { if (salle && salle.chrono) action(coeur.temps(salle.chrono,heure()).running ? 'pause' : 'demarrer'); };
    window.salonPhaseChoisir=function (mode) { action(mode); };
    window.salonReinitialiser=function () { action('reinitialiser'); };
    window.salonModifierPartage=function () {
        if (!session || session.role !== 'hote') return;
        $('salonEcran').hidden=true; $('salonRaccourci').hidden=false; $('salonCreer').hidden=true; $('salonFormTitre').textContent='Modifier le partage';$('salonMajPartage').hidden=false;$('salonRetour').hidden=false;
        $('salonNom').value=salle.nom;$('salonNom').disabled=true;
        Object.keys(salle.options || {}).forEach(function(k){var el=document.querySelector('[name="salonPartage"][value="'+k+'"]');if(el)el.checked=!!salle.options[k];});
        editionPartage=true;resumeSelection();if($('focusReglages').hidden)focusBasculerReglages();focusChoisirOnglet('salon');
    };
    window.salonRevenir=function () { editionPartage=false;focusChoisirOnglet('themes');ouvrirPomodoro();focusFermer('focusReglages');$('salonRaccourci').hidden=true;$('salonEcran').hidden=false; };
    window.salonActualiserPartage=function () {
        envoyer({options:options(),partage:selectionPartagee()}).then(function(ok){if(ok)window.salonRevenir();});
    };
    function lien() { return coeur.lienInvitation(document.baseURI, session.id); }
    function messageCopie(message) {
        statut('salonLienStatut',message);statut('salonGroupePartageStatut',message);statut('salonMessage',message);
    }
    function selectionnerLien(valeur) {
        var carte=$('salonLienCarte'), champ=$('salonLienAffiche');
        // Éviter qu'une feuille ouverte recouvre le champ sur petit écran.
        focusFermer('focusReglages');carte.hidden=false;champ.value=valeur;champ.focus();champ.select();
        try { champ.setSelectionRange(0,champ.value.length); } catch(e) {}
    }
    function copieSecours(s, valeur) {
        if (session!==s) return;
        // Le lien reste visible et sélectionnable si l'accès au presse-papiers
        // est refusé (appui long sur mobile, copier au clavier sur ordinateur).
        selectionnerLien(valeur);
        var copie=false;
        try { copie=typeof document.execCommand==='function' && document.execCommand('copy')===true; } catch(e) {}
        messageCopie(copie ? 'Lien copié ! Partage-le uniquement avec tes invités.' : 'Copie automatique indisponible : sélectionne le lien ci-dessus et copie-le manuellement.');
    }
    window.salonCopierLien=function () {
        if (!session) return;
        var s=session, valeur=lien(), operation;
        try {
            if (navigator.clipboard && typeof navigator.clipboard.writeText==='function') operation=navigator.clipboard.writeText(valeur);
            else { copieSecours(s,valeur);return; }
        } catch(e) { copieSecours(s,valeur);return; }
        Promise.resolve(operation).then(function(){
            if(session===s)messageCopie('Lien copié ! Partage-le uniquement avec tes invités.');
        },function(){copieSecours(s,valeur);});
    };
    function stopperAudio() { generationAudio++; Object.keys(lecteurs).forEach(function (id){lecteurs[id].pause();lecteurs[id].removeAttribute('src');lecteurs[id].load();});lecteurs={};signatureAudio=''; }
    window.salonActiverAudio=function () { audioAutorise=!audioAutorise;if (!audioAutorise) stopperAudio();signatureAudio='';peindre(); };
    function peindreAudio(partage, opts) {
        var ids=[];
        var sons=opts.sons ? partage.sons : local.sons;
        var musique=opts.musique ? partage.musique : local.musique;
        if (Array.isArray(sons)) ids=ids.concat(sons);
        if (musique && Array.isArray(musique.sons)) ids=ids.concat(musique.sons);
        ids=ids.filter(function(id,i,a){return a.indexOf(id)===i && !!focusSonParId(id);});
        propriete($('salonAutoriserAudio'),'hidden',!ids.length);
        statut('salonAutoriserAudio',audioAutorise?'Couper les sons':'Activer les sons');
        if (!audioAutorise) return;
        var signature=JSON.stringify(ids);if(signature===signatureAudio)return;stopperAudio();signatureAudio=signature;var generation=generationAudio;
        ids.forEach(function(id){ var son=focusSonParId(id), audio=new Audio(son.fichier);audio.loop=true;audio.volume=focusVolume(id)*volumeSalon;lecteurs[id]=audio;var p=audio.play();if(p&&p.catch)p.catch(function(){if(generation!==generationAudio)return;statut('salonMessage','La lecture est bloquée : touche « Activer les sons » pour réessayer.');audioAutorise=false;stopperAudio();}); });
    }
    function sauvegarderPreferences() {
        try { localStorage.setItem('studyPlanIB_salon_preferences',JSON.stringify({volume:volumeSalon,discret:discret,signal:signalFin})); } catch(e) {}
    }
    window.salonChangerVolume=function(v) {
        volumeSalon=Math.max(0,Math.min(1,Number(v)/100));
        $('salonVolumeValeur').textContent=Math.round(volumeSalon*100)+' %';
        Object.keys(lecteurs).forEach(function(id){lecteurs[id].volume=focusVolume(id)*volumeSalon;}); sauvegarderPreferences();
    };
    window.salonChangerDiscret=function(v) { discret=!!v;sauvegarderPreferences();signatureGroupe='';peindre(); };
    window.salonChangerSignal=function(v) {
        if (['visuel','son','aucun'].indexOf(v)<0) return;
        signalFin=v; $('salonSignalVisuel').hidden=true; sauvegarderPreferences();
        if(v==='son') try { var AudioContext=window.AudioContext||window.webkitAudioContext; if(AudioContext) { contexteSignal=contexteSignal||new AudioContext(); contexteSignal.resume(); } } catch(e) {}
    };
    function signalerFin(c) {
        if (salle.chrono.running && salle.chrono.fin > 0 && c.restant > 0) { finObservee=salle.chrono.fin; propriete($('salonSignalVisuel'),'hidden',true); }
        if (!finObservee || c.restant !== 0 || signalees[finObservee]) return;
        signalees[finObservee]=true;finObservee=0;
        if(signalFin==='visuel') $('salonSignalVisuel').hidden=false;
        if(signalFin==='son' && contexteSignal && contexteSignal.state==='running') {
            var osc=contexteSignal.createOscillator(), gain=contexteSignal.createGain(), t=contexteSignal.currentTime;
            osc.type='sine';osc.frequency.value=523.25;gain.gain.setValueAtTime(0.0001,t);gain.gain.exponentialRampToValueAtTime(.08,t+.05);gain.gain.exponentialRampToValueAtTime(.0001,t+.8);osc.connect(gain);gain.connect(contexteSignal.destination);osc.start(t);osc.stop(t+.82);
        }
    }
    function publierMembre(changement) {
        var s=session;
        if (!s || !connecte || typeof s.personnaliser !== 'function') { statut('salonRituelInfo','Cette fonction attend le raccordement sécurisé du salon.'); return Promise.resolve(false); }
        fileMembre=fileMembre.catch(function(){}).then(function(){
            if(session!==s) return false;
            return s.personnaliser(changement).then(function(){return true;},function(e){statut('salonRituelInfo',erreur(e));return false;});
        });
        return fileMembre;
    }
    window.salonGarderObjectif=function() {
        if(!session)return;
        var val=coeur.texte($('salonObjectif').value,160);
        try { sessionStorage.setItem('studyPlanIB_salon_objectif_'+session.id,JSON.stringify({texte:val,fait:$('salonObjectifFait').checked})); } catch(e) {}
        clearTimeout(objectifTimer);
        if($('salonObjectifPartager').checked) objectifTimer=setTimeout(function(){publierMembre({objectifPartage:true,objectif:val,objectifFait:$('salonObjectifFait').checked});},400);
    };
    window.salonPartagerObjectif=function() {
        clearTimeout(objectifTimer);
        var partage=$('salonObjectifPartager').checked;
        publierMembre({objectifPartage:partage,objectif:partage?coeur.texte($('salonObjectif').value,160):'',objectifFait:partage && $('salonObjectifFait').checked}).then(function(ok){
            if(!ok && partage) $('salonObjectifPartager').checked=false;
            if(!ok && !partage) { $('salonObjectifPartager').checked=true; statut('salonRituelInfo','Le retrait du partage n’a pas été confirmé. Réessaie dès la reconnexion.'); }
        });
    };
    function moi() { return salle && session && session.uid && Array.isArray(salle.membres) ? salle.membres.filter(function(m){return m.uid===session.uid;})[0] : null; }
    window.salonBasculerPret=function(){var m=moi();publierMembre({pret:!(m && m.pret)});};
    function appelGroupe(nom,args) {
        var s=session;
        if(!s || !connecte || typeof s[nom]!=='function'){statut('salonMessage','Cette fonction attend le raccordement sécurisé du salon.');return;}
        Promise.resolve().then(function(){return s[nom].apply(s,args||[]);}).catch(function(e){statut('salonMessage',erreur(e));});
    }
    window.salonVerrouiller=function(){if(session && session.role==='hote')appelGroupe('verrouiller',[!salle.verrouille]);};
    window.salonDemanderAide=function(){appelGroupe('demanderAide',[]);};
    window.salonAppliquerAmbiance=function(){
        if(!salle || !session || session.role!=='hote')return;
        var id=$('salonAmbiance').value, recettes={bibliotheque:{nom:'Bibliothèque sous la pluie',sons:['bibliotheque','pluie']},cafe:{nom:'Café calme',sons:['cafe','piano']}};
        if(!recettes[id])return;
        var opts=coeur.autorisations(salle.options), partage=coeur.contenus(opts,salle.partage||{});
        opts.musique=true;partage.musique=recettes[id];
        envoyer({options:opts,partage:partage}).then(function(ok){if(ok)playlistChoisie=recettes[id];});
    };
    function peindreGroupe() {
        var hote=session.role==='hote', membres=Array.isArray(salle.membres)?salle.membres.slice(0,40):[], m=moi();
        if(m && !partageInitialise) { $('salonObjectifPartager').checked=m.objectifPartage===true; partageInitialise=true; }
        propriete($('salonCommandes'),'hidden',!hote);propriete($('salonAttente'),'hidden',hote);propriete($('salonReglages'),'hidden',!hote);
        statut('salonQuitterBouton',hote?'Fermer le salon':'Quitter le salon');
        propriete($('salonOutilsHote'),'hidden',!hote);propriete($('salonAmbianceHote'),'hidden',!hote);
        propriete($('salonPret'),'disabled',!connecte || typeof session.personnaliser!=='function');
        propriete($('salonObjectifPartager'),'disabled',typeof session.personnaliser!=='function' || (!connecte && !$('salonObjectifPartager').checked));
        statut('salonPret',m && m.pret?'✨ Je ne suis plus prêt':'✨ Je suis prêt');
        statut('salonVerrou',salle.verrouille?'Déverrouiller le salon':'Verrouiller le salon');
        propriete($('salonVerrou'),'disabled',!connecte || typeof session.verrouiller!=='function');
        propriete($('salonCoupPouce'),'disabled',!connecte || typeof session.demanderAide!=='function');
        if(typeof session.personnaliser!=='function')statut('salonRituelInfo','Partage de l’objectif et rituel prêts : bientôt disponibles dans le salon.');
        var bilan=salle.bilan;
        statut('salonBilan',bilan && Number.isFinite(bilan.secondes) && Number.isFinite(bilan.sessions) ? Math.floor(Math.max(0,bilan.secondes)/60)+' min de concentration · '+Math.max(0,bilan.sessions)+' session(s) terminée(s) ensemble' : 'Le bilan commun est en préparation pour ce salon.');
        statut('salonGroupeInfo',membres.length ? membres.length+' personne(s) inscrite(s) · '+membres.filter(function(x){return x.pret;}).length+' prêt(s)' : 'Les participants apparaîtront ici.');
        var signature=JSON.stringify([membres,discret,hote,connecte,!!session.retirer,!!session.transferer,!!session.encourager]);
        if(signature===signatureGroupe)return;signatureGroupe=signature;
        var liste=$('salonListeMembres'), encouragements=$('salonEncouragements');liste.textContent='';encouragements.textContent='';
        $('salonMembres').hidden=discret;
        if(discret) return;
        membres.forEach(function(x){
            var ligne=document.createElement('div'), label=document.createElement('span');
            label.textContent=coeur.texte(x.pseudo,30)+(x.pret?' · prêt ✨':'')+(x.objectifPartage && x.objectif?' · '+coeur.texte(x.objectif,160)+(x.objectifFait?' ✓':''):'');ligne.appendChild(label);
            function bouton(texte,fn){var b=document.createElement('button');b.type='button';b.className='salon-action-secondaire';b.textContent=texte;b.disabled=!connecte;b.addEventListener('click',fn);ligne.appendChild(b);}
            if(hote && x.uid && x.uid!==session.uid && typeof session.transferer==='function') bouton('Transférer',function(){if(window.confirm('Confier le rôle d’organisateur à '+coeur.texte(x.pseudo,30)+' ?'))appelGroupe('transferer',[x.uid]);});
            if(hote && x.uid && x.uid!==session.uid && typeof session.retirer==='function') bouton('Retirer',function(){if(window.confirm('Retirer '+coeur.texte(x.pseudo,30)+' du salon ?'))appelGroupe('retirer',[x.uid]);});
            if(x.aide && x.uid!==session.uid && typeof session.encourager==='function') bouton('💚 Encourager',function(){appelGroupe('encourager',[x.uid]);});
            if(x.aide) { var info=document.createElement('span');info.textContent=' · a besoin d’un coup de pouce';ligne.appendChild(info); }
            if(x.encouragement) { var info2=document.createElement('span');info2.textContent=' · 💚 '+coeur.texte(x.encouragement,80);ligne.appendChild(info2); }
            liste.appendChild(ligne);
        });
    }
    function decor(id, personnelAutorise) {
        var cle = id + ':' + !!personnelAutorise;
        if (fondMontre===cle) return;fondMontre=cle;
        var el=$('salonDecor'), ancien=el.querySelector('video');
        if (ancien) { ancien.pause(); ancien.removeAttribute('src'); ancien.load(); }
        el.textContent=''; $('salonRelancerVideo').hidden=true;
        var fond=FOCUS_FONDS.filter(function(f){return f.id===id && (personnelAutorise || f.id!=='personnel-local');})[0];
        if(!fond)fond=FOCUS_FONDS[0];
        el.style.backgroundImage='url('+JSON.stringify(fond.src)+')';
        if(fond.video) { var v=document.createElement('video');v.muted=true;v.defaultMuted=true;v.loop=true;v.playsInline=true;v.poster=fond.src;v.src=fond.videoLeger||fond.video;v.setAttribute('aria-hidden','true');el.appendChild(v);v.addEventListener('playing',function(){$('salonRelancerVideo').hidden=true;});v.addEventListener('error',function(){$('salonRelancerVideo').hidden=false;});var p=v.play();if(p&&p.catch)p.catch(function(e){if(v.isConnected && (!e || e.name!=='AbortError'))$('salonRelancerVideo').hidden=false;}); }
    }
    window.salonRelancerVideo=function(){var v=$('salonDecor').querySelector('video');if(!v)return;if(v.error)v.load();var p=v.play();if(p&&p.catch)p.catch(function(){$('salonRelancerVideo').hidden=false;});};
    function peindre() {
        if(!session || !salle) return;
        var choix=coeur.autorisations(salle.options), p=coeur.contenus(choix,salle.partage || {}), c;
        try { c=coeur.temps(salle.chrono,heure()); } catch(e) { statut('salonMessage','Le minuteur reçu est invalide.');return; }
        statut('salonTitre',coeur.texte(salle.nom,60));
        statut('salonPhase',({focus:'Concentration',short:'Pause courte',long:'Pause longue'})[c.mode]);
        statut('salonTemps',focusTexte(c.restant));peindreMini(c);
        statut('salonInfoChrono',c.restant===0?'Temps écoulé · en attente de l’organisateur':(c.running?'En cours':'En pause'));
        attribut($('salonDemarrer'),'aria-label',c.running?'Pause':'Démarrer');propriete($('salonIconPlay').style,'display',c.running?'none':'block');propriete($('salonIconPause').style,'display',c.running?'block':'none');
        statut('salonAstuce',FOCUS_ASTUCES[c.mode]||'');var flamme=$('focusFlamme');if(flamme)statut('salonFlamme',flamme.textContent);
        signalerFin(c);peindreGroupe();
        $('salonCommandes').querySelectorAll('button').forEach(function(b){propriete(b,'disabled',!connecte||occupe);});
        document.querySelectorAll('#salonEcran [data-mode]').forEach(function(b){propriete(b,'disabled',session.role!=='hote'||!connecte||occupe);b.classList.toggle('is-on',b.dataset.mode===c.mode);attribut(b,'aria-pressed',String(b.dataset.mode===c.mode));});
        var h=choix.horloge && p.horloge ? p.horloge : local.horloge;
        var police=FOCUS_POLICES.some(function(x){return x.id===h.police})?h.police:'gras';
        var taille=FOCUS_TAILLES.some(function(x){return x.id===h.taille})?h.taille:'normale';
        var classe='salon-ecran focus-police-'+police+' focus-taille-'+taille;if($('salonEcran').className!==classe)$('salonEcran').className=classe;
        statut('salonHeure',new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}));
        var citation=choix.citations && p.citation ? p.citation : local.citation;
        statut('salonCitation',citation.visible?citation.texte:'');
        var decorPartage = choix.theme && p.theme;
        decor(decorPartage ? p.theme : local.themeLocal, !decorPartage);
        peindreAudio(p,choix);
        var membres=Array.isArray(salle.membres)?salle.membres:[];
        peindreParticipants(membres);
        statut('salonMembres',membres.length ? 'Participants : '+membres.slice(0,40).map(function(m){return coeur.texte(m && m.pseudo,30);}).filter(Boolean).join(' · ') : '');
    }
    var signatureParticipants='';
    function peindreParticipants(membres) {
        var zone=$('salonParticipants'), noms=$('salonParticipantsNoms'), maintenant=heure();
        var liste=membres.slice(0,40).map(function(m){
            var date=Number(m && m.vuLe), connue=connecte && Number.isFinite(date) && date>0;
            return {nom:coeur.texte(m && m.pseudo,30),etat:!connue?'inconnue':(date<=maintenant+30000 && maintenant-date<=120000?'recente':'ancienne')};
        }).filter(function(m){return m.nom && m.etat!=='ancienne';});
        var signature=JSON.stringify([liste,discret,connecte]);
        if(signature===signatureParticipants)return;
        signatureParticipants=signature;zone.hidden=discret || !liste.length;
        noms.textContent='';
        liste.forEach(function(m){var puce=document.createElement('span');puce.className='salon-participant'+(m.etat==='recente'?' salon-participant-recent':'');puce.textContent=m.nom;puce.title=m.etat==='recente'?'Activité récente':'Présence non vérifiée';noms.appendChild(puce);});
        statut('salonParticipantsInfo',!connecte?'Connexion interrompue · présences non vérifiées':liste.some(function(m){return m.etat==='inconnue';})?'Présence de certains participants non vérifiée.':'Point vert : activité dans les deux dernières minutes.');
    }
    function finirLocal(message, finOrganisateur) {
        var bilanFinal=salle && salle.bilan;
        window.salonFermerMini();clearTimeout(objectifTimer); if(arreterEcoute)arreterEcoute();arreterEcoute=null;clearInterval(timer);timer=null;stopperAudio();audioAutorise=false;
        var video=$('salonDecor').querySelector('video');if(video){video.pause();video.removeAttribute('src');video.load();}
        try { sessionStorage.removeItem('studyPlanIB_salon_session'); } catch(e) {}
        $('salonEcran').hidden=true;$('salonRaccourci').hidden=true;session=null;salle=null;adresseSalon(null);document.body.classList.remove('salon-actif');protegerReglages(false);$('salonLienCarte').hidden=true;
        focusFermer('focusReglages');focusFermer('focusTaches');focusFermer('focusSons');
        sonsPersonnels.forEach(focusLireSon);sonsPersonnels=[];focusPeindreSonBouton();connecte=false;occupe=false;
        $('salonSortieLocale').hidden=true;$('salonFormTitre').textContent='Créer un salon';$('salonCreer').hidden=false;$('salonMajPartage').hidden=true;$('salonRetour').hidden=true;$('salonNom').disabled=false;
        pret();statut('salonStatutCreation',message||'Tu as quitté le salon.');
        editionPartage=false;
        if(finOrganisateur) {
            focusChoisirOnglet('themes');
            var fin=$('salonFinDialog');if(fin.parentNode!==document.body)document.body.appendChild(fin);if(!fin.open)fin.showModal();
            return;
        }
        if ($('focusReglages').hidden) focusBasculerReglages();focusChoisirOnglet('salon');
        if(bilanFinal && Number.isFinite(bilanFinal.secondes) && Number.isFinite(bilanFinal.sessions)) {
            $('salonBilanFinal').textContent=Math.floor(Math.max(0,bilanFinal.secondes)/60)+' min de concentration · '+Math.max(0,bilanFinal.sessions)+' session(s) terminée(s) ensemble.';
            var dialogBilan=$('salonBilanDialog'); if(dialogBilan.parentNode!==document.body)document.body.appendChild(dialogBilan);if(!dialogBilan.open)dialogBilan.showModal();
        }
    }
    window.salonQuitter=function () {
        if(!session || occupe)return;
        if(session.role==='hote' && !window.confirm('Fermer le salon pour toutes les personnes présentes ?')) return;
        var s=session;occupe=true;statut('salonMessage',s.role==='hote'?'Fermeture du salon…':'Départ du salon…');
        var operation=s.role==='hote'?s.fermer():s.quitter();
        Promise.resolve(operation).then(function(){if(session===s)finirLocal(s.role==='hote'?'Salon fermé.':'Tu as quitté le salon.');},function(e){occupe=false;$('salonSortieLocale').hidden=false;statut('salonMessage',erreur(e)+' Tu peux quitter cet appareil ; le salon peut rester ouvert pour les autres.');});
    };
    window.salonSortieLocale=function(){if(!session)return;finirLocal('Tu as quitté sur cet appareil. Le salon peut être encore ouvert pour les autres.');};
})();
