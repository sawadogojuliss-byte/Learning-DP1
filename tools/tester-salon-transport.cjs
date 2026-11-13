/* Double Firestore en mémoire : teste l'adaptateur, pas les règles Firebase. */
const assert=require('node:assert/strict');
const core=require('../js/pages/salon-focus-coeur.js');
const creerAdaptateur=require('../js/pages/salon-focus-firebase.js');
const crypto=require('node:crypto').webcrypto;
class Timestamp {constructor(ms){this.ms=ms}toMillis(){return this.ms}static fromMillis(ms){return new Timestamp(ms)}}
const SERVER=Symbol('server timestamp'), docs=new Map(), ecoutes=[];
function copie(x){if(x instanceof Timestamp)return new Timestamp(x.ms);if(x===SERVER)return new Timestamp(Date.now());if(Array.isArray(x))return x.map(copie);if(x&&typeof x==='object')return Object.fromEntries(Object.entries(x).map(([k,v])=>[k,copie(v)]));return x;}
function snapshot(path){return {id:path.split('/').pop(),exists:docs.has(path),data:()=>copie(docs.get(path)),metadata:{fromCache:false,hasPendingWrites:false}};}
class Ref {
 constructor(db,path){this.db=db;this.path=path}
 collection(name){return new Coll(this.db,this.path+'/'+name)}
 async get(){if(!this.db.online)throw Error('offline');return snapshot(this.path)}
 onSnapshot(opts,cb){const item={path:this.path,cb,type:'doc'};ecoutes.push(item);queueMicrotask(()=>cb(snapshot(this.path)));return()=>{ecoutes.splice(ecoutes.indexOf(item),1)}}
}
class Coll {
 constructor(db,path){this.db=db;this.path=path}
 doc(id){return new Ref(this.db,this.path+'/'+id)}
 onSnapshot(opts,cb){let item={path:this.path,cb,type:'collection'};ecoutes.push(item);queueMicrotask(()=>notifier(item));return()=>{ecoutes.splice(ecoutes.indexOf(item),1)}}
}
function notifier(item){if(item.type==='doc')return item.cb(snapshot(item.path));const prefix=item.path+'/';const liste=[...docs.keys()].filter(k=>k.startsWith(prefix)&&!k.slice(prefix.length).includes('/')).map(snapshot);item.cb({docs:liste,metadata:{fromCache:false,hasPendingWrites:false}});}
class DB {
 constructor(uid){this.uid=uid;this.online=true}
 collection(name){return new Coll(this,name)}
 async runTransaction(f){if(!this.online)throw Error('offline');const writes=[];const tx={get:async r=>snapshot(r.path),set:(r,d)=>writes.push(['set',r.path,copie(d)]),update:(r,d)=>writes.push(['update',r.path,copie(d)]),delete:r=>writes.push(['delete',r.path])};const result=await f(tx);for(const [op,p,v] of writes){if(op==='delete')docs.delete(p);else if(op==='update')docs.set(p,{...docs.get(p),...v});else docs.set(p,v)}for(const item of [...ecoutes])queueMicrotask(()=>notifier(item));return result;}
}
function Auth(user){this.user=user;this.persistence=null}
Auth.prototype.onAuthStateChanged=function(cb){queueMicrotask(()=>cb(this.user));return()=>{}};
Auth.prototype.setPersistence=async function(p){this.persistence=p};
Auth.prototype.signInAnonymously=async function(){this.user={uid:'invite-1',isAnonymous:true};return {user:this.user}};
const hostAuth=new Auth({uid:'host-1',isAnonymous:false}),guestAuth=new Auth(null),hostDB=new DB('host-1'),guestDB=new DB('invite-1');
const firebase={apps:[],initializeApp(config,name){const a={name,auth:()=>guestAuth,firestore:()=>guestDB};this.apps.push(a);return a;}};
firebase.auth=()=>hostAuth;firebase.auth.Auth={Persistence:{SESSION:'SESSION'}};
firebase.firestore=()=>hostDB;firebase.firestore.FieldValue={serverTimestamp:()=>SERVER};firebase.firestore.Timestamp=Timestamp;
const host=creerAdaptateur({coeur:core,firebase,config:{},crypto,horloge:()=>Date.now()+900000});
const guest=creerAdaptateur({coeur:core,firebase,config:{},crypto,horloge:()=>Date.now()-300000});
const donnees={nom:'Salon A',options:{theme:true},partage:{theme:'foret',citation:{texte:'privé'}},chrono:{mode:'focus',total:1500,restant:1500,running:false,fin:0}};
(async()=>{
 const a=await host.creer(donnees), b=await host.creer({...donnees,nom:'Salon B',options:{theme:true,sons:true},partage:{theme:'foret',sons:['pluie']}});
 assert.notEqual(a.id,b.id);assert.match(a.id,/^[a-f0-9]{48}$/);assert.ok(Math.abs(a.maintenant()-Date.now())<2000,'horloge hôte recalée');
 assert.deepEqual(Object.keys(docs.get('salons_focus/'+a.id).partage),['theme']);assert.deepEqual(Object.keys(docs.get('salons_focus/'+b.id).partage).sort(),['sons','theme']);
 const debut=core.commande(donnees.chrono,'demarrer',a.maintenant(),{});await a.modifier(1,{chrono:debut});
 await assert.rejects(a.modifier(1,{chrono:debut}),e=>e.code==='revision-conflict');
 const g=await guest.rejoindre(a.id,'Camille');assert.ok(Math.abs(g.maintenant()-Date.now())<2000,'horloge invitée recalée');assert.equal(hostAuth.user.uid,'host-1','le compte principal reste connecté');assert.equal(guestAuth.persistence,'SESSION');
 const recu=await new Promise((resolve,reject)=>{const stop=g.observer((room,etat)=>{if(etat.connecte){stop();resolve(room)}},reject)});
 assert.equal(recu.nom,'Salon A');assert.equal(recu.chrono.fin,debut.fin);assert.ok(Math.abs(core.temps(recu.chrono,g.maintenant()).restant-core.temps(debut,a.maintenant()).restant)<=1);
 assert.equal(recu.membres.some(x=>x.pseudo==='Camille'),true);assert.equal(docs.get('salons_focus/'+b.id).chrono.running,false);
 const etats=[];const stop=g.observer((d,etat)=>etats.push({d,etat}),e=>{throw e});await new Promise(r=>setTimeout(r,0));
 const listener=ecoutes.find(x=>x.type==='doc' && x.path==='salons_focus/'+a.id);
 listener.cb({exists:true,data:()=>({nom:'donnée non confirmée',ferme:false}),metadata:{fromCache:true,hasPendingWrites:true}});
 assert.equal(etats.at(-1).d.nom,'Salon A','une donnée locale non confirmée ne remplace pas le serveur');assert.equal(etats.at(-1).etat.connecte,false);
 listener.cb(snapshot(listener.path));assert.equal(etats.at(-1).etat.connecte,true);stop();
 await assert.rejects(g.modifier(2,{chrono:debut}),e=>e.code==='permission-denied');
 hostDB.online=false;await assert.rejects(a.modifier(2,{chrono:debut}),/offline/);hostDB.online=true;assert.equal(docs.get('salons_focus/'+a.id).revision,2);
 await g.quitter();assert.equal(docs.has('salons_focus/'+a.id+'/membres/invite-1'),false);await a.fermer();assert.equal(docs.get('salons_focus/'+a.id).ferme,true);assert.equal(docs.get('salons_focus/'+b.id).ferme,false);
 console.log('OK adaptateur Firestore simulé : liens, choix, compte isolé, horloges, retard, conflits et déconnexion. Règles NON testées.');
})().catch(e=>{console.error(e);process.exit(1)});
