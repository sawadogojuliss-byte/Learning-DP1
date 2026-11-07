/* Présentation uniquement : les créneaux, leurs identifiants et leur sauvegarde
   restent calculés par le moteur public. */
function exoCarteParties(parties) {
    return '<span class="ed-slot-parts">' + parties.map(function (part, i) {
        return '<span class="ed-slot-part"><span class="ed-slot-number">' + (i + 1) + '</span>' +
            '<span class="ed-slot-part-info"><strong>' + exoEscape(part.dateStr) + '</strong>' +
            '<span>' + exoEscape(part.startTime) + ' <span aria-hidden="true">–</span> ' + exoEscape(part.endTime) + '</span></span></span>';
    }).join('') + '</span>';
}

function exoCarteProposition(slot, index, id, numero) {
    const nombre = slot.parts.length;
    const temps = slot.parts.reduce((s, p) => s + (Number(p.duration) || 0), 0);
    const attrs = ' data-exo-action="creneau" data-exo-id="' + exoEscape(id) +
        '" data-exo-slot="' + index + '" data-exo-date="' + exoEscape(slot.dateKey) +
        '" data-exo-time="' + exoEscape(slot.startTime) + '"';
    const periode = nombre > 1 ? '<small class="ed-slot-range">Du ' + exoEscape(slot.parts[0].dateStr) + ' au ' + exoEscape(slot.parts[nombre - 1].dateStr) + '</small>' : '';
    const titre = '<span><strong>Proposition ' + numero + '</strong><small>' + nombre + ' ' +
        (nombre > 1 ? 'séances' : 'séance') + ' · ' + temps + ' min au total</small>' + periode + '</span>';
    if (nombre > 1) {
        return '<details class="ed-slot-details"><summary class="ed-slot-option-head">' + titre +
            '<span class="ed-slot-expand"><span class="ed-expand-closed">Voir les séances</span><span class="ed-expand-short">Détails</span><span class="ed-expand-open">Masquer</span> <span class="ed-expand-arrow" aria-hidden="true">⌄</span></span></summary>' +
            '<div class="ed-slot-details-body">' + exoCarteParties(slot.parts) +
            '<button type="button"' + attrs + ' class="ed-slot-confirm">Choisir ce créneau <span aria-hidden="true">→</span></button></div></details>';
    }
    return '<button type="button"' + attrs + ' class="slot-chip ed-slot-option">' +
        '<span class="ed-slot-option-head">' + titre + '<span class="ed-slot-choose">Choisir <span aria-hidden="true">↗</span></span></span>' +
        exoCarteParties(slot.parts) + '</button>';
}

/* Les exercices déjà enregistrés contiennent un libellé, pas les objets parts.
   On le lit sans modifier les données ; si son format est inconnu on l'affiche
   intégralement, échappé, plutôt que de perdre une information. */
function exoCartePlanifiee(libelle) {
    const brut = String(libelle || '');
    let parties = [];
    let minutes = '';
    const multi = /\s*\((\d+)\/(\d+) min\)$/.exec(brut);
    if (multi) {
        const elements = brut.slice(0, multi.index).split(' · ');
        const lus = elements.map(function (texte) {
            const m = /^P\d+\s+(.+?)\s+(\d{2}:\d{2})[–-](\d{2}:\d{2})$/.exec(texte);
            return m ? {dateStr:m[1], startTime:m[2], endTime:m[3]} : null;
        });
        if (lus.every(Boolean)) { parties = lus; minutes = multi[1] === multi[2] ? multi[2] + ' min au total' : multi[1] + '/' + multi[2] + ' min'; }
    } else {
        const simple = /^(.+?) · (\d{2}:\d{2})\s*[–-]\s*(\d{2}:\d{2})\s*\((\d+) min\)$/.exec(brut);
        if (simple) { parties = [{dateStr:simple[1], startTime:simple[2], endTime:simple[3]}]; minutes = simple[4] + ' min'; }
    }
    const detail = parties.length ? parties.length + ' ' + (parties.length > 1 ? 'séances' : 'séance') + ' · ' + minutes : 'Détails de ton créneau';
    return '<div class="ed-scheduled"><div class="ed-scheduled-head"><span class="ed-scheduled-check" aria-hidden="true">✓</span>' +
        '<span><strong>Exercice planifié</strong><small>' + exoEscape(detail) + '</small></span></div>' +
        (parties.length ? exoCarteParties(parties) : '<p class="ed-slot-fallback">' + exoEscape(brut) + '</p>') + '</div>';
}
