'use strict';
/* Simulation complète Apps Script : aucune requête ni aucun mail réel. */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
let now=Date.UTC(2026,10,5,12),envois=[],perdre=false;
const props=new Map([['MAIL_SECRET','secret-fictif']]), rooms=new Map(), calls=[], tests=new Map(), logs=[];
const gens={hote:{localId:'hote',email:'alice@example.test',displayName:'Alice',emailVerified:true,providerUserInfo:[{providerId:'google.com'}]},invite:{localId:'invite',email:'binta@example.test',displayName:'Binta',emailVerified:true,providerUserInfo:[{providerId:'google.com'}]},anon:{localId:'anon',email:'anon@example.test',emailVerified:true,providerUserInfo:[]}};
const token=id=>id+'.'+'x'.repeat(100);
class DateTest extends Date{constructor(...a){super(...(a.length?a:[now]));}static now(){return now;}}
const propsApi={getProperty:k=>props.get(k)||null,setProperty:(k,v)=>props.set(k,v),deleteProperty:k=>props.delete(k),getProperties:()=>Object.fromEntries(props)};
function response(code,data){return {getResponseCode:()=>code,getContentText:()=>JSON.stringify(data)};}
const context={Date:DateTest,Set,JSON,Math,Number,String,Array,Object,RegExp,Error,encodeURIComponent,
 PropertiesService:{getScriptProperties:()=>propsApi},
 Utilities:{Charset:{UTF_8:'UTF_8'},getUuid:()=> 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',computeHmacSha256Signature:(text,key)=>Array.from(crypto.createHmac('sha256',key).update(text).digest()),newBlob:s=>({getBytes:()=>Buffer.from(s)}),formatDate:(date,zone,format)=>{new Intl.DateTimeFormat('fr-FR',{timeZone:zone}).format(date);return '05/11/2026 12:20';}},
 Session:{getEffectiveUser:()=>({getEmail:()=> 'alice@example.test'})},Logger:{log:s=>logs.push(s)},
 ContentService:{MimeType:{JSON:'JSON'},createTextOutput:texte=>({texte,setMimeType(){return this;}})},
 LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},
 ScriptApp:{getOAuthToken:()=> 'oauth-fictif',getProjectTriggers:()=>[],newTrigger:()=>({timeBased(){return this;},everyMinutes(){return this;},create(){}})},
 GmailApp:{sendEmail:(...args)=>{envois.push(args);if(perdre)throw Error('réponse incertaine');}},
 UrlFetchApp:{fetch:(url,opt)=>{
   calls.push(url);
   if(url.includes('accounts:lookup')){const id=JSON.parse(opt.payload).idToken.split('.')[0];return gens[id]?response(200,{users:[gens[id]]}):response(401,{});}
   if(url.includes('/documents/documents/')){assert.match(opt.headers.Authorization,/^Bearer /);let id=url.split('/').pop();return response(200,{fields:{classe:{stringValue:id==='invite'?'DP2':'DP1'}}});}
   if(url.endsWith('/documents:commit')){assert.equal(opt.headers.Authorization,'Bearer oauth-fictif');const writes=JSON.parse(opt.payload).writes;const path=writes[0].update.name;const id=path.split('/').pop();if(rooms.has(id))return response(409,{});rooms.set(id,{fields:writes[0].update.fields,updateTime:'2026-11-05T00:00:00Z'});return response(200,{writeResults:[]});}
   if(url.includes('/documents/salons_focus/')){const id=url.split('/salons_focus/')[1].split('?')[0];const r=rooms.get(id);if(!r)return response(404,{});if(opt.method==='patch'){Object.assign(r.fields,JSON.parse(opt.payload).fields);return response(200,r);}return response(200,r);}
   if(url.includes('/documents/salons_test_acces/')){const id=url.split('/salons_test_acces/')[1].split('?')[0];if(opt.method==='patch'){tests.set(id,JSON.parse(opt.payload));return response(200,{});}if(opt.method==='delete'){tests.delete(id);return response(200,{});}}
   throw Error('URL non attendue');
 }}
};
vm.createContext(context);vm.runInContext(fs.readFileSync('tools/envoi-mail.gs','utf8'),context);vm.runInContext(fs.readFileSync('tools/salons-planifies-gratuit.gs','utf8'),context);
assert.equal(JSON.parse(context.doGet().texte).salonsPlanifies,true);
function api(id,action,data={}){return JSON.parse(context.doPost({postData:{contents:JSON.stringify({...data,actionSalons:action,jeton:token(id)})}}).texte);}
let x=api('anon','membres');assert.equal(x.error,'google-requis');
assert.equal(api('invite','inscription',{visible:true}).success,true);assert.equal(api('hote','inscription',{visible:true}).success,true);
x=api('hote','membres');assert.equal(x.resultat.eleves[0].classe,'DP2');assert.ok(!JSON.stringify(x).includes('@example.test'));
let data={nom:'Maths <script>',debut:now+20*60000,fuseau:'Africa/Ouagadougou',invites:['invite']};
x=api('hote','creer',data);assert.equal(x.success,true);let id=x.resultat.id;assert.equal(rooms.size,1);assert.equal(api('hote','creer',data).resultat.deja,true);assert.equal(rooms.size,1);
assert.equal(api('invite','annuler',{id}).error,'acces-refuse');assert.equal(api('invite','liste').resultat.salons[0].lien,'');
context.spRappelsSalons();assert.equal(envois.length,0);now+=10*60000;context.spRappelsSalons();assert.equal(envois.length,1);assert.equal(envois[0][0],'alice@example.test');assert.ok(envois[0][3].htmlBody.includes('Maths &lt;script&gt;'));assert.ok(!envois[0][3].htmlBody.includes('<script>'));assert.match(envois[0][3].htmlBody,/#salon=[a-f0-9]{48}/);
context.spRappelsSalons();assert.equal(envois.length,1);now+=5*60000;context.spRappelsSalons();assert.equal(envois.length,2);assert.equal(envois[1][0],'binta@example.test');assert.ok(api('invite','liste').resultat.salons[0].lien.includes('#salon='));context.spRappelsSalons();assert.equal(envois.length,2);
data={...data,debut:now+20*60000};api('hote','creer',data);now+=10*60000;perdre=true;context.spRappelsSalons();const n=envois.length;context.spRappelsSalons();assert.equal(envois.length,n,'pas de doublon après erreur');perdre=false;api('invite','inscription',{visible:false});now+=5*60000;context.spRappelsSalons();assert.equal(envois.length,n,'pas de mail après désinscription');
data={...data,invites:[],debut:now+20*60000};x=api('hote','creer',data);const p=JSON.parse(props.get('SP_P_'+x.resultat.id));assert.equal(api('hote','annuler',{id:x.resultat.id}).success,true);assert.equal(rooms.get(p.salonId).fields.ferme.booleanValue,true);now+=10*60000;context.spRappelsSalons();assert.equal(envois.length,n);
assert.ok([...props.keys()].includes('MAIL_SECRET'));assert.ok(!JSON.stringify(api('hote','liste')).includes('secret-fictif'));
vm.runInContext(fs.readFileSync('tools/salons-diagnostic-gratuit.gs','utf8'),context);context.spDiagnosticGratuit();context.spDiagnosticEcriture();assert.equal(tests.size,0);assert.ok(logs.some(x=>x.includes('Lecture Firestore : autorisée')));assert.ok(logs.some(x=>x.includes('Document de diagnostic supprimé')));assert.ok(!logs.join(' ').includes('secret-fictif'));assert.equal(envois.length,n);
console.log('ok variante gratuite Apps Script : comptes, consentement, Firestore, rappels et annulation (simulation sans réseau)');
