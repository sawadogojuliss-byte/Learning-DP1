'use strict';
/* Simulation complète Apps Script : aucune requête ni aucun mail réel. */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
let now=Date.UTC(2026,10,5,12),envois=[],perdre=false,annuaireEchec=false;
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
   if(url.includes('/documents/documents?') || url.includes('/documents/comptes?')){
    assert.equal(opt.headers.Authorization,'Bearer oauth-fictif');if(annuaireEchec)return response(403,{});
    const documents=url.includes('/documents/documents?'), page=url.includes('pageToken=deux');
    if(documents){
     assert.ok(url.includes('mask.fieldPaths=nom') && url.includes('mask.fieldPaths=classe'));
     return response(200,page?{documents:[{name:'x/documents/sansmail',fields:{nom:{stringValue:'Sans mail'},classe:{stringValue:'DP1'}}}]}:{documents:[{name:'x/documents/hote',fields:{nom:{stringValue:'Alice'},classe:{stringValue:'DP1'}}},{name:'x/documents/invite',fields:{nom:{stringValue:'Binta'},classe:{stringValue:'DP2'}}}],nextPageToken:'deux'});
    }
    assert.ok(url.includes('mask.fieldPaths=email'));
    return response(200,{documents:[{name:'x/comptes/hote',fields:{email:{stringValue:'alice@example.test'}}},{name:'x/comptes/invite',fields:{email:{stringValue:'binta@example.test'}}}]});
   }
   if(url.includes('/documents/documents/')){assert.match(opt.headers.Authorization,/^Bearer /);let id=url.split('/').pop();return response(200,{fields:{classe:{stringValue:id==='invite'?'DP2':'DP1'}}});}
   if(url.endsWith('/documents:commit')){assert.equal(opt.headers.Authorization,'Bearer oauth-fictif');const writes=JSON.parse(opt.payload).writes;const path=writes[0].update.name;const id=path.split('/').pop();if(rooms.has(id))return response(409,{});rooms.set(id,{fields:writes[0].update.fields,updateTime:'2026-11-05T00:00:00Z'});return response(200,{writeResults:[]});}
   if(url.includes('/documents/salons_focus/') && url.includes('/membres/')){const parts=url.split('/salons_focus/')[1].split('/membres/');return response(rooms.has(parts[0]) && ['hote','invite'].includes(parts[1])?200:404,{});}
   if(url.includes('/documents/salons_focus/')){const id=url.split('/salons_focus/')[1].split('?')[0];const r=rooms.get(id);if(!r)return response(404,{});if(opt.method==='patch'){Object.assign(r.fields,JSON.parse(opt.payload).fields);return response(200,r);}return response(200,r);}
   if(url.includes('/documents/salons_test_acces/')){const id=url.split('/salons_test_acces/')[1].split('?')[0];if(opt.method==='patch'){tests.set(id,JSON.parse(opt.payload));return response(200,{});}if(opt.method==='delete'){tests.delete(id);return response(200,{});}}
   throw Error('URL non attendue');
 }}
};
vm.createContext(context);vm.runInContext(fs.readFileSync('tools/envoi-mail.gs','utf8'),context);vm.runInContext(fs.readFileSync('tools/salons-planifies-gratuit.gs','utf8'),context);
// Contenu transactionnel : pas d'envoi réel, les deux rôles et les anciens
// programmes sont couverts, y compris les valeurs contenant du HTML.
const exemple={nom:'Révisions <maths>\nBilan',organisateurNom:'Alice & <Bob>',debut:now+600000,fin:now+3600000,fuseau:'UTC',salonId:'a'.repeat(48)};
const courrierHote=context.spCourrier(exemple,'organisateur'), courrierInvite=context.spCourrier(exemple,'invite');
assert.equal(courrierHote.subject,'Ta séance « Révisions <maths> Bilan » commence bientôt | Studyplan');
assert.ok(!/[\r\n]/.test(courrierHote.subject),'aucun retour à la ligne dans l’objet');
for (const c of [courrierHote,courrierInvite]) {
  // L'URL dépend de la configuration du script : les deux versions doivent
  // porter exactement le même lien et le HTML doit échapper les données.
  const url=context.SP_SITE+'#salon='+exemple.salonId;
  assert.ok(c.text.includes(url));assert.ok(c.html.includes('href="'+url+'"'));
  assert.ok(c.html.includes('Révisions &lt;maths&gt; Bilan'));
  assert.ok(c.html.includes('Alice &amp; &lt;Bob&gt;'));assert.ok(!c.html.includes('<maths>'));
  assert.ok(c.text.includes('Date et heure :'));assert.ok(c.text.includes('Organisée par :'));
  assert.ok(c.text.includes('partage-le seulement avec les personnes invitées'));
  assert.ok(c.html.includes('Un temps pour se concentrer, ensemble'));
}
assert.ok(courrierHote.text.includes('tu as organisé cette séance'));
assert.ok(courrierInvite.text.includes('tu as accepté cette séance'));
const ancien=context.spCourrier({...exemple,fin:null,organisateurNom:''},'invite');
assert.ok(ancien.text.includes('Un membre Studyplan'));assert.ok(!ancien.text.includes(' → '));
const diag=JSON.parse(context.doGet().texte);assert.equal(diag.salonsPlanifies,true);assert.equal(diag.version,8);assert.equal(diag.salonsAnnuaireAuto,true);
function api(id,action,data={}){return JSON.parse(context.doPost({postData:{contents:JSON.stringify({...data,actionSalons:action,jeton:token(id)})}}).texte);}
let x=api('anon','membres');assert.equal(x.error,'google-requis');
x=api('hote','membres');assert.equal(x.resultat.annuaireAutomatique,true);assert.equal(x.resultat.eleves.length,1);assert.equal(x.resultat.eleves[0].classe,'DP2');assert.ok(!JSON.stringify(x).includes('@example.test'));
annuaireEchec=true;assert.equal(api('hote','membres').error,'annuaire-indisponible');annuaireEchec=false;assert.equal(props.has('SP_U_invite'),false,'aucune inscription préalable');
context.spDiagnosticAnnuaire();assert.ok(logs.some(l=>l.includes('Annuaire accessible : 2')));assert.ok(!logs.join(' ').includes('@example.test'));assert.ok(!logs.join(' ').includes('Binta'));
let data={nom:'Maths <script>',debut:now+20*60000,fin:now+80*60000,fuseau:'Africa/Ouagadougou',invites:['invite']};
assert.equal(api('hote','creer',{...data,invites:['sansmail']}).error,'invite-indisponible');
x=api('hote','creer',data);assert.equal(x.success,true);let id=x.resultat.id;assert.equal(rooms.size,1);assert.equal(api('hote','creer',data).resultat.deja,true);assert.equal(rooms.size,1);
assert.equal(api('invite','annuler',{id}).error,'acces-refuse');assert.equal(api('hote','repondre',{id,reponse:'accepte'}).error,'acces-refuse');assert.equal(api('invite','repondre',{id,reponse:'autre'}).error,'demande-invalide');
assert.equal(api('invite','liste').resultat.salons[0].lien,'');assert.equal(api('invite','liste').resultat.salons[0].organisateurNom,'Alice');assert.equal(api('invite','liste').resultat.salons[0].fin,data.fin);
context.spRappelsSalons();assert.equal(envois.length,0);now+=10*60000;context.spRappelsSalons();assert.equal(envois.length,1);assert.equal(envois[0][0],'alice@example.test');assert.match(envois[0][1],/^Ta séance « Maths <script> » commence bientôt/);assert.ok(envois[0][2].includes('tu as organisé cette séance'));assert.ok(envois[0][3].htmlBody.includes('Maths &lt;script&gt;'));assert.ok(!envois[0][3].htmlBody.includes('<script>'));assert.match(envois[0][3].htmlBody,/#salon=[a-f0-9]{48}/);
context.spRappelsSalons();assert.equal(envois.length,1);now+=5*60000;context.spRappelsSalons();assert.equal(envois.length,1,'aucun mail sans acceptation');assert.equal(api('invite','liste').resultat.salons[0].lien,'');
assert.equal(api('invite','repondre',{id,reponse:'accepte'}).success,true);assert.equal(api('invite','repondre',{id,reponse:'accepte'}).success,true);assert.ok(!JSON.stringify(api('invite','liste')).includes('@example.test'),'les adresses ne sortent pas de la liste');
const sid=JSON.parse(props.get('SP_P_'+id)).salonId;assert.equal(api('invite','liste').resultat.historique.length,0,'accepter ne vaut pas participation');
assert.equal(api('invite','participer',{salonId:sid,jetonSalon:token('inconnu')}).error,'auth-requise');assert.equal(api('invite','participer',{salonId:sid,jetonSalon:token('anon')}).error,'acces-refuse');assert.equal(api('invite','participer',{salonId:sid,jetonSalon:token('invite')}).success,true);assert.equal(api('invite','participer',{salonId:sid,jetonSalon:token('invite')}).success,true);assert.equal(api('invite','liste').resultat.historique.length,1);assert.equal(api('hote','liste').resultat.historique.length,0);
context.spRappelsSalons();assert.equal(envois.length,2);assert.equal(envois[1][0],'binta@example.test');assert.ok(envois[1][2].includes('tu as accepté cette séance'));assert.ok(api('invite','liste').resultat.salons[0].lien.includes('#salon='));context.spRappelsSalons();assert.equal(envois.length,2);
data={...data,debut:now+20*60000,fin:now+80*60000};x=api('hote','creer',data);let id2=x.resultat.id;assert.equal(api('invite','repondre',{id:id2,reponse:'refuse'}).success,true);assert.equal(api('invite','participer',{salonId:JSON.parse(props.get('SP_P_'+id2)).salonId,jetonSalon:token('invite')}).error,'acces-refuse');assert.equal(api('invite','repondre',{id:id2,reponse:'accepte'}).success,true);now+=10*60000;perdre=true;context.spRappelsSalons();const n=envois.length;context.spRappelsSalons();assert.equal(envois.length,n,'pas de doublon après erreur');perdre=false;assert.equal(api('invite','repondre',{id:id2,reponse:'refuse'}).success,true);assert.equal(api('invite','liste').resultat.salons.find(s=>s.id===id2).reponse,'refuse');now+=5*60000;context.spRappelsSalons();assert.equal(envois.length,n,'pas de mail après refus');
data={...data,invites:[],debut:now+20*60000,fin:now+80*60000};x=api('hote','creer',data);const p=JSON.parse(props.get('SP_P_'+x.resultat.id));assert.equal(api('hote','annuler',{id:x.resultat.id}).success,true);assert.equal(rooms.get(p.salonId).fields.ferme.booleanValue,true);now+=10*60000;context.spRappelsSalons();assert.equal(envois.length,n);
assert.equal(api('hote','creer',{...data,debut:now+20*60000,fin:now+20*60000}).error,'fin-invalide');props.delete('SP_P_'+id);assert.equal(api('invite','liste').resultat.historique.length,1,'historique conservé après nettoyage de la séance');assert.equal(api('invite','effacer-historique').success,true);assert.equal(api('invite','liste').resultat.historique.length,0);assert.ok([...props.keys()].includes('MAIL_SECRET'));assert.ok(!JSON.stringify(api('hote','liste')).includes('secret-fictif'));
vm.runInContext(fs.readFileSync('tools/salons-diagnostic-gratuit.gs','utf8'),context);context.spDiagnosticGratuit();context.spDiagnosticEcriture();assert.equal(tests.size,0);assert.ok(logs.some(x=>x.includes('Lecture Firestore : autorisée')));assert.ok(logs.some(x=>x.includes('Document de diagnostic supprimé')));assert.ok(!logs.join(' ').includes('secret-fictif'));assert.equal(envois.length,n);
// Une séance acceptée sous v7 continue d'utiliser son ancienne adresse.
props.set('SP_U_invite',JSON.stringify({uid:'invite',email:'binta@example.test'}));
props.set('SP_P_legacy',JSON.stringify({id:'legacy',salonId:'b'.repeat(48),nom:'Séance antérieure',debut:now+4*60000,fin:now+64*60000,fuseau:'UTC',organisateurUid:'hote',organisateurEmail:'alice@example.test',invites:['invite'],reponses:{invite:'accepte'},annule:false,etats:{hote:'tentative'}}));
context.spRappelsSalons();assert.equal(envois.length,n+1);assert.equal(envois[n][0],'binta@example.test');context.spRappelsSalons();assert.equal(envois.length,n+1,'pas de doublon après migration');
console.log('ok variante gratuite Apps Script : annuaire automatique, acceptation, Firestore, rappels et annulation (simulation sans réseau)');
