'use strict';
// Test du service en mémoire : aucune requête réseau ni aucun e-mail réel.
const assert = require('node:assert/strict');
const Module = require('node:module');
const vm = require('node:vm');
const fs = require('node:fs');
const core = require('../services/salons-planifies/coeur');
let now = Date.UTC(2026, 10, 5, 12), mail = [], erreurMail = false;
const vraiNow = Date.now; Date.now = () => now;
const docs = new Map(), comptes = {
  hote:{uid:'hote',name:'Alice',email:'alice@example.test',email_verified:true,firebase:{sign_in_provider:'google.com'}},
  invite:{uid:'invite',name:'Binta',email:'binta@example.test',email_verified:true,firebase:{sign_in_provider:'google.com'}},
  anon:{uid:'anon',name:'Anonyme',email:'anon@example.test',email_verified:true,firebase:{sign_in_provider:'anonymous'}}
};
class Timestamp { constructor(n){this.n=n;} toMillis(){return this.n;} static now(){return new Timestamp(now);} static fromMillis(n){return new Timestamp(n);} }
function copie(obj) { if(!obj || typeof obj!=='object' || obj instanceof Timestamp)return obj; if(Array.isArray(obj))return obj.map(copie); return Object.fromEntries(Object.entries(obj).map(([k,v])=>[k,copie(v)])); }
class Ref {
  constructor(path){this.path=path;this.id=path.split('/').pop();}
  collection(c){return new Col(this.path+'/'+c);}
  async get(){return snap(this);}
  async set(v){docs.set(this.path,copie(v));}
  async update(v){if(!docs.has(this.path))throw Error('missing');docs.set(this.path,{...docs.get(this.path),...copie(v)});}
  async delete(){docs.delete(this.path);}
}
function snap(ref){return {exists:docs.has(ref.path),id:ref.id,ref,data:()=>copie(docs.get(ref.path))};}
class Col {
  constructor(path,conditions=[],order=null,max=Infinity){this.path=path;this.conditions=conditions;this.order=order;this.max=max;}
  doc(id){return new Ref(this.path+'/'+id);}
  where(k,op,v){return new Col(this.path,this.conditions.concat([[k,op,v]]),this.order,this.max);}
  orderBy(k){return new Col(this.path,this.conditions,k,this.max);}
  limit(n){return new Col(this.path,this.conditions,this.order,n);}
  async get(){
    let arr=Array.from(docs.keys()).filter(k=>k.startsWith(this.path+'/') && k.slice(this.path.length+1).indexOf('/')<0).map(k=>snap(new Ref(k)));
    function val(v){return v instanceof Timestamp?v.toMillis():v;}
    arr=arr.filter(d=>this.conditions.every(([k,op,v])=>op==='=='?val(d.data()[k])===val(v):op==='<='?val(d.data()[k])<=val(v):op==='>='?val(d.data()[k])>=val(v):op==='array-contains'?d.data()[k].includes(v):false));
    if(this.order)arr.sort((a,b)=>val(a.data()[this.order])-val(b.data()[this.order]));
    arr=arr.slice(0,this.max);return {docs:arr,size:arr.length};
  }
}
const db={collection:p=>new Col(p),async runTransaction(fn){const writes=[];const tx={get:r=>r.get(),set:(r,v)=>writes.push(()=>r.set(v)),update:(r,v)=>writes.push(()=>r.update(v))};const result=await fn(tx);for(const w of writes)await w();return result;}};
const originalLoad=Module._load;
Module._load=function(request,parent,isMain){
  if(request==='firebase-functions/v2/https')return {onRequest:(_,f)=>f};
  if(request==='firebase-functions/v2/scheduler')return {onSchedule:(_,f)=>f};
  if(request==='firebase-functions/params')return {defineSecret:()=>({value:()=> 'secret-test'})};
  if(request==='firebase-admin/app')return {initializeApp:()=>{}};
  if(request==='firebase-admin/auth')return {getAuth:()=>({verifyIdToken:async t=>{if(!comptes[t])throw Error('token');return comptes[t];},getUser:async uid=>({...comptes[uid],emailVerified:true,disabled:false,providerData:[{providerId:'google.com'}]})})};
  if(request==='firebase-admin/firestore')return {getFirestore:()=>db,Timestamp};
  return originalLoad.apply(this,arguments);
};
const service=require('../services/salons-planifies/index.js'); Module._load=originalLoad;
const cache=new Map(), livraisons=[];
const script={PropertiesService:{getScriptProperties:()=>({getProperty:()=> 'secret-test'})},ContentService:{MimeType:{JSON:'JSON'},createTextOutput:texte=>({texte,setMimeType(){return this;}})},LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},CacheService:{getScriptCache:()=>({get:k=>cache.get(k),put:(k,v)=>cache.set(k,v),remove:k=>cache.delete(k)})},GmailApp:{sendEmail:(...args)=>livraisons.push(args)}};
vm.createContext(script);vm.runInContext(fs.readFileSync('tools/envoi-mail.gs','utf8'),script);
global.fetch=async (url,opt)=>{assert.match(url,/^https:\/\/script\.google\.com\/macros\/s\//);const p=JSON.parse(opt.body);mail.push(p);const reponse=JSON.parse(script.doPost({postData:{contents:opt.body}}).texte);if(erreurMail)throw Error('réponse perdue');return {ok:true,json:async()=>reponse};};
async function api(user,body){let status=200, result;const req={method:'POST',body,get:()=> 'Bearer '+user};const res={set(){return this;},status(n){status=n;return this;},json(v){result=v;return this;}};await service.salonsPlanifies(req,res);return {status,result};}
async function main(){
  docs.set('documents/hote',{classe:'DP1'});docs.set('documents/invite',{classe:'DP2'});
  assert.equal((await api('anon',{action:'membres'})).result.erreur,'google-requis');
  assert.equal((await api('invite',{action:'inscription',visible:true})).result.visible,true);
  assert.equal((await api('hote',{action:'inscription',visible:true})).result.visible,true);
  const membres=(await api('hote',{action:'membres'})).result;assert.equal(membres.eleves.length,1);assert.equal(membres.eleves[0].classe,'DP2');assert.ok(!JSON.stringify(membres).includes('example.test'));
  const data={action:'creer',nom:'Maths <script>',debut:now+20*core.MINUTE,fuseau:'Africa/Ouagadougou',invites:['invite'],demandeId:'a'.repeat(32)};
  const cree=await api('hote',data);assert.equal(cree.status,200);assert.equal((await api('hote',data)).result.deja,true);
  const repete=await api('hote',{...data,demandeId:'d'.repeat(32)});assert.equal(repete.result.deja,true);assert.equal(repete.result.id,cree.result.id);
  const refus=await api('hote',{...data,nom:'Autre'});assert.equal(refus.result.erreur,'identifiant-utilise');
  assert.equal((await api('invite',{action:'annuler',id:cree.result.id})).result.erreur,'acces-refuse');
  let liste=(await api('invite',{action:'liste'})).result.salons;assert.equal(liste.length,1);assert.equal(liste[0].lien,'');
  await service.rappelsSalons();assert.equal(mail.length,0);
  now+=10*core.MINUTE;await service.rappelsSalons();assert.equal(mail.length,1);assert.equal(mail[0].to,'alice@example.test');assert.ok(mail[0].html.includes('Maths &lt;script&gt;'));assert.ok(!mail[0].html.includes('<script>'));assert.match(mail[0].html,/#salon=[a-f0-9]{48}/);assert.equal(livraisons.length,1);assert.equal(livraisons[0][3].htmlBody,mail[0].html,'le script conserve le modèle sans ajout extérieur');
  await service.rappelsSalons();assert.equal(mail.length,1);
  assert.equal((await api('invite',{action:'liste'})).result.salons[0].lien,'');
  now+=5*core.MINUTE;await service.rappelsSalons();assert.equal(mail.length,2);assert.equal(mail[1].to,'binta@example.test');
  assert.ok((await api('invite',{action:'liste'})).result.salons[0].lien.includes('#salon='));
  await service.rappelsSalons();assert.equal(mail.length,2);
  const deux={...data,debut:now+20*core.MINUTE,demandeId:'b'.repeat(32)};await api('hote',deux);now+=10*core.MINUTE;erreurMail=true;await service.rappelsSalons();const n=mail.length;await service.rappelsSalons();assert.equal(mail.length,n,'une réponse perdue ne doit pas déclencher un second envoi');erreurMail=false;
  await api('invite',{action:'inscription',visible:false});now+=5*core.MINUTE;await service.rappelsSalons();assert.equal(mail.length,n,'un élève désinscrit ne reçoit pas le rappel');
  const trois={...data,invites:[],debut:now+20*core.MINUTE,demandeId:'c'.repeat(32)};const c=await api('hote',trois);assert.equal((await api('hote',{action:'annuler',id:c.result.id})).result.annule,true);now+=10*core.MINUTE;await service.rappelsSalons();assert.equal(mail.length,n,'un salon annulé ne déclenche pas de mail');
  assert.throws(()=>core.verifierDemande({...data,demandeId:'a'.repeat(32),debut:now+1000},now),/date-invalide/);
  assert.throws(()=>core.verifierDemande({...data,demandeId:'a'.repeat(32),debut:now+20*core.MINUTE,fuseau:'invalid'},now),/fuseau-invalide/);
  console.log('ok salons planifiés : droits, annuaire sans e-mails, échéances, modèle, annulation, désinscription et aucun renvoi incertain (simulation)');
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{Date.now=vraiNow;});
