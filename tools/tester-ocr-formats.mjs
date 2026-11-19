/* Documents fictifs : PDF texte multi-pages, grille horaire et PDF mixte. */
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
 const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'});
 const externe=[];page.on('request',r=>{if(!r.url().startsWith(base) && (r.method() !== 'GET' || r.postData())) externe.push(r.method()+' '+r.url())});
 await page.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
 await page.addInitScript(()=>{window.__STUDYPLAN_E2E=true});await page.goto(base,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__STUDYPLAN_READY&&!document.body.classList.contains('booting'),null,{timeout:60000});
 await page.evaluate(()=>{subjects=[{name:'Mathématiques',level:'HL',icon:'📚'},{name:'Chimie',level:'SL',icon:'🧪'}];optionalSubjects=[];});
 const grille=await page.evaluate(()=>emploiParseGrille([
  {str:'Lundi',x:160,y:450},{str:'Mardi',x:310,y:450},
  {str:'08:00 - 09:00',x:20,y:390},{str:'Mathématiques',x:160,y:390},{str:'Chimie',x:310,y:390},
  {str:'10:00 - 11:00',x:20,y:330},{str:'Chimie',x:160,y:330}
 ]).jours.map(j=>j.map(c=>[c.nom,c.plage.debut,c.plage.fin])));
 assert.deepEqual(grille[0],[['Mathématiques','08:00','09:00'],['Chimie','10:00','11:00']]);
 assert.deepEqual(grille[1],[['Chimie','08:00','09:00']]);
 assert.equal(await page.evaluate(()=>emploiLirePlage('29:70 - 30:80')),null,'une heure invalide ne doit pas être transformée');
 const inline=await page.evaluate(()=>({texte:emploiParseTexte('Mardi Chimie 08:00 - 09:00').jours[1],
  items:emploiParseItems([{str:'Lundi',x:100,y:400},{str:'Chimie 08:00 - 09:00',x:100,y:350}]).jours[0]}));
 assert.equal(inline.texte[0].nom,'Chimie');assert.equal(inline.items[0].nom,'Chimie');
 const heuresCourtes=await page.evaluate(()=>emploiParseTexte('Mardi Chimie 8h - 9h').jours[1]);
 assert.equal(heuresCourtes[0].nom,'Chimie');assert.equal(heuresCourtes[0].plage.debut,'08:00');
 const dates=await page.evaluate(()=>({iso:devoirsParserTexte('2029-12-23 Mathématiques 08:00 - 09:00'),nommee:devoirsParserTexte('23 octobre 2031 Mathématiques 08:00 - 09:00')}));
 assert.equal(dates.iso[0].date,'2029-12-23');assert.equal(dates.nommee[0].date,'2031-10-23');
 const cours=(jour,nom)=>({text:[[50,450,jour],[50,390,nom],[50,365,'08:00 - 09:00']]});
 const multi=pdf([cours('Lundi','Maths'),cours('Lundi','Maths'),cours('Lundi','Maths'),cours('Mardi','Chimie')]);
 const scanB64=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=900;c.height=500;const ctx=c.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,900,500);ctx.fillStyle='black';ctx.font='bold 42px Arial';ctx.fillText('23/12/2030',55,170);ctx.fillText('Chimie 08:00 - 09:00',55,240);return c.toDataURL('image/jpeg',.95).split(',')[1];});
 const mixte=pdf([{jpeg:Buffer.from(scanB64,'base64'),text:[[30,480,'Document scolaire titre long avec une couche de texte partielle']]}]);
 const tropLong=pdf(Array.from({length:21},()=>cours('Lundi','Maths')));
 externe.length=0;
 const results=await page.evaluate(async ({multi,mixte,tropLong})=>{
  const file=(b,name)=>new File([Uint8Array.from(atob(b),c=>c.charCodeAt(0))],name,{type:'application/pdf'});
  const items=await emploiPdfItems(file(multi,'multi.pdf'),()=>{},()=>true);
  const emplois=emploiAnalyserLecture(items);
  const texte=await devoirsOcrImage(file(mixte,'mixte.pdf'));
  const devoirs=devoirsParserTexte(texte);
  let erreur='',erreurEmploi='';try{await devoirsOcrImage(file(tropLong,'long.pdf'))}catch(e){erreur=e.message}
  try{await emploiPdfItems(file(tropLong,'long.pdf'),()=>{},()=>true)}catch(e){erreurEmploi=e.message}
  return {emplois,texte,devoirs,erreur,erreurEmploi};
 },{multi:multi.toString('base64'),mixte:mixte.toString('base64'),tropLong:tropLong.toString('base64')});
 assert.equal(results.emplois.jours[0].length,1,'doublons des pages supprimés');
 assert.equal(results.emplois.jours[1][0].nom,'Chimie','la quatrième page est lue');
 assert.match(results.texte,/23\/12\/2030/,'le scan est lu malgré le titre en texte');
 assert.ok(results.devoirs.some(x=>x.matiere==='Chimie'&&x.date==='2030-12-23'),JSON.stringify(results));
 assert.match(results.erreur,/20 pages maximum/);assert.match(results.erreurEmploi,/20 pages maximum/);
 assert.deepEqual(externe,[], 'la lecture PDF/OCR ne doit pas envoyer le document à un service externe');
 const avant=await page.evaluate(()=>localStorage.getItem(DEVOIRS_CLE));
 await page.evaluate(()=>{ibYear='DP1';navigateTo('devoirs');});
 await page.locator('#devoirsFichierExam').setInputFiles({name:'examen-mixte.pdf',mimeType:'application/pdf',buffer:mixte});
 await page.waitForFunction(()=>!devoirsOcrEnCours,null,{timeout:90000});
 assert.ok(await page.evaluate(()=>devoirsPropositions.some(p=>p.matiere==='Chimie'&&p.date==='2030-12-23')),'proposition examinable dans l’interface');
 assert.equal(await page.evaluate(()=>localStorage.getItem(DEVOIRS_CLE)),avant,'lecture sans enregistrement avant confirmation');
 console.log('OK OCR local : grille, dates, quatrième page, scan mixte, dédoublonnage et limite explicite');
}finally{await browser.close()}
