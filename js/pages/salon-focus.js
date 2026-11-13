/* Salon focus — interface et orchestration indépendantes du transport.
   Le transport réel doit être installé et protégé AVANT activation. Pour les
   tests uniquement, window.SALON_FOCUS_TRANSPORT peut être injecté au démarrage.
   Les échanges sont limités aux éléments explicitement cochés. */
(function () {
    'use strict';
    var coeur = window.SalonFocusCoeur;
    var transport = window.SALON_FOCUS_TRANSPORT || null;
    var session = null, salle = null, arreterEcoute = null, timer = null;
    var invitation = window.__salonInvitation || null, reprise = null;
    if (!invitation) {
        try { var ancien = JSON.parse(sessionStorage.getItem('studyPlanIB_salon_session') || 'null');
            if (ancien && /^[a-f0-9]{48}$/.test(ancien.id) && ['hote','invite'].indexOf(ancien.role) >= 0) { invitation=ancien.id; reprise=ancien; }
        } catch (e) {}
    }
    try { delete window.__salonInvitation; } catch (e) { window.__salonInvitation = null; }
    var occupe = false, connecte = false, audioAutorise = false, lecteurs = {}, signatureAudio = '';
    var fondMontre = '', playlistChoisie = null, local = null, sonsPersonnels = [], generationAudio = 0;
    var volumeSalon = 1, discret = false, signalFin = 'visuel', contexteSignal = null, finObservee = 0, signalees = {};
    var objectifTimer = null, fileMembre = Promise.resolve(), signatureGroupe = '', partageInitialise = false;
    try {
        var preference = JSON.parse(localStorage.getItem('studyPlanIB_salon_preferences') || '{}');
        volumeSalon = typeof preference.volume === 'number' ? Math.max(0, Math.min(1, preference.volume)) : 1;
        discret = preference.discret === true;
        if (['visuel','son','aucun'].indexOf(preference.signal) >= 0) signalFin = preference.signal;
    } catch (e) {}
    var $ = function (id) { return document.getElementById(id); };
    function statut(id, message) { var el = $(id), valeur = message || ''; if (el && el.textContent !== valeur) el.textContent = valeur; }
    function heure() { return session && typeof session.maintenant === 'function' ? session.maintenant() : Date.now(); }
    function options() { var r={}; document.querySelectorAll('[name="salonPartage"]').forEach(function (e) { r[e.value] = e.checked; }); return coeur.autorisations(r); }
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
        if (e && (e.code === 'room-closed' || e.code === 'not-found' || e.code === 'removed')) return 'Ce salon est fermé, expiré ou introuvable.';
        if (e && e.code === 'revision-conflict') return 'Le salon a changé. Attends la synchronisation puis réessaie.';
        if (e && e.code === 'permission-denied') return 'Accès refusé. Le service du salon doit être configuré ou ce lien n’est plus valide.';
        return 'Impossible de joindre le salon pour le moment. Réessaie.';
    }
    function pret() {
        if (!$('salonCreer')) return;
        var actif = !!(transport && typeof transport.creer === 'function' && typeof transport.rejoindre === 'function');
        $('salonCreer').disabled = !actif;
        statut('salonStatutCreation', actif ? 'Les invités rejoignent gratuitement avec un pseudo. Le lien donne accès au salon.' : 'Le service de salon n’est pas encore activé.');
        $('salonBadge').textContent = actif ? 'Un espace à partager' : 'En préparation';
        if (invitation) {
            var dialog=$('salonInvitation');
            // Le dialogue doit être visible avant d'ouvrir la page Pomodoro.
            if (dialog && dialog.parentNode !== document.body) document.body.appendChild(dialog);
            if (reprise && reprise.role === 'hote') {
                $('salonInvitationTitre').textContent='Reprendre ton salon';
                $('salonInvitationDescription').textContent='Reconnecte-toi pour retrouver ton salon et son minuteur.';
                $('salonPseudo').hidden=true;$('salonPseudo').required=false;$('salonPseudoLabel').hidden=true;
                $('salonRejoindreBouton').textContent='Reprendre';
            } else if (reprise) $('salonPseudo').value=coeur.texte(reprise.pseudo,30);
            if (dialog && !dialog.open) dialog.showModal();
            if (!actif) { $('salonRejoindreBouton').disabled=true; statut('salonInvitationStatut','Le service de salon n’est pas encore activé.'); }
        }
    }
    function init() {
        if (!window.__STUDYPLAN_READY) { setTimeout(init, 80); return; }
        pret();
    }
    setTimeout(init,0);
    function commencer(s, initial, pseudo) {
        if (!s || !/^[a-f0-9]{48}$/.test(s.id) || ['hote','invite'].indexOf(s.role) < 0 || typeof s.maintenant !== 'function' || typeof s.observer !== 'function' || typeof s.modifier !== 'function' || typeof s.quitter !== 'function' || typeof s.fermer !== 'function') throw new Error('Session invalide');
        session = s;
        try { sessionStorage.setItem('studyPlanIB_salon_session',JSON.stringify({id:s.id,role:s.role,pseudo:coeur.texte(pseudo,30)})); } catch(e) {}
        local = initial || etatPersonnel(); salle = null; connecte = false; fondMontre = ''; signatureGroupe=''; finObservee=0; signalees={}; partageInitialise=false;
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
        $('salonEcran').hidden = false; $('salonRaccourci').hidden = true;
        $('salonCommandes').hidden = session.role !== 'hote';
        $('salonAttente').hidden = session.role === 'hote';
        $('salonReglages').hidden = session.role !== 'hote';
        $('salonQuitterBouton').textContent = session.role === 'hote' ? 'Fermer le salon' : 'Quitter le salon';
        statut('salonMessage',minuteurPersonnelPause ? 'Ton minuteur personnel a été mis en pause pendant le salon.' : 'Le minuteur du salon est indépendant de ton minuteur personnel.');
        arreterEcoute = session.observer(function (data, etat) {
            connecte = !!(etat && etat.connecte);
            if (data && salle && Number(data.revision) < Number(salle.revision)) return;
            if (data && data.ferme) { finirLocal('Le salon a été fermé par son organisateur.'); return; }
            if (data) {
                salle = data;
                if (session.uid && data.organisateurUid) {
                    session.role = data.organisateurUid === session.uid ? 'hote' : 'invite';
                    try { var memo=JSON.parse(sessionStorage.getItem('studyPlanIB_salon_session')||'{}'); memo.role=session.role; sessionStorage.setItem('studyPlanIB_salon_session',JSON.stringify(memo)); } catch(e) {}
                }
                if (session.role === 'hote' && !playlistChoisie && data.options && data.options.musique && data.partage && data.partage.musique)
                    playlistChoisie = coeur.contenus({musique:true},{musique:data.partage.musique}).musique;
            }
            statut('salonEtatConnexion', connecte ? '● Connecté en direct' : '○ Reconnexion en cours');
            peindre();
        }, function (e) { if(e && (e.code==='removed' || e.code==='room-closed')) { finirLocal(e.code==='removed'?'Tu as été retiré du salon.':'Le salon a été fermé.'); return; } connecte=false;statut('salonEtatConnexion','○ Connexion interrompue');statut('salonMessage',erreur(e));peindre(); });
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
    window.salonAnnulerInvitation = function () { invitation=null;reprise=null;try{sessionStorage.removeItem('studyPlanIB_salon_session');}catch(e){} $('salonInvitation').close(); };
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
        focusBasculerReglages();focusChoisirOnglet('salon');
    };
    window.salonRevenir=function () { focusFermer('focusReglages');$('salonRaccourci').hidden=true;$('salonEcran').hidden=false; };
    window.salonActualiserPartage=function () {
        envoyer({options:options(),partage:selectionPartagee()}).then(function(ok){if(ok)window.salonRevenir();});
    };
    function lien() { var u=new URL(location.href);u.search='';u.hash='salon='+session.id;return u.href; }
    window.salonCopierLien=function () {
        if (!session) return;
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(lien()).then(function(){statut('salonMessage','Lien copié. Partage-le uniquement avec tes invités.');},function(){afficherLien();});
        else afficherLien();
    };
    function afficherLien() {
        var p=$('salonMessage');p.textContent='Copie ce lien : ';var input=document.createElement('input');input.value=lien();input.readOnly=true;input.setAttribute('aria-label','Lien d’invitation');p.appendChild(input);input.select();
    }
    function stopperAudio() { generationAudio++; Object.keys(lecteurs).forEach(function (id){lecteurs[id].pause();lecteurs[id].removeAttribute('src');lecteurs[id].load();});lecteurs={};signatureAudio=''; }
    window.salonActiverAudio=function () { audioAutorise=!audioAutorise;if (!audioAutorise) stopperAudio();signatureAudio='';peindre(); };
    function peindreAudio(partage, opts) {
        var ids=[];
        var sons=opts.sons ? partage.sons : local.sons;
        var musique=opts.musique ? partage.musique : local.musique;
        if (Array.isArray(sons)) ids=ids.concat(sons);
        if (musique && Array.isArray(musique.sons)) ids=ids.concat(musique.sons);
        ids=ids.filter(function(id,i,a){return a.indexOf(id)===i && !!focusSonParId(id);});
        $('salonAutoriserAudio').hidden=!ids.length;
        $('salonAutoriserAudio').textContent=audioAutorise?'Couper les sons':'Activer les sons';
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
        if (salle.chrono.running && salle.chrono.fin > 0 && c.restant > 0) { finObservee=salle.chrono.fin; $('salonSignalVisuel').hidden=true; }
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
        $('salonCommandes').hidden=!hote; $('salonAttente').hidden=hote; $('salonReglages').hidden=!hote;
        $('salonQuitterBouton').textContent=hote?'Fermer le salon':'Quitter le salon';
        $('salonOutilsHote').hidden=!hote;$('salonAmbianceHote').hidden=!hote;
        $('salonPret').disabled=!connecte || typeof session.personnaliser!=='function';
        $('salonObjectifPartager').disabled=typeof session.personnaliser!=='function' || (!connecte && !$('salonObjectifPartager').checked);
        $('salonPret').textContent=m && m.pret?'✨ Je ne suis plus prêt':'✨ Je suis prêt';
        $('salonVerrou').textContent=salle.verrouille?'Déverrouiller le salon':'Verrouiller le salon';
        $('salonVerrou').disabled=!connecte || typeof session.verrouiller!=='function';
        $('salonCoupPouce').disabled=!connecte || typeof session.demanderAide!=='function';
        var bilan=salle.bilan;
        statut('salonBilan',bilan && Number.isFinite(bilan.secondes) && Number.isFinite(bilan.sessions) ? Math.floor(Math.max(0,bilan.secondes)/60)+' min de concentration · '+Math.max(0,bilan.sessions)+' session(s) terminée(s) ensemble' : 'Le bilan commun apparaîtra après les premières sessions terminées.');
        statut('salonGroupeInfo',membres.length ? membres.filter(function(x){return x.pret;}).length+' prêt(s) sur '+membres.length+' participant(s)' : 'Les participants apparaîtront ici.');
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
        $('salonTitre').textContent=coeur.texte(salle.nom,60);
        $('salonPhase').textContent=({focus:'Concentration',short:'Pause courte',long:'Pause longue'})[c.mode];
        $('salonTemps').textContent=focusTexte(c.restant);
        statut('salonInfoChrono',c.restant===0?'Temps écoulé · en attente de l’organisateur':(c.running?'En cours':'En pause'));
        $('salonDemarrer').textContent=c.running?'Mettre en pause':'Démarrer';
        signalerFin(c);peindreGroupe();
        $('salonCommandes').querySelectorAll('button').forEach(function(b){b.disabled=!connecte||occupe;if(b.dataset.mode)b.setAttribute('aria-pressed',String(b.dataset.mode===c.mode));});
        var h=choix.horloge && p.horloge ? p.horloge : local.horloge;
        var police=FOCUS_POLICES.some(function(x){return x.id===h.police})?h.police:'gras';
        var taille=FOCUS_TAILLES.some(function(x){return x.id===h.taille})?h.taille:'normale';
        $('salonEcran').className='salon-ecran focus-police-'+police+' focus-taille-'+taille;
        $('salonHeure').textContent=new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
        var citation=choix.citations && p.citation ? p.citation : local.citation;
        $('salonCitation').textContent=citation.visible?citation.texte:'';
        var decorPartage = choix.theme && p.theme;
        decor(decorPartage ? p.theme : local.themeLocal, !decorPartage);
        peindreAudio(p,choix);
        var membres=Array.isArray(salle.membres)?salle.membres:[];
        statut('salonMembres',membres.length ? 'Participants : '+membres.slice(0,40).map(function(m){return coeur.texte(m && m.pseudo,30);}).filter(Boolean).join(' · ') : '');
    }
    function finirLocal(message) {
        var bilanFinal=salle && salle.bilan;
        clearTimeout(objectifTimer); if(arreterEcoute)arreterEcoute();arreterEcoute=null;clearInterval(timer);timer=null;stopperAudio();audioAutorise=false;
        var video=$('salonDecor').querySelector('video');if(video){video.pause();video.removeAttribute('src');video.load();}
        try { sessionStorage.removeItem('studyPlanIB_salon_session'); } catch(e) {}
        $('salonEcran').hidden=true;$('salonRaccourci').hidden=true;session=null;salle=null;
        sonsPersonnels.forEach(focusLireSon);sonsPersonnels=[];focusPeindreSonBouton();connecte=false;occupe=false;
        $('salonSortieLocale').hidden=true;$('salonFormTitre').textContent='Créer un salon';$('salonCreer').hidden=false;$('salonMajPartage').hidden=true;$('salonRetour').hidden=true;$('salonNom').disabled=false;
        pret();statut('salonStatutCreation',message||'Tu as quitté le salon.');
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
