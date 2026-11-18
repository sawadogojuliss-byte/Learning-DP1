/* Conversation vocale WebRTC. La signalisation ne transporte jamais l'audio. */
(function(root) {
    'use strict';
    function creer(options) {
        var canal=options.canal, uid=options.uid, instance=options.instance, statut=options.statut||function(){}, audioRecu=options.audioRecu||function(){}, audioRetire=options.audioRetire||function(){};
        var creerConnexion=options.creerConnexion||function(config){return new RTCPeerConnection(config);};
        var rtc=options.iceServers||[{urls:'stun:stun.l.google.com:19302'}];
        var pairs=new Map(), presents=new Map(), attente=[], arrets=[], courant=true, flux=null, versionMicro=0, pret=false;
        var maxPairs=7, dernieresPresences=[], operationJoindre=null, fermeture=null;
        var microSouhaite=false, repriseMicro=null, delaiReprise=2000;
        function erreur(e){ if(courant)statut('erreur',e); }
        function attendreGlace(pc) {
            if(pc.iceGatheringState==='complete')return Promise.resolve();
            return new Promise(function(resolve){
                var timer=setTimeout(fin,8000);
                function fin(){clearTimeout(timer);pc.removeEventListener('icegatheringstatechange',changement);resolve();}
                function changement(){if(pc.iceGatheringState==='complete')fin();}
                pc.addEventListener('icegatheringstatechange',changement);
            });
        }
        function fermerPair(id) {
            var p=pairs.get(id);if(!p)return;pairs.delete(id);p.ferme=true;
            try {p.pc.ontrack=null;p.pc.onconnectionstatechange=null;p.pc.close();} catch(e){}
            audioRetire(id);
        }
        function nouveau(id, cle) {
            var pc=creerConnexion({iceServers:rtc}), trans=uid<id?pc.addTransceiver('audio',{direction:'sendrecv'}):null;
            var p={pc:pc,trans:trans,cle:cle,file:Promise.resolve(),fileMicro:Promise.resolve(),ferme:false};pairs.set(id,p);
            pc.ontrack=function(ev){if(courant && !p.ferme)audioRecu(id,ev.streams && ev.streams[0] || new MediaStream([ev.track]));};
            pc.onconnectionstatechange=function(){if(!courant || p.ferme)return;if(pc.connectionState==='failed')statut('connexion-impossible',id);else if(pc.connectionState==='connected')statut('connecte',id);};
            if(trans && flux && flux.getAudioTracks()[0])mettrePiste(p,flux.getAudioTracks()[0],versionMicro).catch(erreur);
            if(uid<id) {
                p.file=p.file.then(async function(){
                    if(p.ferme || !courant)return;
                    await pc.setLocalDescription(await pc.createOffer());await attendreGlace(pc);
                    if(!p.ferme && courant)await canal.envoyer(id,cle,'offer',pc.localDescription.sdp);
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
                if(signal.type==='offer' && uid>signal.auteur && p.pc.signalingState==='stable') {
                    await p.pc.setRemoteDescription({type:'offer',sdp:signal.sdp});
                    p.trans=p.pc.getTransceivers().find(function(t){return t.receiver && t.receiver.track && t.receiver.track.kind==='audio';});
                    if(!p.trans)throw new Error('audio-transceiver-missing');
                    p.trans.direction='sendrecv';
                    if(flux && flux.getAudioTracks()[0])await mettrePiste(p,flux.getAudioTracks()[0],versionMicro);
                    await p.pc.setLocalDescription(await p.pc.createAnswer());await attendreGlace(p.pc);
                    if(!p.ferme && courant)await canal.envoyer(signal.auteur,cle,'answer',p.pc.localDescription.sdp);
                } else if(signal.type==='answer' && uid<signal.auteur && p.pc.signalingState==='have-local-offer') {
                    await p.pc.setRemoteDescription({type:'answer',sdp:signal.sdp});
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
                arrets.push(canal.presences(actualiser,erreur));
                arrets.push(canal.signaux(appliquer,erreur));
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
        function fermer() {
            if(!courant)return fermeture || Promise.resolve();courant=false;versionMicro++;microSouhaite=false;annulerRepriseMicro();pret=false;
            if(flux)flux.getTracks().forEach(function(t){t.stop();});flux=null;
            pairs.forEach(function(_,id){fermerPair(id);});arrets.forEach(function(f){if(typeof f==='function')f();});arrets=[];
            fermeture=Promise.resolve(operationJoindre).catch(function(){}).then(function(){return canal.quitter(instance);}).catch(function(){});return fermeture;
        }
        return {demarrer:demarrer,micro:micro,fermer:fermer,identite:function(){return uid;}};
    }
    var api={creer:creer};if(typeof module==='object' && module.exports)module.exports=api;else root.SalonVoix=api;
})(typeof window==='undefined'?globalThis:window);
