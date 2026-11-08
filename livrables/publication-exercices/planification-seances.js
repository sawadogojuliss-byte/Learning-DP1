/* Planification guidée : aucune écriture avant la confirmation d'une proposition. */
let exoPlanEtat = null;

function exoPlanDuree(minutes) {
    const m = Number(minutes) || 0;
    return m >= 60 ? Math.floor(m / 60) + ' h' + (m % 60 ? ' ' + (m % 60) + ' min' : '') : m + ' min';
}
function exoPlanConseil(exo) {
    const total = Math.max(15, Number(exo.duration) || 60);
    const nombre = Math.max(1, Math.min(8, Math.ceil(total / 45)));
    const minutes = Math.max(15, Math.ceil(total / nombre / 15) * 15);
    return { nombre, minutes };
}
function exoPlanPropositions(exo, nombre, minutes) {
    const deadline = exoLireDate(exo.deadline);
    if (!deadline || exo.done || !Number.isInteger(nombre) || nombre < 1 || nombre > 8 ||
        !Number.isInteger(minutes) || minutes < 15 || minutes > 180 || minutes % 15) return [];
    const today = new Date(), candidats = [];
    for (let d = 0; d < 14; d++) {
        const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + d, 12);
        if (date >= deadline) break;
        const planDay = (date.getDay() + 6) % 7;
        if (typeof holidayMode === 'function' && holidayMode(planDay, date) === 'free') continue;
        const dateKey = exoDateLocale(date), dateStr = date.toLocaleDateString('fr-FR', {weekday:'short',day:'numeric',month:'long'});
        for (const gap of getRealFreeSlots(planDay, minutes, date, exo.id)) {
            const debut = Math.ceil(gap.startMins / 15) * 15;
            for (let m = debut; m + minutes <= gap.endMins; m += 15) {
                candidats.push({dateKey, planDay, dateStr, startTime:addMinutes('00:00',m), endTime:addMinutes('00:00',m + minutes), duration:minutes, startMins:m});
            }
        }
    }
    // Une même journée peut contenir plusieurs séances, séparées d'au moins 15 min.
    function compatible(part, autres) { return autres.every(p => p.dateKey !== part.dateKey ||
        part.startMins >= p.startMins + minutes + 15 || p.startMins >= part.startMins + minutes + 15); }
    const options = [], vus = new Set();
    for (let i = 0; i < candidats.length && options.length < 5; i++) {
        const seed = candidats[i];
        const parties = [seed];
        // Favoriser la répartition sur plusieurs jours ; si ce n'est pas
        // suffisant, compléter avec des séances distinctes le même jour.
        for (const p of candidats.slice(i + 1)) {
            if (parties.length >= nombre) break;
            if (!parties.some(x => x.dateKey === p.dateKey) && compatible(p, parties)) parties.push(p);
        }
        for (const p of candidats.slice(i + 1)) {
            if (parties.length >= nombre) break;
            if (compatible(p, parties)) parties.push(p);
        }
        if (parties.length !== nombre) {
            // La répartition sur des jours différents est une préférence,
            // pas une raison de manquer une solution sur une même journée.
            parties.splice(1);
            for (const p of candidats.slice(i + 1)) {
                if (parties.length >= nombre) break;
                if (compatible(p, parties)) parties.push(p);
            }
        }
        if (parties.length !== nombre) continue;
        parties.sort((a,b)=>a.dateKey.localeCompare(b.dateKey)||a.startMins-b.startMins);
        const signature = parties.map(p=>p.dateKey+'@'+p.startTime+'-'+p.endTime).join('|');
        if (vus.has(signature)) continue;
        vus.add(signature);
        const total = nombre * minutes;
        const label = parties.length === 1 ? parties[0].dateStr + ' · ' + parties[0].startTime + ' – ' + parties[0].endTime + ' (' + total + ' min)' :
            parties.map((p, index) => 'P' + (index+1) + ' ' + p.dateStr + ' ' + p.startTime + '–' + p.endTime).join(' · ') + ' (' + total + '/' + total + ' min)';
        options.push({parts:parties, signature, label});
    }
    return options;
}
function exoPlanEnregistrer(exo, signature, nombre, minutes) {
    if (!exo || exo.done || typeof customEvents === 'undefined') return false;
    // Les places peuvent changer pendant la consultation : tout recalculer.
    const option = exoPlanPropositions(exo, nombre, minutes).find(p=>p.signature===signature);
    if (!option) {
        exoPlanEtat.message = 'Ces horaires ne sont plus disponibles. Relance la recherche : rien n’a été modifié.';
        exoPlanEtat.options = null; renderPlanifier(); return false;
    }
    const avant = customEvents.slice(), ancien = {slot:exo.scheduledSlot, version:exo.planVersion, minutes:exo.planMinutes, etat:exo.etatAt};
    const version = exoNouveauId();
    try {
        customEvents = customEvents.filter(e=>!e || e.exoId !== exo.id);
        option.parts.forEach((p, i)=>customEvents.push({id:exoNouveauId(),day:p.planDay,date:p.dateKey,
            title:'Exercices ' + exo.subject + (option.parts.length > 1 ? ' (Partie ' + (i+1) + '/' + option.parts.length + ')' : ''),
            startTime:p.startTime,endTime:p.endTime,type:'study',icon:exo.subjectIcon,source:'exercice',exoId:exo.id,
            planVersion:version,pinned:true,timestamp:Date.now()+i}));
        exo.scheduledSlot=option.label; exo.planVersion=version; exo.planMinutes=nombre*minutes; exo.etatAt=new Date().toISOString();
        // Vérifier les journées reconstruites avant toute sauvegarde : une
        // proposition ne doit pas masquer ou chevaucher un événement réel.
        if (typeof emploiNePasSauver !== 'undefined') emploiNePasSauver++;
        try {
            for (const p of option.parts) {
                const date=exoLireDate(p.dateKey), evenements=generateDayEvents(p.planDay,date);
                const poses=evenements.filter(e=>e && e.exoId===exo.id && e.planVersion===version);
                if (!poses.some(e=>e.startTime===p.startTime && e.endTime===p.endTime)) throw new Error('Séance non visible');
                if (evenements.some(e=>e && e.exoId!==exo.id && e.startTime && e.endTime &&
                    timeToMinutes(p.startTime)<timeToMinutes(e.endTime) && timeToMinutes(p.endTime)>timeToMinutes(e.startTime))) throw new Error('Horaire occupé');
            }
        } finally { if (typeof emploiNePasSauver !== 'undefined') emploiNePasSauver--; }
        refreshPlanningAfterExercise(option.parts[0]);
    } catch (e) {
        customEvents=avant; exo.scheduledSlot=ancien.slot; exo.planVersion=ancien.version; exo.planMinutes=ancien.minutes; exo.etatAt=ancien.etat;
        try { refreshPlanningAfterExercise(); } catch (ignore) {}
        exoPlanEtat.message='Ces séances ne peuvent plus être placées sans chevauchement. Rien n’a été changé : essaie une autre proposition.'; renderPlanifier(); return false;
    }
    exoPlanEtat={id:exo.id,termine:true}; planifyTarget=exo.id;
    exoMajBadge(); renderPlanifier(); renderExoList();
    if (typeof v3Toast==='function') v3Toast('Tes séances sont ajoutées au planning.', 'success');
    return true;
}
function exoPlanAction(action, id, btn) {
    const exo = exercices.find(e=>e.id===id && !e.done);
    if (action==='retour') { exoPlanEtat=null; planifyTarget=null; renderPlanifier(); return; }
    if (!exo) { exoPlanEtat=null; planifyTarget=null; renderPlanifier(); return; }
    if (action==='ouvrir') { exoPlanEtat={id:exo.id}; planifyTarget=exo.id; renderPlanifier(); return; }
    if (!exoPlanEtat || exoPlanEtat.id!==id) return;
    if (action==='auto') {
        const conseil=exoPlanConseil(exo), total=Math.max(15,Number(exo.duration)||60);
        const choix=[conseil].concat(Array.from({length:8},(_,i)=>i+1).filter(n=>n!==conseil.nombre).map(nombre=>({nombre,minutes:Math.max(15,Math.ceil(total/nombre/15)*15)}))
            .filter(c=>c.minutes<=180).sort((a,b)=>Math.abs(a.minutes-45)-Math.abs(b.minutes-45) || a.nombre-b.nombre));
        let options=[]; let retenu=conseil;
        for (const candidat of choix) {
            options=exoPlanPropositions(exo,candidat.nombre,candidat.minutes);
            if (options.length) { retenu=candidat; break; }
        }
        exoPlanEtat.nombre=retenu.nombre; exoPlanEtat.minutes=retenu.minutes; exoPlanEtat.auto=true;
        exoPlanEtat.message=''; exoPlanEtat.options=options; renderPlanifier(); return;
    } else if (action==='calcul') {
        const nombre=Number(document.getElementById('exoPlanNombre').value), minutes=Number(document.getElementById('exoPlanMinutes').value);
        if (!Number.isInteger(nombre) || nombre<1 || nombre>8 || !Number.isInteger(minutes) || minutes<15 || minutes>180 || minutes%15) {
            const erreur=document.getElementById('exoPlanErreur'); erreur.textContent='Choisis entre 1 et 8 séances, de 15 à 180 minutes par pas de 15 minutes.'; return;
        }
        exoPlanEtat.nombre=nombre; exoPlanEtat.minutes=minutes; exoPlanEtat.auto=false;
    } else if (action==='modifier') { exoPlanEtat.options=null; exoPlanEtat.termine=false; exoPlanEtat.message=''; renderPlanifier(); return; }
    else if (action==='choisir') { exoPlanEnregistrer(exo, btn.dataset.signature, exoPlanEtat.nombre, exoPlanEtat.minutes); return; }
    else return;
    exoPlanEtat.message=''; exoPlanEtat.options=exoPlanPropositions(exo,exoPlanEtat.nombre,exoPlanEtat.minutes); renderPlanifier();
}
function exoPlanBouton(action,id,contenu,classe) {
    return '<button type="button" class="'+classe+'" data-exo-action="'+action+'" data-exo-id="'+exoEscape(id)+'">'+contenu+'</button>';
}
function renderPlanifier() {
    const container=document.getElementById('planifierContent'); if (!container) return;
    const restants=exoRestants().slice().sort((a,b)=>String(a.deadline).localeCompare(String(b.deadline)));
    if (!restants.length) { exoPlanEtat=null; planifyTarget=null; container.innerHTML='<div class="epn-empty"><span aria-hidden="true">✦</span><h3>Un peu de place pour avancer</h3><p>Ajoute un exercice à faire pour préparer tes prochaines séances.</p><button type="button" onclick="switchExoTab(\'ajouter\')">Ajouter un exercice</button></div>'; return; }
    if (!exoPlanEtat && planifyTarget && restants.some(e=>e.id===planifyTarget)) exoPlanEtat={id:planifyTarget};
    const choisi=exoPlanEtat && restants.find(e=>e.id===exoPlanEtat.id);
    if (!choisi) {
        exoPlanEtat=null; planifyTarget=null;
        container.innerHTML='<div class="epn-intro"><div><span>UNE ÉTAPE À LA FOIS</span><h3>Quel exercice veux-tu planifier ?</h3><p>Choisis un exercice, puis compose tes séances à ton rythme.</p></div><span class="epn-count">'+restants.length+' à faire</span></div>' +
        '<div class="epn-list">'+restants.map(exo=>{
            const dl=exoLireDate(exo.deadline), date=dl?dl.toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'}):'date à vérifier';
            return '<button type="button" class="epn-exercice" data-exo-action="ouvrir" data-exo-id="'+exoEscape(exo.id)+'"><span class="epn-exo-icon" aria-hidden="true">'+iconeHtml(exo.subjectIcon || '📚','1.25rem')+'</span><span class="epn-exo-info"><strong>'+exoEscape(exo.subject)+'</strong><span>'+exoEscape(exo.filename||exo.text||'Exercice')+'</span><small>À terminer avant le '+exoEscape(date)+' · durée estimée : '+exoPlanDuree(exo.duration)+'</small></span><span class="epn-exo-right">'+(exo.scheduledSlot?'<small>Planifié</small>':'<small>À planifier</small>')+'<b aria-hidden="true">→</b></span></button>';
        }).join('')+'</div>'; return;
    }
    const exo=choisi, conseil=exoPlanConseil(exo), etat=exoPlanEtat;
    const nombre=etat.nombre||conseil.nombre, minutes=etat.minutes||conseil.minutes;
    let html=exoPlanBouton('retour',exo.id,'← Tous mes exercices','epn-back') +
        '<div class="epn-selected"><span class="epn-selected-icon" aria-hidden="true">'+iconeHtml(exo.subjectIcon || '📚','1.35rem')+'</span><div><small>TON EXERCICE</small><h3>'+exoEscape(exo.subject)+'</h3><p>'+exoEscape(exo.filename||exo.text||'Exercice')+'</p></div></div>';
    if (exo.scheduledSlot && !(typeof customEvents !== 'undefined' && customEvents.some(e=>e && e.exoId===exo.id && !e.date))) html+=exoCartePlanifiee(exo.scheduledSlot);
    if (etat.termine) {
        html+='<div class="epn-success"><strong>Tout est prêt !</strong><p>Tes séances sont enregistrées dans ton planning. Tu peux les retrouver ci-dessus.</p></div>' +
            exoPlanBouton('modifier',exo.id,'Modifier mes séances','epn-secondary');
    } else {
        html+='<div class="epn-setup"><div class="epn-setup-heading"><span>01</span><div><h3>Comment veux-tu avancer ?</h3><p>Choisis le nombre de séances et leur durée, ou laisse Studyplan te guider.</p></div></div>' +
            '<div class="epn-fields"><label for="exoPlanNombre">Nombre de séances<input type="number" id="exoPlanNombre" min="1" max="8" step="1" value="'+nombre+'"></label><label for="exoPlanMinutes">Durée par séance<select id="exoPlanMinutes">'+Array.from({length:12},(_,i)=>(i+1)*15).map(m=>'<option value="'+m+'"'+(m===minutes?' selected':'')+'>'+exoPlanDuree(m)+'</option>').join('')+'</select></label></div>' +
            '<p class="epn-hint">Estimation de départ : '+exoPlanDuree(exo.duration)+'. Le total choisi peut être différent ; les horaires seront proposés avant confirmation.</p><p id="exoPlanErreur" class="epn-error" role="alert">'+exoEscape(etat.message||'')+'</p><div class="epn-setup-actions">'+
            exoPlanBouton('calcul',exo.id,'Voir mes propositions <span aria-hidden="true">→</span>','epn-primary') +
            exoPlanBouton('auto',exo.id,'✦ Laisser Studyplan décider','epn-secondary')+'</div></div>';
        if (etat.options) {
            const total=etat.nombre*etat.minutes;
            html+='<div class="epn-results"><div class="epn-results-head"><span>02</span><div><h3>Voici tes propositions</h3><p>'+(etat.auto?'Suggestion Studyplan · ':'')+etat.nombre+' séance'+(etat.nombre>1?'s':'')+' de '+exoPlanDuree(etat.minutes)+' · '+exoPlanDuree(total)+' au total'+(total!==Number(exo.duration)?' (estimation initiale : '+exoPlanDuree(exo.duration)+')':'')+'</p></div></div>' +
                (etat.options.length ? '<p class="epn-results-note">Les séances sont placées avant la date limite, dans les créneaux libres. Rien ne change avant confirmation.</p><div class="epn-options">'+etat.options.map((option,i)=>'<div class="epn-option"><div class="epn-option-top"><span>OPTION '+(i+1)+'</span><strong>'+etat.nombre+' séance'+(etat.nombre>1?'s':'')+'</strong></div>'+exoCarteParties(option.parts)+'<button type="button" class="epn-primary" data-exo-action="choisir" data-exo-id="'+exoEscape(exo.id)+'" data-signature="'+exoEscape(option.signature)+'">Confirmer ces séances <span aria-hidden="true">→</span></button></div>').join('')+'</div>' : '<p class="epn-no-slot">Aucune proposition complète avec ces séances avant la date limite, dans les 14 prochains jours. Essaie une autre durée ou un autre nombre : rien n’a été modifié.</p>') + '</div>';
        }
    }
    container.innerHTML=html;
}
