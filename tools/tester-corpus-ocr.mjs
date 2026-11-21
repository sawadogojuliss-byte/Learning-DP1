/* Corpus reproductible de 10 emplois et 10 examens fictifs : aucun PDF utilisateur. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
const require=createRequire(process.env.STUDY_TEST_MODULES?path.resolve(process.env.STUDY_TEST_MODULES,'../package.json'):import.meta.url);
const {chromium}=require('playwright');
const portable=process.env.STUDY_PLAYWRIGHT_SYSTEM?null:require('@sparticuz/chromium').default;
const base=process.env.STUDY_SITE||'http://127.0.0.1:8653/';
function pdf(pages) {
 const objs=[]; objs[1]='<< /Type /Catalog /Pages 2 0 R >>';
 objs[2]=`<< /Type /Pages /Kids [${pages.map((_,i)=>`${4+i*2} 0 R`).join(' ')}] /Count ${pages.length} >>`;
 objs[3]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';
 for(let i=0;i<pages.length;i++) {
  const p=pages[i], page=4+i*2, content=page+1;
  let img=''; if(p.jpeg) {const n=4+pages.length*2+i;img=`/XObject << /Im1 ${n} 0 R >>`;objs[n]=Buffer.concat([Buffer.from(`<< /Type /XObject /Subtype /Image /Width 900 /Height 500 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`),p.jpeg,Buffer.from('\nendstream')]);}
  objs[page]=`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 500] /Resources << /Font << /F1 3 0 R >> ${img} >> /Contents ${content} 0 R >>`;
  const text=(p.text||[]).map(([x,y,t])=>`BT /F1 12 Tf ${x} ${y} Td (${t.replace(/[()\\]/g,'\\$&')}) Tj ET`).join('\n');
  const stream=Buffer.from((p.jpeg?'q 600 0 0 500 0 0 cm /Im1 Do Q\n':'')+text);
  objs[content]=Buffer.concat([Buffer.from(`<< /Length ${stream.length} >>\nstream\n`),stream,Buffer.from('\nendstream')]);
 }
 const parts=[Buffer.from('%PDF-1.4\n')],offsets=[0];
 for(let i=1;i<objs.length;i++){ offsets[i]=parts.reduce((n,b)=>n+b.length,0);parts.push(Buffer.from(`${i} 0 obj\n`),Buffer.isBuffer(objs[i])?objs[i]:Buffer.from(objs[i]),Buffer.from('\nendobj\n')); }
 const xref=parts.reduce((n,b)=>n+b.length,0);parts.push(Buffer.from(`xref\n0 ${objs.length}\n0000000000 65535 f \n`));
 for(let i=1;i<objs.length;i++)parts.push(Buffer.from(`${String(offsets[i]).padStart(10,'0')} 00000 n \n`));
 parts.push(Buffer.from(`trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`));return Buffer.concat(parts);
}

const browser=await chromium.launch(portable?{executablePath:await portable.executablePath(),args:portable.args.filter(x=>x!=='--single-process')}:{});
try {
 const page=await browser.newPage({serviceWorkers:'block'});
 const envois=[];
 page.on('request',r=>{if(!r.url().startsWith(base)&&(r.method()!=='GET'||r.postData())) envois.push(r.url())});
 await page.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
 await page.addInitScript(()=>{window.__STUDYPLAN_E2E=true});
 await page.goto(base,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__STUDYPLAN_READY&&!document.body.classList.contains('booting'),null,{timeout:60000});
 await page.evaluate(()=>{subjects=[{name:'Mathématiques',level:'HL'},{name:'Chimie',level:'SL'},{name:'Physique',level:'SL'},{name:'Histoire',level:'SL'}];optionalSubjects=[];});
 const lignes=(...a)=>({text:a.map((t,i)=>[40,450-i*35,t])});
 const scan=async lines=>Buffer.from(await page.evaluate(lines=>{
   const c=document.createElement('canvas');c.width=900;c.height=500;
   const x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,900,500);x.fillStyle='black';x.font='bold 40px Arial';
   lines.forEach((s,i)=>x.fillText(s,40,100+i*75));return c.toDataURL('image/jpeg',.98).split(',')[1];
 },lines),'base64');
 const e=(jour,nom,debut,fin)=>[jour,nom,debut,fin];
 const E=[
  ['FR ligne',[lignes('Lundi Chimie 08:00 - 09:00')],[e(0,'Chimie','08:00','09:00')]],
  ['EN ligne',[lignes('Tuesday Physics 10:00 - 11:30')],[e(1,'Physics','10:00','11:30')]],
  ['EN apres-midi',[lignes('Friday History 1:00 pm - 2:00 pm')],[e(4,'History','13:00','14:00')]],
  ['FR blocs',[lignes('Mercredi','Chimie','08:00 - 09:00')],[e(2,'Chimie','08:00','09:00')]],
  ['EN blocs',[lignes('Thursday','Physics','10:00 - 11:00')],[e(3,'Physics','10:00','11:00')]],
  ['deux pages',[lignes('Lundi Chimie 08:00 - 09:00'),lignes('Mardi Physique 10:00 - 11:00')],[e(0,'Chimie','08:00','09:00'),e(1,'Physique','10:00','11:00')]],
  ['sans jour',[lignes('Physics 08:00 - 09:00')],[]],
  ['heure invalide',[lignes('Monday Physics 29:70 - 30:80')],[]],
  ['scan anglais',[{jpeg:await scan(['Monday','Physics','08:00 - 09:00'])}],[e(0,'Physics','08:00','09:00')]],
  ['scan francais',[{jpeg:await scan(['Mardi','Chimie','10:00 - 11:00'])}],[e(1,'Chimie','10:00','11:00')]]
 ];
 const x=(matiere,date,debut,fin)=>[matiere,date,debut,fin];
 const X=[
  ['ISO',[lignes('2031-10-23 Chimie 08:00 - 09:00')],[x('Chimie','2031-10-23','08:00','09:00')]],
  ['FR numerique non ambigu',[lignes('23/10/2031 Physique 10:00 - 11:00')],[x('Physique','2031-10-23','10:00','11:00')]],
  ['EN mois jour',[lignes('October 23 2031 Physics 08:00 - 09:00')],[x('Physique','2031-10-23','08:00','09:00')]],
  ['EN jour mois',[lignes('23 October 2031 Chemistry 10:00 - 11:00')],[x('Chimie','2031-10-23','10:00','11:00')]],
  ['FR mois',[lignes('23 octobre 2031 Histoire 08:00 - 09:00')],[x('Histoire','2031-10-23','08:00','09:00')]],
  ['annee manquante',[lignes('23 octobre Chimie 08:00 - 09:00')],[x('Chimie','','08:00','09:00')]],
  ['date numerique ambigue',[lignes('04/05/2031 Physique 08:00 - 09:00')],[x('Physique','','08:00','09:00')]],
  ['heure manquante',[lignes('2031-10-23 Physics')],[x('Physique','2031-10-23','','')]],
  ['scan anglais',[{jpeg:await scan(['23 October 2031','Physics 08:00 - 09:00'])}],[x('Physique','2031-10-23','08:00','09:00')]],
  ['scan francais',[{jpeg:await scan(['23/10/2031','Chimie 10:00 - 11:00'])}],[x('Chimie','2031-10-23','10:00','11:00')]]
 ];
 let erreurs=0;
 for(const [type,corpus] of [['emploi',E],['examen',X]]) for(let i=0;i<corpus.length;i++) {
   const [nom,pages,attendu]=corpus[i],buffer=pdf(pages);
   let obtenu,texte='';
   try {
    ({obtenu,texte}=await page.evaluate(async ({type,b64})=>{
     const file=new File([Uint8Array.from(atob(b64),c=>c.charCodeAt(0))],'cas.pdf',{type:'application/pdf'});
     if(type==='emploi'){
      const items=await emploiPdfItems(file,()=>{},()=>true), res=emploiAnalyserLecture(items);
      return {obtenu:res.jours.flatMap((j,idx)=>j.map(c=>[idx,c.nom,c.plage.debut,c.plage.fin])),texte:items.map(x=>x.str).join(' | ')};
     }
     const texte=await devoirsOcrImage(file);
     return {obtenu:devoirsParserTexte(texte).map(p=>[p.matiere,p.date,p.debut,p.fin]),texte};
    },{type,b64:buffer.toString('base64')}));
    assert.deepEqual(obtenu,attendu);
    console.log(`OK ${type} ${i+1}/10 ${nom}`);
   } catch(err) {erreurs++;console.error(`ECHEC ${type} ${i+1}/10 ${nom}\nsource: ${JSON.stringify(texte)}\nattendu: ${JSON.stringify(attendu)}\nobtenu: ${JSON.stringify(obtenu)}\n${err.message}`)}
 }
 const securite=await page.evaluate(()=>{
   const avant=localStorage.getItem(DEVOIRS_CLE);
   devoirsMontrerPropositions('04/05/2031 Physics 08:00 - 09:00','examens',false);
   const date=document.querySelector('.prop-date').value;
   devoirsConfirmerPropositions('examens');
   const apresDate=localStorage.getItem(DEVOIRS_CLE);
   devoirsMontrerPropositions('2031-10-23 Physics','devoirs',false);
   devoirsConfirmerPropositions('devoirs');
   const apresHeures=localStorage.getItem(DEVOIRS_CLE);
   return {avant,date,apresDate,apresHeures,alerte:document.getElementById('devoirsOcrStatut').textContent,jour:document.getElementById('emploiManuelJour').value};
 });
 assert.equal(securite.date,'','la date ambigue ne doit pas etre choisie');
 assert.equal(securite.apresDate,securite.avant,'pas de sauvegarde sans date');
 assert.equal(securite.apresHeures,securite.avant,'pas de sauvegarde sans heures');
 assert.match(securite.alerte,/Heures/);
 assert.equal(securite.jour,'','aucun jour manuel choisi par defaut');
 assert.deepEqual(envois,[],'aucun document ne doit etre envoye a un tiers');
 if(erreurs) throw new Error(`${erreurs} cas en echec`);
 console.log('OK corpus : 20 PDF fictifs, comparaison exacte et analyse locale');
} finally {await browser.close()}
