/* ============================================================
   Export de l'emploi du temps
   Fichier de toute la semaine, même rendu que le site.
   ============================================================ */

function exportEchap(str) {
    if (typeof v3Escape === 'function') return v3Escape(str);
    return String(str == null ? '' : str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function exportDuree(event) {
    var durMins = timeToMinutes(event.endTime) - timeToMinutes(event.startTime);
    if (durMins <= 0) return '';
    var durH = Math.floor(durMins / 60);
    var durM = durMins % 60;
    return (durH > 0 ? durH + 'h' : '') + (durM > 0 ? durM + 'min' : '');
}

function exportCarte(event) {
    var borderColorMap = { indigo: '#818cf8', blue: '#60a5fa', orange: '#fb923c', red: '#ef4444', amber: '#f59e0b', purple: '#a78bfa', cyan: '#22d3ee', gray: '#9ca3af', pink: '#f472b6', green: '#4ade80', yellow: '#facc15', teal: '#2dd4bf', rose: '#fb7185', violet: '#a78bfa' };
    var bgColorMap = { indigo: '#eef2ff', blue: '#eff6ff', orange: '#fff7ed', red: '#fef2f2', amber: '#fffbeb', purple: '#faf5ff', cyan: '#ecfeff', gray: '#f9fafb', pink: '#fdf2f8', green: '#f0fdf4', yellow: '#fefce8', teal: '#f0fdfa', rose: '#fff1f2', violet: '#f5f3ff' };
    var colorClass = getEventColor(event.type);
    var parts = colorClass.split(' ');
    var borderStyle = parts[0].replace('border-', '').replace('-400', '').replace('-500', '');
    var bgStyle = parts[1].replace('bg-', '').replace('-50', '');
    var bColor = borderColorMap[borderStyle] || '#9ca3af';
    var bBg = bgColorMap[bgStyle] || '#f9fafb';
    var durMins = timeToMinutes(event.endTime) - timeToMinutes(event.startTime);
    var durLabel = exportDuree(event);
    var subtitle = event.subtitle || '';
    if (typeof v3IsStudyType === 'function' && v3IsStudyType(event.type) && durMins > 0 && typeof v3PomodoroLabel === 'function') {
        subtitle = (subtitle ? subtitle + ' · ' : '') + v3PomodoroLabel(durMins);
    }
    var pinBadge = event.kind === 'pinned' ? '<span style="font-size:0.7rem;margin-right:0.2rem;">📌</span>' : '';
    return '<div style="display:flex;align-items:center;gap:0.875rem;padding:0.875rem 1rem;background:' + bBg + ';border-radius:0.875rem;border-left:4px solid ' + bColor + ';box-shadow:0 1px 4px rgba(0,0,0,0.08);margin-bottom:0.5rem;">'
        + '<div style="width:2.75rem;height:2.75rem;background:white;border-radius:0.75rem;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 1px 3px rgba(0,0,0,0.08);border:1.5px solid #f3f4f6;"><span style="font-size:1.375rem;">' + exportEchap(event.icon || '') + '</span></div>'
        + '<div style="flex:1;min-width:0;">'
        + '<h3 style="font-weight:700;color:#111827;font-size:0.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin:0;">' + exportEchap(event.title) + '</h3>'
        + (subtitle ? '<p style="font-size:0.75rem;color:#6b7280;margin:0.1rem 0 0;">' + exportEchap(subtitle) + '</p>' : '')
        + '</div>'
        + '<div style="text-align:right;flex-shrink:0;">'
        + '<p style="font-size:0.85rem;font-weight:700;color:#374151;margin:0;">' + pinBadge + exportEchap(event.startTime) + '</p>'
        + '<p style="font-size:0.7rem;color:#9ca3af;margin:0;">→ ' + exportEchap(event.endTime) + '</p>'
        + (durLabel ? '<p style="font-size:0.68rem;color:' + bColor + ';font-weight:600;margin:0.1rem 0 0;">' + durLabel + '</p>' : '')
        + '</div>'
        + '<div style="width:1.15rem;flex-shrink:0;margin-left:0.25rem;visibility:hidden;"><span style="font-size:0.8rem;">✏️</span></div>'
        + '</div>';
}

function exportChaine(event, bColor) {
    if (event.id === 'sleep') return '';
    return '<div style="display:flex;align-items:center;gap:0.5rem;padding:0 1rem;margin:-0.25rem 0;"><div style="width:3rem;flex-shrink:0;"></div><div style="width:2px;height:0.625rem;background:linear-gradient(to bottom,' + bColor + ',#e5e7eb);margin-left:1.375rem;opacity:0.5;border-radius:1px;"></div></div>';
}

function exportJour(index, jour) {
    var noms = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
    var mois = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
    var date = new Date(jour.date);
    var puce = jour.isToday
        ? 'background:#10b981;color:white;box-shadow:0 10px 15px -3px rgba(0,0,0,0.1);'
        : 'background:#f3f4f6;color:#4b5563;';
    var html = '<section style="margin:0 0 1.75rem;">'
        + '<div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.85rem;">'
        + '<div style="display:flex;flex-direction:column;align-items:center;padding:0.5rem 0.75rem;border-radius:0.75rem;min-width:3.5rem;' + puce + '"><span style="font-size:0.75rem;font-weight:500;">' + exportEchap(jour.dayName) + '</span><span style="font-size:1.125rem;font-weight:700;">' + jour.dayNumber + '</span></div>'
        + '<div><h2 style="margin:0;font-size:1.15rem;color:#111827;">' + noms[index] + '</h2><p style="margin:0.1rem 0 0;color:#6b7280;font-size:0.8rem;">' + date.getDate() + ' ' + mois[date.getMonth()] + '</p></div>'
        + '</div>';

    if (typeof holidayMode === 'function' && holidayMode(index) === 'free') {
        html += (typeof v3LibreVertical === 'function') ? v3LibreVertical() : '<p style="color:#be123c;font-family:Georgia,serif;font-size:2rem;">libre</p>';
        return html + '</section>';
    }
    if (typeof holidayMode === 'function' && holidayMode(index) === 'keep') {
        html += '<div style="margin-bottom:0.75rem;padding:0.75rem 1rem;border-radius:0.85rem;background:#ecfdf5;border:1px solid #a7f3d0;color:#065f46;font-size:0.85rem;font-weight:600;">🎉 Jour férié — emploi du temps conservé</div>';
    } else if (typeof holidayMode === 'function' && holidayMode(index) === 'light') {
        html += '<div style="margin-bottom:0.75rem;padding:0.75rem 1rem;border-radius:0.85rem;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;font-size:0.85rem;font-weight:600;">🎉 Jour férié — activités désélectionnées retirées</div>';
    }

    var events = generateDayEvents(index);
    var borderColorMap = { indigo: '#818cf8', blue: '#60a5fa', orange: '#fb923c', red: '#ef4444', amber: '#f59e0b', purple: '#a78bfa', cyan: '#22d3ee', gray: '#9ca3af', pink: '#f472b6', green: '#4ade80', yellow: '#facc15', teal: '#2dd4bf', rose: '#fb7185', violet: '#a78bfa' };
    events.forEach(function (event, idx) {
        html += exportCarte(event);
        if (idx !== events.length - 1) {
            var colorClass = getEventColor(event.type).split(' ')[0].replace('border-', '').replace('-400', '').replace('-500', '');
            html += exportChaine(event, borderColorMap[colorClass] || '#9ca3af');
        }
    });
    return html + '</section>';
}

function exportDatesSemaine() {
    var today = new Date();
    var monday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    monday.setDate(monday.getDate() - today.getDay() + 1);
    return Array.from({ length: 7 }, function (_, i) {
        var date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
        return {
            dayName: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'][i],
            dayNumber: date.getDate(),
            isToday: date.toDateString() === today.toDateString(),
            date: date
        };
    });
}

function construireEmploiSemaine() {
    var jours = exportDatesSemaine();
    var mois = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
    var debut = jours[0].date;
    var fin = jours[6].date;
    var plage = debut.getDate() + ' ' + mois[debut.getMonth()] + ' – ' + fin.getDate() + ' ' + mois[fin.getMonth()] + ' ' + fin.getFullYear();
    var classe = (typeof ibYear !== 'undefined' && (ibYear === 'DP1' || ibYear === 'DP2')) ? ibYear : 'IB';
    var nom = (typeof userName !== 'undefined' && userName) ? userName : '';
    var sousTitre = [nom, classe, (typeof targetScore !== 'undefined' ? 'objectif ' + targetScore : '')].filter(Boolean).join(' · ');
    var corps = jours.map(function (jour, index) { return exportJour(index, jour); }).join('');
    var legend = document.getElementById('planningLegend');
    var stats = document.getElementById('planningStats');
    return '<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
        + '<title>Emploi du temps — semaine</title>'
        + '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&amp;display=swap" rel="stylesheet">'
        + '<style>body{margin:0;font-family:Inter,ui-sans-serif,system-ui,sans-serif;background:linear-gradient(to bottom right,#ecfdf5,white,#f0fdfa);color:#111827;} @media print { body{background:white;} .no-print{display:none;} section{break-inside:avoid;} }</style>'
        + '</head><body>'
        + '<header style="position:sticky;top:0;z-index:2;background:rgba(255,255,255,0.95);backdrop-filter:blur(8px);box-shadow:0 1px 3px rgba(0,0,0,0.1);border-bottom:1px solid #f3f4f6;">'
        + '<div style="max-width:56rem;margin:0 auto;padding:0.85rem 1rem;display:flex;align-items:center;gap:0.75rem;">'
        + '<div style="width:2.5rem;height:2.5rem;background:linear-gradient(to bottom right,#10b981,#14b8a6);border-radius:0.75rem;display:flex;align-items:center;justify-content:center;box-shadow:0 10px 15px -3px rgba(0,0,0,0.1);"><span style="font-size:1.25rem;">📚</span></div>'
        + '<div><div style="font-size:1.125rem;font-weight:700;background:linear-gradient(to right,#059669,#0d9488);-webkit-background-clip:text;background-clip:text;color:transparent;">Study Plan IB</div>'
        + '<p style="margin:0.1rem 0 0;font-size:0.875rem;color:#6b7280;">Emploi du temps de la semaine · ' + exportEchap(plage) + '</p>'
        + (sousTitre ? '<p style="margin:0.1rem 0 0;font-size:0.8rem;color:#047857;font-weight:600;">' + exportEchap(sousTitre) + '</p>' : '')
        + '</div></div></header>'
        + '<main style="max-width:56rem;margin:0 auto;padding:1.5rem 1rem 2.5rem;">' + corps
        + (stats ? stats.outerHTML : '')
        + (legend ? legend.outerHTML : '')
        + '</main></body></html>';
}

function telechargerEmploiDuTemps() {
    try {
        var html = construireEmploiSemaine();
        var blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        var lien = document.createElement('a');
        lien.href = URL.createObjectURL(blob);
        lien.download = 'emploi-du-temps-semaine.html';
        document.body.appendChild(lien);
        lien.click();
        lien.remove();
        setTimeout(function () { URL.revokeObjectURL(lien.href); }, 1500);
        if (typeof v3Toast === 'function') v3Toast('Emploi du temps de la semaine téléchargé.', 'success');
    } catch (e) {
        console.error(e);
        if (typeof v3Toast === 'function') v3Toast('Le téléchargement n’a pas pu être préparé.', 'info');
    }
}
