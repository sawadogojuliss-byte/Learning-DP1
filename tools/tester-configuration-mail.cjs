'use strict';
/* Diagnostic local sans Firebase de production ni envoi de courriel. */
const fs = require('fs'), vm = require('vm'), assert = require('assert/strict');
const ctx = { Promise, Object, Array, String, Number, RegExp, Math, Date, JSON, Error, setTimeout, clearTimeout, AbortController, TextEncoder, encodeURIComponent, unescape, localStorage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}} };
ctx.window = ctx;
vm.createContext(ctx); vm.runInContext(fs.readFileSync('js/pages/boite.js','utf8'),ctx);
const user={uid:'admin-fictif'}; let current=user, lire;
ctx.firebase={auth:()=>({currentUser:current}),firestore:()=>({collection:n=>{assert.equal(n,'config');return {doc:id=>{assert.equal(id,'mail');return {get:opts=>{assert.equal(opts.source,'server'); return lire();}}}}}})};
ctx.boiteEstAdmin=()=>true;
ctx.boiteFirebasePret=()=>Promise.resolve(current);
async function main() {
 current=null;
 await assert.rejects(ctx.boiteSecretMail(),/mail_session/);
 current=user;
 lire=()=>Promise.reject(Object.assign(Error('détail privé'),{code:'permission-denied'}));
 await assert.rejects(ctx.boiteSecretMail(),/mail_acces/);
 lire=()=>Promise.reject(Error('réseau ou SDK'));
 await assert.rejects(ctx.boiteSecretMail(),/mail_reseau/);
 lire=()=>Promise.resolve({exists:false});
 await assert.rejects(ctx.boiteSecretMail(),/mail_configuration/);
 lire=()=>Promise.resolve({exists:true,data:()=>({secret:'  '})});
 await assert.rejects(ctx.boiteSecretMail(),/mail_configuration/);
 lire=()=>Promise.resolve({exists:true,data:()=>({secret:'valeur-fictive'})});
 assert.equal(await ctx.boiteSecretMail(),'valeur-fictive');
 assert.equal(await ctx.boiteSecretMail(),'valeur-fictive','cache session');
 for (const type of ['mail_session','mail_acces','mail_reseau','mail_configuration','mail_adresse']) {
   const msg=ctx.boiteMessageEchecMail(Error(type));
   assert.match(msg,/mail n’est pas parti/); assert.doesNotMatch(msg,/valeur-fictive|détail privé/);
 }
 ctx.boiteFetch=()=>Promise.resolve({ok:true,json:()=>Promise.resolve({url:'https://script.google.com/macros/s/fictif/exec'})});
 assert.match(await ctx.boiteUrlScript(),/fictif/);
 ctx.boiteFetch=()=>Promise.resolve({ok:true,json:()=>Promise.resolve({url:'https://exemple.invalid/'})});
 await assert.rejects(ctx.boiteUrlScript(),/mail_adresse/);
 ctx.boiteFetch=()=>Promise.reject(Error('hors ligne'));
 await assert.rejects(ctx.boiteUrlScript(),/mail_reseau/);
 assert.match(ctx.boiteMessageEchecMail(Object.assign(Error('refus'),{raison:'secret'})),/secret du script/);
 console.log('ok configuration mail : session, droits, absence, réseau, URL et secret sans révélation');
}
main().catch(err=>{console.error(err);process.exit(1)});
