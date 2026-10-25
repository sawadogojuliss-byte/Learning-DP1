/* Accessibilité commune aux écrans chargés par boot.js.
   Un seul canal vocal persistant ; les messages visuels restent en place. */
(function () {
    'use strict';
    var region = document.getElementById('annonceUnique');
    if (!region) return;
    var attente = 0, precedent = '';
    window.annoncer = function (texte, urgent) {
        texte = String(texte || '').trim();
        if (!texte) return;
        clearTimeout(attente);
        region.textContent = '';
        region.setAttribute('aria-live', urgent ? 'assertive' : 'polite');
        attente = setTimeout(function () { region.textContent = texte; precedent = texte; }, 40);
    };

    var derniereSource = new WeakMap();
    var ouvert = new WeakMap();
    var retourFocus = new WeakMap();
    var actif = null;
    var champs = 'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
    function visible(el) { return !!(el && el.isConnected && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden'); }
    function focusables(el) { return Array.from(el.querySelectorAll(champs)).filter(visible); }
    function sources(racine) {
        if (!racine || racine.nodeType !== 1 || racine === region) return;
        var candidats = [racine].concat(Array.from(racine.querySelectorAll('[aria-live],[role="status"],[role="alert"]')));
        candidats.forEach(function (el) {
            if (el === region || el.getAttribute('data-annonce-source') === 'oui') return;
            var ancienRole = el.getAttribute('role');
            if (!el.hasAttribute('aria-live') && ancienRole !== 'status' && ancienRole !== 'alert') return;
            el.setAttribute('data-annonce-source', 'oui');
            el.setAttribute('data-annonce-urgent', ancienRole === 'alert' ? 'oui' : 'non');
            el.removeAttribute('aria-live');
            if (ancienRole === 'status' || ancienRole === 'alert') el.removeAttribute('role');
        });
    }
    function lireSource(noeud) {
        var el = noeud.nodeType === 1 ? noeud : noeud.parentElement;
        var source = el && el.closest('[data-annonce-source="oui"]');
        if (!source || source === region || !visible(source)) return;
        var texte = (source.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 240);
        if (texte && texte !== derniereSource.get(source)) {
            derniereSource.set(source, texte);
            if (texte !== precedent) window.annoncer(texte, source.dataset.annonceUrgent === 'oui');
        }
    }
    function etiqueter(racine) {
        if (!racine || racine.nodeType !== 1) return;
        var list = [racine].concat(Array.from(racine.querySelectorAll('button,input,select,textarea,img')));
        list.forEach(function (el) {
            if (el.tagName === 'IMG') {
                if (!el.hasAttribute('alt')) el.setAttribute('alt', '');
                return;
            }
            if (el.tagName === 'BUTTON') {
                if (el.hasAttribute('aria-label') || el.hasAttribute('aria-labelledby')) return;
                var texte = (el.textContent || '').trim().replace(/\s+/g, ' ');
                var action = el.getAttribute('onclick') || '';
                if (action.indexOf('setExoDuration') !== -1) {
                    el.setAttribute('aria-label', 'Durée de l’exercice : ' + texte);
                    return;
                }
                if (!/^[+−✕←→‹›✨🎯🏃🏆]?$/.test(texte)) return;
                var libelle = '';
                if (action.indexOf('goToSlide') !== -1) libelle = 'Voir la diapositive ' + (Number(el.dataset.index) + 1);
                else if (action.indexOf('openSideMenu') !== -1) libelle = 'Ouvrir le menu';
                else if (action.indexOf("navigateTo('planning')") !== -1) libelle = 'Retour au planning';
                else if (action.indexOf('adjustSleepHours') !== -1) {
                    var jour = /'weekday'/.test(action) ? 'en semaine' : /'saturday'/.test(action) ? 'le samedi' : 'le dimanche';
                    libelle = (texte === '−' ? 'Réduire' : 'Augmenter') + ' la durée de sommeil ' + jour;
                } else if (action.indexOf('ajusterHabitude') !== -1) {
                    libelle = (texte === '−' ? 'Réduire' : 'Augmenter') + ' la durée du ' + (/petitDej/.test(action) ? 'petit-déjeuner' : 'dîner');
                } else if (action.indexOf('adjustScore') !== -1) libelle = (texte === '−' ? 'Réduire' : 'Augmenter') + ' l’objectif IB';
                else if (action.indexOf('adjustEditDuration') !== -1) libelle = (texte === '−' ? 'Réduire' : 'Augmenter') + ' la durée du créneau';
                else if (action.indexOf('prevSlide') !== -1) libelle = 'Diapositive précédente';
                else if (action.indexOf('nextSlide') !== -1) libelle = 'Diapositive suivante';
                else if (action.indexOf('closeSideMenu') !== -1) libelle = 'Fermer le menu';
                else if (action.indexOf('closeEditModal') !== -1) libelle = 'Fermer la modification';
                else if (action.indexOf('fermerCompte') !== -1) libelle = 'Fermer mon compte';
                else if (action.indexOf('basculerEmojisActivite') !== -1) libelle = 'Choisir une icône d’activité';
                if (libelle) el.setAttribute('aria-label', libelle);
                return;
            }
            if (el.type === 'hidden' || el.type === 'checkbox' || el.type === 'radio' || el.type === 'file') return;
            if (el.hasAttribute('aria-label') || el.hasAttribute('aria-labelledby') || (el.labels && el.labels.length)) return;
            var label = el.id && document.querySelector('label[for="' + CSS.escape(el.id) + '"]');
            if (!label && el.closest('label')) label = el.closest('label');
            if (label) return;
            var precedentLabel = el.previousElementSibling;
            if (precedentLabel && precedentLabel.tagName === 'LABEL' && !precedentLabel.htmlFor) {
                if (!el.id) el.id = 'champ-accessible-' + Math.random().toString(36).slice(2, 10);
                precedentLabel.htmlFor = el.id;
                return;
            }
            var nom = el.getAttribute('placeholder') || el.getAttribute('title');
            if (!nom) nom = ({ scoreValue: 'Objectif IB sur 45 points',
                carToSchoolInput: 'Trajet en voiture vers l’école en minutes',
                carFromSchoolInput: 'Trajet en voiture depuis l’école en minutes',
                motoToSchoolInput: 'Trajet en moto vers l’école en minutes',
                motoFromSchoolInput: 'Trajet en moto depuis l’école en minutes',
                exoDurationSlider: 'Durée de l’exercice en minutes' })[el.id];
            if (nom) el.setAttribute('aria-label', nom);
        });
    }
    function preparerModales(racine) {
        if (!racine || racine.nodeType !== 1) return;
        var list = [racine].concat(Array.from(racine.querySelectorAll('.context-modal,#compteModal,#addEventModal,#editEventModal,[role="dialog"]')));
        list.forEach(function (el) {
            if (!el.matches('.context-modal,#compteModal,#addEventModal,#editEventModal,[role="dialog"]')) return;
            if (el.matches('.context-modal,#compteModal,#addEventModal,#editEventModal')) {
                el.setAttribute('role', 'dialog');
                el.setAttribute('aria-modal', 'true');
                if (!el.hasAttribute('aria-labelledby')) {
                    var titre = el.querySelector('h1,h2,h3');
                    if (titre) {
                        if (!titre.id) titre.id = 'titre-dialogue-' + el.id;
                        el.setAttribute('aria-labelledby', titre.id);
                    } else el.setAttribute('aria-label', 'Fenêtre Study Plan IB');
                }
            }
            if (el.getAttribute('role') === 'dialog') el.setAttribute('aria-modal', 'true');
        });
    }
    function dialogVisible(el) {
        if (!visible(el)) return false;
        var parent = el.parentElement;
        while (parent && parent !== document.body) {
            if (getComputedStyle(parent).display === 'none' || getComputedStyle(parent).visibility === 'hidden') return false;
            parent = parent.parentElement;
        }
        return true;
    }
    function modaleActive() {
        var listes = Array.from(document.querySelectorAll('.context-modal,#compteModal,#addEventModal,#editEventModal,[role="dialog"]'));
        var trouve = listes.filter(dialogVisible);
        /* Les panneaux du menu passent devant le planning en plein écran.
           Ne piège pas le clavier dans ce planning resté ouvert derrière. */
        if (Array.from(document.querySelectorAll('.app-panel.active')).some(dialogVisible)) {
            trouve = trouve.filter(function (el) { return !el.classList.contains('context-modal'); });
        }
        if (!trouve.length) return null;
        /* Si un dialogue est dans un autre, le plus intérieur passe devant. */
        return trouve.filter(function (el) { return !trouve.some(function (autre) { return autre !== el && el.contains(autre); }); }).pop();
    }
    function synchroniserFocus() {
        var suivant = modaleActive();
        if (suivant === actif) return;
        var precedentModal = actif;
        if (precedentModal && !dialogVisible(precedentModal)) {
            var retour = retourFocus.get(precedentModal);
            if (retour && visible(retour) && (!suivant || suivant.contains(retour))) retour.focus();
        }
        actif = suivant;
        if (suivant && !ouvert.get(suivant)) {
            retourFocus.set(suivant, document.activeElement);
            ouvert.set(suivant, true);
        }
        if (suivant) {
            setTimeout(function () {
                if (modaleActive() !== suivant || suivant.contains(document.activeElement)) return;
                var cible = focusables(suivant)[0] || suivant;
                if (cible === suivant && !suivant.hasAttribute('tabindex')) suivant.tabIndex = -1;
                cible.focus();
            }, 0);
        }
        if (precedentModal && !dialogVisible(precedentModal)) ouvert.delete(precedentModal);
    }
    function fermer(modale) {
        if (!modale) return;
        var id = modale.id || (modale.closest('#compteModal') ? 'compteModal' : '');
        var fn = id === 'compteModal' ? 'fermerCompte' :
            id === 'addEventModal' ? 'closeAddModal' : id === 'editEventModal' ? 'closeEditModal' :
            id === 'planningModal' ? 'goBackFromPlanning' : id === 'emploiModal' ? 'goBackFromEmploi' :
            id === 'contextModal' ? 'closeContextModal' : '';
        if (fn && typeof window[fn] === 'function') { window[fn](); return; }
        var annuler = Array.from(modale.querySelectorAll('button')).find(function (b) {
            return visible(b) && (b.classList.contains('btn-back') || /^(annuler|fermer|← retour|retour à l.accueil)/i.test(b.textContent.trim()));
        });
        if (annuler) annuler.click();
    }
    document.addEventListener('keydown', function (e) {
        var modale = modaleActive();
        if (!modale) return;
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); fermer(modale); return; }
        if (e.key !== 'Tab') return;
        var list = focusables(modale);
        if (!list.length) { e.preventDefault(); modale.focus(); return; }
        var premier = list[0], dernier = list[list.length - 1];
        if (!modale.contains(document.activeElement) || (e.shiftKey && document.activeElement === premier)) {
            e.preventDefault(); (e.shiftKey ? dernier : premier).focus();
        } else if (!e.shiftKey && document.activeElement === dernier) { e.preventDefault(); premier.focus(); }
    }, true);
    document.addEventListener('focusin', function (e) {
        var modale = modaleActive();
        if (modale && !modale.contains(e.target)) {
            var cible = focusables(modale)[0] || modale;
            if (cible === modale && !modale.hasAttribute('tabindex')) modale.tabIndex = -1;
            cible.focus();
        }
    });
    function traiter(racine) { sources(racine); etiqueter(racine); preparerModales(racine); }
    traiter(document.getElementById('app-pages'));
    var observer = new MutationObserver(function (mutations) {
        var changer = false;
        mutations.forEach(function (m) {
            if (m.type === 'attributes') { if (m.attributeName === 'class' || m.attributeName === 'style' || m.attributeName === 'hidden') changer = true; return; }
            m.addedNodes.forEach(function (noeud) { if (noeud.nodeType === 1) { traiter(noeud); lireSource(noeud); changer = true; } });
            if (m.target !== region && !region.contains(m.target)) lireSource(m.target);
        });
        if (changer) synchroniserFocus();
    });
    observer.observe(document.getElementById('app-pages'), { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class','style','hidden'] });
    /* Certains dialogues et messages sont créés directement sous body. */
    observer.observe(document.body, { childList: true });
})();
