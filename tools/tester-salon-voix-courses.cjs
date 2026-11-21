/* Tests des courses sans matériel ni Firebase. */
const assert=require('node:assert/strict');const {creer}=require('../js/pages/salon-voix.js');
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve}};
(async()=>{
 const entree=deferred();let quitte=0,ecoutes=0,instanceQuittee;
 const canal={joindre:()=>entree.promise,quitter:async i=>{quitte++;instanceQuittee=i},presences:()=>{ecoutes++;return()=>{}},signaux:()=>{ecoutes++;return()=>{}}};
 const node=creer({uid:'a',instance:'x',canal});const debut=node.demarrer();const fin=node.fermer();assert.equal(quitte,0);entree.resolve();await Promise.all([debut,fin]);assert.equal(quitte,1);assert.equal(instanceQuittee,'x');assert.equal(ecoutes,0);
 const attente=deferred();let pistes=[];Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{getUserMedia:async()=>{await attente.promise;const t={readyState:'live',stop(){this.readyState='ended'}};pistes.push(t);return {getTracks:()=>[t],getAudioTracks:()=>[t]}}}}});
 const transport={joindre:async()=>{},quitter:async()=>{},presences:()=>()=>{},signaux:()=>()=>{}};
 const autre=creer({uid:'a',instance:'z',canal:transport});await autre.demarrer();const allumer=autre.micro(true);await autre.micro(false);attente.resolve();assert.equal(await allumer,false);assert.equal(pistes[0].readyState,'ended');await autre.fermer();await assert.rejects(autre.micro(true),/voice-unavailable/);
 console.log('OK courses : fermeture pendant entrée, demande micro annulée, piste arrêtée.');
})().catch(e=>{console.error(e);process.exitCode=1});
