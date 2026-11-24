'use strict';
/* Transport et refus simulés en mémoire : aucun appel réseau ni courriel. */
const fs = require('fs'), vm = require('vm'), assert = require('assert/strict');
const ctx = { console, Promise, Object, Array, String, Number, RegExp, Math, Date, JSON, Error, setTimeout, clearTimeout, AbortController, TextEncoder, encodeURIComponent, unescape, btoa: s => Buffer.from(s,'binary').toString('base64'), localStorage: {getItem:()=>null,setItem:()=>{},removeItem:()=>{}} };
ctx.window=ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync('js/pages/boite.js','utf8'),ctx);
ctx.boiteEstAdmin=()=>true; ctx.boiteUrlScript=()=>Promise.resolve('https://script.google.com/fictif'); ctx.boiteSecretMail=()=>Promise.resolve('secret-test');
let appels=0, action;
ctx.fetch=async (url,opts)=>{appels++; return action(JSON.parse(opts.body));};
async function main() {
 action=p=>({ok:true,json:async()=>({success:true,id:p.nonce})});
 const result=await ctx.boiteEnvoyerMail('12@example.org','Réponse','Question','',new Date());
 assert.equal(result.success,true,'nom introuvable : salutation simple autorisée');
 assert.equal(appels,1);
 assert.equal(ctx.boiteMailAccepte({success:false,id:result.id},result.id),false);
 action=p=>({ok:true,json:async()=>({success:false,id:p.nonce,error:'secret'})});
 await assert.rejects(ctx.boiteEnvoyerMail('alice@example.org','Réponse','','Alice'),/refus/);
 assert.equal(appels,2,'aucun renvoi après un refus explicite');
 action=()=>{throw Error('réseau');};
 await assert.rejects(ctx.boiteEnvoyerMail('alice@example.org','Réponse','','Alice'),/incertain/);
 assert.equal(appels,3,'aucun renvoi si résultat réseau inconnu');
 action=()=>({ok:true,json:async()=>{throw Error('réponse illisible');}});
 await assert.rejects(ctx.boiteEnvoyerMail('alice@example.org','Réponse','','Alice'),/incertain/);
 assert.equal(appels,4,'aucun renvoi si réponse illisible');
 console.log('ok transport mail : salutation, acquittement strict, refus et réponse incertaine sans doublon');
}
main().catch(err=>{console.error(err);process.exit(1)});
