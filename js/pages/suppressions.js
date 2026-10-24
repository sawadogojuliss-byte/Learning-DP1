/* Suppressions annulables et confirmations non bloquantes, communes aux pages. */
function suppressionAvecAnnulation(options) {
    if (!options || typeof options.retirer !== 'function' || typeof options.restaurer !== 'function') return;
    options.retirer();
    if (typeof options.actualiser === 'function') options.actualiser();
    var toast = document.createElement('div');
    toast.className = 'suppression-toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    var decalage = Array.from(document.querySelectorAll('.suppression-toast')).reduce(function (max, el) {
        return Math.max(max, parseFloat(el.style.bottom) || 0);
    }, 0);
    toast.style.cssText = 'position:fixed;bottom:' + (decalage ? decalage + 5 : 1) + 'rem;left:50%;transform:translateX(-50%);max-width:min(30rem,calc(100vw - 2rem));box-sizing:border-box;z-index:500;background:#134e4a;color:#fff;padding:0.85rem 1rem;border-radius:0.85rem;box-shadow:0 8px 24px #0004;display:flex;align-items:center;gap:0.8rem;flex-wrap:wrap;font-size:0.85rem;';
    var texte = document.createElement('span');
    texte.textContent = options.message || 'Élément supprimé.';
    toast.appendChild(texte);
    var actif = true;
    var timer;
    function fermer() {
        if (!actif) return false;
        actif = false;
        clearTimeout(timer);
        toast.remove();
        return true;
    }
    function bouton(libelle, action) {
        var b = document.createElement('button');
        b.type = 'button';
        b.textContent = libelle;
        b.style.cssText = 'border:1px solid #fff;background:transparent;color:#fff;border-radius:0.5rem;padding:0.35rem 0.55rem;font:inherit;font-weight:800;cursor:pointer;';
        b.onclick = function () { if (actif) action(); };
        toast.appendChild(b);
        return b;
    }
    bouton('Annuler', function () {
        if (!fermer()) return;
        options.restaurer();
        if (typeof options.actualiser === 'function') options.actualiser();
    });
    if (typeof options.deplacer === 'function') {
        var deplacement = bouton('Déplacer les révisions', function () {
            options.deplacer();
            if (typeof options.actualiser === 'function') options.actualiser();
            texte.textContent = 'Révisions déplacées — tu peux encore annuler.';
            deplacement.remove();
        });
    }
    document.body.appendChild(toast);
    timer = setTimeout(fermer, 8000);
    return { annuler: function () {
        if (!fermer()) return;
        options.restaurer();
        if (typeof options.actualiser === 'function') options.actualiser();
    } };
}

function confirmerAction(options) {
    if (!options || typeof options.confirmer !== 'function') return;
    var ancien = document.getElementById('confirmationAction');
    if (ancien) ancien.remove();
    var precedent = document.activeElement;
    var voile = document.createElement('div');
    voile.id = 'confirmationAction';
    voile.setAttribute('role', 'dialog');
    voile.setAttribute('aria-modal', 'true');
    voile.setAttribute('aria-labelledby', 'confirmationActionTitre');
    voile.style.cssText = 'position:fixed;inset:0;z-index:510;background:#11182799;display:flex;align-items:center;justify-content:center;padding:1rem;';
    var boite = document.createElement('div');
    boite.style.cssText = 'background:#fff;color:#1f2937;border-radius:1rem;padding:1.25rem;max-width:26rem;width:100%;box-sizing:border-box;box-shadow:0 20px 50px #0004;font:inherit;';
    var titre = document.createElement('h3');
    titre.id = 'confirmationActionTitre';
    titre.textContent = options.titre || 'Confirmer cette action ?';
    titre.style.cssText = 'margin:0 0 0.65rem;font-size:1.05rem;';
    boite.appendChild(titre);
    var detail = document.createElement('p');
    detail.textContent = options.detail || '';
    detail.style.cssText = 'font-size:0.85rem;line-height:1.5;margin:0 0 1rem;';
    boite.appendChild(detail);
    var actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:0.5rem;flex-wrap:wrap;';
    function fermer() {
        voile.remove();
        if (precedent && typeof precedent.focus === 'function') precedent.focus();
    }
    function ajouter(libelle, action, danger) {
        var b = document.createElement('button');
        b.type = 'button';
        b.textContent = libelle;
        b.style.cssText = 'padding:0.65rem 0.85rem;border-radius:0.65rem;border:1px solid #d1d5db;background:' + (danger ? '#b91c1c;color:white;' : '#fff;color:#374151;') + 'font:inherit;font-weight:700;cursor:pointer;';
        b.onclick = action;
        actions.appendChild(b);
        return b;
    }
    var annuler = ajouter('Annuler', fermer, false);
    if (typeof options.exporter === 'function') ajouter('Télécharger mes données', options.exporter, false);
    ajouter(options.action || 'Confirmer', function () { fermer(); options.confirmer(); }, true);
    boite.appendChild(actions);
    voile.appendChild(boite);
    voile.onclick = function (event) { if (event.target === voile) fermer(); };
    voile.onkeydown = function (event) {
        if (event.key === 'Escape') fermer();
        if (event.key === 'Tab') {
            var boutons = actions.querySelectorAll('button');
            if (event.shiftKey && document.activeElement === boutons[0]) { event.preventDefault(); boutons[boutons.length - 1].focus(); }
            else if (!event.shiftKey && document.activeElement === boutons[boutons.length - 1]) { event.preventDefault(); boutons[0].focus(); }
        }
    };
    document.body.appendChild(voile);
    annuler.focus();
}
