/* Import réel de PDF court, photo de grille et PDF scanné : uniquement
   des documents fictifs fabriqués dans ce navigateur. Aucun compte/mail. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const SITE = process.env.STUDY_SITE || 'https://sawadogojuliss-byte.github.io/Learning-DP1/';

function pdfFictif(jpeg, couchePartielle) {
    const texte = [
        [50,450,'Lundi'],[300,450,'Mardi'],
        [50,390,'Maths AA'],[50,365,'08:00 - 09:00'],
        [300,390,'Chimie'],[300,365,'10:00 - 11:00']
    ].map(([x,y,t]) => `BT /F1 12 Tf ${x} ${y} Td (${t}) Tj ET`).join('\n');
    const contenu = Buffer.from(jpeg ?
        (couchePartielle ? 'BT /F1 12 Tf 50 480 Td (Tableau 08:00 - 09:00) Tj ET\n' : '') + 'q 600 0 0 500 0 0 cm /Im1 Do Q' : texte);
    const enveloppe = b => Buffer.concat([Buffer.from(`<< /Length ${b.length} >>\nstream\n`),b,Buffer.from('\nendstream')]);
    const objets = [
        '<< /Type /Catalog /Pages 2 0 R >>',
        '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 500] /Resources << ${jpeg ? '/XObject << /Im1 6 0 R >>' : ''} ${!jpeg || couchePartielle ? '/Font << /F1 5 0 R >>' : ''} >> /Contents 4 0 R >>`,
        enveloppe(contenu),
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
    ];
    if (jpeg) objets.push(Buffer.concat([
        Buffer.from(`<< /Type /XObject /Subtype /Image /Width 900 /Height 500 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`),
        jpeg, Buffer.from('\nendstream')
    ]));
    const morceaux = [Buffer.from('%PDF-1.4\n')], positions = [0];
    objets.forEach((obj,i) => {
        positions.push(morceaux.reduce((n,b) => n + b.length,0));
        morceaux.push(Buffer.from(`${i+1} 0 obj\n`),Buffer.isBuffer(obj) ? obj : Buffer.from(obj),Buffer.from('\nendobj\n'));
    });
    const depart = morceaux.reduce((n,b) => n + b.length,0);
    morceaux.push(Buffer.from(`xref\n0 ${objets.length+1}\n0000000000 65535 f \n`));
    positions.slice(1).forEach(p => morceaux.push(Buffer.from(`${String(p).padStart(10,'0')} 00000 n \n`)));
    morceaux.push(Buffer.from(`trailer\n<< /Size ${objets.length+1} /Root 1 0 R >>\nstartxref\n${depart}\n%%EOF`));
    return Buffer.concat(morceaux);
}

(async () => {
    const config = { headless: true };
    if (process.env.STUDY_CHROMIUM_LOCAL) {
        const aws = require('@sparticuz/chromium');
        config.executablePath = await aws.executablePath(); config.args = aws.args;
    }
    const browser = await chromium.launch(config);
    try {
        const page = await browser.newPage({ viewport: { width: 320, height: 720 } });
        const erreurs = [];
        page.on('pageerror', e => erreurs.push(String(e)));
        await page.addInitScript(() => { window.__STUDYPLAN_E2E = true; });
        await page.goto(SITE, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForFunction(() => window.__STUDYPLAN_READY && !document.body.classList.contains('booting'), null, { timeout: 60000 });
        await page.evaluate(() => {
            document.getElementById('emploiModal').classList.add('active');
            subjects = [{ name: 'Maths AA', level: 'HL', icon: '🔢' }, { name: 'Chimie', level: 'SL', icon: '⚗️' }];
            optionalSubjects = [];
            localStorage.setItem(EMPLOI_CLE, JSON.stringify({ at: 'ancien', jours: [[],[],[
                { id:'cours-manuel', nom:'Français', debut:'11:00', fin:'12:00', src:'manuel' }
            ],[],[],[],[]] }));
        });
        const images = await page.evaluate(() => {
            const c = document.createElement('canvas'); c.width = 900; c.height = 500;
            const x = c.getContext('2d');
            x.fillStyle = '#fff'; x.fillRect(0,0,900,500);
            x.fillStyle = '#000'; x.font = 'bold 42px Arial';
            [['Lundi',60,80],['Mardi',470,80],['Maths AA',60,160],['Chimie',470,160],['08:00 - 09:00',60,215],['10:00 - 11:00',470,215]].forEach(([t,a,b]) => x.fillText(t,a,b));
            return { png: c.toDataURL('image/png').split(',')[1], jpeg: c.toDataURL('image/jpeg',.94).split(',')[1] };
        });
        const png = Buffer.from(images.png,'base64');
        const jpeg = Buffer.from(images.jpeg,'base64');
        async function importer(fichier, parBouton) {
            const numero = await page.evaluate(() => emploiLectureNumero);
            if (parBouton) {
                const choix = page.waitForEvent('filechooser');
                await page.locator('#emploiZoneDepot').click();
                await (await choix).setFiles(fichier);
            } else await page.locator('#emploiFichier').setInputFiles(fichier);
            await page.waitForFunction(n => emploiLectureNumero > n, numero, { timeout: 10000 });
            await page.waitForFunction(() => !emploiOcrEnCours, null, { timeout: 90000 });
            const resultat = await page.evaluate(() => ({ statut: document.getElementById('emploiOcrStatut').textContent,
                propositions: emploiPropositions.map(p => [p.jour,p.nom,p.debut,p.fin]),
                enregistrés: emploiScolaireLire().jours.map(j => j.length) }));
            assert.deepEqual(resultat.propositions.map(([jour,nom,debut,fin])=>[jour,nom,debut,fin]),
                [[0,'Maths AA','08:00','09:00'],[1,'Chimie','10:00','11:00']],
                fichier.name + ' : cours corrects, sans invention : ' + JSON.stringify(resultat));
            assert.deepEqual(resultat.enregistrés, [0,0,1,0,0,0,0],
                'la lecture ne doit modifier aucun ancien cours avant accord');
        }
        await importer({ name:'petit-emploi.pdf', mimeType:'application/pdf', buffer:pdfFictif() }, true);
        await importer({ name:'photo-emploi.png', mimeType:'image/png', buffer:png });
        await importer({ name:'scan-emploi.pdf', mimeType:'application/pdf', buffer:pdfFictif(jpeg) });
        await importer({ name:'pdf-couche-partielle.pdf', mimeType:'application/pdf', buffer:pdfFictif(jpeg, true) });
        assert.deepEqual(await page.evaluate(() => {
            return {
                inconnu: emploiParseTexte('Mercredi\nLatin\n08:00 - 09:00').jours[2].map(c => c.nom),
                sansJour: emploiParseTexte('Latin\n08:00 - 09:00').jours.flat().length,
                generique: emploiParseTexte('Mercredi\nCours\n08:00 - 09:00').jours.flat().length
            };
        }), { inconnu: ['Latin'], sansJour: 0, generique: 0 }, 'matière réelle avec jour/plage, jamais de jour ou de matière inventés');
        const exportSite = await page.evaluate(() => {
            const c = document.createElement('canvas'); c.width = 900; c.height = 450;
            const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0,0,900,450);
            x.fillStyle = '#111'; x.font = 'bold 42px Arial';
            ['Study Plan IB', 'Lun', 'Réveil 06:00', 'Cours 08:15', 'Cours 13:30', 'Coucher 22:00'].forEach((t,i) => x.fillText(t,35,65+i*60));
            return c.toDataURL('image/png').split(',')[1];
        });
        const avantExport = await page.evaluate(() => JSON.stringify(emploiScolaireLire()));
        await page.locator('#emploiFichier').setInputFiles({ name:'planning-exporte.png', mimeType:'image/png', buffer:Buffer.from(exportSite,'base64') });
        await page.waitForFunction(() => !emploiOcrEnCours, null, { timeout: 90000 });
        assert.equal(await page.evaluate(() => emploiPropositions.length), 0, 'aucun vrai cours ne peut être déduit de l’export du planning');
        assert.match(await page.locator('#emploiConfirmation').innerText(), /planning exporté par Study Plan IB.*matières.*heures de fin/s);
        assert.match(await page.locator('#emploiNomFichier').innerText(), /planning-exporte.png/);
        assert.equal(await page.evaluate(() => JSON.stringify(emploiScolaireLire())), avantExport, 'l’échec ne touche pas aux cours enregistrés');
        await importer({ name:'scan-emploi.pdf', mimeType:'application/pdf', buffer:pdfFictif(jpeg) });
        await page.locator('#emploiConfirmation').getByRole('button', { name: 'Enregistrer mes cours' }).click();
        const sauves = await page.evaluate(() => emploiScolaireLire().jours.map(j => j.map(c => [c.nom,c.debut,c.fin,c.src])));
        assert.deepEqual(sauves[0], [['Maths AA','08:00','09:00','doc']]);
        assert.deepEqual(sauves[1], [['Chimie','10:00','11:00','doc']]);
        assert.deepEqual(sauves[2], [['Français','11:00','12:00','manuel']], 'le cours existant reste intact');
        assert.deepEqual(erreurs, [], 'erreurs JS : ' + erreurs.join(' | '));
        console.log('ok upload emploi : PDF court, photo par colonnes, PDF scanné et sauvegarde conservatrice ; aucun compte ni mail');
    } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
