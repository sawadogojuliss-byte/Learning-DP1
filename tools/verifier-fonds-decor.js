/* Vérifie le changement de décor Pomodoro :
   - le planning ne peut jamais apparaître (aucune baisse d'opacité) ;
   - l'ancienne image ne revient jamais (aucun fondu) ;
   - l'image choisie est posée d'un coup, dès qu'elle est décodée ;
   - les images sont préparées en avance pour que le clic soit instantané. */
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var code = fs.readFileSync(path.join(__dirname, '..', 'js/pages/pomodoro-page.js'), 'utf8');
var page = fs.readFileSync(path.join(__dirname, '..', 'pages/pomodoro.html'), 'utf8');
var css = fs.readFileSync(path.join(__dirname, '..', 'css/pages/planning-panels.css'), 'utf8');
var echecs = [];

function ok(cond, message) {
    if (!cond) echecs.push(message);
}

function creerContexte(typeReseau) {
    var elements = {};
    var timers = [];
    var compteur = 0;
    var chargees = [];
    var enAttente = [];
    var journal = [];

    function element(id) {
        if (elements[id]) return elements[id];
        var el = creerElement(id);
        elements[id] = el;
        return el;
    }

    function creerElement(id) {
        var el = {
            id: id,
            style: {},
            hidden: false,
            childNodes: [],
            attrs: {},
            __focus: false,
            appendChild: function (enfant) { this.childNodes.push(enfant); },
            addEventListener: function () {},
            removeEventListener: function () {},
            setAttribute: function (cle, valeur) { this.attrs[cle] = String(valeur); },
            getAttribute: function (cle) { return this.attrs[cle]; },
            removeAttribute: function (cle) { delete this.attrs[cle]; },
            querySelector: function () { return null; },
            querySelectorAll: function () { return []; },
            classList: {
                _s: {},
                add: function (c) { this._s[c] = true; },
                remove: function (c) { delete this._s[c]; },
                toggle: function (c, on) { if (on) this._s[c] = true; else delete this._s[c]; },
                contains: function (c) { return !!this._s[c]; }
            }
        };
        /* On enregistre chaque fois que le décor est réellement repeint. */
        var image = '';
        Object.defineProperty(el.style, 'backgroundImage', {
            get: function () { return image; },
            set: function (valeur) {
                image = String(valeur);
                journal.push({ id: id, src: image });
            }
        });
        return el;
    }

    function FausseImage() {
        var self = this;
        this.onload = null;
        this.onerror = null;
        this.decode = function () { return Promise.resolve(); };
        Object.defineProperty(this, 'src', {
            get: function () { return self._src; },
            set: function (valeur) {
                self._src = valeur;
                enAttente.push(self);
            }
        });
    }

    var documentFaux = {
        title: 'Studyplan',
        addEventListener: function () {},
        removeEventListener: function () {},
        getElementById: element,
        createElement: function () { return creerElement('cree'); },
        querySelectorAll: function (selecteur) {
            if (selecteur === '#focusFonds .focus-vignette') return element('focusFonds').childNodes;
            return [];
        },
        querySelector: function () { return null; },
        body: creerElement('body'),
        documentElement: creerElement('html')
    };

    var stockage = {};
    var sandbox = {
        console: console,
        Promise: Promise,
        Math: Math,
        Date: Date,
        JSON: JSON,
        Number: Number,
        String: String,
        Error: Error,
        document: documentFaux,
        Image: FausseImage,
        navigator: { connection: { effectiveType: typeReseau, saveData: false } },
        localStorage: {
            getItem: function (cle) { return cle in stockage ? stockage[cle] : null; },
            setItem: function (cle, valeur) { stockage[cle] = String(valeur); },
            removeItem: function (cle) { delete stockage[cle]; }
        },
        setTimeout: function (fn, delai) {
            compteur += 1;
            timers.push({ id: compteur, fn: fn, delai: delai || 0 });
            return compteur;
        },
        clearTimeout: function (id) {
            timers = timers.filter(function (t) { return t.id !== id; });
        },
        setInterval: function () { return 1; },
        clearInterval: function () {},
        requestAnimationFrame: function (fn) { return sandbox.setTimeout(fn, 16); },
        location: { href: 'https://exemple.test/index.html', origin: 'https://exemple.test' },
        URL: URL
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    var contexte = vm.createContext(sandbox);
    vm.runInContext(code, contexte, { filename: 'pomodoro-page.js' });

    function liberer() {
        return new Promise(function (resoudre) {
            var tours = 0;
            (function suivant() {
                tours += 1;
                var fait = false;
                while (timers.length) {
                    timers.shift().fn();
                    fait = true;
                }
                if (enAttente.length) {
                    var lot = enAttente.slice();
                    enAttente = [];
                    lot.forEach(function (img) {
                        chargees.push(img.src);
                        if (img.onload) img.onload();
                    });
                    fait = true;
                }
                if (fait && tours < 500) return setImmediate(suivant);
                setImmediate(resoudre);
            })();
        });
    }

    return {
        contexte: contexte,
        element: element,
        vignettes: function () { return element('focusFonds').childNodes; },
        drainer: liberer,
        journal: function (id) {
            return journal.filter(function (entree) { return entree.id === id; })
                .map(function (entree) { return entree.src; });
        },
        minuteurs: function () { return timers.length; },
        imagesEnAttente: function () { return enAttente.length; },
        imagesChargees: function () { return chargees.length; }
    };
}

(async function () {
    /* ── 1. Réseau lent : rien n'est préchargé, chaque clic est observé en direct ── */
    var lent = creerContexte('2g');
    var contexte = lent.contexte;
    var bg = lent.element('focusBg');
    var source = function (i) { return contexte.FOCUS_FONDS[i].src; };

    contexte.focusCharger();
    await lent.drainer();
    var nbFonds = contexte.FOCUS_FONDS.length;
    ok(nbFonds >= 32 && lent.vignettes().length === nbFonds,
        'une vignette doit être créée pour chaque décor (' + nbFonds + ' attendues, trouvé ' + lent.vignettes().length + ')');
    ok(lent.imagesEnAttente() === 0, 'en 2G aucune image ne doit être préchargée d avance');
    ok(String(lent.vignettes()[0].style.backgroundImage).indexOf('mini/lumiere.webp') !== -1,
        'les vignettes doivent utiliser les petites images');
    ok(contexte.focusFondActif === source(0), 'le décor doit s ouvrir sur la lumière');
    ok(lent.journal('focusBg').length === 1 && lent.journal('focusBg')[0].indexOf('lumiere.webp') !== -1,
        'la lumière doit être peinte une seule fois');
    var ancienne = bg.style.backgroundImage;

    /* Clic sur « Chalet » : tant que l'image n'est pas décodée, le décor ne bouge pas. */
    contexte.focusPoserFond(5);
    ok(bg.style.backgroundImage === ancienne,
        'le décor ne doit pas être modifié avant que la nouvelle image soit prête');
    ok(bg.style.opacity === undefined,
        'le décor ne doit jamais baisser d opacité (le planning apparaîtrait)');
    ok(lent.journal('focusBg').length === 1, 'aucune image intermédiaire ne doit être peinte');
    ok(lent.vignettes()[5].classList.contains('is-chargement'),
        'la vignette cliquée doit indiquer le chargement');
    ok(lent.vignettes()[5].getAttribute('aria-busy') === 'true', 'la vignette doit être marquée occupée');

    await lent.drainer();
    ok(bg.style.backgroundImage.indexOf('chalet.webp') !== -1,
        'la nouvelle image doit être posée dès qu elle est décodée');
    ok(bg.style.opacity === undefined, 'le décor doit rester pleinement opaque');
    ok(lent.journal('focusBg').length === 2, 'le décor ne doit être peint qu une fois par changement');
    ok(lent.journal('focusBg')[0].indexOf('lumiere') !== -1 &&
        lent.journal('focusBg')[1].indexOf('chalet') !== -1,
        'l ancienne image ne doit jamais réapparaître après la nouvelle');
    ok(!lent.vignettes()[5].classList.contains('is-chargement'),
        'l indicateur de chargement doit disparaître');
    ok(contexte.focusFondActif === source(5), 'le décor actif doit être le chalet');
    ok(lent.minuteurs() === 0, 'aucune minuterie de fondu ne doit rester');

    /* Deuxième changement : même comportement. */
    contexte.focusPoserFond(17);
    ok(bg.style.backgroundImage.indexOf('chalet.webp') !== -1,
        'le décor garde l image précédente pendant le chargement');
    await lent.drainer();
    ok(bg.style.backgroundImage.indexOf('sentier.webp') !== -1, 'le nouveau décor doit être posé directement');
    ok(lent.journal('focusBg').length === 3, 'toujours une seule peinture par changement');
    ok(String(lent.element('focusAccueilFond').style.backgroundImage).indexOf('sentier.webp') !== -1,
        'le fond de l accueil doit suivre le décor choisi');

    contexte.focusArreterFonds();
    var avant = lent.imagesChargees();
    await lent.drainer();
    ok(lent.imagesChargees() === avant, 'en quittant le minuteur le préchargement doit s arrêter');

    /* ── 2. Réseau normal : les images sont préparées en avance ── */
    var rapide = creerContexte('4g');
    rapide.contexte.focusCharger();
    await rapide.drainer();
    var restantes = rapide.contexte.FOCUS_FONDS.filter(function (f) {
        return !rapide.contexte.focusFondsPrets[f.src];
    });
    ok(restantes.length === 0, 'toutes les images doivent être préparées (' + restantes.length + ' restantes)');
    ok(Object.keys(rapide.contexte.focusFondsPrets).length === rapide.contexte.FOCUS_FONDS.length,
        'chaque fond doit être prêt (' + rapide.contexte.FOCUS_FONDS.length + ')');

    /* Image déjà prête : le changement doit être immédiat, sans aucun délai. */
    var journalAvant = rapide.journal('focusBg').length;
    rapide.contexte.focusPoserFond(9);
    ok(rapide.element('focusBg').style.backgroundImage.indexOf('noel.webp') !== -1,
        'une image déjà prête doit s afficher immédiatement');
    ok(rapide.journal('focusBg').length === journalAvant + 1, 'un seul repaint, sans passage intermédiaire');
    ok(!rapide.vignettes()[9].classList.contains('is-chargement'),
        'aucun chargement à signaler quand l image est prête');
    ok(rapide.minuteurs() === 0, 'aucune minuterie ne doit être posée');

    /* ── 3. Le code et le style portent bien la correction ── */
    ok(code.indexOf("opacity = '0.25'") === -1, 'l ancien effacement du décor doit avoir disparu');
    ok(code.indexOf('focusBgBis') === -1 && page.indexOf('focusBgBis') === -1, 'plus de second calque');
    ok(code.indexOf('visible.style.opacity') === -1 && code.indexOf('prochain.style.opacity') === -1,
        'plus aucun fondu entre deux décors');
    ok(code.indexOf('focusPeindreCalque(bg, src)') !== -1, 'la nouvelle image est peinte directement');
    ok(code.split('function focusFondPage').length === 2, 'une seule définition de focusFondPage');
    ok(code.split('function focusPoserFond').length === 2, 'une seule définition de focusPoserFond');
    ok(css.indexOf('transition: none') !== -1, 'le décor ne doit plus changer en fondu');
    ok(css.indexOf('.focus-bg-bis') === -1, 'le style du second calque doit disparaître');
    ok(css.indexOf('background: #04140f') !== -1, 'le fond opaque de sécurité doit rester');

    if (echecs.length) {
        console.error('échecs ' + echecs.length);
        echecs.forEach(function (e) { console.error('- ' + e); });
        process.exit(1);
    }
    console.log('décor Pomodoro : changement direct, sans fondu ni trou, échecs 0');
})();
