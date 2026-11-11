/* ============================================================
   PAGE Planning — interface
   Affichage, modification fiable, suppression avec annulation, signalement des doublons.
   Vue : pages/planning.html
   ============================================================ */

// ═══════════════════════════════════════════════════════════════════
//  AFFICHAGE DU PLANNING (surcharge de renderPlanning)
//  — identique visuellement, sans aucune marque de minuteur,
//    📌 sur les créneaux fixés, ouverture de l'édition par index
// ═══════════════════════════════════════════════════════════════════
/* L'icône des activités change à chaque semaine : le coureur, la fléchette,
   puis le trophée, et on recommence. La semaine commence le lundi, pour tout
   le monde en même temps. */
var v3LastRendered = [];
var V3_ICONES_ACTIVITES = ['🏃', '🎯', '🏆'];

/* La nuit est une limite absolue, pas un créneau remplaçable. Les anciennes
   données sont conservées ; un bloc hors limite est signalé, pas déplacé. */
function v3BornesSommeil(day) {
    var reveil = typeof planningReveilDuJour === 'function' ? planningReveilDuJour(day) : (day === 5 ? saturdayWakeup : day === 6 ? sundayWakeup : weekdayWakeup);
    var coucher = day === 5 && typeof devoirsFaitBac === 'function' && devoirsFaitBac()
        ? calculateBedtime(reveil, saturdaySleepHours) : bedtimeForDay(day);
    return { reveil: timeToMinutes(reveil), coucher: timeToMinutes(coucher), reveilTexte: reveil, coucherTexte: coucher };
}
function v3DureeHoraire(debut, fin) {
    var duree = timeToMinutes(fin) - timeToMinutes(debut);
    return duree < 0 ? duree + 1440 : duree;
}
function syncEditDurationFromTimes() {
    var s = document.getElementById('editEventStart').value, e = document.getElementById('editEventEnd').value;
    if (!s || !e) return;
    var duree = v3DureeHoraire(s, e);
    if (duree > 0) { editCurrentDuration = duree; updateEditDurationDisplay(); }
}
function v3SommeilInterdit(debut, fin, day) {
    var b = v3BornesSommeil(day), s = typeof debut === 'number' ? debut : timeToMinutes(debut), e = typeof fin === 'number' ? fin : timeToMinutes(fin);
    if (!isFinite(s) || !isFinite(e) || !isFinite(b.reveil) || !isFinite(b.coucher)) return true;
    if (e <= s) e += 1440;
    if (e - s >= 1440) return true;
    var lit = b.coucher, r = b.reveil;
    var nuits = lit < r ? [[lit, r]] : [[lit, 1440], [0, r]];
    return nuits.some(function (n) { return [0, 1440].some(function (offset) { return s < n[1] + offset && n[0] + offset < e; }); });
}
var v3ValidationAvantSommeil = validateNewEventTime;
validateNewEventTime = function (debut, fin, day) {
    if (v3SommeilInterdit(debut, fin, day)) return {valid:false, error:'Ce créneau tombe pendant le sommeil. Choisis un horaire entre le réveil et le coucher.'};
    var s = timeToMinutes(debut), e = timeToMinutes(fin);
    if (e < s) {
        if (day < 5 && s < COURS_FIN && COURS_DEBUT < 1440) return {valid:false,error:'Ce créneau traverse les heures de cours.'};
        return {valid:true, error:''};
    }
    return v3ValidationAvantSommeil(debut, fin, day);
};
// Ne jamais décaler silencieusement les anciens horaires lors du calcul.
planningRegleReveil = function (evenements) { return evenements || []; };
// Certains blocs automatiques partagent leur identifiant (plusieurs temps
// libres). Une exception précise cible aussi les horaires d'origine, sans
// renommer ni déplacer les autres occurrences portant le même identifiant.
var v3AppliquerDateOriginal = planningAppliquerDate;
planningAppliquerDate = function (events, jour, date) {
    var tous = customEvents, cible = date instanceof Date ? date : getWeekDates(new Date())[jour].date;
    var cle = planningCleDate(cible), precis = tous.filter(function (e) { return e && e.date === cle && e.day === jour && e.cibleDebut && e.cibleFin && e.replacesId; });
    if (!precis.length) return v3AppliquerDateOriginal(events, jour, date);
    var resultat;
    try { customEvents = tous.filter(function (e) { return !e || !e.cibleDebut || !e.cibleFin; }); resultat = v3AppliquerDateOriginal(events, jour, date); }
    finally { customEvents = tous; }
    var reset = tous.reduce(function (m,e) { return e && e.day === jour && e.date === cle && e.resetDate ? Math.max(m,Number(e.timestamp)||0) : m; },0);
    precis = precis.filter(function (e) { return !reset || Number(e.timestamp) > reset; }).sort(function (a,b) { return (Number(a.timestamp)||0)-(Number(b.timestamp)||0); });
    return resultat.map(function (ev) {
        var modification = precis.filter(function (e) { return e.replacesId === ev.id && e.cibleDebut === ev.startTime && e.cibleFin === ev.endTime; }).slice(-1)[0];
        if (!modification) return ev;
        if (modification.deleted) return null;
        return Object.assign({},ev,{title:modification.title,startTime:modification.startTime,endTime:modification.endTime,
            icon:modification.icon || ev.icon,kind:modification.pinned ? 'pinned' : ev.kind,
            _v3CibleDebut:modification.cibleDebut,_v3CibleFin:modification.cibleFin});
    }).filter(Boolean);
};
var v3GenererJourOriginal = generateDayEvents;
var v3SommeilHorsPlanning = [];
generateDayEvents = function (day, date) {
    var events = v3GenererJourOriginal(day, date) || [], b = v3BornesSommeil(day);
    var reveil = events.find(function (e) { return e && (e.id === 'wakeup' || e.type === 'wakeup'); });
    var coucher = events.find(function (e) { return e && (e.id === 'sleep' || e.type === 'sleep'); });
    if (!reveil) reveil = {id:'wakeup',title:'Réveil',startTime:b.reveilTexte,endTime:addMinutes(b.reveilTexte,10),type:'wakeup',icon:'🌅',editable:false,kind:'fixed'};
    if (!coucher) coucher = {id:'sleep',title:'Coucher',startTime:b.coucherTexte,endTime:b.reveilTexte,type:'sleep',icon:'😴',editable:false,kind:'fixed'};
    var hors = [], milieu = events.filter(function (e) {
        if (!e || e.id === reveil.id || e.id === coucher.id || e.type === 'wakeup' || e.type === 'sleep') return false;
        if (!e.startTime || !e.endTime || v3SommeilInterdit(e.startTime, e.endTime, day)) { hors.push(e); return false; }
        return true;
    });
    milieu.sort(function (a, c) {
        function ordre(e) { var m = timeToMinutes(e.startTime); return m < b.reveil ? m + 1440 : m; }
        return ordre(a) - ordre(c);
    });
    v3SommeilHorsPlanning = hors;
    return [reveil].concat(milieu, [coucher]);
};

function v3PorteeEvenement(e, day) {
    var date = planningDateEdition(day);
    return !!(e && e.day === day && (date ? e.date === date : !e.date));
}
function v3RecordDate(record, day) {
    var date = planningDateEdition(day);
    if (date) {
        record.date = date;
        var dernier = customEvents.reduce(function (max, e) {
            return e && e.date === date && e.day === day ? Math.max(max, Number(e.timestamp) || 0) : max;
        }, 0);
        record.timestamp = Math.max(Number(record.timestamp) || 0, dernier + 1);
    }
    return record;
}
function v3EvenementsJour(day) {
    return planningDecalageSemaine === 0 ? generateDayEvents(day) : generateDayEvents(day, planningDateSelectionnee(day));
}

function v3IconeActivitesSemaine() {
    var maintenant = new Date();
    var lundi = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate());
    lundi.setDate(lundi.getDate() - ((lundi.getDay() + 6) % 7));
    lundi.setDate(lundi.getDate() + 7 * planningDecalageSemaine);
    /* Semaine de référence : celle du 12 octobre 2026, pour que cette semaine
       affiche le coureur, puis la fléchette, puis le trophée. */
    var reference = new Date(2026, 9, 12);
    var semaines = Math.round((lundi.getTime() - reference.getTime()) / 604800000);
    var rang = ((semaines % V3_ICONES_ACTIVITES.length) + V3_ICONES_ACTIVITES.length) % V3_ICONES_ACTIVITES.length;
    return V3_ICONES_ACTIVITES[rang];
}

function v3PeindreIconeActivites() {
    var el = document.getElementById('statActivitiesIcone');
    if (el) el.textContent = v3IconeActivitesSemaine();
}

function planningMinuteurEntete() {
    var bouton = document.getElementById('planningMinuteurEntete');
    if (!bouton) return;
    var actif = typeof focusEtat !== 'undefined' && focusEtat.running;
    bouton.hidden = !actif;
    if (actif) bouton.textContent = '● ' + (typeof focusTexte === 'function' ? focusTexte(Math.max(0, Math.round((focusEtat.fin - Date.now()) / 1000))) : '') + ' · Minuteur';
}

function planningEnteteSemaine(weekDates) {
    var premier = weekDates[0].date, dernier = weekDates[6].date, affiche = weekDates[selectedDay].date;
    var court = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
    var titre = document.getElementById('planningSemaineType');
    var etendue = document.getElementById('planningSemaineDates');
    var jour = document.getElementById('planningJourDate');
    var retour = document.getElementById('planningAujourdhui');
    if (titre) titre.textContent = planningDecalageSemaine === 0 ? 'Semaine actuelle' :
        planningDecalageSemaine === 1 ? 'Semaine suivante' : planningDecalageSemaine === -1 ? 'Semaine précédente' : 'Autre semaine';
    if (etendue) etendue.textContent = court.format(premier) + ' – ' + court.format(dernier) + ' ' + dernier.getFullYear();
    if (jour) {
        var complet = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(affiche);
        jour.textContent = complet.charAt(0).toUpperCase() + complet.slice(1);
    }
    if (retour) retour.hidden = planningDecalageSemaine === 0;
    var precedant = document.querySelector('#planningModal .planning-semaine-actions [aria-label="Semaine précédente"]');
    var suivant = document.querySelector('#planningModal .planning-semaine-actions [aria-label="Semaine suivante"]');
    if (precedant) precedant.disabled = planningDecalageSemaine <= -52;
    if (suivant) suivant.disabled = planningDecalageSemaine >= 52;
    planningMinuteurEntete();
}

function renderPlanning() {
    var ancienChevauchement = document.getElementById('chevauchementJour');
    if (ancienChevauchement && ancienChevauchement.parentNode) ancienChevauchement.parentNode.removeChild(ancienChevauchement);
    if (typeof poserJourCourant === 'function') poserJourCourant();
    const weekDates = getWeekDates(new Date(), planningDecalageSemaine);
    const dateAffichee = weekDates[selectedDay].date;
    planningEnteteSemaine(weekDates);

    let dayNavHtml = '';
    weekDates.forEach(function (day, index) {
        const isSelected = selectedDay === index;
        dayNavHtml += '<button type="button" class="planning-jour' + (isSelected ? ' selectionne' : '') + (day.isToday ? ' actuel' : '') + '" onclick="selectDay(' + index + ')" aria-label="' + new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(day.date) + '" aria-pressed="' + isSelected + '"' + (day.isToday ? ' aria-current="date"' : '') + '><span>' + day.dayName + '</span><strong>' + day.dayNumber + '</strong></button>';
    });
    document.getElementById('dayNavigation').innerHTML = dayNavHtml;

    const nextActivity = getNextActivity();
    if (nextActivity) {
        document.getElementById('nextActivityBanner').style.display = 'block';
        document.getElementById('nextActivityBanner').innerHTML = buildNextActivityHTML(nextActivity);
    } else {
        document.getElementById('nextActivityBanner').style.display = 'none';
    }

    const events = planningDecalageSemaine === 0
        ? generateDayEvents(selectedDay) : generateDayEvents(selectedDay, dateAffichee);
    v3LastRendered = events;
    const addBtn = document.getElementById('addPlanningBtn');
    const jourLibre = typeof holidayMode === 'function' && holidayMode(selectedDay, dateAffichee) === 'free' &&
        !customEvents.some(e => e && e.date === planningCleDate(dateAffichee) && e.day === selectedDay && !e.deleted && !e.resetDate);
    const horsSommeil = v3SommeilHorsPlanning.slice();
    window.__v3HorsSommeilAffiche = horsSommeil;
    if (addBtn) addBtn.style.display = planningJourModifiable(selectedDay) ? 'flex' : 'none';
    if (planningJourModifiable(selectedDay)) v3SignalerChevauchementJour(events, selectedDay);
    let eventsHtml = '';
    if (horsSommeil.length) {
        eventsHtml += '<div class="cv-sommeil-avertissement" role="status"><strong>Le sommeil est protégé</strong><p>Ces anciens créneaux tombent pendant le sommeil. Ils sont conservés mais retirés de la journée tant que leurs horaires ne sont pas corrigés :</p>' + horsSommeil.map(function (ev, index) {
            return '<div><span>' + v3Escape(ev.title || 'Créneau') + ' · ' + v3Escape(ev.startTime || '') + ' → ' + v3Escape(ev.endTime || '') + '</span>' +
                (planningJourModifiable(selectedDay) && ev.editable ? '<button type="button" onclick="v3ModifierHorsSommeil(' + index + ')">Modifier</button>' : '') + '</div>';
        }).join('') + '</div>';
    }
    if (typeof holidayMode === 'function' && holidayMode(selectedDay, dateAffichee) === 'keep') {
        eventsHtml += '<div style="margin-bottom: 0.75rem; padding: 0.75rem 1rem; border-radius: 0.85rem; background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; font-size: 0.85rem; font-weight: 600;">🎉 Jour férié — emploi du temps conservé</div>';
    } else if (typeof holidayMode === 'function' && holidayMode(selectedDay, dateAffichee) === 'light') {
        eventsHtml += '<div style="margin-bottom: 0.75rem; padding: 0.75rem 1rem; border-radius: 0.85rem; background: #fff7ed; border: 1px solid #fed7aa; color: #9a3412; font-size: 0.85rem; font-weight: 600;">🎉 Jour férié — activités désélectionnées retirées</div>';
    }
    const borderColorMap = { indigo: '#818cf8', blue: '#60a5fa', orange: '#fb923c', red: '#ef4444', amber: '#f59e0b', purple: '#a78bfa', cyan: '#22d3ee', gray: '#9ca3af', pink: '#f472b6', green: '#4ade80', yellow: '#facc15', teal: '#2dd4bf', rose: '#fb7185', violet: '#4d63a1' };
    const bgColorMap = { indigo: '#eef2ff', blue: '#eff6ff', orange: '#fff7ed', red: '#fef2f2', amber: '#fffbeb', purple: '#faf5ff', cyan: '#ecfeff', gray: '#f9fafb', pink: '#fdf2f8', green: '#f0fdf4', yellow: '#fefce8', teal: '#f0fdfa', rose: '#fff1f2', violet: '#eef2ff' };

    events.forEach(function (event, idx) {
        const colorClass = getEventColor(event.type);
        const [borderColor, bgColor] = colorClass.split(' ');
        const borderStyle = borderColor.replace('border-', '').replace('-400', '').replace('-500', '');
        const bgStyle = bgColor.replace('bg-', '').replace('-50', '');
        const bColor = borderColorMap[borderStyle] || '#9ca3af';
        const bBg = bgColorMap[bgStyle] || '#f9fafb';

        const durMins = v3DureeHoraire(event.startTime, event.endTime);
        const durH = Math.floor(durMins / 60), durM = durMins % 60;
        const durLabel = durMins > 0 ? (durH > 0 ? durH + 'h' : '') + (durM > 0 ? durM + 'min' : '') : '';

        const isLast = idx === events.length - 1;
        const chainLine = (!isLast && event.id !== 'sleep') ?
            '<div style="display:flex;align-items:center;gap:0.5rem;padding:0 1rem;margin:-0.25rem 0;"><div style="width:3rem;flex-shrink:0;"></div><div style="width:2px;height:0.625rem;background:linear-gradient(to bottom,' + bColor + ',#e5e7eb);margin-left:1.375rem;opacity:0.5;border-radius:1px;"></div></div>'
            : '';

        /* Plus aucune marque de minuteur sur les cartes du planning : la
           séance de révision et le minuteur ont leur propre page. */
        const subtitle = event.subtitle || '';
        const pinBadge = event.kind === 'pinned' ? '<span title="Heure fixée par toi" style="font-size:0.7rem;margin-right:0.2rem;">📌</span>' : '';

        /* Deux épreuves simultanées choisies par l'élève restent visibles
           côte à côte ; elles ne se recouvrent jamais dans la liste. */
        const memeEpreuve = function (a, b) {
            return a && b && a.devoirsBloc && b.devoirsBloc &&
                ['devoir-', 'exam-'].some(function (prefixe) { return String(a.id).startsWith(prefixe); }) &&
                ['devoir-', 'exam-'].some(function (prefixe) { return String(b.id).startsWith(prefixe); }) &&
                timeToMinutes(a.startTime) < timeToMinutes(b.endTime) && timeToMinutes(b.startTime) < timeToMinutes(a.endTime);
        };
        const avecAvant = memeEpreuve(events[idx - 1], event);
        const avecApres = memeEpreuve(event, events[idx + 1]);
        if (!avecAvant && avecApres) eventsHtml += '<div class="devoirs-paralleles">';
        const modifiable = planningJourModifiable(selectedDay) && event.editable;
        eventsHtml += '<div data-v3-idx="' + idx + '" data-v3-type="' + v3Escape(event.type) + '" onclick="' + (modifiable ? 'v3OpenEditByIndex(' + idx + ')' : '') + '" style="display:flex;align-items:center;gap:0.875rem;padding:0.875rem 1rem;background:' + bBg + ';border-radius:0.875rem;border-left:4px solid ' + bColor + ';box-shadow:0 1px 4px rgba(0,0,0,0.08);cursor:' + (modifiable ? 'pointer' : 'default') + ';transition:all 0.2s;margin-bottom:0.5rem;" ' + (modifiable ? 'onmouseover="this.style.transform=\'translateX(2px)\';this.style.boxShadow=\'0 4px 12px rgba(0,0,0,0.12)\'" onmouseout="this.style.transform=\'none\';this.style.boxShadow=\'0 1px 4px rgba(0,0,0,0.08)\'"' : '') + '>' +
            '<div style="width:2.75rem;height:2.75rem;background:white;border-radius:0.75rem;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 1px 3px rgba(0,0,0,0.08);border:1.5px solid #f3f4f6;"><span style="font-size:1.375rem;">' + iconeHtml(event.icon, '1.45rem') + '</span></div>' +
            '<div style="flex:1;min-width:0;">' +
                '<h3 style="font-weight:700;color:#111827;font-size:0.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + v3Escape(event.title) + '</h3>' +
                (subtitle ? '<p style="font-size:0.75rem;color:#6b7280;margin-top:0.1rem;">' + v3Escape(subtitle) + '</p>' : '') +
            '</div>' +
            '<div style="text-align:right;flex-shrink:0;">' +
                '<p style="font-size:0.85rem;font-weight:700;color:#374151;">' + pinBadge + event.startTime + '</p>' +
                '<p style="font-size:0.7rem;color:#56665e;">→ ' + event.endTime + '</p>' +
                (durLabel ? '<p style="font-size:0.68rem;color:' + bColor + ';font-weight:600;margin-top:0.1rem;">' + durLabel + '</p>' : '') +
            '</div>' +
            '<div style="width:1.15rem;flex-shrink:0;margin-left:0.25rem;text-align:center;color:#d1d5db;' + (modifiable ? '' : 'visibility:hidden;') + '"><span style="font-size:0.8rem;">✏️</span></div>' +
        '</div>' + (avecAvant || avecApres ? '' : chainLine);
        if (avecAvant && !avecApres) eventsHtml += '</div>' + chainLine;
        if (jourLibre && event.id === 'wakeup') eventsHtml += v3LibreVertical();
    });

    // Lien discret pour revenir au planning automatique du jour (si modifié)
    const dateEdition = planningDateEdition(selectedDay);
    const dayHasChanges = customEvents.some(e => e && !e.resetDate && e.day === selectedDay && (dateEdition ? e.date === dateEdition : !e.date));
    if (dayHasChanges && planningJourModifiable(selectedDay)) {
        eventsHtml += '<div style="text-align:right;margin-top:0.25rem;"><button onclick="v3ResetDay()" style="background:none;border:none;color:#56665e;font-size:0.75rem;cursor:pointer;text-decoration:underline;">↺ Réinitialiser ' + (dateEdition ? 'le ' + dateEdition : V3_DAY_NAMES[selectedDay]) + ' (planning automatique)</button></div>';
    }
    document.getElementById('eventsContainer').innerHTML = eventsHtml;

    document.getElementById('statScore').textContent = targetScore;
    document.getElementById('statSubjects').textContent = subjects.length + optionalSubjects.length;
    document.getElementById('statActivities').textContent = selectedActivities.length;
    v3PeindreIconeActivites();
    if (typeof majClasseAffichage === 'function') majClasseAffichage();
    if (typeof eeSuiviPlanning === 'function') eeSuiviPlanning();
}

function v3LibreVertical() {
    /* Jour férié libéré : la carte « Jour libre » aux couleurs vertes du site. */
    return '<div style="min-height:68vh;display:flex;align-items:center;justify-content:center;padding:1.25rem 0.5rem;">'
        + '<div style="width:min(100%,21rem);border-radius:1.6rem;overflow:hidden;line-height:0;box-shadow:0 26px 60px rgba(22,101,52,0.14),0 2px 10px rgba(22,101,52,0.06);">'
        + '<img src="images/jour-libre.webp?v=20261016e" alt="Jour libre : rien de programmé aujourd\'hui" width="409" height="619" draggable="false" style="display:block;width:100%;height:auto;">'
        + '</div></div>';
}

function v3OpenEditByIndex(idx) {
    const ev = v3LastRendered[idx];
    if (!planningJourModifiable(selectedDay) || !ev || !ev.editable) return;
    openEditModal(ev.id, ev.title, ev.startTime, ev.endTime, ev.type, ev.icon, ev);
}

function v3ModifierHorsSommeil(index) {
    var ev = (window.__v3HorsSommeilAffiche || [])[index];
    if (!ev || !ev.editable || !planningJourModifiable(selectedDay)) return;
    openEditModal(ev.id, ev.title, ev.startTime, ev.endTime, ev.type, ev.icon, ev);
    if (editingEvent) editingEvent.horsSommeil = ev;
}

function v3ResetDay() {
    if (!planningJourModifiable(selectedDay)) return;
    const day = selectedDay;
    const dateEdition = planningDateEdition(day);
    confirmerAction({
        titre: 'Réinitialiser le planning de ' + (dateEdition || V3_DAY_NAMES[day]) + ' ?',
        detail: 'Tes modifications de ce jour seront retirées. Tu pourras ensuite annuler pendant quelques secondes.',
        action: 'Réinitialiser ce jour',
        confirmer: function () {
            const snapshot = customEvents.slice();
            customEvents = customEvents.filter(e => !(e && e.day === day && (dateEdition ? e.date === dateEdition : !e.date)));
            if (dateEdition) {
                // Une ancienne copie de compte ne doit pas ressusciter les
                // exceptions réinitialisées lors de la prochaine fusion.
                var dernier = snapshot.reduce(function (max, e) {
                    return e && e.date === dateEdition && e.day === day ? Math.max(max, Number(e.timestamp) || 0) : max;
                }, 0);
                var temps = Math.max(Date.now(), dernier + 1);
                customEvents.push({ id: generateEventId('date-reset', dateEdition + '-' + temps, day),
                    day: day, date: dateEdition, resetDate: true, timestamp: temps });
            }
            v3Save();
            v3SyncExoLabels();
            renderPlanning();
            v3Toast('↺ Planning de ' + V3_DAY_NAMES[day] + ' réinitialisé', 'info', { undo: function () { customEvents = snapshot; v3Save(); v3SyncExoLabels(); renderPlanning(); } });
        }
    });
}

// ═══════════════════════════════════════════════════════════════════
//  3. MODIFICATION D'UN CRÉNEAU (surcharge openEditModal / save / delete)
// ═══════════════════════════════════════════════════════════════════
function openEditModal(id, title, startTime, endTime, type, icon, evt) {
    if (!planningJourModifiable(selectedDay)) return;
    const dateEdition = planningDateEdition(selectedDay);
    const record = customEvents.find(e => e && e.id === id && !e.replacesId && (dateEdition ? e.date === dateEdition : !e.date)) || null;
    editingEvent = {
        id, title, startTime, endTime, type,
        icon: icon || (evt && evt.icon) || (record && record.icon) || '📌',
        kind: evt ? evt.kind : (record ? 'pinned' : 'flex'),
        cibleDebut: evt && evt._v3CibleDebut, cibleFin: evt && evt._v3CibleFin,
        isCustom: !!record
    };
    document.getElementById('editEventTitle').value = title;
    document.getElementById('editEventStart').value = startTime;
    document.getElementById('editEventEnd').value = endTime;
    editCurrentDuration = timeToMinutes(endTime) - timeToMinutes(startTime);
    if (editCurrentDuration < 0) editCurrentDuration += 1440;
    if (!editCurrentDuration) editCurrentDuration = 30;
    updateEditDurationDisplay();
    var info = document.getElementById('editCascadeInfo');
    var bouton = document.getElementById('editSaveButton');
    if (info) info.innerHTML = '📅 <strong>Pour cette date seulement :</strong> les autres créneaux gardent leurs horaires. Aucune autre semaine ne sera modifiée.';
    if (bouton) bouton.textContent = 'Enregistrer pour cette date';
    document.getElementById('editTimeError').style.display = 'none';
    v3UpdateEditPinHint();
    document.getElementById('editEventModal').style.display = 'flex';
}

function v3UpdateEditPinHint() {
    var hint = document.getElementById('editPinHint');
    if (hint) hint.style.display = 'none';
}

function saveEditedEventCascade() {
    if (!editingEvent) return;
    const newTitle = document.getElementById('editEventTitle').value.trim() || editingEvent.title;
    const newStart = document.getElementById('editEventStart').value;
    const newEnd = document.getElementById('editEventEnd').value;
    const errEl = document.getElementById('editTimeError');
    const showErr = (m) => { errEl.textContent = m; errEl.style.display = 'block'; };

    if (!newStart || !newEnd) { showErr('Remplis les horaires.'); return; }
    let newDur = timeToMinutes(newEnd) - timeToMinutes(newStart);
    if (newDur < 0) newDur += 1440;
    if (!newDur) { showErr("L'heure de fin doit être après le début."); return; }
    errEl.style.display = 'none';

    const day = selectedDay;
    if (!planningJourModifiable(day)) return;
    if (v3SommeilInterdit(newStart, newEnd, day)) { showErr('Ce créneau tombe pendant le sommeil. Choisis un horaire entre le réveil et le coucher.'); return; }
    const memeHoraire = newStart === editingEvent.startTime && newEnd === editingEvent.endTime;
    const ctx = { mode:'edition', day:day, title:newTitle, icon:editingEvent.icon, type:editingEvent.type,
        start:newStart, end:newEnd, origineStart:editingEvent.startTime, origineEnd:editingEvent.endTime,
        excludeIds:[editingEvent.id], conflits:[], resolutionDate:planningCleDate(planningDateSelectionnee(day)),
        renommageSeul:memeHoraire, directEdition:true };
    if (!memeHoraire) {
        ctx.conflits = v3ConflitsCreneau(day, newStart, newEnd, [editingEvent.id]);
        if (ctx.conflits.length) { v3OuvrirChoixChevauchement(ctx); return; }
    }
    v3AppliquerResolutionDate(ctx, {type:'deplacer', utilisateur:{start:newStart,end:newEnd}, supprimerIds:[]});
}

function saveEditedEvent() { saveEditedEventCascade(); }

function deleteEditedEvent() {
    if (!editingEvent || !planningJourModifiable(selectedDay)) return;
    const day = selectedDay, date = planningCleDate(planningDateSelectionnee(day));
    const snapshot = customEvents.slice(), title = editingEvent.title;
    const before = v3EvenementsJour(day);
    const matches = before.filter(function (e) { return e.id === editingEvent.id && e.startTime === editingEvent.startTime && e.endTime === editingEvent.endTime; });
    const erreur = document.getElementById('editTimeError');
    if (matches.length > 1) {
        erreur.textContent = 'Ces créneaux ont le même horaire et ne peuvent pas être distingués sans risque. Rien n’a été changé.'; erreur.style.display = 'block'; return;
    }
    const original = matches[0] || editingEvent.horsSommeil;
    if (!original) { erreur.textContent = 'Ce créneau a changé. Ferme la fenêtre et réessaie.'; erreur.style.display = 'block'; return; }
    const precise = !!original._v3CibleDebut || before.filter(function (e) { return e.id === original.id; }).length > 1;
    const cibleDebut = original._v3CibleDebut || original.startTime, cibleFin = original._v3CibleFin || original.endTime;
    const temps = Math.max(Date.now(), snapshot.reduce(function (max,e) { return e && e.day === day && e.date === date ? Math.max(max,Number(e.timestamp)||0) : max; },0) + 1);
    let sauvegarde;
    try { sauvegarde = localStorage.getItem('studyPlanIB_customEvents_juliss'); }
    catch (e) { erreur.textContent = 'Le stockage est indisponible. Rien n’a été changé.'; erreur.style.display = 'block'; return; }
    try {
        customEvents = customEvents.filter(function (e) {
            if (!e || e.day !== day || e.date !== date) return true;
            if (!e.replacesId && e.id === original.id) return false;
            if (e.replacesId !== original.id) return true;
            return precise ? !(e.cibleDebut === cibleDebut && e.cibleFin === cibleFin) : !!e.cibleDebut;
        });
        const marqueur = {id:generateEventId('date-delete',title,day),day:day,date:date,title:title,
            startTime:original.startTime,endTime:original.endTime,type:original.type,icon:original.icon,
            replacesId:original.id,deleted:true,timestamp:temps};
        if (precise) { marqueur.cibleDebut = cibleDebut; marqueur.cibleFin = cibleFin; }
        customEvents.push(marqueur);
        if (typeof emploiNePasSauver !== 'undefined') emploiNePasSauver++;
        var apres;
        try { apres = v3EvenementsJour(day); } finally { if (typeof emploiNePasSauver !== 'undefined') emploiNePasSauver--; }
        if (apres.some(function (e) { return e.id === original.id && e.startTime === original.startTime && e.endTime === original.endTime; }) ||
            before.some(function (e) { return e !== original && !apres.some(function (x) { return x.id === e.id && x.startTime === e.startTime && x.endTime === e.endTime && x.title === e.title; }); }) ||
            apres.some(function (e) { return !before.some(function (x) { return x.id === e.id && x.startTime === e.startTime && x.endTime === e.endTime && x.title === e.title; }); })) throw new Error('Modification inattendue');
        v3Save();
    } catch (e) {
        customEvents = snapshot;
        try { if (sauvegarde === null) localStorage.removeItem('studyPlanIB_customEvents_juliss'); else localStorage.setItem('studyPlanIB_customEvents_juliss',sauvegarde); } catch (ignore) {}
        erreur.textContent = 'Impossible de retirer ce créneau sans modifier le reste. Rien n’a été changé.'; erreur.style.display = 'block'; return;
    }
    v3SyncExoLabels(); closeEditModal(); renderPlanning();
    v3Toast('🗑️ « ' + title + ' » retiré pour le ' + date, 'info', {
        undo: function () { customEvents = snapshot; v3Save(); v3SyncExoLabels(); renderPlanning(); v3Toast('↩ « ' + title + ' » rétabli', 'success'); }
    });
}

// ═══════════════════════════════════════════════════════════════════
//  2. AJOUT AU PLANNING + DÉTECTION DES DOUBLONS
// ═══════════════════════════════════════════════════════════════════
let v3DupAck = null; // clé du doublon déjà signalé (2e clic = ajout confirmé)

function v3FindDuplicate(dayIndex, title, mode) {
    const wanted = mode === 'study' ? v3StudyKey(title) : v3Normalize(title);
    if (!wanted) return null;
    return v3EvenementsJour(dayIndex).find(ev => {
        if (ev.id === 'wakeup' || ev.id === 'sleep') return false;
        if (mode === 'study') return v3IsStudyType(ev.type) && v3StudyKey(ev.title) === wanted;
        return v3Normalize(ev.title) === wanted;
    }) || null;
}
function v3ShowDupWarning(el, label, dup, dayIndex) {
    el.innerHTML = '⚠️ <strong>' + v3Escape(label) + '</strong> est déjà dans ton planning de ' + V3_DAY_NAMES[dayIndex] +
        ' (' + dup.startTime + ' → ' + dup.endTime + ').<br>Clique à nouveau sur « Ajouter au planning » pour l\'ajouter quand même.';
    el.style.display = 'block';
}

function confirmAddStudy() {
    if (!newEventSelectedSubject) return;
    const startTime = document.getElementById('studyStartInput').value;
    const endTime = document.getElementById('studyEndInput').value;
    const errEl = document.getElementById('studyTimeError');
    const warnEl = document.getElementById('studyDupWarning');
    const showErr = (m) => { errEl.textContent = m; errEl.style.display = 'block'; if (warnEl) warnEl.style.display = 'none'; };

    if (!startTime || !endTime) { showErr('Remplis les horaires.'); return; }
    const validation = validateNewEventTime(startTime, endTime, selectedDay);
    if (!validation.valid) { showErr(validation.error); return; }
    const conflict = v3FindConflict(selectedDay, startTime, endTime);
    if (conflict) { showErr(v3ConflictMessage(conflict)); return; }
    errEl.style.display = 'none';

    const icon = newEventStudyType === 'revision' ? newEventSelectedSubject.icon : '✏️';
    const title = (newEventStudyType === 'revision' ? 'Révision ' : 'Exercices ') + newEventSelectedSubject.name;

    // Doublon : même type de session pour la même matière ce jour-là
    const dupKey = ['study', v3StudyKey(title), selectedDay, startTime, endTime].join('|');
    const dup = v3FindDuplicate(selectedDay, title, 'study');
    if (dup && v3DupAck !== dupKey && warnEl) { v3DupAck = dupKey; v3ShowDupWarning(warnEl, dup.title, dup, selectedDay); return; }
    v3DupAck = null;
    if (warnEl) warnEl.style.display = 'none';

    customEvents.push(v3RecordDate({
        id: generateEventId('study', title, selectedDay),
        day: selectedDay, title, startTime, endTime, type: 'study', icon,
        subjectGrade: newEventSelectedSubject.grade, source: 'custom', timestamp: Date.now()
    }, selectedDay));
    v3Save();
    closeAddModal();
    renderPlanning();
    v3Toast('✅ « ' + title + ' » ajouté ' + V3_DAY_NAMES[selectedDay] + ' à ' + startTime + ' · ' + v3DurLabel(timeToMinutes(endTime) - timeToMinutes(startTime)), 'success');
}

var activityEmojiManuel = false;
var EMOJI_ACTIVITE = ['⚽','🏀','🏊','💃','🏋️','⛪','🕌','🎨','🤝','🎵','📚','🍳','🏃','🚴','🧘','🎬','🎮','💻','🙏','🎉','🎾','🏐','🥊','🚶','💼','⭐','🎯','🌟','💡','🧩','🎭','🏆','🌈','🔥','🎹','🎤','📖','✏️','😴','🍵','📷','🌸','🍀','💫','🥁','♟️'];

function activiteEmojiReinit() {
    activityEmojiManuel = false;
    var picker = document.getElementById('activityEmojiPicker');
    if (picker) picker.style.display = 'none';
}

function emojiPourActivite(nom) {
    var n = String(nom || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (!n) return '✨';
    var regles = [
        [/foot|soccer/, '⚽'], [/basket/, '🏀'], [/natation|nage|piscine|swim/, '🏊'],
        [/danse|dance/, '💃'], [/gym|muscu|fitness/, '🏋️'], [/eglise|messe|culte/, '⛪'],
        [/mosque/, '🕌'], [/art|dessin|peint/, '🎨'], [/benevol/, '🤝'],
        [/music|piano|guitare|violon|chant|chanson|batterie/, '🎵'], [/lecture|lire|livre/, '📚'],
        [/cuisine|cuisin|repas/, '🍳'], [/course|jogging|run/, '🏃'], [/velo|cycl/, '🚴'],
        [/yoga|medit/, '🧘'], [/film|cine|serie/, '🎬'], [/jeu|game|gaming|console/, '🎮'],
        [/code|programm|info/, '💻'], [/priere|prier/, '🙏'], [/famille|parent/, '👨‍👩‍👧'],
        [/ami|sortie|fete|anniv/, '🎉'], [/tennis/, '🎾'], [/volley/, '🏐'], [/boxe|combat/, '🥊'],
        [/marche|promen/, '🚶'], [/travail|job|stage|boulot/, '💼'], [/echec|chess/, '♟️'],
        [/photo/, '📷'], [/theatre/, '🎭'], [/sieste|repos|dorm/, '😴']
    ];
    for (var i = 0; i < regles.length; i++) if (regles[i][0].test(n)) return regles[i][1];
    var h = 0;
    for (var j = 0; j < n.length; j++) h = (h + n.charCodeAt(j) * (j + 1)) % EMOJI_ACTIVITE.length;
    return EMOJI_ACTIVITE[h];
}

function majEmojiActivite() {
    if (activityEmojiManuel) return;
    var input = document.getElementById('activityNameInput');
    var nom = input ? input.value.trim() : '';
    var icon = emojiPourActivite(nom);
    newActivityIcon = icon;
    var preview = document.getElementById('activityIconPreview');
    if (preview) preview.textContent = icon;
    document.querySelectorAll('.preset-act-btn').forEach(function (btn) {
        var on = nom && (btn.getAttribute('data-name') || '').toLowerCase() === nom.toLowerCase();
        btn.style.background = on ? '#f0fdf4' : 'white';
        btn.style.borderColor = on ? '#6ee7b7' : '#e5e7eb';
    });
}

function basculerEmojisActivite() {
    var picker = document.getElementById('activityEmojiPicker');
    if (!picker) return;
    if (!picker.childElementCount) {
        var vus = {};
        EMOJI_ACTIVITE.forEach(function (emoji) {
            if (vus[emoji]) return;
            vus[emoji] = true;
            var bouton = document.createElement('button');
            bouton.type = 'button';
            bouton.textContent = emoji;
            bouton.style.cssText = 'width:2.25rem;height:2.25rem;border:1px solid #e5e7eb;background:white;border-radius:0.6rem;font-size:1.15rem;cursor:pointer;padding:0;';
            bouton.onclick = function (ev) {
                ev.stopPropagation();
                activityEmojiManuel = true;
                newActivityIcon = emoji;
                var preview = document.getElementById('activityIconPreview');
                if (preview) preview.textContent = emoji;
                picker.style.display = 'none';
            };
            picker.appendChild(bouton);
        });
    }
    picker.style.display = picker.style.display === 'flex' ? 'none' : 'flex';
}

function confirmAddActivity() {
    const name = document.getElementById('activityNameInput').value.trim();
    const preview = document.getElementById('activityIconPreview');
    const icon = (preview && preview.textContent.trim()) || newActivityIcon || '✨';
    const startTime = document.getElementById('activityStartInput').value;
    const endTime = document.getElementById('activityEndInput').value;
    const errEl = document.getElementById('activityTimeError');
    const warnEl = document.getElementById('activityDupWarning');
    const showErr = (m) => { errEl.textContent = m; errEl.style.display = 'block'; if (warnEl) warnEl.style.display = 'none'; };

    if (!name) { showErr('Merci d\'entrer un nom d\'activité.'); return; }
    if (!startTime || !endTime) { showErr('Remplis les horaires.'); return; }
    if (timeToMinutes(endTime) <= timeToMinutes(startTime)) { showErr("L'heure de fin doit être après le début."); return; }
    if (v3SommeilInterdit(startTime, endTime, selectedDay)) { showErr('Ce créneau tombe pendant le sommeil. Choisis un horaire entre le réveil et le coucher.'); return; }
    // D'abord montrer le conflit, même pendant les cours :
    // seul un retrait explicite (et confirmé deux fois) pourra alors déroger
    // à la protection habituelle de ces horaires.
    if (!window.__ignorerChevauchementActivite) {
        var voisinesAjout = v3ConflitsCreneau(selectedDay, startTime, endTime, []);
        if (voisinesAjout.length) {
            v3OuvrirChoixChevauchement({
                mode: 'ajout',
                day: selectedDay,
                title: name,
                icon: icon,
                type: 'activity',
                start: startTime,
                end: endTime,
                origineStart: startTime,
                origineEnd: endTime,
                excludeIds: [],
                conflits: voisinesAjout
            });
            return;
        }
    }
    const validation = validateNewEventTime(startTime, endTime, selectedDay);
    if (!validation.valid) { showErr(validation.error); return; }
    errEl.style.display = 'none';

    // Doublon : une activité du même nom existe déjà ce jour-là
    const dupKey = ['activity', v3Normalize(name), selectedDay, startTime, endTime].join('|');
    const dup = v3FindDuplicate(selectedDay, name, 'activity');
    if (dup && v3DupAck !== dupKey && warnEl) { v3DupAck = dupKey; v3ShowDupWarning(warnEl, dup.title, dup, selectedDay); return; }
    v3DupAck = null;
    if (warnEl) warnEl.style.display = 'none';

    customEvents.push(v3RecordDate({
        id: generateEventId('activity', name, selectedDay),
        day: selectedDay, title: name, startTime, endTime, type: 'activity', icon, source: 'custom', timestamp: Date.now()
    }, selectedDay));
    v3Save();
    closeAddModal();
    renderPlanning();
    v3Toast('✅ « ' + name + ' » ajouté ' + V3_DAY_NAMES[selectedDay] + ' à ' + startTime, 'success');
}

// Page « Tes activités » (inscription) : pas deux fois la même activité
function addCustomActivity() {
    const input = document.getElementById('customActivityInput');
    const name = input.value.trim();
    if (!name) return;
    const norm = v3Normalize(name);
    const existing = selectedActivities.find(a => v3Normalize(a.name) === norm);
    if (existing) {
        v3Toast('⚠️ « ' + existing.name + ' » est déjà dans tes activités.', 'warn');
        input.value = '';
        return;
    }
    const preset = availableActivitiesList.find(a => v3Normalize(a.name) === norm);
    if (preset) {
        toggleActivity(preset.name, preset.icon); // même activité que la liste → on la sélectionne
        input.value = '';
        return;
    }
    selectedActivities.push({ name, icon: '✨', days: [], sameTime: true, startTime: '17:00', endTime: '19:00', dayTimes: {} });
    input.value = '';
    renderActivities();
}

// ── Surcharges légères (on garde le comportement d'origine + ajout) ──
function v3EstActivite(ev) {
    if (!ev) return false;
    if (ev.type === 'activity') return true;
    return String(ev.id || '').indexOf('activity-') === 0;
}

function v3IntervallesSeCroisent(debut, fin, autreDebut, autreFin) {
    if (typeof timeToMinutes !== 'function') return false;
    var s = timeToMinutes(debut);
    var e = timeToMinutes(fin);
    var os = timeToMinutes(autreDebut);
    var oe = timeToMinutes(autreFin);
    if (!isFinite(s) || !isFinite(e) || !isFinite(os) || !isFinite(oe) || e === s || oe === os) return false;
    if (e < s) e += 1440;
    if (oe < os) oe += 1440;
    return [-1440, 0, 1440].some(function (delta) { return s < oe + delta && os + delta < e; });
}

function v3ActivitesChevauchees(day, start, end, excludeIds) {
    var exclus = {};
    (excludeIds || []).forEach(function (id) { if (id) exclus[id] = true; });
    var vus = {};
    var out = [];
    function ajouter(ev) {
        if (!ev || !ev.id || exclus[ev.id] || vus[ev.id] || !v3EstActivite(ev)) return;
        if (!v3IntervallesSeCroisent(start, end, ev.startTime, ev.endTime)) return;
        vus[ev.id] = true;
        out.push(ev);
    }
    try { (v3EvenementsJour(day) || []).forEach(ajouter); } catch (e) {}
    // Les sources hebdomadaires ne doivent pas ressusciter une activité
    // supprimée ou déplacée pour cette date précise.
    if (planningDateEdition(day)) return out;
    (typeof customEvents !== 'undefined' ? customEvents : []).forEach(function (ev) {
        if (!ev || ev.day !== day || ev.deleted) return;
        if (ev.replacesId) {
            ajouter({
                id: ev.replacesId,
                title: ev.title,
                startTime: ev.startTime,
                endTime: ev.endTime,
                type: ev.type || 'activity',
                icon: ev.icon || '✨'
            });
            return;
        }
        ajouter(ev);
    });
    var remplacees = {};
    (typeof customEvents !== 'undefined' ? customEvents : []).forEach(function (ev) {
        if (ev && ev.day === day && ev.replacesId) remplacees[ev.replacesId] = true;
    });
    (typeof selectedActivities !== 'undefined' ? selectedActivities : []).forEach(function (act) {
        if (!act || !act.name || !act.days || act.days.indexOf(day) === -1) return;
        var id = 'activity-' + act.name;
        if (remplacees[id]) return;
        var slot = act.sameTime ? { start: act.startTime, end: act.endTime } : ((act.dayTimes && (act.dayTimes[day] || act.dayTimes[String(day)])) || null);
        if (!slot || !slot.start || !slot.end) return;
        ajouter({ id: id, title: act.name, startTime: slot.start, endTime: slot.end, type: 'activity', icon: act.icon || '✨' });
    });
    return out;
}

// Une solution n'est proposée que si les deux destinations sont vérifiées.
function v3Horloge(mins) {
    return typeof v3M2T === 'function' ? v3M2T(mins) : '00:00';
}

function v3DureeCourte(mins) {
    var h = Math.floor(mins / 60), m = mins % 60;
    return (h ? h + ' h' : '') + (m ? (h ? ' ' : '') + m + ' min' : '');
}

function v3ConflitsCreneau(day, start, end, excludeIds) {
    var exclus = new Set(excludeIds || []);
    var out = [], vus = new Set();
    function ajouter(ev) {
        if (!ev || !ev.id || exclus.has(ev.id) || vus.has(ev.id)) return;
        if (!ev.startTime || !ev.endTime) return;
        var croise = v3IntervallesSeCroisent(start, end, ev.startTime, ev.endTime);
        if (!croise) return;
        vus.add(ev.id);
        out.push(ev);
    }
    (v3EvenementsJour(day) || []).forEach(ajouter);
    v3ActivitesChevauchees(day, start, end, excludeIds).forEach(ajouter);
    return out.sort(function (a, b) { return timeToMinutes(a.startTime) - timeToMinutes(b.startTime); });
}

/* Une confirmation supplémentaire est obligatoire pour ces besoins essentiels.
   On ne supprime jamais silencieusement un bloc proposé par le moteur. */
function v3Fondamental(ev) {
    return !!(ev && (ev.id === 'sleep' || ev.id === 'wakeup' || ev.type === 'school' ||
        ev.type === 'transport' || ev.type === 'meal' || ev.type === 'prep' ||
        ev.type === 'prep-soir' || ev.id === 'prep' || ev.id === 'prepSoir'));
}

function v3PeutDeplacerChevauchement(ev) {
    return !!(ev && v3EstActivite(ev) && ev.editable !== false && !ev.habitudeFixe &&
        ev.type !== 'school' && ev.type !== 'transport');
}

function v3VerifierChoixChevauchement(ctx, choix) {
    if (!ctx || !choix || !choix.utilisateur || selectedDay !== ctx.day) {
        return { valid: false, error: 'Le jour du planning a changé. Recommence ton choix.' };
    }
    if (ctx.mode === 'edition' && (!editingEvent || ctx.excludeIds[0] !== editingEvent.id)) {
        return { valid: false, error: 'Cette modification a changé. Ouvre à nouveau le créneau.' };
    }
    var utilisateur = choix.utilisateur;
    if (v3SommeilInterdit(utilisateur.start, utilisateur.end, ctx.day) ||
        (choix.autre && v3SommeilInterdit(choix.autre.start, choix.autre.end, ctx.day)) ||
        (choix.supprimerIds || []).indexOf('sleep') !== -1 || (choix.supprimerIds || []).indexOf('wakeup') !== -1) {
        return {valid:false, error:'Le sommeil et le réveil sont protégés. Choisis un autre horaire.'};
    }
    var duree = v3DureeHoraire(ctx.start, ctx.end);
    var start = timeToMinutes(utilisateur.start), end = timeToMinutes(utilisateur.end);
    if (end < start) end += 1440;
    var retirer = Array.isArray(choix.supprimerIds) ? choix.supprimerIds : [];
    if (!(start >= 0 && end < 2880 && end > start &&
        (choix.type === 'remplacerExact' || end - start === duree))) {
        return { valid: false, error: 'Choisis une heure et une durée valides, sans dépasser minuit.' };
    }
    var exclus = (ctx.excludeIds || []).slice();
    if (choix.conflitId) exclus.push(choix.conflitId);
    var conflits = v3ConflitsCreneau(ctx.day, utilisateur.start, utilisateur.end, exclus);
    if (retirer.length) {
        var tous = new Set(conflits.map(function (ev) { return ev.id; }));
        if (new Set(retirer).size !== retirer.length || retirer.some(function (id) { return !tous.has(id); })) {
            return { valid: false, error: 'La liste des créneaux à retirer a changé. Recommence ton choix.' };
        }
        if (choix.type === 'remplacerExact') {
            var source = conflits.find(function (ev) { return ev.id === choix.sourceId; });
            if (!source || retirer.indexOf(source.id) === -1 ||
                source.startTime !== utilisateur.start || source.endTime !== utilisateur.end) {
                return { valid: false, error: 'Choisis le créneau exact à prendre.' };
            }
        }
    }
    var restant = conflits.find(function (ev) { return retirer.indexOf(ev.id) === -1; });
    if (restant) return { valid: false, error: '« ' + restant.title + ' » occupe encore cet horaire. Choisis quoi retirer ou un autre horaire.' };
    var valid = validateNewEventTime(utilisateur.start, utilisateur.end, ctx.day);
    if (!valid.valid && !retirer.some(function (id) {
        var ev = conflits.find(function (c) { return c.id === id; });
        return ev && (ev.id === 'sleep' || ev.type === 'school' || ev.id === 'wakeup');
    })) return valid;
    if (choix.conflitId) {
        if (ctx.conflits.length !== 1) return { valid: false, error: 'Plusieurs créneaux se chevauchent. Choisis un autre horaire.' };
        var autre = ctx.conflits[0];
        var present = v3ActivitesChevauchees(ctx.day, autre.startTime, autre.endTime, ctx.excludeIds).find(function (ev) { return ev.id === autre.id; }) ||
            (v3EvenementsJour(ctx.day) || []).find(function (ev) { return ev.id === autre.id; });
        if (!v3PeutDeplacerChevauchement(autre) || !present || present.startTime !== autre.startTime || present.endTime !== autre.endTime) {
            return { valid: false, error: 'Cette activité a changé. Ferme la fenêtre et réessaie.' };
        }
        var as = timeToMinutes(choix.autre.start), ae = timeToMinutes(choix.autre.end);
        var ancien = v3DureeHoraire(autre.startTime, autre.endTime);
        if (!(as >= 0 && ae < 1440 && ae > as && ae - as === ancien)) {
            return { valid: false, error: 'La durée de « ' + autre.title + ' » doit rester la même.' };
        }
        if (v3IntervallesSeCroisent(utilisateur.start, utilisateur.end, choix.autre.start, choix.autre.end)) {
            return { valid: false, error: 'Les deux nouveaux horaires se chevauchent encore.' };
        }
        valid = validateNewEventTime(choix.autre.start, choix.autre.end, ctx.day);
        if (!valid.valid) return valid;
        var conflit = v3ConflitsCreneau(ctx.day, choix.autre.start, choix.autre.end, exclus)[0];
        if (conflit) return { valid: false, error: '« ' + autre.title + ' » recouvrirait encore « ' + conflit.title + ' ».' };
    }
    return { valid: true };
}

// Le coucher peut être minuit ou après minuit : les propositions restent
// dans la journée affichée, au lieu de considérer qu'elle finit à 00 h.
function v3FinJourChevauchement(day) {
    var reveil = day === 5 ? saturdayWakeup : day === 6 ? sundayWakeup : weekdayWakeup;
    var debut = timeToMinutes(reveil || '06:00');
    var fin = timeToMinutes(bedtimeForDay(day));
    return Number.isFinite(fin) && fin > debut ? Math.min(1440, fin) : 1440;
}

function v3PropositionsCreneau(ctx) {
    var duree = v3DureeHoraire(ctx.start, ctx.end);
    var reveil = ctx.day === 5 ? saturdayWakeup : ctx.day === 6 ? sundayWakeup : weekdayWakeup;
    var bas = Math.max(0, timeToMinutes(reveil || '06:00'));
    var haut = v3FinJourChevauchement(ctx.day);
    if (!(duree > 0) || haut - bas < duree) return [];
    var debuts = new Set(), cursor;
    // Couvrir toute la journée par demi-heures, avec les limites réelles des
    // activités pour ne pas rater un espace libre qui commence à 18 h 15.
    for (cursor = Math.ceil(bas / 30) * 30; cursor + duree <= haut; cursor += 30) debuts.add(cursor);
    debuts.add(bas);
    (v3EvenementsJour(ctx.day) || []).forEach(function (ev) {
        if (!ev || !ev.startTime || !ev.endTime) return;
        debuts.add(timeToMinutes(ev.startTime));
        debuts.add(timeToMinutes(ev.endTime));
    });
    var out = [];
    Array.from(debuts).sort(function (a, b) { return a - b; }).forEach(function (debut) {
        if (!(debut >= bas && debut + duree <= haut) || debut === timeToMinutes(ctx.start)) return;
        var plage = { start: v3Horloge(debut), end: v3Horloge(debut + duree) };
        var conflits = v3ConflitsCreneau(ctx.day, plage.start, plage.end, ctx.excludeIds);
        var voisin = Object.assign({}, ctx, { start: plage.start, end: plage.end, conflits: conflits });
        var choix = { utilisateur: plage };
        if (conflits.length) {
            choix.type = 'remplacer';
            choix.supprimerIds = conflits.map(function (ev) { return ev.id; });
        }
        if (!v3VerifierChoixChevauchement(voisin, choix).valid) return;
        out.push({ start: plage.start, end: plage.end, conflits: conflits });
    });
    return out;
}

function v3DestinationDeplacement(ctx, conflit) {
    if (ctx.conflits.length !== 1 || !v3PeutDeplacerChevauchement(conflit)) return null;
    var duree = v3DureeHoraire(conflit.startTime, conflit.endTime);
    if (!(duree > 0)) return null;
    var finJour = v3FinJourChevauchement(ctx.day);
    for (var debut = Math.ceil(Math.max(timeToMinutes(ctx.end), timeToMinutes(conflit.endTime)) / 15) * 15;
        debut + duree <= finJour; debut += 15) {
        var choix = {
            utilisateur: { start: ctx.start, end: ctx.end },
            conflitId: conflit.id,
            autre: { start: v3Horloge(debut), end: v3Horloge(debut + duree) }
        };
        if (v3VerifierChoixChevauchement(ctx, choix).valid) return choix;
    }
    return null;
}

function v3DeplacerEvenement(ev, day, start, end) {
    if (!ev) return;
    var direct = customEvents.findIndex(function (item) { return item && item.id === ev.id && !item.replacesId && v3PorteeEvenement(item, day); });
    if (direct !== -1) {
        customEvents[direct] = v3RecordDate(Object.assign({}, customEvents[direct], {
            startTime: start, endTime: end, pinned: true, timestamp: Date.now()
        }), day);
        return;
    }
    customEvents = customEvents.filter(function (item) {
        return !(v3PorteeEvenement(item, day) && item.replacesId === ev.id);
    });
    customEvents.push(v3RecordDate({
        id: generateEventId(ev.type || 'activity', ev.title || 'activite', day),
        day: day, title: ev.title, startTime: start, endTime: end,
        type: ev.type || 'activity', icon: ev.icon || '📌', source: 'custom',
        replacesId: ev.id, pinned: true, timestamp: Date.now()
    }, day));
}

function v3FermerChoixChevauchement() {
    var el = document.getElementById('chevauchementPopup');
    if (el) el.remove();
    window.__chevauchementCtx = null;
    var retour = window.__chevauchementRetourFocus;
    window.__chevauchementRetourFocus = null;
    if (retour && retour.isConnected && typeof retour.focus === 'function') retour.focus();
}

function v3DireChevauchement(message) {
    var erreur = document.getElementById('chevauchementErreur');
    if (erreur) {
        erreur.textContent = message || '';
        if (message && typeof erreur.scrollIntoView === 'function') erreur.scrollIntoView({ block: 'nearest' });
    } else {
        erreur = document.getElementById('editTimeError');
        if (erreur) { erreur.textContent = message || ''; erreur.style.display = message ? 'block' : 'none'; }
    }
}

/* Le report hebdomadaire de v3Save peut ajouter des blocs après l'aperçu.
   Il ne doit pas modifier le résultat approuvé au moment de sa confirmation. */
function v3SauverChoixChevauchement() {
    var precedent = window.__v3SaveEnCours;
    window.__v3SaveEnCours = true;
    try { v3Save(); } finally { window.__v3SaveEnCours = precedent; }
}

function v3SimulerChoixChevauchement(ctx, choix) {
    if (typeof emploiNePasSauver !== 'undefined') emploiNePasSauver++;
    try { return v3AppliquerChoixChevauchement(ctx, choix, { simuler: true }); }
    finally { if (typeof emploiNePasSauver !== 'undefined') emploiNePasSauver--; }
}

function v3AppliquerChoixChevauchement(ctx, choix, options) {
    options = options || {};
    if (ctx.resolutionDate && ctx.mode === 'edition') return v3AppliquerResolutionDate(ctx, choix, options);
    function refuser(message) {
        if (options.simuler) return { valid: false, error: message };
        v3DireChevauchement(message);
        return false;
    }
    if (!planningJourModifiable(ctx.day) || (ctx.date || '') !== planningDateEdition(ctx.day)) {
        return refuser('La date a changé. Ferme la fenêtre et réessaie.');
    }
    var depart = customEvents.slice();
    var stockageAvant;
    try { stockageAvant = localStorage.getItem('studyPlanIB_customEvents_juliss'); } catch (ignore) {}
    try {
        var valid = v3VerifierChoixChevauchement(ctx, choix);
        if (!valid.valid) return refuser(valid.error);
        var idAffiche = '';
        // Capturer la journée et la sélection avant de recalculer.
        var avant = v3EvenementsJour(ctx.day);
        var selection = v3ConflitsCreneau(ctx.day, choix.utilisateur.start, choix.utilisateur.end, ctx.excludeIds);
        if ((choix.supprimerIds || []).concat(choix.conflitId ? [choix.conflitId] : []).some(function (id) {
            return avant.filter(function (ev) { return ev.id === id; }).length !== 1;
        })) return refuser('Ce créneau apparaît plusieurs fois et ne peut pas être modifié sans risque. Choisis un autre horaire. Rien n’a été enregistré.');
        (choix.supprimerIds || []).forEach(function (id) {
            var ev = selection.find(function (item) { return item.id === id; });
            if (!ev) throw new Error('Le créneau à retirer a changé');
            customEvents = customEvents.filter(function (item) {
                return !(v3PorteeEvenement(item, ctx.day) && (item.id === id || item.replacesId === id));
            });
            customEvents.push(v3RecordDate({ id: generateEventId(ev.type || 'activity', ev.title, ctx.day), day: ctx.day,
                title: ev.title, startTime: ev.startTime, endTime: ev.endTime, type: ev.type,
                replacesId: id, source: 'custom', deleted: true, remplacementConflit: true, timestamp: Date.now() }, ctx.day));
        });
        if (choix.conflitId) v3DeplacerEvenement(ctx.conflits[0], ctx.day, choix.autre.start, choix.autre.end);
        if (ctx.mode === 'edition') {
            var id = editingEvent.id;
            var direct = customEvents.findIndex(function (ev) { return ev && ev.id === id && !ev.replacesId && v3PorteeEvenement(ev, ctx.day); });
            if (direct !== -1) {
                customEvents[direct] = v3RecordDate(Object.assign({}, customEvents[direct], {
                    title: ctx.title, startTime: choix.utilisateur.start, endTime: choix.utilisateur.end,
                    pinned: true, resteEcole: false, remplacementConflit: !!(choix.supprimerIds && choix.supprimerIds.length), timestamp: Date.now()
                }), ctx.day);
            } else {
                customEvents = customEvents.filter(function (ev) { return !(v3PorteeEvenement(ev, ctx.day) && ev.replacesId === id); });
                customEvents.push(v3RecordDate({
                    id: generateEventId(ctx.type, ctx.title, ctx.day), day: ctx.day, title: ctx.title,
                    startTime: choix.utilisateur.start, endTime: choix.utilisateur.end,
                    type: ctx.type, icon: ctx.icon || '📌', source: 'custom',
                    replacesId: id, pinned: true, resteEcole: false, remplacementConflit: !!(choix.supprimerIds && choix.supprimerIds.length), timestamp: Date.now()
                }, ctx.day));
            }
            idAffiche = id;
        } else {
            idAffiche = generateEventId('activity', ctx.title, ctx.day);
            customEvents.push(v3RecordDate({ id: idAffiche, day: ctx.day, title: ctx.title,
                startTime: choix.utilisateur.start, endTime: choix.utilisateur.end,
                type: 'activity', icon: ctx.icon || '✨', source: 'custom', pinned: true, remplacementConflit: !!(choix.supprimerIds && choix.supprimerIds.length), timestamp: Date.now() }, ctx.day));
        }
        // Tester le résultat réel du moteur avant de sauvegarder. L'emploi gelé
        // n'est pas modifié si une proposition échoue.
        if (typeof emploiNePasSauver !== 'undefined') emploiNePasSauver++;
        var apres;
        try { apres = v3EvenementsJour(ctx.day); }
        finally { if (typeof emploiNePasSauver !== 'undefined') emploiNePasSauver--; }
        function horaireAttendu(id, plage) {
            var ev = (apres || []).find(function (item) { return item.id === id; });
            return !!(ev && ev.startTime === plage.start && ev.endTime === plage.end);
        }
        // Plusieurs blocs peuvent partager le même identifiant. Apparier
        // d'abord les occurrences exactement identiques, puis les changements
        // restants, pour que l'aperçu ne cache ni n'invente de modification.
        var anciens = avant.filter(function (ev) {
            return (choix.supprimerIds || []).indexOf(ev.id) === -1 && ev.id !== idAffiche && ev.id !== choix.conflitId;
        });
        var nouveaux = (apres || []).filter(function (ev) { return ev.id !== idAffiche && ev.id !== choix.conflitId; }).slice();
        var aComparer = [];
        anciens.forEach(function (ev) {
            var identique = nouveaux.findIndex(function (item) {
                return item.id === ev.id && item.startTime === ev.startTime && item.endTime === ev.endTime && item.title === ev.title && item.type === ev.type;
            });
            if (identique !== -1) nouveaux.splice(identique, 1);
            else aComparer.push(ev);
        });
        var effets = aComparer.map(function (ev) {
            var index = nouveaux.findIndex(function (item) { return item.id === ev.id; });
            return { avant: ev, apres: index === -1 ? null : nouveaux.splice(index, 1)[0] };
        });
        nouveaux.forEach(function (ev) { effets.push({ avant: null, apres: ev }); });
        function pairesEnConflit(events) {
            var paires = new Set();
            (events || []).forEach(function (a, i) {
                if (!a || a.id === 'sleep' || a.id === 'wakeup' || a.id === idAffiche) return;
                events.slice(i + 1).forEach(function (b) {
                    if (!b || b.id === 'sleep' || b.id === 'wakeup' || b.id === idAffiche || a.id === b.id ||
                        (a.parallele && b.parallele && a.type === 'school' && b.type === 'school')) return;
                    if (v3IntervallesSeCroisent(a.startTime, a.endTime, b.startTime, b.endTime)) {
                        paires.add(JSON.stringify([[a.id, a.startTime, a.endTime], [b.id, b.startTime, b.endTime]].sort(function (x, y) { return JSON.stringify(x).localeCompare(JSON.stringify(y)); })));
                    }
                });
            });
            return paires;
        }
        var conflitsAvant = pairesEnConflit(avant);
        var conflitsApres = pairesEnConflit(apres);
        var conflitNouveau = Array.from(conflitsApres).some(function (cle) { return !conflitsAvant.has(cle); });
        if (conflitNouveau || !horaireAttendu(idAffiche, choix.utilisateur) ||
            (choix.supprimerIds || []).some(function (id) {
                return (apres || []).some(function (ev) { return ev.id === id; });
            }) ||
            (choix.conflitId && !horaireAttendu(choix.conflitId, choix.autre)) ||
            (apres || []).some(function (ev) {
                return ev.id !== idAffiche && ev.id !== 'wakeup' && ev.id !== 'sleep' &&
                    v3IntervallesSeCroisent(choix.utilisateur.start, choix.utilisateur.end, ev.startTime, ev.endTime);
            })) {
            customEvents = depart;
            return refuser('Le planning ne peut pas appliquer ce choix sans conflit ou sans respecter les horaires demandés. Choisis un autre horaire. Rien n’a été enregistré.');
        }
        // La signature couvre toute la journée, pas seulement les changements visibles :
        // si le planning évolue pendant la confirmation, il faut refaire l’aperçu.
        function signature(events, idNouveau) {
            return JSON.stringify((events || []).map(function (ev) {
                return [ev.id === idNouveau && ctx.mode === 'ajout' ? '__nouveau__' : ev.id,
                    ev.title, ev.type, ev.startTime, ev.endTime];
            }).sort(function (a, b) { return JSON.stringify(a).localeCompare(JSON.stringify(b)); }));
        }
        var empreinte = JSON.stringify(depart) + '|' + signature(avant, '') + '|' + signature(apres, idAffiche);
        if (options.simuler) {
            customEvents = depart;
            return { valid: true, effets: effets, empreinte: empreinte };
        }
        if ((options.empreinte && options.empreinte !== empreinte) || (!options.empreinte && effets.length)) {
            customEvents = depart;
            return refuser(options.empreinte
                ? 'Le planning a changé depuis l’aperçu. Reviens au choix pour le vérifier à nouveau. Rien n’a été enregistré.'
                : 'Ce choix modifierait aussi d’autres créneaux. Vérifie l’aperçu avant de confirmer. Rien n’a été enregistré.');
        }
        v3SauverChoixChevauchement();
    } catch (e) {
        customEvents = depart;
        // Si l'écriture locale avait réussi avant qu'une étape suivante
        // échoue, on remet aussi la copie locale de départ.
        if (!options.simuler) {
            try {
                if (stockageAvant === null) localStorage.removeItem('studyPlanIB_customEvents_juliss');
                else if (stockageAvant !== undefined) localStorage.setItem('studyPlanIB_customEvents_juliss', stockageAvant);
            } catch (ignore) {}
        }
        return refuser(options.simuler ? 'Impossible de vérifier ce choix. Réessaie ou choisis un autre horaire.' : 'La sauvegarde a été interrompue. Vérifie tes horaires avant de réessayer.');
    }
    v3FermerChoixChevauchement();
    if (ctx.mode === 'edition') closeEditModal();
    else closeAddModal();
    if (typeof v3SyncExoLabels === 'function') v3SyncExoLabels();
    renderPlanning();
    v3Toast('✅ « ' + ctx.title + ' » placé à ' + choix.utilisateur.start +
        (choix.conflitId ? '. « ' + ctx.conflits[0].title + ' » déplacé à ' + choix.autre.start + '.' : '.') , 'success');
    return true;
}

/* Résoudre le conflit visible pour une seule date : superposer des exceptions
   datées évite de recalculer et déplacer les autres jours de la semaine. */
function v3AppliquerResolutionDate(ctx, choix, options) {
    options = options || {};
    function refuser(message) {
        if (options.simuler) return { valid: false, error: message };
        v3DireChevauchement(message);
        return false;
    }
    if (!planningJourModifiable(ctx.day) || ctx.day !== selectedDay ||
        ctx.resolutionDate !== planningCleDate(planningDateSelectionnee(ctx.day))) {
        return refuser('La date a changé. Ferme la fenêtre et recommence.');
    }
    var verdict = ctx.renommageSeul ? {valid:true} : v3VerifierChoixChevauchement(ctx, choix);
    if (v3SommeilInterdit(choix.utilisateur.start, choix.utilisateur.end, ctx.day)) verdict = {valid:false,error:'Ce créneau tombe pendant le sommeil.'};
    if (!verdict.valid) return refuser(verdict.error);
    var avant = customEvents.slice();
    var stockageAvant = null;
    try { stockageAvant = localStorage.getItem('studyPlanIB_customEvents_juliss'); } catch (ignore) {}
    var jourAvant = v3EvenementsJour(ctx.day);
    var retires = choix.supprimerIds || [];
    var occurrences = jourAvant.filter(function (ev) { return ev.id === editingEvent.id && ev.startTime === editingEvent.startTime && ev.endTime === editingEvent.endTime; });
    if (occurrences.length > 1) return refuser('Ces créneaux ont le même horaire et ne peuvent pas être distingués sans risque. Rien n’a été changé.');
    // Un identifiant partagé peut désigner plusieurs blocs automatiques : ne
    // pas en supprimer deux alors que l'aperçu n'en montrait qu'un seul.
    if (retires.some(function (id) { return jourAvant.filter(function (ev) { return ev.id === id; }).length !== 1; })) {
        return refuser('Ce créneau existe plusieurs fois dans la journée. Choisis un autre horaire : rien n’a été changé.');
    }
    var selection = v3ConflitsCreneau(ctx.day, choix.utilisateur.start, choix.utilisateur.end, ctx.excludeIds);
    var timestamp = Math.max(Date.now(), customEvents.reduce(function (max, ev) {
        return ev && ev.date === ctx.resolutionDate && ev.day === ctx.day ? Math.max(max, Number(ev.timestamp) || 0) : max;
    }, 0) + 1);
    function exception(ev, plage, supprime) {
        var dateDirecte = customEvents.findIndex(function (record) { return record && record.day === ctx.day &&
            record.date === ctx.resolutionDate && record.id === ev.id && !record.replacesId && !record.deleted; });
        if (dateDirecte !== -1 && !supprime) {
            customEvents[dateDirecte] = Object.assign({}, customEvents[dateDirecte], {title:ev.title,
                startTime:plage.start, endTime:plage.end, pinned:true, timestamp:timestamp++});
            return;
        }
        var precise = !!(ev._v3CibleDebut || (jourAvant.filter(function (item) { return item.id === ev.id; }).length > 1));
        var debutCible = ev._v3CibleDebut || ev.startTime, finCible = ev._v3CibleFin || ev.endTime;
        customEvents = customEvents.filter(function (record) {
            if (!(record && record.date === ctx.resolutionDate && record.day === ctx.day && record.replacesId === ev.id)) return true;
            return precise ? !(record.cibleDebut === debutCible && record.cibleFin === finCible) : !!record.cibleDebut;
        });
        var record = {id:generateEventId(ev.type || 'activity', ev.title || 'activite', ctx.day),
            day:ctx.day,date:ctx.resolutionDate,title:ev.title,startTime:plage.start,endTime:plage.end,
            type:ev.type || 'activity',icon:ev.icon || '📌',source:'custom',replacesId:ev.id,
            pinned:!supprime,deleted:!!supprime,timestamp:timestamp++};
        if (precise) { record.cibleDebut = debutCible; record.cibleFin = finCible; }
        customEvents.push(record);
    }
    try {
        retires.forEach(function (id) {
            var ev = selection.find(function (item) { return item.id === id; });
            if (!ev) throw new Error('Créneau à retirer introuvable');
            exception(ev,{start:ev.startTime,end:ev.endTime},true);
        });
        if (choix.conflitId) exception(ctx.conflits[0],choix.autre,false);
        var original = jourAvant.find(function (ev) { return ev.id === editingEvent.id && ev.startTime === editingEvent.startTime && ev.endTime === editingEvent.endTime; }) || editingEvent.horsSommeil;
        if (!original) throw new Error('Activité introuvable');
        exception(Object.assign({}, original, {title:ctx.title}),choix.utilisateur,false);
        if (typeof emploiNePasSauver !== 'undefined') emploiNePasSauver++;
        var apres;
        try { apres = v3EvenementsJour(ctx.day); }
        finally { if (typeof emploiNePasSauver !== 'undefined') emploiNePasSauver--; }
        var cibles = apres.filter(function (ev) { return ev.id === original.id && ev.startTime === choix.utilisateur.start && ev.endTime === choix.utilisateur.end && ev.title === ctx.title; });
        var cible = cibles[0];
        if (cibles.length !== 1 ||
            jourAvant.some(function (ev) {
                if (ev === original || ev.id === choix.conflitId || retires.indexOf(ev.id) !== -1) return false;
                return !apres.some(function (a) { return a.id === ev.id && a.startTime === ev.startTime && a.endTime === ev.endTime; });
            }) || apres.some(function (ev) {
                if (ev === cible || ev.id === choix.conflitId) return false;
                return !jourAvant.some(function (old) { return old.id === ev.id && old.startTime === ev.startTime && old.endTime === ev.endTime; });
            }) || retires.some(function (id) { return apres.some(function (ev) { return ev.id === id; }); }) ||
            (choix.conflitId && (!apres.some(function (ev) { return ev.id === choix.conflitId && ev.startTime === choix.autre.start && ev.endTime === choix.autre.end; }) ||
                apres.some(function (ev) { return ev.id !== choix.conflitId && ev.id !== 'sleep' && ev.id !== 'wakeup' &&
                    v3IntervallesSeCroisent(choix.autre.start, choix.autre.end, ev.startTime, ev.endTime); }))) ||
            (!ctx.renommageSeul && apres.some(function (ev) { return ev !== cible && ev.id !== 'sleep' && ev.id !== 'wakeup' &&
                v3IntervallesSeCroisent(choix.utilisateur.start, choix.utilisateur.end, ev.startTime, ev.endTime); }))) {
            throw new Error('Le résultat ne correspond pas à l’aperçu');
        }
        function signature(events) {
            return JSON.stringify((events || []).map(function (ev) { return [ev.id, ev.title, ev.type, ev.startTime, ev.endTime]; })
                .sort(function (a, b) { return JSON.stringify(a).localeCompare(JSON.stringify(b)); }));
        }
        var empreinte = JSON.stringify(avant) + '|' + signature(jourAvant) + '|' + signature(apres);
        if (options.simuler) { customEvents = avant; return { valid: true, effets: [], empreinte: empreinte }; }
        if (options.empreinte && options.empreinte !== empreinte) {
            customEvents = avant;
            return refuser('Le planning a changé depuis l’aperçu. Reviens au choix pour le vérifier à nouveau. Rien n’a été enregistré.');
        }
        v3SauverChoixChevauchement();
    } catch (e) {
        customEvents = avant;
        if (!options.simuler) {
            try { if (stockageAvant === null) localStorage.removeItem('studyPlanIB_customEvents_juliss'); else localStorage.setItem('studyPlanIB_customEvents_juliss', stockageAvant); } catch (ignore) {}
        }
        return refuser('Ce choix ne peut pas être appliqué sans modifier d’autres créneaux. Essaie un autre horaire : rien n’a été enregistré.');
    }
    v3FermerChoixChevauchement(); closeEditModal();
    if (typeof v3SyncExoLabels === 'function') v3SyncExoLabels();
    renderPlanning();
    v3Toast(ctx.directEdition ? '✅ Modification enregistrée pour le ' + ctx.resolutionDate + '.' : '✅ Chevauchement résolu pour le ' + ctx.resolutionDate + '.', 'success');
    return true;
}

function v3SignalerChevauchementJour(events, day) {
    var anciens = document.getElementById('chevauchementJour');
    if (anciens && anciens.parentNode) anciens.parentNode.removeChild(anciens);
    var activites = (events || []).filter(v3EstActivite);
    var conflit = null;
    var i, j;
    for (i = 0; i < activites.length && !conflit; i++) {
        for (j = i + 1; j < activites.length; j++) {
            if (v3IntervallesSeCroisent(activites[i].startTime, activites[i].endTime, activites[j].startTime, activites[j].endTime)) {
                conflit = { voulu: activites[i], autre: activites[j] };
                break;
            }
        }
    }
    if (!conflit) {
        /* Un conflit entre des faits (repas, trajet, activité choisie...) ne
           doit pas être dissimulé par un déplacement automatique. */
        var faits = (events || []).filter(function (ev) { return ev && ev.id !== 'sleep' && ev.id !== 'wakeup'; });
        for (i = 0; i < faits.length && !conflit; i++) for (j = i + 1; j < faits.length; j++) {
            if (faits[i].parallele && faits[j].parallele && faits[i].type === 'school' && faits[j].type === 'school') continue;
            if (!(faits[i].conflitHoraire || faits[j].conflitHoraire ||
                (typeof planningInamovible === 'function' && planningInamovible(faits[i]) && planningInamovible(faits[j])))) continue;
            if (v3IntervallesSeCroisent(faits[i].startTime, faits[i].endTime, faits[j].startTime, faits[j].endTime)) {
                conflit = { voulu: faits[i], autre: faits[j], faits: true };
                break;
            }
        }
    }
    if (!conflit) return;
    // Ne jamais déplacer un cours, un trajet ou un besoin essentiel à l'insu de l'élève.
    var candidat = [conflit.voulu, conflit.autre].find(v3PeutDeplacerChevauchement) || null;
    var barre = document.createElement('div');
    barre.id = 'chevauchementJour';
    barre.className = 'cv-alerte';
    barre.setAttribute('role', 'status');
    barre.innerHTML = '<span class="cv-alerte-icone" aria-hidden="true">↔</span><div class="cv-alerte-texte"><strong>Deux activités se chevauchent</strong>' +
        '<span>' + v3Escape(conflit.voulu.title) + ' et ' + v3Escape(conflit.autre.title) + ' sont prévus au même moment.</span></div>' +
        '<button type="button" class="cv-voir">Voir <span aria-hidden="true">→</span></button>';
    barre.querySelector('.cv-voir').onclick = function () {
        var retour = this;
        var voile = document.createElement('div');
        voile.id = 'chevauchementExplication';
        voile.className = 'cv-explication-voile';
        var a = conflit.voulu, b = conflit.autre;
        voile.innerHTML = '<section class="cv-explication" role="dialog" aria-modal="true" aria-labelledby="cvTitre" aria-describedby="cvDescription">' +
            '<div class="cv-explication-entete"><span aria-hidden="true">↔</span><div><small>MON PLANNING</small><h2 id="cvTitre">Un moment à organiser</h2></div>' +
            '<button type="button" class="cv-fermer" aria-label="Fermer">×</button></div>' +
            '<p id="cvDescription">Ces deux créneaux ont une partie de leurs horaires en commun. Rien n’a été déplacé automatiquement.</p>' +
            [a, b].map(function (ev) { return '<div class="cv-evenement"><span class="cv-point" aria-hidden="true"></span><strong>' + v3Escape(ev.title) + '</strong><span>' + v3Escape(ev.startTime) + ' → ' + v3Escape(ev.endTime) + '</span></div>'; }).join('') +
            (candidat ? '<p class="cv-indication">Nous chercherons des horaires pour « ' + v3Escape(candidat.title) + ' », pour cette date uniquement. Tu pourras vérifier et confirmer avant tout changement.</p>' :
             '<p class="cv-indication">Ces créneaux ne peuvent pas être déplacés automatiquement. Modifie leurs horaires à leur source ou vérifie Tes habitudes.</p>') +
            (candidat ? '<button type="button" class="cv-resoudre">Résoudre ce problème <span aria-hidden="true">→</span></button>' : '') +
            '<button type="button" class="cv-annuler">Fermer sans modifier</button></section>';
        document.body.appendChild(voile);
        function fermer() { voile.remove(); if (retour.isConnected) retour.focus(); }
        voile.querySelector('.cv-fermer').onclick = fermer;
        voile.querySelector('.cv-annuler').onclick = fermer;
        voile.addEventListener('click', function (e) { if (e.target === voile) fermer(); });
        voile.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') { e.preventDefault(); fermer(); return; }
            if (e.key !== 'Tab') return;
            var controls = Array.from(voile.querySelectorAll('button'));
            if (e.shiftKey && document.activeElement === controls[0]) { e.preventDefault(); controls[controls.length-1].focus(); }
            else if (!e.shiftKey && document.activeElement === controls[controls.length-1]) { e.preventDefault(); controls[0].focus(); }
        });
        var resoudre = voile.querySelector('.cv-resoudre');
        if (resoudre) resoudre.onclick = function () {
            // Recalculer les conflits au moment du clic : ne pas utiliser une
            // ancienne liste si le planning ou le jour a changé.
            if (selectedDay !== day || !planningJourModifiable(day)) { fermer(); return; }
            var maintenant = v3EvenementsJour(day).find(function (ev) { return ev.id === candidat.id; });
            if (!maintenant || maintenant.startTime !== candidat.startTime || maintenant.endTime !== candidat.endTime) { fermer(); renderPlanning(); return; }
            var voisins = v3ConflitsCreneau(day, maintenant.startTime, maintenant.endTime, [maintenant.id]);
            if (!voisins.length) { fermer(); renderPlanning(); return; }
            fermer();
            openEditModal(maintenant.id, maintenant.title, maintenant.startTime, maintenant.endTime, maintenant.type, maintenant.icon, maintenant);
            // Le dialogue de résolution porte le parcours ; garder l'état
            // d'édition sans afficher une seconde fenêtre en dessous.
            document.getElementById('editEventModal').style.display = 'none';
            v3OuvrirChoixChevauchement({ mode: 'edition', day: day, title: maintenant.title,
                icon: maintenant.icon, type: maintenant.type, start: maintenant.startTime, end: maintenant.endTime,
                origineStart: maintenant.startTime, origineEnd: maintenant.endTime, excludeIds: [maintenant.id], conflits: voisins,
                resolutionDate: planningCleDate(planningDateSelectionnee(day)) });
            var popup = document.getElementById('chevauchementPopup');
            if (popup) {
                popup.querySelector('[data-autre-creneau]').click();
                popup.querySelector('[data-filtre-horaire="libres"]').click();
                var proposition = popup.querySelector('.chev-proposition-libre:not([hidden])');
                if (!proposition && popup.querySelector('.chev-proposition')) {
                    popup.querySelector('[data-filtre-horaire="tous"]').click();
                    var note = document.createElement('p');
                    note.className = 'chev-note cv-alternatives';
                    note.textContent = 'Aucun horaire totalement libre : ces propositions montrent les créneaux concernés. Tu pourras décider explicitement de les déplacer ou de les retirer, ou annuler sans rien changer.';
                    popup.querySelector('#chevauchementAutres').insertBefore(note, popup.querySelector('.chev-filtres'));
                    proposition = popup.querySelector('.chev-proposition:not([hidden])');
                }
                (proposition || popup.querySelector('#chevauchementDebut')).focus();
            }
        };
        (resoudre || voile.querySelector('.cv-fermer')).focus();
    };
    var conteneur = document.getElementById('eventsContainer');
    if (conteneur && conteneur.parentNode) conteneur.parentNode.insertBefore(barre, conteneur);
}

function v3OuvrirChoixChevauchement(ctx) {
    var retourFocus = document.getElementById('chevauchementPopup') ? window.__chevauchementRetourFocus : document.activeElement;
    v3FermerChoixChevauchement();
    ctx.conflits = ctx.conflits || [];
    ctx.excludeIds = ctx.excludeIds || [];
    ctx.date = planningDateEdition(ctx.day);
    window.__chevauchementCtx = ctx;
    window.__chevauchementRetourFocus = retourFocus;
    var jour = V3_DAY_NAMES[ctx.day] || 'ce jour';
    var duree = v3DureeHoraire(ctx.start, ctx.end);
    var peutDeplacer = ctx.conflits.length === 1 ? v3DestinationDeplacement(ctx, ctx.conflits[0]) : null;
    var premier = ctx.conflits[0];
    var titre = ctx.selectionne ? 'Ton créneau choisi' :
        ctx.conflits.length > 1 ? 'Plusieurs créneaux se chevauchent' : 'Deux créneaux sont prévus en même temps';
    var lignes = ctx.conflits.map(function (ev) {
        var type = ev.type === 'school' ? 'Cours' : ev.type === 'transport' ? 'Trajet' :
            v3EstActivite(ev) ? 'Activité' : 'Créneau du planning';
        return '<div class="chev-carte chev-carte-deja">' +
            '<span class="chev-icone" aria-hidden="true">' + iconeHtml(ev.icon || '📌', '1.4rem') + '</span>' +
            '<div class="chev-carte-corps"><span class="chev-etiquette">' + type + (type === 'Activité' ? ' déjà prévue' : ' déjà prévu') + '</span>' +
            '<strong>' + v3Escape(ev.title) + '</strong><span>' + v3Escape(ev.startTime) + ' → ' +
            v3Escape(ev.endTime) + ' · ' + v3DureeCourte(v3DureeHoraire(ev.startTime, ev.endTime)) + '</span></div></div>';
    }).join('');
    var explication = ctx.selectionne
        ? 'Tu as choisi ' + v3Escape(ctx.start) + ' → ' + v3Escape(ctx.end) + ' pour « ' + v3Escape(ctx.title) + ' ». Cet horaire est occupé : choisis comment résoudre le conflit.'
        : ctx.conflits.length > 1
        ? 'Ton créneau recouvre ' + ctx.conflits.length + ' autres créneaux le ' + jour + '. Regarde les horaires de la journée et leurs conséquences avant de choisir.'
        : 'Tu veux placer « ' + v3Escape(ctx.title) + ' » le ' + jour + ', mais « ' + v3Escape(premier.title) + ' » est déjà prévu à ce moment-là.';
    var el = document.createElement('div');
    el.id = 'chevauchementPopup';
    el.className = 'chev-voile';
    el.innerHTML = '<section class="chev-dialogue" role="dialog" aria-modal="true" aria-labelledby="chevTitre" aria-describedby="chevIntro">' +
        '<div class="chev-entete"><span class="chev-symbole" aria-hidden="true">↔</span><div>' +
        '<span class="chev-kicker">ORGANISER MON PLANNING</span><h2 id="chevTitre" tabindex="-1">' + titre + '</h2></div><button type="button" class="chev-close" data-fermer aria-label="Fermer sans modifier">×</button></div>' +
        '<p id="chevIntro" class="chev-intro">' + explication + '</p>' +
        '<div id="chevauchementChoix">' +
        '<div id="chevEtapeInitiale"><span class="chev-section">Ton choix</span><div class="chev-carte chev-carte-moi">' +
        '<span class="chev-icone" aria-hidden="true">' + iconeHtml(ctx.icon || '✨', '1.4rem') + '</span>' +
        '<div class="chev-carte-corps"><span class="chev-etiquette">' + v3Escape(jour) + ' · à placer</span>' +
        '<strong>' + v3Escape(ctx.title) + '</strong><span>' + v3Escape(ctx.start) + ' → ' + v3Escape(ctx.end) +
        ' · ' + v3DureeCourte(duree) + '</span></div></div>' +
        '<span class="chev-section" data-deja>Ce qui est déjà prévu</span>' + lignes +
        '<div class="chev-actions"><button type="button" class="chev-bouton chev-bouton-vert" data-autre-creneau><strong>Choisir un autre créneau</strong><small>Place ton activité à une autre heure. Les autres restent en place si possible.</small></button>' +
        (peutDeplacer ? '<button type="button" class="chev-bouton chev-bouton-clair" data-deplacer>Garder mon horaire et déplacer ' + v3Escape(premier.title) + '<small>Déplacer à ' + v3Escape(peutDeplacer.autre.start) + ' → ' + v3Escape(peutDeplacer.autre.end) + ', sans retirer cette activité.</small></button>' : '') +
        '<button type="button" class="chev-bouton chev-bouton-clair" data-remplacer>' + (ctx.conflits.length === 1 ? 'Retirer « ' + v3Escape(premier.title) + ' » pour garder cet horaire' : 'Choisir les créneaux à retirer') + '<small>Tu choisis ce qui sera retiré pour libérer cet horaire.</small></button>' +
        (ctx.selectionne ? '<button type="button" class="chev-bouton chev-bouton-lien" data-annuler>Annuler · ne rien changer</button></div><p class="chev-note">Choisis quoi faire avec les créneaux déjà prévus pour pouvoir continuer.</p>' :
            '<button type="button" class="chev-bouton chev-bouton-lien" data-annuler>Annuler · ne rien changer</button></div>') + '</div>' +
        '<div id="chevauchementAutres" hidden><span class="chev-section">Horaires du ' + v3Escape(jour) + ' · ' + v3DureeCourte(duree) + '</span>' +
        '<p class="chev-note">Choisis un horaire. Un horaire occupé peut nécessiter le retrait d’un autre créneau.</p>' +
        '<div class="chev-filtres" role="group" aria-label="Filtrer les horaires">' +
        '<button type="button" data-filtre-horaire="tous" aria-pressed="false">Tous</button>' +
        '<button type="button" data-filtre-horaire="libres" aria-pressed="true">Libres</button>' +
        '<button type="button" data-filtre-horaire="occupes" aria-pressed="false">Occupés</button></div>' +
        '<div class="chev-propositions" data-propositions></div><p class="chev-note" data-aucun-horaire hidden>Aucun horaire dans cette catégorie. Essaie les horaires occupés ou saisis une autre heure.</p>' +
        '<label class="chev-libelle" for="chevauchementDebut">Ou choisis l’heure de début</label>' +
        '<div class="chev-manuel"><input id="chevauchementDebut" type="time" value="' + v3Escape(ctx.start) + '">' +
        '<span>Fin : <strong id="chevauchementFin"></strong></span></div>' +
        '<p id="chevauchementVerdict" class="chev-verdict" role="status" aria-live="polite"></p>' +
        '<button type="button" class="chev-bouton chev-bouton-clair" data-placer disabled>Choisir cet horaire</button>' +
        '<div class="chev-actions"><button type="button" class="chev-bouton chev-bouton-lien" data-retour-autres>Retour</button><button type="button" class="chev-bouton chev-bouton-lien" data-annuler>Annuler · ne rien changer</button></div></div>' +
        '<div id="chevRemplacement" hidden><div id="chevHoraireMode"' + (ctx.selectionne ? ' hidden' : '') + '><span class="chev-section">Choisis ton horaire</span>' +
        '<label class="chev-mode"><input type="radio" name="chevMode" value="garder" checked> Garder l’horaire demandé (' + v3Escape(ctx.start) + ' → ' + v3Escape(ctx.end) + ' · ' + v3DureeCourte(duree) + ')</label>' +
        '<label class="chev-mode"' + (ctx.selectionne ? ' style="display:none"' : '') + '><input type="radio" name="chevMode" value="prendre"> Utiliser l’horaire du créneau à retirer <span id="chevExactExemple"></span></label>' +
        '<div id="chevSourceGroupe" hidden><label class="chev-libelle" for="chevSource">Créneau dont prendre les heures et la durée</label><select id="chevSource"></select></div></div>' +
        '<p id="chevResultat" class="chev-resultat"></p>' +
        '<span class="chev-section">Coche les créneaux à retirer pour libérer cet horaire</span>' +
        '<div id="chevListeRetraits"></div>' +
        '<p id="chevRetraitVerdict" class="chev-verdict" role="status" aria-live="polite"></p>' +
        (ctx.selectionne ? '</div><div id="chevSelectionActions" hidden>' +
            '<div class="chev-actions"><button type="button" class="chev-bouton chev-bouton-vert" data-continuer-selection disabled>Voir les changements</button>' +
            '<button type="button" class="chev-bouton chev-bouton-lien" data-retour-selection>Retour</button><button type="button" class="chev-bouton chev-bouton-lien" data-annuler>Annuler · ne rien changer</button></div></div>' :
            '<div class="chev-actions"><button type="button" class="chev-bouton chev-bouton-vert" data-continuer disabled>Voir les changements</button><button type="button" class="chev-bouton chev-bouton-lien" data-retour-remplacement>Retour</button><button type="button" class="chev-bouton chev-bouton-lien" data-annuler>Annuler · ne rien changer</button></div></div>') +
        '</div>' +
        '<div id="chevauchementApercu" hidden></div>' +
        '<p id="chevauchementErreur" class="chev-erreur" role="alert" aria-live="assertive"></p>' +
        '</section>';
    document.body.appendChild(el);
    var zoneProps = el.querySelector('[data-propositions]');
    function contextePour(plage, conflits) {
        return Object.assign({}, ctx, { start: plage.start, end: plage.end, conflits: conflits, selectionne: true,
            origineStart: ctx.origineStart || ctx.start, origineEnd: ctx.origineEnd || ctx.end });
    }
    function ouvrirPlage(plage) {
        var conflits = v3ConflitsCreneau(ctx.day, plage.start, plage.end, ctx.excludeIds);
        if (conflits.length) {
            // Cette nouvelle popup conserve la même identité et les mêmes
            // contrôles de suppression/déplacement, sans rien enregistrer.
            v3OuvrirChoixChevauchement(contextePour(plage, conflits));
        } else {
            apercu({ utilisateur: { start: plage.start, end: plage.end } });
        }
    }
    function afficherPropositions() {
        zoneProps.innerHTML = '';
        var propositions = v3PropositionsCreneau(ctx);
        if (!propositions.length) {
            zoneProps.textContent = 'Aucun autre horaire de cette durée n’est possible ce jour. Tu peux saisir un début différent ou annuler.';
            return;
        }
        var periode = '';
        propositions.forEach(function (plage) {
            var mins = timeToMinutes(plage.start);
            var rubrique = mins < 12 * 60 ? 'Matin' : mins < 17 * 60 ? 'Après-midi' : 'Soir';
            if (rubrique !== periode) {
                var titrePeriode = document.createElement('p');
                titrePeriode.className = 'chev-periode';
                titrePeriode.textContent = rubrique;
                zoneProps.appendChild(titrePeriode);
                periode = rubrique;
            }
            var bouton = document.createElement('button');
            bouton.type = 'button';
            bouton.className = 'chev-proposition ' + (plage.conflits.length ? 'chev-proposition-occupee' : 'chev-proposition-libre');
            bouton.dataset.occupe = plage.conflits.length ? 'true' : 'false';
            var effet = plage.conflits.length
                ? 'Déjà prévu : ' + plage.conflits.map(function (ev) { return v3Escape(ev.title); }).join(', ') + '.'
                : 'Aucun conflit à cet horaire.';
            bouton.innerHTML = '<span class="chev-proposition-tete"><strong>' + v3Escape(plage.start) + ' → ' + v3Escape(plage.end) + '</strong>' +
                '<small>' + (plage.conflits.length ? plage.conflits.length + ' créneau' + (plage.conflits.length > 1 ? 'x' : '') + ' occupé' + (plage.conflits.length > 1 ? 's' : '') : 'Libre') + '</small></span>' +
                '<span class="chev-proposition-effet">' + effet + '</span>';
            bouton.onclick = function () { ouvrirPlage(plage); };
            zoneProps.appendChild(bouton);
        });
        filtrerPropositions();
    }
    function filtrerPropositions() {
        var actif = el.querySelector('[data-filtre-horaire][aria-pressed="true"]').dataset.filtreHoraire;
        zoneProps.querySelectorAll('.chev-proposition').forEach(function (bouton) {
            bouton.hidden = actif !== 'tous' && (actif === 'occupes') !== (bouton.dataset.occupe === 'true');
        });
        var vide = el.querySelector('[data-aucun-horaire]');
        vide.hidden = !!zoneProps.querySelector('.chev-proposition:not([hidden])');
        vide.textContent = actif === 'libres' ? 'Aucun horaire libre proposé. Essaie les horaires occupés ou saisis une autre heure.' :
            actif === 'occupes' ? 'Aucun horaire occupé proposé. Regarde les horaires libres ou saisis une autre heure.' :
            'Aucun horaire proposé. Essaie de saisir une autre heure.';
        zoneProps.querySelectorAll('.chev-periode').forEach(function (titre) {
            var suivant = titre.nextElementSibling;
            var trouve = false;
            while (suivant && !suivant.classList.contains('chev-periode')) {
                if (!suivant.hidden) trouve = true;
                suivant = suivant.nextElementSibling;
            }
            titre.hidden = !trouve;
        });
    }
    el.querySelectorAll('[data-filtre-horaire]').forEach(function (bouton) {
        bouton.onclick = function () {
            el.querySelectorAll('[data-filtre-horaire]').forEach(function (item) {
                item.setAttribute('aria-pressed', item === bouton ? 'true' : 'false');
            });
            filtrerPropositions();
        };
    });
    function majFin() {
        var debut = el.querySelector('#chevauchementDebut').value;
        var mins = debut ? timeToMinutes(debut) + duree : 1440;
        var fin = mins < 1440 ? v3Horloge(mins) : '';
        var plage = { start: debut, end: fin };
        el.querySelector('#chevauchementFin').textContent = fin || (debut ? 'jour suivant (impossible)' : 'à renseigner');
        var conflits = fin ? v3ConflitsCreneau(ctx.day, debut, fin, ctx.excludeIds) : [];
        var candidat = contextePour(plage, conflits);
        var choix = { utilisateur: plage };
        if (conflits.length) {
            choix.type = 'remplacer';
            choix.supprimerIds = conflits.map(function (ev) { return ev.id; });
        }
        var verdict = fin ? v3VerifierChoixChevauchement(candidat, choix)
            : { valid: false, error: debut ? 'Cette heure dépasse minuit.' : 'Saisis une heure de début.' };
        el.querySelector('#chevauchementVerdict').textContent = verdict.valid
            ? (conflits.length ? 'Cet horaire concerne : ' + conflits.map(function (ev) { return '« ' + ev.title + ' »'; }).join(', ') +
                '. Choisis cet horaire pour voir les options de déplacement ou de retrait. Rien ne change encore.'
                : 'Créneau libre : ' + debut + ' → ' + fin + '. Vérifie les changements avant de confirmer.') : verdict.error;
        el.querySelector('#chevauchementVerdict').dataset.valide = verdict.valid ? 'true' : 'false';
        el.querySelector('[data-placer]').disabled = !verdict.valid;
    }
    var source = el.querySelector('#chevSource');
    ctx.conflits.forEach(function (ev, i) {
        if (!(timeToMinutes(ev.endTime) > timeToMinutes(ev.startTime))) return;
        var option = document.createElement('option');
        option.value = String(i);
        option.textContent = ev.title + ' · ' + ev.startTime + ' → ' + ev.endTime;
        source.appendChild(option);
    });
    if (!source.options.length) {
        var optionExact = el.querySelector('input[name="chevMode"][value="prendre"]');
        optionExact.disabled = true;
        optionExact.parentNode.appendChild(document.createTextNode(' (horaire traversant minuit)'));
    } else {
        var sourceInitiale = ctx.conflits[Number(source.value)];
        el.querySelector('#chevExactExemple').textContent = ' (' + sourceInitiale.startTime + ' → ' +
            sourceInitiale.endTime + ' · ' + v3DureeCourte(v3DureeHoraire(sourceInitiale.startTime, sourceInitiale.endTime)) + ')';
    }
    var mode = function () { return el.querySelector('input[name="chevMode"]:checked').value; };
    function choixRetrait() {
        var ev = ctx.conflits[Number(source.value)] || ctx.conflits[0];
        var exact = mode() === 'prendre' && ev && timeToMinutes(ev.endTime) > timeToMinutes(ev.startTime);
        var plage = exact ? { start: ev.startTime, end: ev.endTime } : { start: ctx.start, end: ctx.end };
        var ids = Array.from(el.querySelectorAll('#chevListeRetraits input:checked')).map(function (input) { return input.value; });
        return { utilisateur: plage, supprimerIds: ids, type: exact ? 'remplacerExact' : 'remplacer', sourceId: exact ? ev.id : '' };
    }
    function majRetraits(reconstruire) {
        v3DireChevauchement('');
        var ev = ctx.conflits[Number(source.value)] || ctx.conflits[0];
        var exact = mode() === 'prendre' && ev;
        var plage = exact ? { start: ev.startTime, end: ev.endTime } : { start: ctx.start, end: ctx.end };
        if (source.options.length) {
            var selectionne = ctx.conflits[Number(source.value)];
            el.querySelector('#chevExactExemple').textContent = ' (' + selectionne.startTime + ' → ' +
                selectionne.endTime + ' · ' + v3DureeCourte(v3DureeHoraire(selectionne.startTime, selectionne.endTime)) + ')';
        }
        el.querySelector('#chevSourceGroupe').hidden = !exact;
        el.querySelector('#chevResultat').textContent = '« ' + ctx.title + ' » : ' + plage.start + ' → ' + plage.end +
            ' · ' + v3DureeCourte(v3DureeHoraire(plage.start, plage.end)) +
            (exact ? ' (heures et durée du créneau remplacé).' : ' (tes heures et ta durée).');
        var liste = el.querySelector('#chevListeRetraits');
        if (reconstruire) {
            liste.innerHTML = '';
            v3ConflitsCreneau(ctx.day, plage.start, plage.end, ctx.excludeIds).forEach(function (item) {
                var label = document.createElement('label');
                label.className = 'chev-retrait';
                var input = document.createElement('input');
                input.type = 'checkbox'; input.value = item.id;
                if (exact && item.id === ev.id) input.checked = true;
                var texte = document.createElement('span');
                texte.textContent = item.title + ' · ' + item.startTime + ' → ' + item.endTime +
                    (v3Fondamental(item) ? ' · créneau essentiel' : '');
                label.appendChild(input); label.appendChild(texte); liste.appendChild(label);
            });
        }
        var choix = choixRetrait();
        var verdict = v3VerifierChoixChevauchement(ctx, choix);
        var texteVerdict = el.querySelector('#chevRetraitVerdict');
        texteVerdict.dataset.valide = verdict.valid ? 'true' : 'false';
        texteVerdict.textContent = verdict.valid && !choix.supprimerIds.length
            ? 'Cet horaire est libre. Vérifie les changements avant de confirmer.'
            : verdict.valid ? 'Retirés du planning si tu continues : ' + choix.supprimerIds.map(function (id) {
                var selection = v3ConflitsCreneau(ctx.day, plage.start, plage.end, ctx.excludeIds);
                var touche = selection.find(function (item) { return item.id === id; });
                return touche ? '« ' + touche.title + ' »' : id;
            }).join(', ') + '.' : verdict.error;
        var continuer = el.querySelector('[data-continuer]');
        if (continuer) continuer.disabled = !verdict.valid;
        if (ctx.selectionne && ctx.choixType === 'retirer') el.querySelector('[data-continuer-selection]').disabled = !verdict.valid;
    }
    function confirmerDirect(choix, zone, simulation) {
        var valid = v3VerifierChoixChevauchement(ctx, choix);
        if (!valid.valid) { v3DireChevauchement(valid.error); return; }
        v3DireChevauchement('');
        var retires = v3ConflitsCreneau(ctx.day, choix.utilisateur.start, choix.utilisateur.end, ctx.excludeIds)
            .filter(function (ev) { return (choix.supprimerIds || []).indexOf(ev.id) !== -1; });
        var essentiels = retires.filter(v3Fondamental).concat(simulation.effets.filter(function (effet) {
            return effet.avant && v3Fondamental(effet.avant);
        }).map(function (effet) { return effet.avant; }));
        if (!essentiels.length) { v3AppliquerChoixChevauchement(ctx, choix, { empreinte: simulation.empreinte }); return; }
        var suite = zone.querySelector('#chevConfirmEssentiels');
        if (!suite) {
            suite = document.createElement('div');
            suite.id = 'chevConfirmEssentiels';
            suite.className = 'chev-confirm-essentiels';
            suite.innerHTML = '<p><strong>Deuxième confirmation :</strong> le changement concerne ' +
                essentiels.map(function (ev) { return '« ' + v3Escape(ev.title) + ' »'; }).join(', ') +
                '. Ces créneaux essentiels seront retirés ou modifiés. Veux-tu vraiment appliquer les changements affichés ?</p>' +
                '<button type="button" class="chev-bouton chev-bouton-vert" data-confirmer-essentiel>Oui, appliquer les changements</button>' +
                '<button type="button" class="chev-bouton chev-bouton-clair" data-renoncer-essentiel>Non, revenir au choix</button>';
            zone.appendChild(suite);
        }
        function revenirDuSecondAccord() {
            suite.remove();
            var bouton = zone.querySelector('[data-continuer-selection], [data-confirmer]');
            if (bouton) bouton.focus();
        }
        suite.querySelector('[data-confirmer-essentiel]').onclick = function () {
            if (!v3AppliquerChoixChevauchement(ctx, choix, { empreinte: simulation.empreinte })) revenirDuSecondAccord();
        };
        suite.querySelector('[data-renoncer-essentiel]').onclick = revenirDuSecondAccord;
        suite.querySelector('[data-confirmer-essentiel]').focus();
    }
    function apercu(choix) {
        var valid = v3VerifierChoixChevauchement(ctx, choix);
        if (!valid.valid) { v3DireChevauchement(valid.error); return; }
        v3DireChevauchement('');
        var simulation = v3SimulerChoixChevauchement(ctx, choix);
        if (!simulation.valid) { v3DireChevauchement(simulation.error); return; }
        ctx.choix = choix;
        // Après sélection, les cartes « déjà prévu » ne font plus partie
        // de l’écran final. Cela ne retire aucune activité du planning.
        el.querySelector('#chevTitre').textContent = 'Vérifie les changements';
        el.querySelector('#chevIntro').textContent = 'Rien n’est enregistré pour le moment. Vérifie les changements avant de confirmer.';
        var partie = el.querySelector('#chevauchementApercu');
        var autre = ctx.conflits[0];
        var ancienDebut = ctx.origineStart || ctx.start;
        var ancienneFin = ctx.origineEnd || ctx.end;
        var doublon = ctx.mode === 'ajout' && typeof v3FindDuplicate === 'function' ? v3FindDuplicate(ctx.day, ctx.title, 'activity') : null;
        var retires = (choix.supprimerIds || []).map(function (id) {
            return v3ConflitsCreneau(ctx.day, choix.utilisateur.start, choix.utilisateur.end, ctx.excludeIds)
                .find(function (ev) { return ev.id === id; });
        }).filter(Boolean);
        partie.innerHTML = '<span class="chev-section">Voici ce qui va changer</span>' +
            '<div class="chev-ligne"><strong>' + v3Escape(ctx.title) + '</strong>' +
            (ancienDebut === choix.utilisateur.start && ancienneFin === choix.utilisateur.end ? '<span></span><b>' :
                '<span>' + v3Escape(ancienDebut) + ' → ' + v3Escape(ancienneFin) + '</span><b>→ ') +
            v3Escape(choix.utilisateur.start) + ' → ' + v3Escape(choix.utilisateur.end) + '</b></div>' +
            (choix.conflitId ? '<div class="chev-ligne"><strong>' + v3Escape(autre.title) + '</strong><span>' +
                v3Escape(autre.startTime) + ' → ' + v3Escape(autre.endTime) + '</span><b>→ ' +
                v3Escape(choix.autre.start) + ' → ' + v3Escape(choix.autre.end) + '</b></div>' : '') +
            (retires.length ? '<p class="chev-retrait-titre">Retirés du planning :</p>' + retires.map(function (ev) {
                return '<p class="chev-retrait-apercu">' + v3Escape(ev.title) + ' · ' + v3Escape(ev.startTime) + ' → ' + v3Escape(ev.endTime) + '</p>';
            }).join('') : '') +
            (simulation.effets.length ? '<p class="chev-retrait-titre">Autres changements dus au recalcul :</p>' + simulation.effets.map(function (effet) {
                var ev = effet.avant || effet.apres;
                var heures = function (item) { return v3Escape(item.startTime) + ' → ' + v3Escape(item.endTime); };
                return '<p class="chev-retrait-apercu"><strong>' + v3Escape(ev.title) + '</strong> : ' +
                    (!effet.avant ? 'ajouté à ' + heures(effet.apres) : !effet.apres ? 'retiré (' + heures(effet.avant) + ')' :
                        heures(effet.avant) + ' devient ' + heures(effet.apres) +
                        (effet.avant.title !== effet.apres.title ? ' · renommé « ' + v3Escape(effet.apres.title) + ' »' : '') +
                        (effet.avant.type !== effet.apres.type ? ' · type modifié' : '')) + '</p>';
            }).join('') : '<p class="chev-note">Aucun autre créneau ne sera modifié.</p>') +
            '<p class="chev-note">' + ((ctx.resolutionDate || ctx.date) ? 'Ces changements concernent uniquement le ' + v3Escape((ctx.resolutionDate || ctx.date).split('-').reverse().join('/')) + '.' : 'Ces changements concernent le planning habituel du ' + v3Escape(jour) + '.') + '</p>' +
            (doublon ? '<p class="chev-note">Attention : une activité nommée « ' + v3Escape(ctx.title) + ' » existe déjà ce jour. Confirmer l’ajoutera quand même.</p>' : '') +
            '<div class="chev-actions"><button type="button" class="chev-bouton chev-bouton-vert" data-confirmer>Confirmer les changements</button><button type="button" class="chev-bouton chev-bouton-clair" data-retour-apercu>Retour au choix</button>' +
            '<button type="button" class="chev-bouton chev-bouton-lien" data-annuler>Annuler · ne rien changer</button></div>';
        el.querySelector('#chevauchementChoix').hidden = true;
        partie.hidden = false;
        partie.querySelector('[data-confirmer]').onclick = function () { confirmerDirect(choix, partie, simulation); };
        partie.querySelector('[data-retour-apercu]').onclick = function () {
            partie.hidden = true; el.querySelector('#chevauchementChoix').hidden = false;
            el.querySelector('#chevTitre').textContent = titre; el.querySelector('#chevIntro').innerHTML = explication;
            v3DireChevauchement('');
            var retour = !el.querySelector('#chevRemplacement').hidden
                ? (ctx.selectionne ? el.querySelector('#chevListeRetraits input') : el.querySelector('#chevRemplacement input:not(:disabled)'))
                : el.querySelector('[data-autre-creneau]');
            if (retour) retour.focus();
        };
        partie.querySelector('[data-annuler]').onclick = v3FermerChoixChevauchement;
        el.querySelector('.chev-dialogue').scrollTop = 0;
        el.querySelector('#chevTitre').focus({ preventScroll: true });
    }
    el.querySelector('[data-remplacer]').onclick = function () {
        el.querySelector('#chevEtapeInitiale').hidden = true;
        el.querySelector('#chevauchementAutres').hidden = true;
        if (ctx.selectionne) {
            ctx.choixType = 'retirer';
            el.querySelector('#chevSelectionActions').hidden = false;
            el.querySelector('[data-continuer-selection]').disabled = true;
        }
        el.querySelector('#chevRemplacement').hidden = false;
        majRetraits(true);
        var focusRetrait = ctx.selectionne ? el.querySelector('#chevListeRetraits input') : el.querySelector('#chevRemplacement input:not(:disabled)');
        if (focusRetrait) focusRetrait.focus();
    };
    el.querySelectorAll('input[name="chevMode"]').forEach(function (input) {
        input.onchange = function () { majRetraits(true); };
    });
    source.onchange = function () { majRetraits(true); };
    el.querySelector('#chevListeRetraits').onchange = function () { majRetraits(false); };
    var continuerRetrait = el.querySelector('[data-continuer]');
    if (continuerRetrait) continuerRetrait.onclick = function () { apercu(choixRetrait()); };
    if (ctx.selectionne) {
        el.querySelector('[data-continuer-selection]').onclick = function () {
            var choix = ctx.choixType === 'retirer' ? choixRetrait() : null;
            if (choix) apercu(choix);
        };
    }
    el.querySelector('[data-autre-creneau]').onclick = function () {
        v3DireChevauchement('');
        el.querySelector('#chevEtapeInitiale').hidden = true;
        el.querySelector('#chevRemplacement').hidden = true;
        if (ctx.selectionne) el.querySelector('#chevSelectionActions').hidden = true;
        el.querySelector('#chevauchementAutres').hidden = false;
        afficherPropositions();
        el.querySelector('[data-filtre-horaire="libres"]').focus();
    };
    if (peutDeplacer) el.querySelector('[data-deplacer]').onclick = function () {
        v3DireChevauchement('');
        apercu(peutDeplacer);
    };
    el.querySelector('#chevauchementDebut').addEventListener('input', majFin);
    el.querySelector('#chevauchementDebut').addEventListener('change', majFin);
    el.querySelector('[data-placer]').onclick = function () {
        var debut = el.querySelector('#chevauchementDebut').value;
        var fin = debut && timeToMinutes(debut) + duree < 1440 ? v3Horloge(timeToMinutes(debut) + duree) : '';
        ouvrirPlage({ start: debut, end: fin });
    };
    el.querySelector('[data-fermer]').onclick = v3FermerChoixChevauchement;
    el.querySelectorAll('[data-annuler]').forEach(function (bouton) { bouton.onclick = v3FermerChoixChevauchement; });
    el.querySelector('[data-retour-autres]').onclick = function () {
        v3DireChevauchement('');
        el.querySelector('#chevauchementAutres').hidden = true;
        el.querySelector('#chevEtapeInitiale').hidden = false;
        el.querySelector('[data-autre-creneau]').focus();
    };
    var retourSelection = el.querySelector('[data-retour-selection]');
    if (retourSelection) retourSelection.onclick = function () {
        v3DireChevauchement('');
        ctx.choixType = ''; el.querySelector('#chevRemplacement').hidden = true;
        el.querySelector('#chevSelectionActions').hidden = true;
        el.querySelector('#chevEtapeInitiale').hidden = false;
        el.querySelector('[data-continuer-selection]').disabled = true;
        el.querySelector('[data-remplacer]').focus();
    };
    var retourRemplacement = el.querySelector('[data-retour-remplacement]');
    if (retourRemplacement) retourRemplacement.onclick = function () {
        v3DireChevauchement('');
        el.querySelector('#chevRemplacement').hidden = true;
        el.querySelector('#chevEtapeInitiale').hidden = false;
        el.querySelector('[data-remplacer]').focus();
    };
    el.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') { event.preventDefault(); v3FermerChoixChevauchement(); }
        if (event.key !== 'Tab') return;
        var actifs = Array.from(el.querySelectorAll('button:not([hidden]):not(:disabled), input:not([hidden]):not(:disabled), select:not([hidden]):not(:disabled)')).filter(function (item) {
            return item.getClientRects().length > 0;
        });
        if (!actifs.length) return;
        var first = actifs[0], last = actifs[actifs.length - 1];
        if (event.shiftKey && (document.activeElement === first || actifs.indexOf(document.activeElement) === -1)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || actifs.indexOf(document.activeElement) === -1)) { event.preventDefault(); first.focus(); }
    });
    el.addEventListener('click', function (event) { if (event.target === el) v3FermerChoixChevauchement(); });
    majFin();
    // L'observateur d'accessibilité doit d'abord repérer cette nouvelle
    // fenêtre, sinon le focus peut être renvoyé vers la fenêtre précédente.
    setTimeout(function () {
        if (el.isConnected && !el.contains(document.activeElement)) el.querySelector('#chevTitre').focus({ preventScroll: true });
    }, 0);
}

// ═══════════════════════════════════════════════════════════════════
//  4. DÉPLACEMENT D'UNE ACTIVITÉ DANS LA JOURNÉE
//  Un clic droit sur une activité fait apparaître une poignée : on la
//  fait glisser sur une autre activité pour lui donner son heure de
//  début. La durée ne change jamais : seules les heures de début et de
//  fin suivent. Rien n'est annoncé : si l'endroit est impossible
//  (pendant les cours, au-delà de minuit), l'activité ne bouge pas.
// ═══════════════════════════════════════════════════════════════════
var v3DeplaceIdx = -1;
var v3DeplaceEnCours = false;
var v3DeplaceCibleIdx = -1;

function v3CarteEvenement(idx) {
    var conteneur = document.getElementById('eventsContainer');
    if (!conteneur || !(idx >= 0)) return null;
    return conteneur.querySelector('[data-v3-idx="' + idx + '"]');
}

function v3EvenementAffiche(idx) {
    if (typeof v3LastRendered === 'undefined' || !v3LastRendered) return null;
    return v3LastRendered[idx] || null;
}

function v3CarteDeplacable(carte) {
    if (!planningJourModifiable(selectedDay) || !carte) return false;
    var idx = parseInt(carte.getAttribute('data-v3-idx'), 10);
    var ev = v3EvenementAffiche(idx);
    return !!(ev && ev.editable);
}

function v3RetirerPoignee() {
    document.querySelectorAll('#eventsContainer .v3-pouce').forEach(function (el) {
        if (el.parentNode) el.parentNode.removeChild(el);
    });
    ['v3-carte-deplace', 'v3-carte-cible', 'v3-carte-glisse'].forEach(function (classe) {
        document.querySelectorAll('#eventsContainer .' + classe).forEach(function (el) {
            el.classList.remove(classe);
        });
    });
    document.body.classList.remove('v3-deplacement');
    v3DeplaceEnCours = false;
    v3DeplaceCibleIdx = -1;
}

function v3PoserPoignee(idx) {
    v3RetirerPoignee();
    var carte = v3CarteEvenement(idx);
    if (!v3CarteDeplacable(carte)) return;
    v3DeplaceIdx = idx;
    carte.classList.add('v3-carte-deplace');
    var pouce = document.createElement('button');
    pouce.type = 'button';
    pouce.className = 'v3-pouce';
    pouce.setAttribute('data-v3-pouce', String(idx));
    pouce.setAttribute('aria-label', 'Déplacer');
    pouce.textContent = '👍';
    pouce.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
    });
    pouce.addEventListener('pointerdown', v3DemarrerDeplacement);
    carte.appendChild(pouce);
}

function v3DemarrerDeplacement(event) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    var pouce = event.currentTarget;
    var idx = parseInt(pouce.getAttribute('data-v3-pouce'), 10);
    if (!(idx >= 0)) return;
    event.preventDefault();
    event.stopPropagation();
    v3DeplaceIdx = idx;
    v3DeplaceEnCours = true;
    v3DeplaceCibleIdx = -1;
    document.body.classList.add('v3-deplacement');
    var carte = v3CarteEvenement(idx);
    if (carte) carte.classList.add('v3-carte-glisse');
    document.addEventListener('pointermove', v3PendantDeplacement, true);
    document.addEventListener('pointerup', v3TerminerDeplacement, true);
    document.addEventListener('pointercancel', v3FermerDeplacement, true);
}

function v3CarteSousPointeur(clientX, clientY) {
    var conteneur = document.getElementById('eventsContainer');
    if (!conteneur) return null;
    var meilleure = null;
    var meilleureDistance = Infinity;
    var meilleureHauteur = 0;
    conteneur.querySelectorAll('[data-v3-idx]').forEach(function (carte) {
        var idx = parseInt(carte.getAttribute('data-v3-idx'), 10);
        if (idx === v3DeplaceIdx) return;
        if (!v3CarteDeplacable(carte)) return;
        var rect = carte.getBoundingClientRect();
        if (!rect.height) return;
        var dx = 0;
        if (clientX < rect.left) dx = rect.left - clientX;
        else if (clientX > rect.right) dx = clientX - rect.right;
        var dy = Math.abs(clientY - (rect.top + rect.height / 2));
        var distance = dy + dx * 0.7;
        if (distance < meilleureDistance) {
            meilleureDistance = distance;
            meilleure = carte;
            meilleureHauteur = rect.height;
        }
    });
    if (!meilleure) return null;
    if (meilleureDistance > meilleureHauteur * 1.35 + 40) return null;
    return meilleure;
}

function v3PendantDeplacement(event) {
    if (!v3DeplaceEnCours) return;
    event.preventDefault();
    var carte = v3CarteSousPointeur(event.clientX, event.clientY);
    var idx = carte ? parseInt(carte.getAttribute('data-v3-idx'), 10) : -1;
    if (idx === v3DeplaceCibleIdx) return;
    document.querySelectorAll('#eventsContainer .v3-carte-cible').forEach(function (el) {
        el.classList.remove('v3-carte-cible');
    });
    v3DeplaceCibleIdx = idx;
    if (carte) carte.classList.add('v3-carte-cible');
}

function v3FermerDeplacement() {
    document.removeEventListener('pointermove', v3PendantDeplacement, true);
    document.removeEventListener('pointerup', v3TerminerDeplacement, true);
    document.removeEventListener('pointercancel', v3FermerDeplacement, true);
    v3RetirerPoignee();
}

function v3TerminerDeplacement() {
    if (!v3DeplaceEnCours) {
        v3FermerDeplacement();
        return;
    }
    var source = v3DeplaceIdx;
    var cible = v3DeplaceCibleIdx;
    v3FermerDeplacement();
    if (source >= 0 && cible >= 0) v3DonnerHoraireCible(source, cible);
}

// L'activité garde exactement la même durée : elle prend l'heure de début
// de l'activité visée, et l'heure de fin suit.
function v3DonnerHoraireCible(sourceIdx, cibleIdx) {
    if (!planningJourModifiable(selectedDay)) return false;
    var voulu = v3EvenementAffiche(sourceIdx);
    var cible = v3EvenementAffiche(cibleIdx);
    if (!voulu || !cible || !voulu.editable) return false;
    if (voulu.startTime === cible.startTime) return false;
    var duree = v3DureeHoraire(voulu.startTime, voulu.endTime);
    if (!(duree > 0)) return false;
    var debut = cible.startTime;
    var finMins = timeToMinutes(debut) + duree;
    if (finMins >= 1440) return false;
    var fin = addMinutes('00:00', finMins);
    if (v3SommeilInterdit(debut, fin, selectedDay)) { v3Toast('Le sommeil est protégé : choisis un autre horaire.', 'warn'); return false; }
    var conflits = v3ConflitsCreneau(selectedDay, debut, fin, [voulu.id]);
    if (conflits.length) {
        editingEvent = { id: voulu.id, title: voulu.title, startTime: voulu.startTime,
            endTime: voulu.endTime, type: voulu.type, icon: voulu.icon, kind: voulu.kind };
        v3OuvrirChoixChevauchement({ mode: 'edition', day: selectedDay,
            title: voulu.title, icon: voulu.icon, type: voulu.type,
            start: debut, end: fin, origineStart: voulu.startTime, origineEnd: voulu.endTime,
            excludeIds: [voulu.id], conflits: conflits });
        return true;
    }
    var validation = validateNewEventTime(debut, fin, selectedDay);
    if (!validation || !validation.valid) return false;
    if (typeof v3DeplacerEvenement !== 'function') return false;
    v3DeplacerEvenement(voulu, selectedDay, debut, fin);
    if (voulu.exoId && typeof customEvents !== 'undefined') {
        customEvents.forEach(function (item) {
            if (v3PorteeEvenement(item, selectedDay) && item.replacesId === voulu.id && !item.exoId) item.exoId = voulu.exoId;
        });
    }
    try { localStorage.setItem('studyPlanIB_customEvents_juliss', JSON.stringify(customEvents)); } catch (e) {}
    if (typeof v3Save === 'function') v3Save();
    if (typeof v3SyncExoLabels === 'function') { try { v3SyncExoLabels(); } catch (e) {} }
    if (typeof renderPlanning === 'function') renderPlanning();
    return true;
}

(function v3BrancherDeplacement() {
    if (typeof document === 'undefined' || window.__v3DeplacementBranche) return;
    window.__v3DeplacementBranche = true;
    document.addEventListener('contextmenu', function (event) {
        var carte = event.target && event.target.closest ? event.target.closest('#eventsContainer [data-v3-idx]') : null;
        if (!carte || !v3CarteDeplacable(carte)) return;
        event.preventDefault();
        v3PoserPoignee(parseInt(carte.getAttribute('data-v3-idx'), 10));
    });
    document.addEventListener('pointerdown', function (event) {
        if (v3DeplaceEnCours || v3DeplaceIdx < 0) return;
        var dansPoignee = event.target && event.target.closest ? event.target.closest('#eventsContainer .v3-pouce') : null;
        if (dansPoignee) return;
        var carte = event.target && event.target.closest ? event.target.closest('#eventsContainer [data-v3-idx]') : null;
        if (carte && parseInt(carte.getAttribute('data-v3-idx'), 10) === v3DeplaceIdx) return;
        v3DeplaceIdx = -1;
        v3RetirerPoignee();
    }, true);
    document.addEventListener('keydown', function (event) {
        if (event.key !== 'Escape' || v3DeplaceIdx < 0) return;
        v3DeplaceIdx = -1;
        v3FermerDeplacement();
    });
})();

/* L'icône de la semaine est posée dès le chargement, sans attendre le planning. */
if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', v3PeindreIconeActivites);
    else v3PeindreIconeActivites();
}

/* Les choix d'activités de l'inscription respectent la même limite que le
   planning, y compris les échanges dans leur fenêtre de chevauchement. */
(function v3ProtegerActivitesSommeil() {
    function interdit(start, end, day) { return !start || !end || timeToMinutes(end) <= timeToMinutes(start) || v3SommeilInterdit(start, end, day); }
    function avertir() {
        var cible = document.getElementById('schoolWarning');
        if (!cible) return;
        var message = document.createElement('div');
        message.id = 'activiteSommeilWarning'; message.setAttribute('role', 'alert');
        message.style.cssText = 'position:fixed;top:1rem;left:50%;transform:translateX(-50%);z-index:500;background:#fff8e8;border:2px solid #edcf84;color:#634b1e;padding:1rem;border-radius:1rem;max-width:90%;';
        message.textContent = 'Choisis une heure de fin après le début, entre le réveil et le coucher : le sommeil est protégé.';
        var ancien = document.getElementById(message.id); if (ancien) ancien.remove();
        document.body.appendChild(message); setTimeout(function () { message.remove(); }, 5000);
    }
    var toggleJour = window.toggleActivityDay;
    window.toggleActivityDay = function (name, day) {
        var act = selectedActivities.find(function (e) { return e.name === name; });
        if (act && !act.days.includes(day)) { var slot = creneauActivite(act, day); if (slot && interdit(slot.start, slot.end, day)) { avertir(); return; } }
        return toggleJour.apply(this, arguments);
    };
    var update = window.updateActivityTime;
    window.updateActivityTime = function (name, field, value, days) {
        var act = selectedActivities.find(function (e) { return e.name === name; });
        if (act) {
            var s = field === 'startTime' ? value : act.startTime, e = field === 'endTime' ? value : act.endTime;
            if (((days && days.length) ? days : act.days).some(function (day) { return interdit(s,e,day); })) { avertir(); renderActivities(); return; }
        }
        return update.apply(this, arguments);
    };
    var updateJour = window.updateActivityDayTime;
    window.updateActivityDayTime = function (name, day, field, value) {
        var act = selectedActivities.find(function (e) { return e.name === name; });
        if (act) {
            var slot = act.dayTimes[day] || {start:act.startTime || '17:00',end:act.endTime || '19:00'};
            if (interdit(field === 'start' ? value : slot.start, field === 'end' ? value : slot.end, day)) { avertir(); renderActivities(); return; }
        }
        return updateJour.apply(this, arguments);
    };
    var toggleMeme = window.toggleSameTime;
    window.toggleSameTime = function (name) {
        var act = selectedActivities.find(function (e) { return e.name === name; });
        if (act && !act.sameTime && act.days.some(function (day) { return interdit(act.startTime,act.endTime,day); })) { avertir(); return; }
        return toggleMeme.apply(this, arguments);
    };
    var placer = window.poserCreneauActivite;
    window.poserCreneauActivite = function (act, day, start, end) { if (interdit(start,end,day)) { avertir(); return; } return placer.apply(this, arguments); };
    var appliquer = window.appliquerCreneauActivite;
    window.appliquerCreneauActivite = function (start, end) {
        var ctx = window.__activiteChevauchement;
        if (ctx && interdit(start,end,ctx.day)) { direChevauchementActivite('Le sommeil est protégé : choisis un autre horaire.'); return; }
        return appliquer.apply(this, arguments);
    };
    var remplacer = window.remplacerActiviteChevauchee;
    window.remplacerActiviteChevauchee = function (conflit) {
        var ctx = window.__activiteChevauchement;
        if (ctx && conflit && (interdit(ctx.start,ctx.end,ctx.day) || interdit(conflit.start,conflit.end,ctx.day))) {
            direChevauchementActivite('Le sommeil est protégé : choisis un autre horaire.'); return;
        }
        return remplacer.apply(this, arguments);
    };
    var propositions = window.propositionsCreneauActivite;
    window.propositionsCreneauActivite = function (day) { return propositions.apply(this, arguments).filter(function (p) { return !interdit(p.start,p.end,day); }); };
})();
