/* Adaptateur Firebase du Salon focus : version d'essai non vérifiée en réel. */
(function (root) {
    'use strict';
    function creerAdaptateur(deps) {
        var coeur = deps.coeur, firebase = deps.firebase, config = deps.config;
        var horloge = deps.horloge || function () { return Date.now(); };
        var alea = deps.crypto, appInvite = null;
        function erreur(code) { var e = new Error(code); e.code = code; return e; }
        function authInitialisee(auth) {
            return new Promise(function (resolve, reject) {
                var retirer = auth.onAuthStateChanged(function (u) { if (retirer) retirer(); resolve(u); }, reject);
            });
        }
        async function organisateur() {
            var auth = firebase.auth(), user = await authInitialisee(auth);
            if (!user || user.isAnonymous) throw erreur('auth-required');
            return { auth: auth, user: user, db: firebase.firestore() };
        }
        async function invite() {
            if (!appInvite) {
                appInvite = firebase.apps.filter(function(a){return a.name === 'salon-focus-invite';})[0]
                    || firebase.initializeApp(config, 'salon-focus-invite');
            }
            var auth = appInvite.auth();
            await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);
            var user = await authInitialisee(auth);
            if (!user) user = (await auth.signInAnonymously()).user;
            if (!user || !user.isAnonymous) throw erreur('auth-required');
            return { auth:auth, user:user, db:appInvite.firestore() };
        }
        async function heureServeur(contexte) {
            var ref=contexte.db.collection('salons_focus_horloges').doc(contexte.user.uid);
            var debut=horloge();
            await contexte.db.runTransaction(function(tx){tx.set(ref,{at:firebase.firestore.FieldValue.serverTimestamp()});return Promise.resolve();});
            var snap=await ref.get({source:'server'}), fin=horloge(), timestamp=snap.exists && snap.data().at;
            if (!timestamp || typeof timestamp.toMillis !== 'function' || fin < debut) throw erreur('clock-unavailable');
            return timestamp.toMillis()-(debut+(fin-debut)/2);
        }
        function validationId(id) { if (!/^[a-f0-9]{48}$/.test(id)) throw erreur('not-found'); }
        async function session(contexte,id,role,offset) {
            validationId(id);
            var db=contexte.db, room=db.collection('salons_focus').doc(id), membre=room.collection('membres').doc(contexte.user.uid);
            var delta=offset, ferme=false, listeConfirmee=[];
            function maintenant(){return Math.round(horloge()+delta);}
            function objet(snap){ if(!snap.exists)throw erreur('not-found');return snap.data(); }
            function observer(callback,surErreur) {
                var salle=null, membres=null, synchroniseSalle=false, synchroniseMembres=false, arrete=false;
                function emettre(){if(!arrete && salle && salle.ferme)callback(salle,{connecte:synchroniseSalle});else if(!arrete && salle && membres)callback(Object.assign({},salle,{membres:membres}),{connecte:synchroniseSalle&&synchroniseMembres});}
                var a=room.onSnapshot({includeMetadataChanges:true},function(snap){
                    synchroniseSalle=!snap.metadata.fromCache&&!snap.metadata.hasPendingWrites;
                    if(!synchroniseSalle) { emettre();return; }
                    if (!snap.exists) { surErreur(erreur('not-found'));return; }
                    salle=snap.data();emettre();
                },function(e){if(!arrete)surErreur(e);});
                var b=room.collection('membres').onSnapshot({includeMetadataChanges:true},function(snap){
                    synchroniseMembres=!snap.metadata.fromCache&&!snap.metadata.hasPendingWrites;
                    if(!synchroniseMembres) { emettre();return; }
                    membres=snap.docs.map(function(d){return {uid:d.id,pseudo:d.data().pseudo};});listeConfirmee=membres;emettre();
                },function(e){if(!arrete && !(salle && salle.ferme))surErreur(e);});
                var interval=setInterval(function(){if(!arrete && !ferme)heureServeur(contexte).then(function(d){delta=d;},function(){surErreur(erreur('clock-unavailable'));});},60000);
                return function(){arrete=true;clearInterval(interval);a();b();};
            }
            async function modifier(revision,changement) {
                if (role!=='hote') throw erreur('permission-denied');
                var cles=Object.keys(changement || {});
                if (!cles.length || cles.some(function(k){return ['chrono','options','partage'].indexOf(k)<0;})) throw erreur('permission-denied');
                return db.runTransaction(async function(tx){
                    var d=objet(await tx.get(room));
                    if(d.ferme)throw erreur('room-closed');
                    if(d.organisateurUid!==contexte.user.uid)throw erreur('permission-denied');
                    if(d.revision!==revision)throw erreur('revision-conflict');
                    var patch=Object.assign({},changement,{revision:revision+1});
                    tx.update(room,patch);
                    // La résolution de la transaction confirme son commit ; inutile
                    // d'effectuer ensuite une lecture qui pourrait échouer et laisser
                    // croire que la modification confirmée n'a pas eu lieu.
                    return Object.assign({},d,patch,{membres:listeConfirmee.slice()});
                });
            }
            async function quitter(){await db.runTransaction(function(tx){tx.delete(membre);return Promise.resolve();});}
            async function fermer(){
                if(role!=='hote')throw erreur('permission-denied');
                await db.runTransaction(async function(tx){var d=objet(await tx.get(room));if(d.organisateurUid!==contexte.user.uid)throw erreur('permission-denied');if(d.ferme)return;tx.update(room,{ferme:true,revision:d.revision+1});});ferme=true;
            }
            return {id:id,uid:contexte.user.uid,role:role,maintenant:maintenant,observer:observer,modifier:modifier,quitter:quitter,fermer:fermer};
        }
        async function creer(donnees) {
            var contexte=await organisateur(), delta=await heureServeur(contexte);
            var id=coeur.nouvelIdentifiant(alea), db=contexte.db, room=db.collection('salons_focus').doc(id);
            var membre=room.collection('membres').doc(contexte.user.uid);
            var nom=coeur.texte(donnees.nom,60);if(!nom)throw erreur('invalid-argument');
            var opts=coeur.autorisations(donnees.options), contenu=coeur.contenus(opts,donnees.partage);
            var chrono=coeur.temps(donnees.chrono,horloge()+delta);
            var data={nom:nom,organisateurUid:contexte.user.uid,revision:1,ferme:false,verrouille:false,chrono:chrono,options:opts,partage:contenu,expireLe:firebase.firestore.Timestamp.fromMillis(horloge()+delta+12*60*60*1000)};
            await db.runTransaction(async function(tx){if((await tx.get(room)).exists)throw erreur('already-exists');tx.set(room,data);tx.set(membre,{pseudo:'Organisateur'});});
            return session(contexte,id,'hote',delta);
        }
        async function rejoindre(id,pseudo) {
            validationId(id);pseudo=coeur.texte(pseudo,30);if(!pseudo)throw erreur('invalid-argument');
            var contexte=await invite(), delta=await heureServeur(contexte), room=contexte.db.collection('salons_focus').doc(id), membre=room.collection('membres').doc(contexte.user.uid);
            await contexte.db.runTransaction(async function(tx){
                var snap=await tx.get(room);if(!snap.exists)throw erreur('not-found');var d=snap.data();
                if(d.ferme || !d.expireLe || d.expireLe.toMillis() <= horloge()+delta)throw erreur('room-closed');
                var existant=await tx.get(membre);if(d.verrouille && !existant.exists)throw erreur('room-locked');
                tx.set(membre,{pseudo:pseudo});
            });
            return session(contexte,id,'invite',delta);
        }
        async function reprendre(id) {
            validationId(id);var contexte=await organisateur(), delta=await heureServeur(contexte), room=contexte.db.collection('salons_focus').doc(id);
            var snap=await room.get({source:'server'});if(!snap.exists)throw erreur('not-found');var d=snap.data();
            if(d.ferme || !d.expireLe || d.expireLe.toMillis()<=horloge()+delta)throw erreur('room-closed');
            if(d.organisateurUid!==contexte.user.uid)throw erreur('permission-denied');
            return session(contexte,id,'hote',delta);
        }
        return {creer:creer,rejoindre:rejoindre,reprendre:reprendre};
    }
    if (typeof module==='object' && module.exports) module.exports=creerAdaptateur;
    else {
        root.creerTransportSalonFirebase=creerAdaptateur;
        // Le transport simulé des tests reste indépendant du vrai Firebase.
        if (!root.SALON_FOCUS_TRANSPORT && !root.__STUDYPLAN_E2E) {
            var charge=null;
            function obtenir() {
                if (!charge) charge=Promise.resolve().then(function(){
                    if (typeof root.compteChargerFirebase !== 'function') throw new Error('Firebase indisponible');
                    return root.compteChargerFirebase();
                }).then(function(firebase){
                    return creerAdaptateur({coeur:root.SalonFocusCoeur,firebase:firebase,config:root.STUDYPLAN_FIREBASE_CONFIG,crypto:root.crypto});
                }).catch(function(e){charge=null;throw e;});
                return charge;
            }
            root.SALON_FOCUS_TRANSPORT={
                creer:function(d){return obtenir().then(function(t){return t.creer(d);});},
                rejoindre:function(id,pseudo){return obtenir().then(function(t){return t.rejoindre(id,pseudo);});},
                reprendre:function(id){return obtenir().then(function(t){return t.reprendre(id);});}
            };
        }
    }
})(typeof window==='undefined'?globalThis:window);
