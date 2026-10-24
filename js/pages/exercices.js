/* ============================================================
   PAGE Exercices
   Ajout, liste et planification des devoirs.
   Vue : pages/exercices.html
   ============================================================ */

// ── PAGE EXERCICES ───────────────────────────────────────────
let exercices = [];
let selectedExoSubject = null;
let exoDuration = 60;
let planifyTarget = null;
let exoFiltre = 'tous';

function exoRestants() { return exercices.filter(e => !e.done); }
function exoMajBadge() {
    const restant = exoRestants().length;
    const badge = document.getElementById('exoCountBadge');
    if (badge) badge.textContent = restant + ' exercice' + (restant > 1 ? 's' : '') + ' à faire';
}

/* Le filtre ne modifie jamais les exercices : on peut toujours revenir
   à Tous ou décocher un exercice terminé. */
function filtrerExos(filtre) {
    if (!['tous', 'afaire', 'faits'].includes(filtre)) return;
    exoFiltre = filtre;
    document.querySelectorAll('[data-exo-filtre]').forEach(btn => {
        const actif = btn.getAttribute('data-exo-filtre') === filtre;
        btn.setAttribute('aria-pressed', String(actif));
        btn.style.background = actif ? '#ecfdf5' : 'white';
        btn.style.borderColor = actif ? '#10b981' : '#e5e7eb';
        btn.style.color = actif ? '#047857' : '#374151';
    });
    renderExoList();
}

function basculerExoFait(id) {
    const exo = exercices.find(e => e.id === id);
    if (!exo) return;
    exo.done = !exo.done;
    localStorage.setItem('studyPlanIB_exercices', JSON.stringify(exercices));
    exoMajBadge();
    renderExoList();
    renderPlanifier();
    /* Le rendu remplace la carte : rendre le focus à l'action inverse,
       ou au filtre qui permet de la retrouver. */
    const bouton = document.querySelector('[data-exo-fait="' + id + '"]');
    const suivant = bouton || document.querySelector('[data-exo-filtre="' + (exo.done ? 'faits' : 'afaire') + '"]');
    if (suivant) suivant.focus();
}

function exoEffacerErreur(champ) {
    const ids = { matiere: 'exoSubjectErreur', contenu: 'exoContenuErreur', date: 'exoDeadlineErreur' };
    const id = ids[champ];
    const zone = document.getElementById(id);
    if (zone) zone.textContent = '';
    const entree = document.getElementById(champ === 'matiere' ? 'exoSubjectGrid' : champ === 'contenu' ? 'exoTextInput' : 'exoDeadline');
    if (entree) entree.removeAttribute('aria-invalid');
}

function exoSignalerErreur(champ, texte) {
    exoEffacerErreur(champ);
    const ids = { matiere: 'exoSubjectErreur', contenu: 'exoContenuErreur', date: 'exoDeadlineErreur' };
    const entree = document.getElementById(champ === 'matiere' ? 'exoSubjectGrid' : champ === 'contenu' ? 'exoTextInput' : 'exoDeadline');
    const zone = document.getElementById(ids[champ]);
    if (zone) zone.textContent = texte;
    if (entree) entree.setAttribute('aria-invalid', 'true');
    const cible = champ === 'matiere' ? (entree.querySelector('button') || entree) : entree;
    if (cible) cible.focus();
}

function initExercices() {
    buildExoSubjectGrid();
    renderExoList();
    renderPlanifier();
    // Set min date to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('exoDeadline').min = today;
    document.getElementById('exoDeadline').value = '';
    switchExoTab('ajouter');
    exoMajBadge();
}

function buildExoSubjectGrid() {
    const allSubj = typeof subjects !== 'undefined' ? [...subjects, ...(optionalSubjects||[])] : [];
    const grid = document.getElementById('exoSubjectGrid');
    if (!grid) return;
    grid.innerHTML = allSubj.map((s, i) =>
        '<button onclick="selectExoSubject(' + i + ')" data-exo-idx="' + i + '" style="display:flex;align-items:center;gap:0.375rem;padding:0.5rem 0.875rem;border-radius:9999px;border:2px solid #e5e7eb;background:white;cursor:pointer;font-size:0.8rem;font-weight:600;color:#374151;transition:all 0.2s;">' +
        '<span>' + iconeHtml(s.icon, '1.15rem') + '</span><span>' + s.name + '</span>' +
        '</button>'
    ).join('');
}

function selectExoSubject(idx) {
    const allSubj = typeof subjects !== 'undefined' ? [...subjects, ...(optionalSubjects||[])] : [];
    selectedExoSubject = allSubj[idx];
    if (selectedExoSubject) exoEffacerErreur('matiere');
    document.querySelectorAll('[data-exo-idx]').forEach((btn, i) => {
        if (i === idx) { btn.style.background = '#ecfdf5'; btn.style.borderColor = '#10b981'; btn.style.color = '#059669'; }
        else { btn.style.background = 'white'; btn.style.borderColor = '#e5e7eb'; btn.style.color = '#374151'; }
    });
}

function setExoDuration(dur) {
    exoDuration = dur;
    document.getElementById('exoDurationSlider').value = dur;
    document.getElementById('exoDurationLabel').textContent = dur >= 60 ? Math.floor(dur/60)+'h'+(dur%60?dur%60+'min':'') : dur+'min';
    document.querySelectorAll('.dur-btn').forEach(btn => {
        const isSel = btn.textContent.trim() === (dur===30?'30 min':dur===45?'45 min':dur===60?'1h':'1h30');
        btn.style.borderColor = isSel ? '#10b981' : '#e5e7eb';
        btn.style.background = isSel ? '#ecfdf5' : 'white';
        btn.style.color = isSel ? '#059669' : '#374151';
    });
}

function updateExoDurationFromSlider(val) {
    exoDuration = parseInt(val);
    const dur = exoDuration;
    document.getElementById('exoDurationLabel').textContent = dur >= 60 ? Math.floor(dur/60)+'h'+(dur%60?dur%60+'min':'') : dur+'min';
    document.querySelectorAll('.dur-btn').forEach(btn => {
        const isSel = (dur===30&&btn.textContent.trim()==='30 min')||(dur===45&&btn.textContent.trim()==='45 min')||(dur===60&&btn.textContent.trim()==='1h')||(dur===90&&btn.textContent.trim()==='1h30');
        btn.style.borderColor = isSel ? '#10b981' : '#e5e7eb';
        btn.style.background = isSel ? '#ecfdf5' : 'white';
        btn.style.color = isSel ? '#059669' : '#374151';
    });
}

// Drag & Drop
function handleDragOver(e) { e.preventDefault(); document.getElementById('dragArea').classList.add('dragging'); }
function handleDragLeave(e) { document.getElementById('dragArea').classList.remove('dragging'); }
function handleFileDrop(e) {
    e.preventDefault();
    document.getElementById('dragArea').classList.remove('dragging');
    const file = e.dataTransfer.files[0];
    if (file) showUploadedFile(file);
}
function handleFileSelect(e) { if (e.target.files[0]) showUploadedFile(e.target.files[0]); }
function showUploadedFile(file) {
    const el = document.getElementById('uploadedFileName');
    el.style.display = 'flex';
    el.innerHTML = '📎 <strong>' + file.name + '</strong> (' + (file.size/1024).toFixed(0) + ' Ko) <button onclick="clearUpload()" style="margin-left:auto;background:none;border:none;cursor:pointer;color:#dc2626;">✕</button>';
    el.setAttribute('data-filename', file.name);
    exoEffacerErreur('contenu');
}
function clearUpload() {
    document.getElementById('uploadedFileName').removeAttribute('data-filename');
    document.getElementById('uploadedFileName').style.display = 'none';
    document.getElementById('fileUploadInput').value = '';
}

function addExercice() {
    const text = document.getElementById('exoTextInput').value.trim();
    const fileEl = document.getElementById('uploadedFileName');
    const filename = fileEl.getAttribute('data-filename') || null;
    const deadline = document.getElementById('exoDeadline').value;

    if (!selectedExoSubject) { exoSignalerErreur('matiere', 'Choisis une matière avant d’ajouter cet exercice.'); return; }
    if (!text && !filename) { exoSignalerErreur('contenu', 'Décris ton exercice ou choisis un fichier.'); return; }
    if (!deadline) { exoSignalerErreur('date', 'Choisis une date limite.'); return; }

    const exo = {
        id: 'exo-' + Date.now(),
        subject: selectedExoSubject.name,
        subjectIcon: selectedExoSubject.icon,
        subjectGrade: selectedExoSubject.grade,
        text: text || filename,
        filename: filename,
        duration: exoDuration,
        deadline: deadline,
        done: false,
        addedAt: new Date().toISOString(),
        scheduledSlot: null
    };
    exercices.push(exo);
    localStorage.setItem('studyPlanIB_exercices', JSON.stringify(exercices));

    // Reset form
    ['matiere', 'contenu', 'date'].forEach(exoEffacerErreur);
    document.getElementById('exoTextInput').value = '';
    clearUpload();
    document.getElementById('exoDeadline').value = '';
    selectedExoSubject = null;
    document.querySelectorAll('[data-exo-idx]').forEach(b => { b.style.background='white';b.style.borderColor='#e5e7eb';b.style.color='#374151'; });
    exoDuration = 60; setExoDuration(60);

    exoMajBadge();

    // Show success
    showExoSuccess();
    switchExoTab('liste');
}

function showExoSuccess() {
    const toast = document.createElement('div');
    toast.style.cssText = 'position:fixed;bottom:2rem;left:50%;transform:translateX(-50%);background:linear-gradient(to right,#10b981,#059669);color:white;padding:0.875rem 1.5rem;border-radius:0.875rem;font-weight:700;font-size:0.9rem;z-index:200;box-shadow:0 8px 20px rgba(16,185,129,0.4);animation:fadeInUp 0.3s ease-out;';
    toast.textContent = '✅ Exercice ajouté avec succès !';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
}

function renderExoList() {
    const container = document.getElementById('exoListContainer');
    if (!container) return;
    const saved = localStorage.getItem('studyPlanIB_exercices');
    if (saved) try { const lus = JSON.parse(saved); if (Array.isArray(lus)) exercices = lus; } catch(e) {}
    exoMajBadge();

    if (exercices.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:3rem 1rem;color:#9ca3af;"><div style="font-size:3rem;margin-bottom:1rem;">📝</div><p style="font-weight:600;">Aucun exercice pour l\'instant</p><p style="font-size:0.85rem;margin-top:0.5rem;">Ajoute ton premier exercice dans l\'onglet ➕</p></div>';
        return;
    }

    // Trier par deadline sans masquer les exercices faits par défaut.
    const visibles = exercices.filter(e => exoFiltre === 'tous' || (exoFiltre === 'faits' ? !!e.done : !e.done));
    if (!visibles.length) {
        container.innerHTML = '<p style="text-align:center;padding:2rem 1rem;color:#6b7280;">' +
            (exoFiltre === 'faits' ? 'Aucun exercice fait pour l’instant.' : 'Aucun exercice à faire.') + '</p>';
        return;
    }
    const sorted = visibles.slice().sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
    const today = new Date(); today.setHours(0,0,0,0);

    container.innerHTML = sorted.map(exo => {
        const dl = new Date(exo.deadline);
        const diffDays = Math.ceil((dl - today) / 86400000);
        const urgency = diffDays <= 1 ? '#dc2626' : diffDays <= 3 ? '#d97706' : '#059669';
        const urgencyBg = diffDays <= 1 ? '#fef2f2' : diffDays <= 3 ? '#fffbeb' : '#ecfdf5';
        const urgencyLabel = diffDays <= 0 ? '⚠️ Aujourd\'hui !' : diffDays === 1 ? '⏰ Demain' : 'Dans ' + diffDays + 'j';
        const dur = exo.duration >= 60 ? Math.floor(exo.duration/60)+'h'+(exo.duration%60?exo.duration%60+'min':'') : exo.duration+'min';

        return '<div class="exo-card" style="margin-bottom:0.875rem;' + (exo.done ? 'background:#f0fdf4;border-color:#a7f3d0;' : '') + '">' +
            '<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:0.75rem;">' +
            '<div style="display:flex;align-items:center;gap:0.625rem;">' +
            '<span style="font-size:1.5rem;">' + iconeHtml(exo.subjectIcon, '1.5rem') + '</span>' +
            '<div><p style="font-weight:700;color:#111827;font-size:0.9rem;">' + exo.subject + '</p>' +
            '<p style="font-size:0.75rem;color:#6b7280;">' + (exo.filename ? '📎 ' + exo.filename : exo.text.substring(0,50) + (exo.text.length>50?'...':'')) + '</p></div></div>' +
            '<button onclick="deleteExo(\'' + exo.id + '\')" style="background:#fef2f2;border:none;border-radius:0.5rem;width:1.75rem;height:1.75rem;cursor:pointer;color:#dc2626;font-size:0.75rem;">✕</button>' +
            '</div>' +
            '<div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem;flex-wrap:wrap;">' +
            '<div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">' +
            '<span style="background:#f3f4f6;border-radius:9999px;padding:0.25rem 0.625rem;font-size:0.75rem;font-weight:600;color:#374151;">⏱️ ' + dur + '</span>' +
            (exo.done ? '<span style="background:#dcfce7;color:#166534;border-radius:9999px;padding:0.25rem 0.625rem;font-size:0.75rem;font-weight:700;">✓ Fait</span>' : '<span style="background:' + urgencyBg + ';color:' + urgency + ';border-radius:9999px;padding:0.25rem 0.625rem;font-size:0.75rem;font-weight:700;">' + urgencyLabel + '</span>') +
            (exo.scheduledSlot ? '<span style="background:#ecfdf5;color:#059669;border-radius:9999px;padding:0.25rem 0.625rem;font-size:0.75rem;font-weight:600;">✓ Planifié</span>' : '') +
            '</div>' +
            '<div style="display:flex;align-items:center;gap:0.4rem;flex-wrap:wrap;">' +
            '<button type="button" data-exo-fait="' + exo.id + '" onclick="basculerExoFait(\'' + exo.id + '\')" aria-pressed="' + !!exo.done + '" aria-label="' + (exo.done ? 'Remettre à faire : ' : 'Marquer fait : ') + exo.subject + '" style="background:' + (exo.done ? 'white' : '#ecfdf5') + ';color:#047857;border:1px solid #a7f3d0;border-radius:0.625rem;padding:0.375rem 0.75rem;font-size:0.75rem;font-weight:700;cursor:pointer;">' + (exo.done ? '↩ À faire' : '✓ Fait') + '</button>' +
            (exo.done ? '' : '<button onclick="openPlanifier(\'' + exo.id + '\')" style="background:linear-gradient(to right,#10b981,#059669);color:white;border:none;border-radius:0.625rem;padding:0.375rem 0.75rem;font-size:0.75rem;font-weight:700;cursor:pointer;">' +
            (exo.scheduledSlot ? '📅 Replanifier' : '+ Planifier') + '</button>') +
            '</div></div></div>';
    }).join('');
}

function deleteExo(id) {
    exercices = exercices.filter(e => e.id !== id);
    localStorage.setItem('studyPlanIB_exercices', JSON.stringify(exercices));
    exoMajBadge();
    renderExoList();
    renderPlanifier();
}

function renderPlanifier() {
    const container = document.getElementById('planifierContent');
    if (!container) return;
    if (exercices.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:3rem 1rem;color:#9ca3af;"><div style="font-size:3rem;margin-bottom:1rem;">📅</div><p style="font-weight:600;">Ajoute d\'abord des exercices</p><p style="font-size:0.85rem;margin-top:0.5rem;">Va dans l\'onglet ➕ pour commencer</p></div>';
        return;
    }

    // Global time estimate
    const restants = exoRestants();
    const totalMins = restants.reduce((s, e) => s + (Number(e.duration) || 0), 0);
    const totalH = Math.floor(totalMins / 60), totalM = totalMins % 60;
    const totalLabel = totalH > 0 ? totalH + 'h' + (totalM > 0 ? totalM + 'min' : '') : totalM + 'min';

    let html = '<div style="background:linear-gradient(135deg,#ecfdf5,#f0fdf4);border:1.5px solid #a7f3d0;border-radius:1rem;padding:1.25rem;margin-bottom:1.25rem;">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.75rem;">' +
        '<h4 style="font-weight:700;color:#064e3b;font-size:0.9rem;">📊 Résumé global</h4>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;">' +
        '<div style="background:white;border-radius:0.75rem;padding:0.75rem;text-align:center;"><p style="font-size:1.25rem;font-weight:800;color:#059669;">' + totalLabel + '</p><p style="font-size:0.7rem;color:#6b7280;">temps minimum total</p></div>' +
        '<div style="background:white;border-radius:0.75rem;padding:0.75rem;text-align:center;"><p style="font-size:1.25rem;font-weight:800;color:#3b82f6;">' + restants.length + '</p><p style="font-size:0.7rem;color:#6b7280;">exercice(s) restant(s)</p></div>' +
        '</div></div>';

    // Individual planifier
    const today = new Date(); today.setHours(0,0,0,0);
    if (!restants.length) html += '<p style="text-align:center;color:#047857;font-weight:700;">Tous les exercices sont faits !</p>';
    restants.slice().sort((a,b) => new Date(a.deadline)-new Date(b.deadline)).forEach(exo => {
        const dl = new Date(exo.deadline);
        const diffDays = Math.ceil((dl - today) / 86400000);
        const urgency = diffDays <= 1 ? '#dc2626' : diffDays <= 3 ? '#d97706' : '#059669';
        const dur = exo.duration >= 60 ? Math.floor(exo.duration/60)+'h'+(exo.duration%60?exo.duration%60+'min':'') : exo.duration+'min';
        const slots = findAvailableSlots(exo);

        html += '<div style="background:white;border:1.5px solid #e5e7eb;border-radius:1rem;padding:1.25rem;margin-bottom:1rem;">' +
            '<div style="display:flex;align-items:center;gap:0.625rem;margin-bottom:1rem;">' +
            '<span style="font-size:1.25rem;">' + iconeHtml(exo.subjectIcon, '1.25rem') + '</span>' +
            '<div><p style="font-weight:700;color:#111827;font-size:0.875rem;">' + exo.subject + ' · ' + (exo.filename || exo.text.substring(0,30)) + '</p>' +
            '<p style="font-size:0.75rem;color:' + urgency + ';font-weight:600;">⏱️ ' + dur + ' · Deadline : ' + dl.toLocaleDateString('fr-FR', {day:'numeric',month:'long'}) + '</p></div></div>' +
            '<p style="font-size:0.8rem;font-weight:600;color:#374151;margin-bottom:0.625rem;">Créneaux disponibles :</p>';

        if (slots.length === 0) {
            html += '<div style="background:#fef2f2;border-radius:0.75rem;padding:0.875rem;font-size:0.8rem;color:#dc2626;text-align:center;">⚠️ Aucun créneau à proposer avant la deadline.</div>';
        } else {
            // Show split info if needed
            const needsSplit = slots.some(s => s.isSplit);
            if (needsSplit) {
                html += '<div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:0.75rem;padding:0.625rem 0.875rem;margin-bottom:0.625rem;font-size:0.78rem;color:#92400e;">✂️ <strong>Découpage automatique :</strong> l\'exercice sera réparti sur plusieurs créneaux libres.</div>';
            }
            const hasReplace = slots.some(function (s) { return s.replace; });
            if (hasReplace) {
                html += '<div style="background:#fff7ed;border:1px solid #fdba74;border-radius:0.75rem;padding:0.625rem 0.875rem;margin-bottom:0.625rem;font-size:0.78rem;color:#9a3412;">🔄 <strong>Pas de temps libre.</strong> Ces créneaux seront remplacés pour faire l\'exercice. Le planning se met à jour dès que tu valides.</div>';
            }
            html += '<div style="display:flex;flex-direction:column;gap:0.5rem;">' +
                slots.map((slot, si) =>
                    '<button onclick="scheduleExo(\'' + exo.id + '\',' + si + ')" class="slot-chip' + (slot.isSplit ? ' split' : '') + '" style="text-align:left;' + (slot.replace ? 'border-color:#fdba74;background:#fff7ed;color:#9a3412;' : (slot.isSplit ? 'border-color:#fcd34d;background:#fffbeb;color:#92400e;' : '')) + '">' +
                    (slot.replace ? '🔄 Remplacer' : (slot.isSplit ? '✂️ ' : '✅ ')) + ' ' + slot.label +
                    '</button>'
                ).join('') + '</div>';
        }
        if (exo.scheduledSlot) {
            html += '<div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:0.75rem;padding:0.625rem 0.875rem;margin-top:0.75rem;font-size:0.8rem;color:#059669;font-weight:600;">✓ Planifié : ' + exo.scheduledSlot + '</div>';
        }
        html += '</div>';
    });

    container.innerHTML = html;
}

// ── MOTEUR DE PLANIFICATION EXERCICES ───────────────────────
// Analyse le vrai planning du jour pour trouver les plages libres
// Si l'exercice est trop long, il est découpé automatiquement en parties

function getRealFreeSlots(planDay, minDuration) {
    // Generate the real events for that day and find gaps
    const events = generateDayEvents(planDay);
    const BLOCKED = new Set(['sleep','wakeup']);
    const freeSlots = [];

    // Build occupied intervals (all non-sleep/non-wakeup events)
    const occupied = events
        .filter(e => !BLOCKED.has(e.id))
        .map(e => ({ s: timeToMinutes(e.startTime), e: timeToMinutes(e.endTime) }))
        .sort((a, b) => a.s - b.s);

    // Find gaps between events
    let scanFrom = timeToMinutes('06:00');
    const scanUntil = timeToMinutes('22:30');

    for (const occ of occupied) {
        if (occ.s > scanFrom) {
            const gapStart = scanFrom;
            const gapEnd = Math.min(occ.s, scanUntil);
            const gapDur = gapEnd - gapStart;
            if (gapDur >= minDuration) {
                freeSlots.push({
                    startMins: gapStart,
                    endMins: gapEnd,
                    duration: gapDur,
                    startTime: addMinutes('00:00', gapStart),
                    endTime: addMinutes('00:00', gapEnd)
                });
            }
        }
        scanFrom = Math.max(scanFrom, occ.e);
    }
    // Final gap
    if (scanFrom < scanUntil && (scanUntil - scanFrom) >= minDuration) {
        freeSlots.push({
            startMins: scanFrom, endMins: scanUntil, duration: scanUntil - scanFrom,
            startTime: addMinutes('00:00', scanFrom), endTime: addMinutes('00:00', scanUntil)
        });
    }
    return freeSlots;
}

function findAvailableSlots(exo) {
    const slots = [];
    const today = new Date();
    const deadline = new Date(exo.deadline);
    deadline.setHours(23, 59, 0, 0);
    const MIN_SLOT = 15; // minimum usable chunk in minutes

    for (let d = 0; d < 14 && slots.length < 8; d++) {
        const date = new Date(today);
        date.setDate(today.getDate() + d);
        if (date > deadline) break;

        const jsDay = date.getDay();
        const planDay = jsDay === 0 ? 6 : jsDay - 1;
        const freeSlots = getRealFreeSlots(planDay, MIN_SLOT);
        const d_label = d === 0 ? "Aujourd'hui" : d === 1 ? 'Demain'
            : ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'][jsDay] + ' ' + date.getDate() + '/' + (date.getMonth() + 1);

        for (const gap of freeSlots) {
            if (slots.length >= 8) break;
            const fitDur = Math.min(exo.duration, gap.duration);
            const endTime = addMinutes(gap.startTime, fitDur);
            const isFull = fitDur >= exo.duration;
            const isSplit = !isFull;
            slots.push({
                label: d_label + ' · ' + gap.startTime + ' – ' + endTime + (isSplit ? ' (partie 1/' + Math.ceil(exo.duration / gap.duration) + ')' : ''),
                planDay, startTime: gap.startTime, endTime,
                availDur: fitDur, neededDur: exo.duration,
                isSplit, gapDuration: gap.duration,
                dateStr: date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }),
                conflict: false
            });
        }
    }

    // If still no slots found and deadline forces it — emergency: split across multiple days
    if (slots.length === 0) {
        // Just pick next 3 days with any free time >= MIN_SLOT
        for (let d = 0; d < 21 && slots.length < 4; d++) {
            const date = new Date(today);
            date.setDate(today.getDate() + d);
            const jsDay = date.getDay();
            const planDay = jsDay === 0 ? 6 : jsDay - 1;
            const freeSlots = getRealFreeSlots(planDay, MIN_SLOT);
            if (freeSlots.length > 0) {
                const gap = freeSlots[0];
                const fitDur = Math.min(exo.duration, gap.duration);
                const endTime = addMinutes(gap.startTime, fitDur);
                const d_label = d === 0 ? "Aujourd'hui" : d === 1 ? 'Demain'
                    : ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'][jsDay] + ' ' + date.getDate() + '/' + (date.getMonth() + 1);
                slots.push({
                    label: d_label + ' · ' + gap.startTime + ' – ' + endTime + ' (partie)',
                    planDay, startTime: gap.startTime, endTime,
                    availDur: fitDur, neededDur: exo.duration,
                    isSplit: fitDur < exo.duration, gapDuration: gap.duration,
                    dateStr: date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }),
                    conflict: false
                });
            }
        }
    }
    if (slots.length === 0) slots.push.apply(slots, findReplacementSlots(exo));
    return slots;
}

function findReplacementSlots(exo) {
    const slots = [];
    const today = new Date();
    const deadline = new Date(exo.deadline);
    deadline.setHours(23, 59, 0, 0);
    const rank = { free: 0, rest: 1, phone: 2, ia: 3, memoir: 3, study: 4, critical: 4, warning: 4, activity: 5 };

    for (let d = 0; d < 14 && slots.length < 8; d++) {
        const date = new Date(today);
        date.setDate(today.getDate() + d);
        if (date > deadline) break;
        const jsDay = date.getDay();
        const planDay = jsDay === 0 ? 6 : jsDay - 1;
        if (typeof holidayMode === 'function' && holidayMode(planDay) === 'free') continue;
        let events = [];
        try { events = generateDayEvents(planDay); } catch (e) { events = []; }
        const candidates = events.filter(function (ev) {
            if (!ev || ev.id === 'wakeup' || ev.id === 'sleep') return false;
            return Object.prototype.hasOwnProperty.call(rank, ev.type);
        }).sort(function (a, b) { return rank[a.type] - rank[b.type]; });

        candidates.forEach(function (ev) {
            if (slots.length >= 8) return;
            let dur = timeToMinutes(ev.endTime) - timeToMinutes(ev.startTime);
            if (dur <= 0) dur += 1440;
            if (dur < 15) return;
            const fitDur = Math.min(exo.duration, dur);
            const endTime = addMinutes(ev.startTime, fitDur);
            const d_label = d === 0 ? "Aujourd'hui" : d === 1 ? 'Demain'
                : ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'][jsDay] + ' ' + date.getDate() + '/' + (date.getMonth() + 1);
            slots.push({
                replace: true,
                replacesId: ev.id,
                replacesTitle: ev.title,
                label: '« ' + ev.title + ' » · ' + d_label + ' · ' + ev.startTime + ' – ' + endTime,
                planDay: planDay,
                startTime: ev.startTime,
                endTime: endTime,
                availDur: fitDur,
                neededDur: exo.duration,
                isSplit: fitDur < exo.duration,
                gapDuration: dur,
                dateStr: date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }),
                conflict: false
            });
        });
    }
    return slots;
}

function applyExerciseSlot(exo, slot, title) {
    if (slot.replace && slot.replacesId) {
        customEvents = customEvents.filter(function (e) {
            if (!e || e.day !== slot.planDay) return true;
            if (e.replacesId === slot.replacesId) return false;
            if (!e.replacesId && e.id === slot.replacesId) return false;
            return true;
        });
        customEvents.push({
            id: 'del-' + slot.replacesId + '-' + slot.planDay,
            replacesId: slot.replacesId,
            day: slot.planDay,
            deleted: true,
            title: slot.replacesTitle || '',
            startTime: slot.startTime,
            endTime: slot.endTime,
            type: 'study'
        });
    }
    customEvents.push({
        id: generateEventId('study', title, slot.planDay),
        day: slot.planDay,
        title: title,
        startTime: slot.startTime,
        endTime: slot.endTime,
        type: 'study',
        icon: exo.subjectIcon,
        source: 'exercice',
        exoId: exo.id,
        pinned: true,
        timestamp: Date.now()
    });
}

function refreshPlanningAfterExercise(planDay) {
    if (typeof planDay === 'number') selectedDay = planDay;
    if (typeof v3Save === 'function') v3Save();
    else localStorage.setItem('studyPlanIB_customEvents_juliss', JSON.stringify(customEvents));
    localStorage.setItem('studyPlanIB_exercices', JSON.stringify(exercices));
    if (typeof renderPlanning === 'function' && document.getElementById('eventsContainer')) {
        try { renderPlanning(); } catch (e) { console.error(e); }
    }
}

function openPlanifier(exoId) {
    planifyTarget = exoId;
    switchExoTab('planifier');
    renderPlanifier();
}

function scheduleExo(exoId, slotIdx) {
    const exo = exercices.find(e => e.id === exoId);
    if (!exo) return;
    const slots = findAvailableSlots(exo);
    const slot = slots[slotIdx];
    if (!slot) return;

    // If split needed, schedule part 1 now and notify
    const part1Dur = slot.availDur;
    const remaining = exo.duration - part1Dur;

    // Add part 1 to planning, replacing the chosen slot when there was no free time
    applyExerciseSlot(exo, slot, 'Exercices ' + exo.subject + (slot.isSplit ? ' (Partie 1)' : ''));

    // If split: auto-schedule part 2 on the next free slot
    if (slot.isSplit && remaining > 0) {
        // Find next available slot for remaining duration
        const exoPart2 = { ...exo, duration: remaining };
        const nextSlots = findAvailableSlots(exoPart2).filter(s => s.planDay !== slot.planDay || timeToMinutes(s.startTime) > timeToMinutes(slot.endTime));
        if (nextSlots.length > 0) {
            const s2 = nextSlots[0];
            applyExerciseSlot(exo, s2, 'Exercices ' + exo.subject + ' (Partie 2)');
            exo.scheduledSlot = slot.dateStr + ' (P1) + ' + s2.dateStr + ' (P2)';
        } else {
            exo.scheduledSlot = slot.dateStr + ' (P1 — P2 à planifier)';
        }
    } else {
        exo.scheduledSlot = slot.dateStr + ' · ' + slot.startTime + '–' + slot.endTime;
    }

    exo.scheduledSlot = exo.scheduledSlot || slot.dateStr;
    refreshPlanningAfterExercise(slot.planDay);
    exoMajBadge();

    const toast = document.createElement('div');
    toast.style.cssText = 'position:fixed;bottom:2rem;left:50%;transform:translateX(-50%);background:linear-gradient(to right,#10b981,#059669);color:white;padding:0.875rem 1.5rem;border-radius:0.875rem;font-weight:700;font-size:0.85rem;z-index:200;box-shadow:0 8px 20px rgba(16,185,129,0.4);animation:fadeInUp 0.3s;max-width:92%;text-align:center;';
    toast.textContent = slot.replace
        ? '✅ « ' + (slot.replacesTitle || 'Créneau') + ' » remplacé. L\'exercice est dans le planning.'
        : (slot.isSplit
        ? '✅ Exercice découpé et planifié sur ' + exo.scheduledSlot
        : '✅ Planifié le ' + slot.dateStr + ' de ' + slot.startTime + ' à ' + slot.endTime);
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
    renderPlanifier();
    renderExoList();
    if (typeof rappelPublierExercice === 'function') rappelPublierExercice(exo, slot);
}

function switchExoTab(tab) {
    ['ajouter','liste','planifier'].forEach(t => {
        document.getElementById('tabContent' + t.charAt(0).toUpperCase() + t.slice(1)).style.display = t === tab ? 'block' : 'none';
        const btn = document.getElementById('tab' + t.charAt(0).toUpperCase() + t.slice(1));
        if (btn) {
            btn.style.background = t === tab ? 'white' : 'transparent';
            btn.style.color = t === tab ? '#059669' : '#6b7280';
            btn.style.boxShadow = t === tab ? '0 1px 3px rgba(0,0,0,0.1)' : 'none';
        }
    });
    if (tab === 'liste') renderExoList();
    if (tab === 'planifier') renderPlanifier();
}

// Load exercices from localStorage on init
(function() {
    const saved = localStorage.getItem('studyPlanIB_exercices');
    if (saved) try { exercices = JSON.parse(saved); } catch(e) {}
})();

// ── BRIDGE: make planning functions accessible from this script block ──
// addMinutes and timeToMinutes are defined in the first <script> block (inline in body)
// and are globally accessible since they are declared with function keyword.
// generateDayEvents is also global. No bridge needed — all window-scope functions.</script>
