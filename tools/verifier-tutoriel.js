'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const context = {
    console: console,
    localStorage: { getItem: function () { return '[]'; }, setItem: function () {} },
    URL: { revokeObjectURL: function () {}, createObjectURL: function () { return ''; } }
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, 'js/pages/tutoriel.js'), 'utf8'), context, { filename: 'tutoriel.js' });

var echecs = 0;
function attendre(nom, cond) {
    if (!cond) {
        echecs += 1;
        console.log('ECHEC', nom);
    }
}

attendre('titre vide', !context.tutorielTitreValide('  '));
attendre('titre court', !context.tutorielTitreValide('A'));
attendre('titre ok', context.tutorielTitreValide('Première vidéo'));
attendre('insertion bloquée', !context.tutorielPeutInserer(''));
attendre('insertion ouverte', context.tutorielPeutInserer('Comment utiliser le planning'));
attendre('publier sans vidéo', !context.tutorielPeutPublier('Comment utiliser le planning', '', null));
attendre('lien refusé', !context.tutorielLienValide('javascript:alert(1)'));
attendre('http refusé', !context.tutorielLienValide('http://example.com/video.mp4'));
attendre('youtube accepté', context.tutorielLienValide('https://youtu.be/abc123XYZ'));
attendre('publier avec lien', context.tutorielPeutPublier('Comment utiliser le planning', 'https://www.youtube.com/watch?v=abc123XYZ', null));
attendre('fichier trop vague', !context.tutorielPeutPublier('Comment utiliser le planning', 'https://example.com/page', null));
attendre('admin sans vidéo', context.tutorielSectionVisible(true, []));
attendre('élève sans vidéo', !context.tutorielSectionVisible(false, []));
var publiee = [{ type: 'tutoriel', id: 't1', titre: 'Bienvenue', url: 'https://youtu.be/abc123XYZ', publie: 1, at: '2026-10-12T10:00:00Z' }];
attendre('élève après publication', context.tutorielSectionVisible(false, publiee));
var fusion = context.tutorielFusionner(publiee.concat([{ type: 'tutoriel', id: 't1', retire: 1, at: '2026-10-12T11:00:00Z' }]));
attendre('retrait garde le dernier', fusion.length === 1 && fusion[0].retire);
attendre('retrait cache la section', !context.tutorielSectionVisible(false, fusion));
attendre('ordre du menu', fs.readFileSync(path.join(root, 'pages/planning.html'), 'utf8').indexOf('menuTutoriel') < fs.readFileSync(path.join(root, 'pages/planning.html'), 'utf8').indexOf('menuAide'));
var page = fs.readFileSync(path.join(root, 'pages/tutoriel.html'), 'utf8');
attendre('titre avant insertion', page.indexOf('tutorielTitre') < page.indexOf('tutorielChoisir'));
attendre('publier présent', page.indexOf('tutorielPublier') > page.indexOf('tutorielChoisir'));
attendre('compose caché', page.indexOf('id="tutorielCompose" style="display:none;') !== -1);

console.log('échecs', echecs);
if (echecs) process.exit(1);
