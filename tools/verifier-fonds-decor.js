/* Vérifie le changement de décor Pomodoro : l'image n'est posée qu'une fois
   décodée, le décor précédent reste opaque, et les images sont préparées en
   avance pour que le clic soit instantané. */
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var code = fs.readFileSync(path.join(__dirname, '..', 'js/pages/pomodoro-page.js'), 'utf8');
var echecs = [];

function ok(cond, message) {
    if (!cond) echecs.push(message);
}

function creerElement(id) {
    return {
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
}

function creerContexte(typeReseau) {
    var elements = {};
    var timers = [];
    var compteur = 0;
    var chargees = [];
    var enAttente = [];

    function element(id) {
        if (!elements[id]) elements[id] = creerElement(id);
        return elements[id];
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
        title: 'Study Plan IB',
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

    function liberer(avecMinuteurs) {
        return new Promise(function (resoudre) {
            var tours = 0;
            (function suivant() {
                tours += 1;
                var fait = false;
                if (avecMinuteurs) {
                    while (timers.length) {
                        timers.shift().fn();
                        fait = true;
                    }
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
        drainer: function () { return liberer(true); },
        /* l'image arrive, mais les minuteries (fin du fondu) n'ont pas encore tourné */
        drainerImages: function () { return liberer(false); },
        imagesEnAttente: function () { return enAttente.length; },
        imagesChargees: function () { return chargees.length; }
    };
}

(async function () {
    /* ── 1. Réseau lent : rien n'est préchargé, le clic est observé en direct ── */
    var lent = creerContexte('2g');
    var contexte = lent.contexte;
    var base = lent.element('focusBg');
    var bis = lent.element('focusBgBis');

    contexte.focusCharger();
    await lent.drainer();
    ok(lent.vignettes().length === 23, 'les 23 vignettes doivent être créées');
    ok(lent.imagesEnAttente() === 0, 'en 2G aucune image ne doit être préchargée d avance');
    ok(String(lent.vignettes()[0].style.backgroundImage).indexOf('mini/lumiere.webp') !== -1,
        'les vignettes doivent utiliser les petites images');
    ok(contexte.focusFondActif === contexte.FOCUS_FONDS[0].src, 'le décor doit s ouvrir sur la lumière');

    /* Le calque affiché est celui dont l'opacité n'est pas mise à zéro : il doit
       le rester jusqu'à ce que la nouvelle image soit décodée. */
    function coucheAffichee() {
        if (base.style.opacity === '0') return bis;
        if (bis.style.opacity === '0') return base;
        if (bis.style.opacity === '1') return bis;
        return base;
    }

    var affichee = coucheAffichee();
    var cachee = affichee === base ? bis : base;

    contexte.focusPoserFond(5);
    ok(coucheAffichee() === affichee, 'le décor affiché doit rester opaque pendant le chargement');
    ok(String(cachee.style.backgroundImage).indexOf('chalet') === -1,
        'la nouvelle image ne doit pas être posée avant d être décodée');
    ok(lent.vignettes()[5].classList.contains('is-chargement'),
        'la vignette cliquée doit indiquer le chargement');
    ok(lent.vignettes()[5].getAttribute('aria-busy') === 'true', 'la vignette doit être marquée occupée');

    /* pendant le fondu : le nouveau décor par-dessus, l'ancien toujours opaque */
    await lent.drainerImages();
    ok(String(cachee.style.backgroundImage).indexOf('chalet.webp') !== -1,
        'la nouvelle image doit finir sur le calque libre');
    ok(String(cachee.style.zIndex) === '1', 'le nouveau calque doit passer au-dessus');
    ok(cachee.style.opacity === '1' && affichee.style.opacity === '1',
        'pendant le fondu les deux décors doivent rester opaques');

    await lent.drainer();
    ok(cachee.style.opacity === '1' && affichee.style.opacity === '0',
        'les deux calques doivent se croiser en fondu');
    ok(cachee.style.zIndex === '0', 'le décor doit repasser sous le voile après le fondu');
    ok(!lent.vignettes()[5].classList.contains('is-chargement'),
        'l indicateur de chargement doit disparaître');
    ok(contexte.focusFondActif === contexte.FOCUS_FONDS[5].src, 'le décor actif doit être le chalet');

    var premiere = cachee;
    var seconde = affichee;
    contexte.focusPoserFond(17);
    ok(coucheAffichee() === premiere, 'le second changement garde aussi le décor en place');
    await lent.drainer();
    ok(String(seconde.style.backgroundImage).indexOf('sentier.webp') !== -1,
        'les deux calques doivent alterner');
    ok(seconde.style.opacity === '1' && premiere.style.opacity === '0',
        'le retour doit aussi se croiser en fondu');
    ok(String(lent.element('focusAccueilFond').style.backgroundImage).indexOf('sentier.webp') !== -1,
        'le fond de l accueil doit être posé une fois prêt');

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
    ok(Object.keys(rapide.contexte.focusFondsPrets).length === 23, 'les 23 fonds doivent être prêts');

    rapide.contexte.focusPoserFond(9);
    ok(rapide.element('focusBgBis').style.opacity === '1' ||
        rapide.element('focusBg').style.opacity === '1',
        'une image déjà prête doit s afficher tout de suite');
    ok(!rapide.vignettes()[9].classList.contains('is-chargement'),
        'aucun chargement à signaler quand l image est prête');

    /* ── 3. L'ancien système ne doit plus exister ── */
    ok(code.indexOf("opacity = '0.25'") === -1, 'l ancien effacement du décor doit avoir disparu');
    ok(code.indexOf('setTimeout(appliquer, 160)') === -1, 'l ancien délai de 160 ms doit avoir disparu');
    ok(code.split('function focusPoserFond').length === 2, 'une seule définition de focusPoserFond');
    ok(code.split('function focusPreparerFonds').length === 2, 'une seule définition de focusPreparerFonds');

    if (echecs.length) {
        console.error('échecs ' + echecs.length);
        echecs.forEach(function (e) { console.error('- ' + e); });
        process.exit(1);
    }
    console.log('décor Pomodoro : aucun trou, images préparées, échecs 0');
})();
