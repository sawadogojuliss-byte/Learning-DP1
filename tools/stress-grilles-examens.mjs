/* Campagne étendue optionnelle : variations synthétiques déterministes.
   Le rapport distingue omissions, heures incertaines et associations erronées. */
import {createRequire} from 'node:module';import path from 'node:path';import fs from 'node:fs';
const require=createRequire(process.env.STUDY_TEST_MODULES?path.resolve(process.env.STUDY_TEST_MODULES,'../package.json'):import.meta.url);
const {chromium}=require('playwright');const portable=process.env.STUDY_PLAYWRIGHT_SYSTEM?null:require('@sparticuz/chromium').default;
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
try{
 const page=await browser.newPage({serviceWorkers:'block'});
 await page.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
 await page.addInitScript(()=>{window.__STUDYPLAN_E2E=true});await page.goto(base,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__STUDYPLAN_READY&&!document.body.classList.contains('booting'),null,{timeout:60000});
 await page.evaluate(()=>{subjects=[{name:'Chimie'},{name:'Physique'},{name:'Histoire'},{name:'Mathématiques AA'},{name:'ESS'}];optionalSubjects=[];});
 const scan=async opts=>Buffer.from(await page.evaluate(opts=>{
  const c=document.createElement('canvas');c.width=900;c.height=500;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,900,500);
  const left=140,w=150;let heads=['Monday 20 October','Tuesday 21 October','Wednesday 22 October','Thursday 23 October','Friday 24 October'];
  if(opts.fr) heads=['Lundi 20 octobre','Mardi 21 octobre','Mercredi 22 octobre','Jeudi 23 octobre','Vendredi 24 octobre'];
  x.fillStyle=opts.green||'#408b20';x.fillRect(left,20,750,34);x.fillStyle='white';x.font='bold '+opts.header+'px '+opts.font;
  heads.forEach((s,i)=>x.fillText(s+(opts.year?' 2031':''),left+i*w+3,42));
  const mat=opts.mat;
  for(let r=0;r<2;r++){
   const y=55+r*205;x.fillStyle=opts.dark||'#7e1534';x.fillRect(0,y,75,175);x.fillStyle='white';x.font='bold 18px Arial';
   x.fillText(r?'11:00':'08:15',8,y+65);x.fillText('-',30,y+92);x.fillText(r?'13:00':'10:30',8,y+122);
   x.fillStyle='black';x.font='bold 12px Arial';x.fillText(opts.fr?'Matiere':'Subject(s)',78,y+35);x.fillText('Paper',78,y+75);x.fillText('Supervisor',78,y+110);x.fillText('Duration',78,y+145);
   x.font=(opts.subjectSize||15)+'px '+opts.font;mat[r].forEach((s,i)=>{let xx=left+i*w+25;x.fillText(s,xx,y+35);x.fillText('P1',xx,y+75);x.fillText('Teacher',xx,y+110);x.fillText('1:30',xx,y+145);});
   x.strokeStyle='#999';for(let i=0;i<=5;i++){x.beginPath();x.moveTo(left+i*w,y);x.lineTo(left+i*w,y+175);x.stroke()}
  }
  if(opts.blur){const old=document.createElement('canvas');old.width=900;old.height=500;old.getContext('2d').drawImage(c,0,0);x.clearRect(0,0,900,500);x.filter='blur('+opts.blur+'px)';x.drawImage(old,0,0);x.filter='none';}return c.toDataURL('image/jpeg',opts.quality||.95).split(',')[1];
 },opts),'base64');

 const count=Number(process.env.STUDY_GRILLE_N||180), mat=['Chemistry','Physics','History','Maths','ESS'];
 const noms={Chemistry:'Chimie',Physics:'Physique',History:'Histoire',Maths:'Mathématiques AA',ESS:'ESS'};
 const english=['Monday','Tuesday','Wednesday','Thursday','Friday'], french=['Lundi','Mardi','Mercredi','Jeudi','Vendredi'];
 const colors=['#408b20','#245d2e','#344d72','#555555','#6a4828','#315e64'];
 let total=0, retrouves=0, mauvais=0, incertains=0, grilles=0, exceptions=0, effectues=0;
 for(let k=Number(process.env.STUDY_GRILLE_OFFSET||0);k<Number(process.env.STUDY_GRILLE_OFFSET||0)+count;k++){
  effectues++;
  const shift=k%5, shift2=(shift+1+(Math.floor(k/5)%4))%5;
  const rows=[Array.from({length:5},(_,i)=>mat[(i+shift)%5]),Array.from({length:5},(_,i)=>mat[(i+shift2)%5])];
  const o={mat:rows,fr:!!(k%2),font:['Arial','Verdana','Georgia'][k%3],header:[10,11,12][Math.floor(k/3)%3],subjectSize:[13,15,16][Math.floor(k/9)%3],green:colors[Math.floor(k/27)%colors.length],dark:colors[(k+2)%colors.length],quality:[.55,.72,.88,.97][Math.floor(k/7)%4],blur:[0,0,.3,.5][Math.floor(k/11)%4]};
  try{
   const buffer=pdf([{jpeg:await scan(o)}]);
   if(process.env.STUDY_EXPORT_GRILLES){
    const dir=process.env.STUDY_EXPORT_GRILLES;fs.mkdirSync(dir,{recursive:true});
    const nom=`grille-fictive-${String(k+1).padStart(3,'0')}`;
    const jours=o.fr?french:english;
    fs.writeFileSync(path.join(dir,nom+'.pdf'),buffer);
    fs.writeFileSync(path.join(dir,nom+'.json'),JSON.stringify({fichier:nom+'.pdf',langue:o.fr?'fr':'en',annee:null,mois:'octobre',options:o,cellules:rows.flatMap((ligne,row)=>ligne.map((matiere,col)=>({jour:jours[col],quantieme:20+col,matiere_originale:matiere,matiere:noms[matiere],plage_session:row?['11:00','13:00']:['08:15','10:30']})))},null,2)+'\n');
   }
   const r=await page.evaluate(async b=>{const f=new File([Uint8Array.from(atob(b),x=>x.charCodeAt(0))],'fictif.pdf',{type:'application/pdf'});return devoirsAnalyserFichier(f)},buffer.toString('base64'));
   const jour=o.fr?french:english, expected=[];
   for(let row=0;row<2;row++) for(let col=0;col<5;col++) expected.push({matiere:noms[rows[row][col]],jour:jour[col],numero:20+col,window:row?'11:00–13:00':'08:15–10:30'});
   let ok=0,wrong=[];if(r.grille)grilles++;
   for(const p of r.propositions){
    if(p.date||p.debut||p.fin){wrong.push('valeur non justifiée '+JSON.stringify(p));continue}
    if(!p.indice){incertains++;continue}
    const match=expected.filter(x=>p.matiere===x.matiere&&p.indice.toLowerCase().includes(x.jour.toLowerCase()));
    if(!match.length){wrong.push(JSON.stringify(p));continue}
    if(p.dateLue && p.dateLue.numero != null && !match.some(x=>p.dateLue.numero===x.numero)) wrong.push('quantieme '+JSON.stringify(p));
    else if(p.indice.includes('Plage de la session')&&!match.some(x=>p.indice.includes(x.window)))wrong.push('session '+JSON.stringify(p));
    else {ok++; if(p.indice.includes('à vérifier'))incertains++;}
   }
   total+=10;retrouves+=ok;mauvais+=wrong.length;
   console.log(JSON.stringify({cas:k+1,grille:r.grille,correspondances:ok,omissions:Math.max(0,10-ok),faux:wrong.length,details:wrong,options:{fr:o.fr,font:o.font,header:o.header,subjectSize:o.subjectSize,green:o.green,dark:o.dark,quality:o.quality,blur:o.blur,shift,shift2}}));
   if(wrong.length && process.env.STUDY_STOP_ON_ERROR) break;
  }catch(e){exceptions++;console.log(JSON.stringify({cas:k+1,erreur:String(e)}))}
 }
 console.log('BILAN '+JSON.stringify({cas:effectues,grilles,attendus:total,retrouves,omissions:total-retrouves,mauvais,incertains,exceptions}));
 if(mauvais||exceptions)process.exitCode=1;
}finally{await browser.close()}
