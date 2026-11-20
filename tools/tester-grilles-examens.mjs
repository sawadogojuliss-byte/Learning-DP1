/* Grilles d'examens fictives, inspirées de documents à plusieurs jours,
   sessions, sous-colonnes, surveillants et durées. Pas de données réelles. */
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
  objs[page]=`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 900 500] /Resources << /Font << /F1 3 0 R >> ${img} >> /Contents ${content} 0 R >>`;
  const text=(p.text||[]).map(([x,y,t])=>`BT /F1 9 Tf ${x} ${y} Td (${t.replace(/[()\\]/g,'\\$&')}) Tj ET`).join('\n');
  const stream=Buffer.from((p.jpeg?'q 900 0 0 500 0 0 cm /Im1 Do Q\n':'')+text);
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
 const envois=[];page.on('request',r=>{if(!r.url().startsWith(base)&&(r.method()!=='GET'||r.postData()))envois.push(r.url())});
 await page.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
 await page.addInitScript(()=>{window.__STUDYPLAN_E2E=true});await page.goto(base,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__STUDYPLAN_READY&&!document.body.classList.contains('booting'),null,{timeout:60000});
 await page.evaluate(()=>{subjects=[{name:'Chimie'},{name:'Physique'},{name:'Histoire'},{name:'Mathématiques AA'},{name:'ESS'}];optionalSubjects=[];});
 const t=(x,y,s)=>[x,y,s];
 const jours=['Monday 20 October','Tuesday 21 October','Wednesday 22 October','Thursday 23 October','Friday 24 October'];
 const mat=[['Chemistry','Physics','History','Maths','ESS'],['Physics','History','Chemistry','ESS','Maths']];
 function native(opts={}){
  let arr=[];
  const heads=jours.map((j,i)=>opts.fr?['Lundi 20 octobre','Mardi 21 octobre','Mercredi 22 octobre','Jeudi 23 octobre','Vendredi 24 octobre'][i]:j);
  function header(y){heads.forEach((j,i)=>arr.push(t(160+i*140,y,j+(opts.year?' 2031':''))));}
  // Colonnes espacées, texte non trié pour mettre à l'épreuve PDF.js.
  header(470);
  for(let r=0;r<2;r++){
   let y=420-r*120;
   arr.push(t(100,y,opts.fr?'Matiere':'Subject(s)'),t(100,y-25,'Paper'),t(100,y-45,'Supervisor'),t(100,y-65,'Duration'));
   if(!opts.noTime)arr.push(t(15,y-15,r?'11:00':'08:15'),t(15,y-40,'-'),t(15,y-60,r?'13:00':'10:30'));
   mat[r].forEach((s,i)=>arr.push(t(160+i*140,y,s),t(160+i*140,y-25,'P1'),t(160+i*140,y-45,'Supervisor X'),t(160+i*140,y-65,'1:30')));
  }
  if(opts.reverse) arr.reverse();
  return {text:arr};
 }
 const scan=async opts=>Buffer.from(await page.evaluate(opts=>{
  const c=document.createElement('canvas');c.width=900;c.height=500;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,900,500);
  const left=140,w=150;let heads=['Monday 20 October','Tuesday 21 October','Wednesday 22 October','Thursday 23 October','Friday 24 October'];
  if(opts.fr) heads=['Lundi 20 octobre','Mardi 21 octobre','Mercredi 22 octobre','Jeudi 23 octobre','Vendredi 24 octobre'];
  x.fillStyle=opts.green||'#408b20';x.fillRect(left,20,750,34);x.fillStyle='white';x.font='bold '+(opts.crowded ? 13 : 11)+'px Arial';
  heads.forEach((s,i)=>x.fillText(s+(opts.year?' 2031':''),left+i*w+3,42));
  const mat=[['Chemistry','Physics','History','Maths','ESS'],['Physics','History','Chemistry','ESS','Maths']];
  for(let r=0;r<2;r++){
   const y=55+r*205;x.fillStyle=opts.dark||'#7e1534';x.fillRect(0,y,75,175);x.fillStyle='white';x.font='bold 18px Arial';
   x.fillText(r?'11:00':'08:15',8,y+65);x.fillText('-',30,y+92);x.fillText(r?'13:00':'10:30',8,y+122);
   x.fillStyle='black';x.font='bold 12px Arial';x.fillText(opts.fr?'Matiere':'Subject(s)',78,y+35);x.fillText('Paper',78,y+75);x.fillText('Supervisor',78,y+110);x.fillText('Duration',78,y+145);
   x.font='15px Arial';mat[r].forEach((s,i)=>{let xx=left+i*w+25;x.fillText(s,xx,y+35);x.fillText('P1',xx,y+75);x.fillText('Teacher',xx,y+110);x.fillText('1:30',xx,y+145);});
   x.strokeStyle='#999';for(let i=0;i<=5;i++){x.beginPath();x.moveTo(left+i*w,y);x.lineTo(left+i*w,y+175);x.stroke()}
  }
  return c.toDataURL('image/jpeg',opts.quality||.95).split(',')[1];
 },opts),'base64');
 const cases=[
  ['native anglais annee',{type:'native',year:true}],
  ['native francais annee',{type:'native',fr:true,year:true}],
  ['native annee absente',{type:'native'}],
  ['native ordre inverse',{type:'native',year:true,reverse:true}],
  ['native heures absentes',{type:'native',year:true,noTime:true}],
  ['scan anglais',{type:'scan'}],
  ['scan francais',{type:'scan',fr:true}],
  ['scan vert fonce',{type:'scan',green:'#245d2e',dark:'#243e65'}],
  ['scan contraste gris',{type:'scan',green:'#444444',dark:'#555555'}],
  ['scan jpeg comprime',{type:'scan',quality:.65}],
  ['en-tetes colles : abstention',{type:'scan',crowded:true,partial:true}]
 ];
 let erreurs=0;
 for(let i=0;i<cases.length;i++){
  const [nom,o]=cases[i],buffer=pdf([o.type==='native'?native(o):{jpeg:await scan(o)}]);
  let r;
  try {
   r=await page.evaluate(async b64=>{
    const f=new File([Uint8Array.from(atob(b64),c=>c.charCodeAt(0))],'grille.pdf',{type:'application/pdf'});
    const r=await devoirsAnalyserFichier(f);return {grille:r.grille,props:r.propositions.map(p=>({matiere:p.matiere,date:p.date,debut:p.debut,fin:p.fin,indice:p.indice}))};
   },buffer.toString('base64'));
   assert.equal(r.grille,true,'grille non reconnue');
   if(o.partial){
    for(const p of r.props){
     const options=[];
     for(let row=0;row<2;row++) for(let j=0;j<5;j++){
      const canon={Chemistry:'Chimie',Physics:'Physique',History:'Histoire',Maths:'Mathématiques AA',ESS:'ESS'}[mat[row][j]];
      if(p.matiere===canon && p.indice.includes((row?'11:00–13:00':'08:15–10:30')) && p.indice.includes(jours[j])) options.push(true);
     }
     assert.ok(options.length, 'association non prouvée : '+JSON.stringify(p));
    }
    console.log(`OK ${i+1}/${cases.length} ${nom} (${r.props.length} propositions prudentes)`);continue;
   }
   assert.equal(r.props.length,10,'dix cellules attendues');
   for(let row=0;row<2;row++) for(let j=0;j<5;j++){
    let source=mat[row][j],canon={Chemistry:'Chimie',Physics:'Physique',History:'Histoire',Maths:'Mathématiques AA',ESS:'ESS'}[source];
    const window=row?'11:00–13:00':'08:15–10:30', date=o.year?`2031-10-${20+j}`:'';
    assert.ok(r.props.some(p=>p.matiere===canon&&p.date===date&&p.indice.includes((o.fr?['Lundi','Mardi','Mercredi','Jeudi','Vendredi']:['Monday','Tuesday','Wednesday','Thursday','Friday'])[j])&&(!o.noTime?p.indice.includes(window):p.indice.includes('à vérifier'))),`${source} jour ${j} session ${row}`);
   }
   assert.ok(r.props.every(p=>!p.debut&&!p.fin),'plage de session non automatiquement validée');
   console.log(`OK ${i+1}/${cases.length} ${nom}`);
  }catch(e){erreurs++;console.error(`ECHEC ${i+1}/${cases.length} ${nom}: ${e.message}\n${JSON.stringify(r)}`)}
 }
 const incoherences=await page.evaluate(()=>{
  const jeudi={jour:4,numero:23,mois:9,anneeSource:null}, vendredi={jour:5,numero:23,mois:9,anneeSource:null};
  const jours=[['Monday',20,100],['Tuesday',21,260],['Wednesday',22,420],['Thursday',23,580],['Friday',23,740]];
  let mots=[];jours.forEach(([nom,n,x])=>{
   mots.push({texte:nom,x,y:20,h:12,w:60},{texte:String(n),x:x+45,y:20,h:12,w:15},{texte:'October',x:x+80,y:20,h:12,w:45});
  });
  mots.push({texte:'Subject(s)',x:35,y:60,h:12,w:60},{texte:'Paper',x:35,y:90,h:12,w:40});
  const d=devoirsDispositionGrille(mots);
  return {compatible:devoirsDatesGrilleCompatibles(jeudi,vendredi),fiables:d.bandes[0].jours.map(j=>j.fiable)};
 });
 assert.equal(incoherences.compatible,false,'dates voisines incompatibles');
 assert.equal(incoherences.fiables[4],false,'une colonne contradictoire doit être ignorée');
 assert.ok(incoherences.fiables.slice(0,4).every(Boolean));
 const fusion=await page.evaluate(()=>{
  // L'OCR a fusionné les en-têtes du mardi au jeudi : le centre
  // du mardi est alors décalé jusque dans la colonne du mercredi.
  const w=(texte,x,y=20)=>({texte,x,y,h:12,w:25});
  const mots=[w('Lundi',100),w('20',145),w('octobre',180),w('Mardi',260),w('21',305),w('octobre',340),w('Mercreds',420),w('22',465),w('octobre',500),w('Jeudr',580),w('23',625),w('octobre',660),w('Vendredi',740),w('24',785),w('octobre',820),w('Matiere',35,60),w('Paper',35,90)];
  return devoirsDispositionGrille(mots).bandes[0].jours.map(j=>({jour:j.jour,fiable:j.fiable}));
 });
 assert.ok(fusion.every(j=>!j.fiable),'les colonnes autour d’une en-tête fusionnée sont trop incertaines');
 const ui=await page.evaluate(()=>{
  localStorage.removeItem(DEVOIRS_CLE);
  const l={date:'',jour:1,numero:20,mois:9,anneeSource:null};
  devoirsMontrerPropositions('','examens',true,[
   {matiere:'Chimie',date:'',debut:'',fin:'',dateLue:l,plageSession:['08:15','10:30'],indice:'Monday 20 October'},
   {matiere:'Chimie',date:'',debut:'',fin:'',dateLue:l,plageSession:['11:00','13:00'],indice:'Monday 20 October'}
  ],true);
  const d=()=>Array.from(document.querySelectorAll('.prop-date')).map(x=>x.value);
  const before=localStorage.getItem(DEVOIRS_CLE),initial=d();
  document.getElementById('devoirsAnneeGrille').value='2030';devoirsAppliquerAnneeGrille();const mauvais=d();
  document.getElementById('devoirsAnneeGrille').value='2031';devoirsAppliquerAnneeGrille();const bon=d();
  devoirsUtiliserPlage('prop0');devoirsUtiliserPlage('prop1');
  const afterInput=localStorage.getItem(DEVOIRS_CLE);
  memoireSauvegarder=function(){};
  devoirsConfirmerPropositions('examens');
  return {initial,mauvais,bon,before,afterInput,examens:devoirsLireStore().examens};
 });
 assert.deepEqual(ui.initial,['','']);assert.deepEqual(ui.mauvais,['',''],'refuser une année incompatible avec le jour');
 assert.deepEqual(ui.bon,['2031-10-20','2031-10-20'],'année explicitement fournie');
 assert.equal(ui.afterInput,ui.before,'aucune écriture avant confirmation');
 assert.equal(ui.examens.length,2,'deux épreuves distinctes de la même matière le même jour doivent être conservées');
 assert.deepEqual(ui.examens.map(x=>[x.debut,x.fin]),[['08:15','10:30'],['11:00','13:00']]);
 assert.deepEqual(envois,[],'aucun PDF envoyé à un service tiers');
 if(erreurs)throw new Error(`${erreurs} grilles en échec`);
 console.log('OK grilles fictives : jours, dates, horaires de session et refus des heures inventées');
}finally{await browser.close()}
