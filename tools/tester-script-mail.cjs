'use strict';
/* Test isolé du diagnostic Apps Script ; aucun réseau et aucun mail réel. */
const fs=require('fs'), vm=require('vm'), assert=require('assert/strict');
let secret='', envois=0;
const c={JSON,String,Date,RegExp,PropertiesService:{getScriptProperties:()=>({getProperty:key=>key==='MAIL_SECRET'?secret:null})},
 ContentService:{MimeType:{JSON:'JSON'},createTextOutput:texte=>({texte,setMimeType(){return this;}})},
 GmailApp:{sendEmail:()=>{envois++;}}, LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},
 CacheService:{getScriptCache:()=>({get:()=>null,put(){},remove(){}})} };
vm.createContext(c);vm.runInContext(fs.readFileSync('tools/envoi-mail.gs','utf8'),c);
let data=JSON.parse(c.doGet().texte); assert.equal(data.version,8);assert.equal(data.secretConfigure,false);assert.equal(data.salonsPlanifies,false);
secret='cle-fictive-privee'; data=JSON.parse(c.doGet().texte);assert.equal(data.secretConfigure,true);assert.ok(!JSON.stringify(data).includes(secret),'aucune clé dans le diagnostic');
const event=d=>({postData:{contents:JSON.stringify(d)}});
data=JSON.parse(c.doPost(event({secret:'mauvais'})).texte); assert.equal(data.error,'secret');
data=JSON.parse(c.doPost(event({secret,nonce:'invalide'})).texte); assert.equal(data.error,'nonce');
assert.equal(envois,0); console.log('ok diagnostic du script : version, présence sans secret, aucun envoi');
