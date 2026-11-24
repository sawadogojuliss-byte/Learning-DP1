/* Conversation vocale WebRTC. La signalisation ne transporte jamais l'audio. */
(function(root) {
    'use strict';
    function creer(options) {
        var canal=options.canal, uid=options.uid, instance=options.instance, statut=options.statut||function(){}, audioRecu=options.audioRecu||function(){}, audioRetire=options.audioRetire||function(){};
        var creerConnexion=options.creerConnexion||function(config){return new RTCPeerConnection(config);};
        var rtc=options.iceServers||[{urls:'stun:stun.l.google.com:19302'}];
        var pairs=new Map(), presents=new Map(), attente=[], arrets=[], courant=true, flux=null, versionMicro=0, pret=false;
        var maxPairs=7, dernieresPresences=[], operationJoindre=null, fermeture=null;
        var microSouhaite=false, repriseMicro=null, delaiReprise=2000, erreursEcoute={presences:null,signaux:null};
        function erreur(e){ if(courant)statut('erreur',e); }
        function ecouter(type,callback) {
            // Firestore ferme définitivement une écoute après son callback
            // d'erreur. Sans réabonnement, le micro peut rester actif alors que
            // plus aucune présence ou offre ne peut être reçue.
            var ferme=false, timer=null, stop=null, generation=0, delai=2000;
            function ouvrir() {
                if(ferme || !courant)return;
                var version=++generation;
                function panne(e) {
                    if(ferme || version!==generation)return;
                    generation++;erreursEcoute[type]=e || new Error('voice-listener-error');
                    if(stop){stop();stop=null;}
                    statut('signalisation-interrompue',e);
                    timer=setTimeout(function(){timer=null;ouvrir();},delai);delai=Math.min(delai*2,30000);
                }
                try {
                    function confirme(){if(!ferme && version===generation){erreursEcoute[type]=null;delai=2000;}}
                    var fermeture=canal[type](function(valeur){
                        if(ferme || version!==generation)return;
                        confirme();callback(valeur);
                    },panne,confirme);
                    if(version!==generation || ferme){if(typeof fermeture==='function')fermeture();}
                    else stop=fermeture;
                } catch(e) {panne(e);}
            }
            ouvrir();
            return function(){ferme=true;generation++;if(timer)clearTimeout(timer);if(typeof stop==='function')stop();};
        }
        function fermerPair(id) {
            var p=pairs.get(id);if(!p)return;pairs.delete(id);p.ferme=true;
            p.attentesSignal.forEach(function(a){clearTimeout(a.timer);a.resolve();});p.attentesSignal.clear();
            if(p.repriseConnexion){clearTimeout(p.repriseConnexion);p.repriseConnexion=null;}
            if(p.surveillanceConnexion){clearTimeout(p.surveillanceConnexion);p.surveillanceConnexion=null;}
            if(p.timerCandidats){clearTimeout(p.timerCandidats);p.timerCandidats=null;}
            try {p.pc.ontrack=null;p.pc.onconnectionstatechange=null;p.pc.close();} catch(e){}
            audioRetire(id);
        }
        async function envoyerAvecReprise(p,id,cle,type,sdp) {
            var delai=2000;
            while(courant && !p.ferme) {
                try {await canal.envoyer(id,cle,type,sdp);p.erreurEnvoi=null;return;}
                catch(e) {
                    if(!courant || p.ferme)return;
                    p.erreurEnvoi=e || new Error('voice-send-error');statut('signalisation-interrompue',e);
                    await new Promise(function(resolve){var attente={resolve:resolve,timer:null};attente.timer=setTimeout(function(){p.attentesSignal.delete(attente);resolve();},delai);p.attentesSignal.add(attente);});
                    delai=Math.min(delai*2,30000);
                }
            }
        }
        function envoyerCandidats(p,id,cle) {
            if(!courant || p.ferme || !p.descriptionEnvoyee || !p.candidatsLocaux.length || p.envoiCandidats)return;
            var groupe=[], taille=2;
            while(p.candidatsLocaux.length && groupe.length<50){
                var candidat=p.candidatsLocaux.shift(), volume=JSON.stringify(candidat).length+1;
                if(volume>28000)continue;
                if(taille+volume>28000){p.candidatsLocaux.unshift(candidat);break;}
                groupe.push(candidat);taille+=volume;
            }
            if(!groupe.length)return;p.envoiCandidats=true;
            envoyerAvecReprise(p,id,cle,'candidate',JSON.stringify(groupe)).finally(function(){
                p.envoiCandidats=false;if(p.candidatsLocaux.length)planifierCandidats(p,id,cle);
            });
        }
        function planifierCandidats(p,id,cle) {
            if(!p.descriptionEnvoyee || p.timerCandidats || p.ferme)return;
            p.timerCandidats=setTimeout(function(){p.timerCandidats=null;envoyerCandidats(p,id,cle);},500);
        }
        async function ajouterCandidats(p,candidats) {
            if(!Array.isArray(candidats) || candidats.length>50)return;
            var ufrag=p.pc.remoteDescription && /(?:^|\r?\n)a=ice-ufrag:([^\r\n]+)/.exec(p.pc.remoteDescription.sdp || '');
            for(var i=0;i<candidats.length;i++) {
                var c=candidats[i];
                if(!c || typeof c.candidate!=='string' || c.candidate.length>2048)continue;
                if(!p.pc.remoteDescription || (c.usernameFragment && ufrag && c.usernameFragment!==ufrag[1])) {
                    if(p.candidatsDistants.length<100)p.candidatsDistants.push(c);continue;
                }
                try {await p.pc.addIceCandidate(c);} catch(e) { /* Candidat expiré ou redondant. */ }
            }
        }
        async function viderCandidatsDistants(p) {
            var enAttente=p.candidatsDistants;p.candidatsDistants=[];await ajouterCandidats(p,enAttente);
        }
        function relancerConnexion(p,id,cle) {
            if(!courant || p.ferme || uid>=id || p.repriseConnexion)return;
            var delai=p.delaiConnexion||3000;p.delaiConnexion=Math.min(delai*2,30000);
            p.repriseConnexion=setTimeout(function(){
                p.repriseConnexion=null;if(!courant || p.ferme || p.pc.connectionState==='connected')return;
                p.file=p.file.then(async function(){
                    if(!courant || p.ferme || p.pc.connectionState==='connected')return;
                    if(p.pc.signalingState==='have-local-offer'){
                        // Si la réponse a été perdue, annuler l'offre initiale
                        // peut changer le mid audio. Le destinataire ayant déjà
                        // répondu refuserait alors la nouvelle offre. Réexpédier
                        // la même offre conserve l'identité de la section média.
                        await envoyerAvecReprise(p,id,cle,'offer',p.pc.localDescription.sdp);
                        return;
                    }
                    if(p.pc.signalingState!=='stable')return;
                    p.descriptionEnvoyee=false;p.candidatsLocaux=[];
                    await p.pc.setLocalDescription(await p.pc.createOffer({iceRestart:true}));
                    if(!p.ferme && courant){await envoyerAvecReprise(p,id,cle,'offer',p.pc.localDescription.sdp);p.descriptionEnvoyee=true;planifierCandidats(p,id,cle);}
                }).catch(erreur).then(function(){if(p.pc.connectionState!=='connected')relancerConnexion(p,id,cle);});
            },delai);
        }
        function surveillerConnexion(p,id,cle,delai) {
            // Une offre ou une réponse peut se perdre sans que WebRTC passe à
            // failed. L'initiateur seul relance, après un délai de grâce.
            if(!courant || p.ferme || uid>=id || p.surveillanceConnexion || p.repriseConnexion)return;
            p.surveillanceConnexion=setTimeout(function(){
                p.surveillanceConnexion=null;
                if(courant && !p.ferme && p.pc.connectionState!=='connected')relancerConnexion(p,id,cle);
            },delai);
        }
        function nouveau(id, cle) {
            var pc=creerConnexion({iceServers:rtc}), trans=uid<id?pc.addTransceiver('audio',{direction:'sendrecv'}):null;
            var p={pc:pc,trans:trans,cle:cle,file:Promise.resolve(),fileMicro:Promise.resolve(),ferme:false,descriptionEnvoyee:false,candidatsLocaux:[],candidatsDistants:[],envoiCandidats:false,attentesSignal:new Set()};pairs.set(id,p);
            pc.onicecandidate=function(ev){if(!courant || p.ferme || !ev.candidate)return;var c=ev.candidate.toJSON();if(p.candidatsLocaux.length<100)p.candidatsLocaux.push(c);planifierCandidats(p,id,cle);};
            pc.ontrack=function(ev){if(courant && !p.ferme)audioRecu(id,ev.streams && ev.streams[0] || new MediaStream([ev.track]));};
            pc.onconnectionstatechange=function(){
                if(!courant || p.ferme)return;
                if(pc.connectionState==='failed'){
                    if(p.surveillanceConnexion)clearTimeout(p.surveillanceConnexion);p.surveillanceConnexion=null;
                    statut('connexion-impossible',id);relancerConnexion(p,id,cle);
                } else if(pc.connectionState==='connected'){
                    if(p.repriseConnexion)clearTimeout(p.repriseConnexion);p.repriseConnexion=null;
                    if(p.surveillanceConnexion)clearTimeout(p.surveillanceConnexion);p.surveillanceConnexion=null;
                    p.delaiConnexion=3000;statut('connecte',id);
                } else if(pc.connectionState==='disconnected')surveillerConnexion(p,id,cle,12000);
            };
            surveillerConnexion(p,id,cle,20000);
            if(trans && flux && flux.getAudioTracks()[0])mettrePiste(p,flux.getAudioTracks()[0],versionMicro).catch(erreur);
            if(uid<id) {
                p.file=p.file.then(async function(){
                    if(p.ferme || !courant)return;
                    await pc.setLocalDescription(await pc.createOffer());
                    if(!p.ferme && courant){await envoyerAvecReprise(p,id,cle,'offer',pc.localDescription.sdp);p.descriptionEnvoyee=true;planifierCandidats(p,id,cle);}
                }).catch(erreur);
            }
            return p;
        }
        function appliquer(signal) {
            if(!courant || signal.versInstance!==instance || signal.auteur===uid)return;
            var cle=presents.get(signal.auteur);
            if(!cle){attente.push(signal);if(attente.length>50)attente.shift();return;}
            if(cle!==signal.deInstance)return;
            var p=pairs.get(signal.auteur);if(!p || p.cle!==cle)return;
            p.file=p.file.then(async function(){
                if(p.ferme || !courant)return;
                if(signal.type==='candidate') {
                    try {await ajouterCandidats(p,JSON.parse(signal.sdp));} catch(e) {}
                } else if(signal.type==='offer' && uid>signal.auteur && p.pc.signalingState==='stable') {
                    await p.pc.setRemoteDescription({type:'offer',sdp:signal.sdp});await viderCandidatsDistants(p);
                    p.trans=p.pc.getTransceivers().find(function(t){return t.receiver && t.receiver.track && t.receiver.track.kind==='audio';});
                    if(!p.trans)throw new Error('audio-transceiver-missing');
                    p.trans.direction='sendrecv';
                    if(flux && flux.getAudioTracks()[0])await mettrePiste(p,flux.getAudioTracks()[0],versionMicro);
                    p.descriptionEnvoyee=false;p.candidatsLocaux=[];
                    await p.pc.setLocalDescription(await p.pc.createAnswer());
                    if(!p.ferme && courant){await envoyerAvecReprise(p,signal.auteur,cle,'answer',p.pc.localDescription.sdp);p.descriptionEnvoyee=true;planifierCandidats(p,signal.auteur,cle);}
                } else if(signal.type==='answer' && uid<signal.auteur && p.pc.signalingState==='have-local-offer') {
                    await p.pc.setRemoteDescription({type:'answer',sdp:signal.sdp});await viderCandidatsDistants(p);
                }
            }).catch(erreur);
        }
        function actualiser(liste) {
            if(!courant)return;
            dernieresPresences=liste;if(!pret)return;
            var propre=liste.find(function(x){return x.uid===uid && x.recent;});
            if(propre && propre.instance!==instance){statut('remplace');fermer();return;}
            var tous=liste.filter(function(x){return x.uid && x.instance && x.recent;}).sort(function(a,b){return a.uid<b.uid?-1:a.uid>b.uid?1:0;});
            // Même ensemble de huit pour tous : pas de liaisons asymétriques.
            if(tous.length>maxPairs+1)statut('capacite');
            var selection=tous.slice(0,maxPairs+1);
            var valides=selection.some(function(x){return x.uid===uid && x.instance===instance;}) ? selection.filter(function(x){return x.uid!==uid;}) : [];
presents=new Map(valides.map(function(x){return [x.uid,x.instance];}));
            pairs.forEach(function(p,id){if(!presents.has(id)||presents.get(id)!==p.cle)fermerPair(id);});
            valides.forEach(function(x){if(!pairs.has(x.uid))nouveau(x.uid,x.instance);});
            var reste=attente;attente=[];reste.forEach(appliquer);
        }
        async function demarrer() {
            if(!courant)return;
            try {operationJoindre=canal.joindre(instance);var identite=await operationJoindre;if(!courant)return;if(typeof identite==='string' && identite)uid=identite;
                arrets.push(ecouter('presences',actualiser));
                arrets.push(ecouter('signaux',appliquer));
                pret=true;actualiser(dernieresPresences);statut('pret');}
            catch(e){erreur(e);fermer();throw e;}
        }
        function mettrePiste(p,piste,generation) {
            var operation=p.fileMicro.then(function(){
                if(p.ferme || !p.trans || !courant || generation!==versionMicro)return;
                return p.trans.sender.replaceTrack(piste);
            });
            p.fileMicro=operation.catch(function(){});return operation;
        }
        function annulerRepriseMicro() {if(repriseMicro!==null){clearTimeout(repriseMicro);repriseMicro=null;}}
        function programmerRepriseMicro(generation) {
            if(!courant || !microSouhaite || generation!==versionMicro || repriseMicro!==null)return;
            statut('micro-reconnexion');
            var delai=delaiReprise;delaiReprise=Math.min(delaiReprise*2,30000);
            repriseMicro=setTimeout(function(){
                repriseMicro=null;
                if(!courant || !microSouhaite || generation!==versionMicro)return;
                capturerMicro(generation).catch(function(){programmerRepriseMicro(generation);});
            },delai);
        }
        async function capturerMicro(generation) {
            var nouveauFlux=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
            if(!courant || !microSouhaite || generation!==versionMicro){nouveauFlux.getTracks().forEach(function(t){t.stop();});return false;}
            var piste=nouveauFlux.getAudioTracks()[0];
            if(!piste || piste.readyState!=='live'){nouveauFlux.getTracks().forEach(function(t){t.stop();});throw new Error('micro-unavailable');}
            flux=nouveauFlux;
            piste.onended=function(){
                if(courant && microSouhaite && generation===versionMicro && flux===nouveauFlux){flux=null;programmerRepriseMicro(generation);}
            };
            // Une liaison réseau défaillante ne doit jamais arrêter le micro local.
            await Promise.all(Array.from(pairs.values()).map(function(p){return mettrePiste(p,piste,generation).catch(erreur);}));
            if(!courant || !microSouhaite || generation!==versionMicro){nouveauFlux.getTracks().forEach(function(t){t.stop();});return false;}
            if(flux!==nouveauFlux || piste.readyState!=='live'){programmerRepriseMicro(generation);return true;}
            delaiReprise=2000;statut('micro-actif');return true;
        }
        async function micro(actif) {
            if(actif && courant && pret && microSouhaite && flux && flux.getAudioTracks().some(function(t){return t.readyState==='live';}))return true;
            var generation=++versionMicro;microSouhaite=!!actif;annulerRepriseMicro();delaiReprise=2000;
            if(!actif) {
                var ancien=flux;flux=null;
                if(ancien)ancien.getTracks().forEach(function(t){t.stop();});
                await Promise.all(Array.from(pairs.values()).map(function(p){return mettrePiste(p,null,generation).catch(erreur);}));
                if(courant && generation===versionMicro)statut('micro-coupe');return false;
            }
            if(!courant || !pret){microSouhaite=false;throw new Error('voice-unavailable');}
            if(flux && flux.getAudioTracks().some(function(t){return t.readyState==='live';}))return true;
            try{return await capturerMicro(generation);}
            catch(e){if(generation===versionMicro)microSouhaite=false;throw e;}
        }
        async function diagnostic() {
            // Pas de SDP, identifiant, adresse, enregistrement ou audio dans ce bilan.
            var liste=Array.from(pairs.values()).filter(function(p){return !p.ferme;});
            async function mesures() {
                return Promise.all(liste.map(async function(p){
                    try {
                        var stats=await p.pc.getStats(), emis=0, recus=0, emisDisponible=false, recusDisponible=false;
                        stats.forEach(function(s){
                            if((s.kind || s.mediaType)!=='audio' || s.isRemote)return;
                            if(s.type==='outbound-rtp' && typeof s.packetsSent==='number'){emis+=s.packetsSent;emisDisponible=true;}
                            if(s.type==='inbound-rtp' && typeof s.packetsReceived==='number'){recus+=s.packetsReceived;recusDisponible=true;}
                        });
                        return {emis:emis,recus:recus,emisDisponible:emisDisponible,recusDisponible:recusDisponible};
                    } catch(e) {return {emis:0,recus:0,emisDisponible:false,recusDisponible:false};}
                }));
            }
            var avant=await mesures();await new Promise(function(resolve){setTimeout(resolve,2000);});var apres=await mesures();
            var erreurs=[erreursEcoute.presences,erreursEcoute.signaux].concat(liste.map(function(p){return p.erreurEnvoi;})).filter(Boolean);
            var signalisationErreur=erreurs.some(function(e){return e.code==='permission-denied' || e.code==='unauthenticated';})?'refus':erreurs.length?'interrompue':'';
            var resultat={participants:0,connectes:0,enAttente:0,enEchec:0,mesurablesEmission:0,mesurablesReception:0,emission:0,reception:0,signalisationErreur:signalisationErreur};
            liste.forEach(function(p,i){
                if(p.ferme)return;resultat.participants++;
                if(p.pc.connectionState==='connected')resultat.connectes++;
                else if(p.pc.connectionState==='failed' || p.pc.iceConnectionState==='failed')resultat.enEchec++;
                else resultat.enAttente++;
                if(avant[i].emisDisponible && apres[i].emisDisponible){resultat.mesurablesEmission++;if(apres[i].emis>avant[i].emis)resultat.emission++;}
                if(avant[i].recusDisponible && apres[i].recusDisponible){resultat.mesurablesReception++;if(apres[i].recus>avant[i].recus)resultat.reception++;}
            });
            return resultat;
        }
        function fermer() {
            if(!courant)return fermeture || Promise.resolve();courant=false;versionMicro++;microSouhaite=false;annulerRepriseMicro();pret=false;
            if(flux)flux.getTracks().forEach(function(t){t.stop();});flux=null;
            pairs.forEach(function(_,id){fermerPair(id);});arrets.forEach(function(f){if(typeof f==='function')f();});arrets=[];
            fermeture=Promise.resolve(operationJoindre).catch(function(){}).then(function(){return canal.quitter(instance);}).catch(function(){});return fermeture;
        }
        return {demarrer:demarrer,micro:micro,fermer:fermer,diagnostic:diagnostic,identite:function(){return uid;}};
    }
    var api={creer:creer};if(typeof module==='object' && module.exports)module.exports=api;else root.SalonVoix=api;
})(typeof window==='undefined'?globalThis:window);
