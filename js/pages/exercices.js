/* ============================================================
   PAGE Exercices
   Ajout, liste et planification des devoirs.
   Vue : pages/exercices.html
   ============================================================ */

// ── PAGE EXERCICES ───────────────────────────────────────────
let exercices = [];
/* Le planning peut s'ouvrir avant la page Exercices : charger l'état dès
   ce module, sinon un exercice fait réapparaît au premier affichage. */
try {
    const sauvegardes = JSON.parse(localStorage.getItem('studyPlanIB_exercices') || '[]');
    if (Array.isArray(sauvegardes)) exercices = sauvegardes;
} catch (e) { console.warn('Exercices enregistrés illisibles', e); }
let selectedExoSubject = null;
let exoDuration = 60;
let planifyTarget = null;
let exoFiltre = 'tous';
const EXO_DRAFT_KEY = 'studyPlanIB_exoBrouillon';
function exoEscape(value) {
    return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function exoDateLocale(date) {
    const d = date || new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function exoLireDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null;
    const [y, m, d] = value.split('-').map(Number);
    const result = new Date(y, m - 1, d);
    return result.getFullYear() === y && result.getMonth() === m - 1 && result.getDate() === d ? result : null;
}
function exoSujets() {
    const list = typeof subjects !== 'undefined' ? [...subjects, ...(typeof optionalSubjects !== 'undefined' ? optionalSubjects : [])] : [];
    if (typeof ibYear !== 'undefined' && ibYear === 'DP2' && typeof devoirsFaitBac === 'function' && devoirsFaitBac() &&
        !list.some(s => s.name === 'Bac national')) list.push({ name: 'Bac national', icon: '🎓' });
    return list;
}
function exoSauvegarder() {
    localStorage.setItem('studyPlanIB_exercices', JSON.stringify(exercices));
    // La copie de compte (y compris l'état « Fait ») doit suivre l'action,
    // et non attendre la prochaine modification du planning.
    if ((typeof window === 'undefined' || !window.compteRestaurationEnCours) && typeof memoireSauvegarder === 'function') memoireSauvegarder();
}
function exoBrouillonSauver() {
    try {
        localStorage.setItem(EXO_DRAFT_KEY, JSON.stringify({ text: document.getElementById('exoTextInput').value,
            deadline: document.getElementById('exoDeadline').value, duration: exoDuration,
            subject: selectedExoSubject && selectedExoSubject.name }));
    } catch (e) {}
}
function exoBrouillonEffacer() {
    document.getElementById('exoTextInput').value = '';
    document.getElementById('exoDeadline').value = '';
    selectedExoSubject = null;
    buildExoSubjectGrid();
    setExoDuration(60);
    localStorage.removeItem(EXO_DRAFT_KEY);
}
function exoNouveauId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return 'exo-' + crypto.randomUUID();
    return 'exo-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
}
function exoBrancherActions() {
    [['exoListContainer', function (action, id) {
        if (action === 'fait') basculerExoFait(id);
        if (action === 'supprimer') deleteExo(id);
        if (action === 'planifier') openPlanifier(id);
    }], ['planifierContent', function (action, id, btn) {
        if (action === 'creneau') scheduleExo(id, Number(btn.dataset.exoSlot), btn.dataset.exoDate, btn.dataset.exoTime);
    }]].forEach(function (entry) {
        const zone = document.getElementById(entry[0]);
        if (!zone || zone.dataset.exoActions || typeof zone.addEventListener !== 'function') return;
        zone.dataset.exoActions = 'oui';
        zone.addEventListener('click', function (event) {
            const btn = event.target.closest('[data-exo-action]');
            if (btn && zone.contains(btn)) entry[1](btn.dataset.exoAction, btn.dataset.exoId, btn);
        });
    });
}


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
    exo.etatAt = new Date().toISOString();
    exoSauvegarder();
    exoMajBadge();
    renderExoList();
    renderPlanifier();
    if (typeof renderPlanning === 'function' && document.getElementById('eventsContainer')) renderPlanning();
    if (typeof focusPeindreAccueil === 'function' && document.getElementById('panelSeances')?.classList.contains('active')) focusPeindreAccueil();
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
    exoBrancherActions();
    try {
        const draft = JSON.parse(localStorage.getItem(EXO_DRAFT_KEY) || 'null');
        if (draft && typeof draft === 'object') {
            document.getElementById('exoTextInput').value = String(draft.text || '');
            document.getElementById('exoDeadline').value = String(draft.deadline || '');
            if (draft.duration >= 15 && draft.duration <= 180) exoDuration = Number(draft.duration);
            selectedExoSubject = exoSujets().find(s => s.name === draft.subject) || null;
        }
    } catch (e) {}
    buildExoSubjectGrid();
    setExoDuration(exoDuration);
    renderExoList();
    renderPlanifier();
    document.getElementById('exoDeadline').min = exoDateLocale();
    switchExoTab('ajouter');
    exoMajBadge();
}

function buildExoSubjectGrid() {
    const allSubj = exoSujets();
    const grid = document.getElementById('exoSubjectGrid');
    if (!grid) return;
    grid.innerHTML = allSubj.map((s, i) =>
        '<button type="button" onclick="selectExoSubject(' + i + ')" data-exo-idx="' + i + '" aria-pressed="' + (selectedExoSubject?.name === s.name) + '" style="display:flex;align-items:center;gap:0.375rem;padding:0.5rem 0.875rem;min-height:44px;border-radius:9999px;border:2px solid ' + (selectedExoSubject?.name === s.name ? '#047857' : '#e5e7eb') + ';background:' + (selectedExoSubject?.name === s.name ? '#ecfdf5' : 'white') + ';cursor:pointer;font-size:0.8rem;font-weight:600;color:#374151;">' +
        '<span>' + iconeHtml(s.icon, '1.15rem') + '</span><span>' + exoEscape(s.name) + '</span></button>'
    ).join('');
}

function selectExoSubject(idx) {
    selectedExoSubject = exoSujets()[idx] || null;
    if (selectedExoSubject) exoEffacerErreur('matiere');
    buildExoSubjectGrid();
    exoBrouillonSauver();
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
    exoBrouillonSauver();
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
    exoBrouillonSauver();
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
    el.replaceChildren();
    const name = document.createElement('strong');
    name.textContent = '📎 ' + file.name + ' (référence, fichier non conservé)';
    const clear = document.createElement('button');
    clear.type = 'button'; clear.textContent = 'Retirer'; clear.setAttribute('aria-label', 'Retirer la référence du fichier');
    clear.style.cssText = 'margin-left:auto;background:none;border:none;cursor:pointer;color:#dc2626;min-height:44px;';
    clear.addEventListener('click', clearUpload);
    el.append(name, clear);
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
    if (!exoLireDate(deadline) || deadline < exoDateLocale()) { exoSignalerErreur('date', 'Choisis une date limite valide, aujourd’hui ou plus tard.'); return; }

    const exo = {
        id: exoNouveauId(),
        subject: selectedExoSubject.name,
        subjectIcon: selectedExoSubject.icon,
        subjectGrade: selectedExoSubject.grade,
        text: text || filename,
        filename: filename,
        duration: exoDuration,
        deadline: deadline,
        done: false,
        addedAt: new Date().toISOString(),
        etatAt: new Date().toISOString(),
        scheduledSlot: null
    };
    exercices.push(exo);
    exoSauvegarder();

    // Reset form
    ['matiere', 'contenu', 'date'].forEach(exoEffacerErreur);
    clearUpload();
    exoBrouillonEffacer();

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
    // Ne pas remplacer les objets en mémoire après une action : Annuler et la
    // synchronisation doivent référencer la même fiche. Initialisation seulement.
    if (!exercices.length) {
        const saved = localStorage.getItem('studyPlanIB_exercices');
        if (saved) try { const lus = JSON.parse(saved); if (Array.isArray(lus)) exercices = lus; } catch(e) {}
    }
    exoMajBadge();

    if (exercices.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:3rem 1rem;color:#56665e;"><div style="font-size:3rem;margin-bottom:1rem;">📝</div><p style="font-weight:600;">Aucun exercice pour l\'instant</p><p style="font-size:0.85rem;margin-top:0.5rem;">Ajoute ton premier exercice dans l\'onglet ➕</p></div>';
        return;
    }

    // Trier par deadline sans masquer les exercices faits par défaut.
    const visibles = exercices.filter(e => exoFiltre === 'tous' || (exoFiltre === 'faits' ? !!e.done : !e.done));
    if (!visibles.length) {
        container.innerHTML = '<p style="text-align:center;padding:2rem 1rem;color:#6b7280;">' +
            (exoFiltre === 'faits' ? 'Aucun exercice fait pour l’instant.' : 'Aucun exercice à faire.') + '</p>';
        return;
    }
    const sorted = visibles.slice().sort((a, b) =>
        (exoFiltre === 'tous' ? Number(!!a.done) - Number(!!b.done) : 0) ||
        String(a.deadline || '').localeCompare(String(b.deadline || '')));
    const today = exoDateLocale();
    container.innerHTML = sorted.map(exo => {
        const dl = exoLireDate(exo.deadline);
        const days = dl ? Math.round((dl - exoLireDate(today)) / 86400000) : NaN;
        const urgency = days < 0 ? '#dc2626' : days <= 1 ? '#dc2626' : days <= 3 ? '#d97706' : '#059669';
        const urgencyBg = days <= 1 ? '#fef2f2' : days <= 3 ? '#fffbeb' : '#ecfdf5';
        const urgencyLabel = !dl ? 'Date à vérifier' : days < 0 ? '⚠️ En retard depuis ' + (-days) + 'j' : days === 0 ? '⚠️ Aujourd’hui' : days === 1 ? '⏰ Demain' : 'Dans ' + days + 'j';
        const dur = exo.duration >= 60 ? Math.floor(exo.duration/60)+'h'+(exo.duration%60?exo.duration%60+'min':'') : exo.duration+'min';
        const id = exoEscape(exo.id);
        const legacy = !exo.done && exo.scheduledSlot && typeof customEvents !== 'undefined' &&
            customEvents.some(e => e && e.exoId === exo.id && !e.date);
        const note = exo.filename ? '📎 Référence : ' + exo.filename + ' (fichier non conservé)' : String(exo.text || '').substring(0, 85);
        return '<div class="exo-card" style="margin-bottom:0.875rem;' + (exo.done ? 'background:#f0fdf4;border-color:#a7f3d0;' : '') + '">' +
            '<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:0.75rem;gap:0.5rem;">' +
            '<div style="display:flex;align-items:center;gap:0.625rem;min-width:0;">' +
            '<span style="font-size:1.5rem;">' + iconeHtml(exo.subjectIcon, '1.5rem') + '</span>' +
            '<div style="min-width:0;"><p style="font-weight:700;color:#111827;font-size:0.9rem;overflow-wrap:anywhere;">' + exoEscape(exo.subject) + '</p>' +
            '<p style="font-size:0.75rem;color:#6b7280;overflow-wrap:anywhere;">' + exoEscape(note) + '</p></div></div>' +
            '<button type="button" data-exo-action="supprimer" data-exo-id="' + id + '" aria-label="Supprimer cet exercice (annulation possible)" style="background:#fef2f2;border:none;border-radius:0.5rem;min-width:44px;min-height:44px;cursor:pointer;color:#dc2626;">✕</button>' +
            '</div>' +
            '<div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem;flex-wrap:wrap;">' +
            '<div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">' +
            '<span style="background:#f3f4f6;border-radius:9999px;padding:0.25rem 0.625rem;font-size:0.75rem;font-weight:600;color:#374151;">⏱️ ' + exoEscape(dur) + '</span>' +
            (exo.done ? '<span style="background:#dcfce7;color:#166534;border-radius:9999px;padding:0.25rem 0.625rem;font-size:0.75rem;font-weight:700;">✓ Fait</span>' : '<span style="background:' + urgencyBg + ';color:' + urgency + ';border-radius:9999px;padding:0.25rem 0.625rem;font-size:0.75rem;font-weight:700;">' + exoEscape(urgencyLabel) + '</span>') +
            (!exo.done && exo.scheduledSlot && !legacy ? '<span style="background:#ecfdf5;color:#059669;border-radius:9999px;padding:0.25rem 0.625rem;font-size:0.75rem;font-weight:600;">✓ Planifié</span>' : '') +
            (legacy ? '<span style="background:#fffbeb;color:#92400e;border-radius:9999px;padding:0.25rem 0.625rem;font-size:0.75rem;">Ancien créneau à dater : replanifie</span>' : '') +
            '</div>' +
            '<div style="display:flex;align-items:center;gap:0.4rem;flex-wrap:wrap;">' +
            '<button type="button" data-exo-action="fait" data-exo-id="' + id + '" data-exo-fait="' + id + '" aria-pressed="' + !!exo.done + '" aria-label="' + (exo.done ? 'Remettre cet exercice à faire' : 'Marquer cet exercice comme fait') + '" style="background:' + (exo.done ? 'white' : '#ecfdf5') + ';color:#047857;border:1px solid #a7f3d0;border-radius:0.625rem;padding:0.375rem 0.75rem;min-height:44px;font-size:0.75rem;font-weight:700;cursor:pointer;">' + (exo.done ? '↩ À faire' : '✓ Fait') + '</button>' +
            (exo.done ? '' : '<button type="button" data-exo-action="planifier" data-exo-id="' + id + '" style="background:linear-gradient(to right,#10b981,#059669);color:white;border:none;border-radius:0.625rem;padding:0.375rem 0.75rem;min-height:44px;font-size:0.75rem;font-weight:700;cursor:pointer;">' +
            (exo.scheduledSlot ? '📅 Replanifier' : '+ Planifier') + '</button>') +
            '</div></div></div>';
    }).join('');
}

function deleteExo(id) {
    const index = exercices.findIndex(e => e.id === id);
    if (index < 0) return;
    const exercice = exercices[index];
    const lies = typeof customEvents !== 'undefined' ? customEvents.filter(e => e && e.exoId === id) : [];
    function actualiser() {
        exoMajBadge();
        /* Recalcule les révisions liées (DE-06), sans ouvrir la fenêtre du planning. */
        if (typeof planningDepuisProgression === 'function') { try { planningDepuisProgression(); } catch (e) { console.error('Recalcul du planning', e); } }
        renderExoList();
        renderPlanifier();
        if (typeof renderPlanning === 'function' && document.getElementById('eventsContainer')) renderPlanning();
    }
    suppressionAvecAnnulation({
        message: 'Exercice « ' + exercice.subject + ' » supprimé · Annuler',
        retirer: function () {
            exercices = exercices.filter(e => e.id !== id);
            if (lies.length && typeof customEvents !== 'undefined') {
                customEvents = customEvents.filter(e => !e || e.exoId !== id);
                if (typeof v3Save === 'function') v3Save();
            }
            exoSauvegarder();
        },
        restaurer: function () {
            if (!exercices.some(e => e.id === id)) exercices.splice(Math.min(index, exercices.length), 0, exercice);
            exoSauvegarder();
            if (lies.length && typeof customEvents !== 'undefined') {
                lies.forEach(e => { if (!customEvents.some(x => x.id === e.id)) customEvents.push(e); });
                if (typeof v3Save === 'function') v3Save();
            }
        },
        actualiser: actualiser
    });
}

function renderPlanifier() {
    const container = document.getElementById('planifierContent');
    if (!container) return;
    if (exercices.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:3rem 1rem;color:#56665e;"><div style="font-size:3rem;margin-bottom:1rem;">📅</div><p style="font-weight:600;">Ajoute d\'abord des exercices</p><p style="font-size:0.85rem;margin-top:0.5rem;">Va dans l\'onglet ➕ pour commencer</p></div>';
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
        const dl = exoLireDate(exo.deadline);
        const diffDays = dl ? Math.round((dl - today) / 86400000) : NaN;
        const urgency = diffDays <= 1 ? '#dc2626' : diffDays <= 3 ? '#d97706' : '#059669';
        const dur = exo.duration >= 60 ? Math.floor(exo.duration/60)+'h'+(exo.duration%60?exo.duration%60+'min':'') : exo.duration+'min';
        const slots = findAvailableSlots(exo);

        html += '<div style="background:white;border:1.5px solid #e5e7eb;border-radius:1rem;padding:1.25rem;margin-bottom:1rem;">' +
            '<div style="display:flex;align-items:center;gap:0.625rem;margin-bottom:1rem;">' +
            '<span style="font-size:1.25rem;">' + iconeHtml(exo.subjectIcon, '1.25rem') + '</span>' +
            '<div><p style="font-weight:700;color:#111827;font-size:0.875rem;">' + exoEscape(exo.subject) + ' · ' + exoEscape(exo.filename || String(exo.text || '').substring(0,30)) + '</p>' +
            '<p style="font-size:0.75rem;color:' + urgency + ';font-weight:600;">⏱️ ' + dur + ' · Deadline : ' + (dl ? dl.toLocaleDateString('fr-FR', {day:'numeric',month:'long'}) : 'date à vérifier') + '</p></div></div>' +
            '<p style="font-size:0.8rem;font-weight:600;color:#374151;margin-bottom:0.625rem;">Créneaux disponibles :</p>';

        if (slots.length === 0) {
            html += '<div style="background:#fef2f2;border-radius:0.75rem;padding:0.875rem;font-size:0.8rem;color:#dc2626;text-align:center;">⚠️ Aucun créneau complet disponible avant la date limite (recherche sur 14 jours). Modifie ton planning ou la date limite : rien n’a été changé.</div>';
        } else {
            if (slots.some(s => s.parts.length > 1)) {
                html += '<div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:0.75rem;padding:0.625rem 0.875rem;margin-bottom:0.625rem;font-size:0.78rem;color:#92400e;">✂️ Durée complète répartie sur plusieurs créneaux, avant la date limite.</div>';
            }
            html += '<div style="display:flex;flex-direction:column;gap:0.5rem;">' +
                slots.map((slot, si) =>
                    '<button type="button" data-exo-action="creneau" data-exo-id="' + exoEscape(exo.id) + '" data-exo-slot="' + si + '" data-exo-date="' + exoEscape(slot.dateKey) + '" data-exo-time="' + exoEscape(slot.startTime) + '" class="slot-chip" style="text-align:left;min-height:44px;">✅ ' + exoEscape(slot.label) + '</button>'
                ).join('') + '</div>';
        }
        if (exo.scheduledSlot && !(typeof customEvents !== 'undefined' && customEvents.some(e => e && e.exoId === exo.id && !e.date))) {
            html += '<div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:0.75rem;padding:0.625rem 0.875rem;margin-top:0.75rem;font-size:0.8rem;color:#059669;font-weight:600;">✓ Planifié : ' + exoEscape(exo.scheduledSlot) + '</div>';
        }
        html += '</div>';
    });

    container.innerHTML = html;
}

// ── MOTEUR DE PLANIFICATION EXERCICES ───────────────────────
// Analyse le vrai planning du jour pour trouver les plages libres
// Si l'exercice est trop long, il est découpé automatiquement en parties

function getRealFreeSlots(planDay, minDuration, date, excludeExoId) {
    // Un jour futur doit inclure ses exceptions datées et ses vrais jours fériés.
    const events = generateDayEvents(planDay, date);
    const occupied = events.filter(e => e && e.exoId !== excludeExoId)
        .map(e => {
            const start = timeToMinutes(e.startTime);
            let end = timeToMinutes(e.endTime);
            if (end < start) end += 1440; // sommeil à cheval sur minuit
            return { s: start, e: end };
        }).filter(e => Number.isFinite(e.s) && Number.isFinite(e.e) && e.e > e.s)
        .sort((a, b) => a.s - b.s);
    const now = new Date();
    const sameDay = date && exoDateLocale(date) === exoDateLocale(now);
    let scanFrom = Math.max(360, sameDay ? Math.ceil((now.getHours() * 60 + now.getMinutes() + 1) / 15) * 15 : 360);
    const scanUntil = 22 * 60 + 30;
    const free = [];
    for (const occ of occupied) {
        if (occ.s > scanFrom && scanFrom < scanUntil) {
            const end = Math.min(occ.s, scanUntil);
            if (end - scanFrom >= minDuration) free.push({ startMins: scanFrom, endMins: end,
                duration: end - scanFrom, startTime: addMinutes('00:00', scanFrom), endTime: addMinutes('00:00', end) });
        }
        scanFrom = Math.max(scanFrom, occ.e);
    }
    if (scanUntil - scanFrom >= minDuration) free.push({ startMins: scanFrom, endMins: scanUntil,
        duration: scanUntil - scanFrom, startTime: addMinutes('00:00', scanFrom), endTime: addMinutes('00:00', scanUntil) });
    return free;
}

function findAvailableSlots(exo) {
    const deadline = exoLireDate(exo.deadline);
    const total = Number(exo.duration);
    if (!deadline || !Number.isInteger(total) || total < 15 || total > 180 || exo.done) return [];
    const today = new Date();
    const gaps = [];
    // Jamais le jour de la deadline. La recherche s'étend sur 14 jours.
    for (let d = 0; d < 14; d++) {
        const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + d, 12);
        if (date >= deadline) break;
        const planDay = (date.getDay() + 6) % 7;
        if (typeof holidayMode === 'function' && holidayMode(planDay, date) === 'free') continue;
        const dateKey = exoDateLocale(date);
        for (const gap of getRealFreeSlots(planDay, 15, date, exo.id)) {
            gaps.push({ dateKey, planDay, startTime: gap.startTime, endTime: gap.endTime,
                duration: gap.duration, startMins: gap.startMins,
                dateStr: date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) });
        }
    }
    const options = [];
    // Montrer d'abord les options qui couvrent réellement toute la durée.
    // Un créneau partiel ne vaut jamais un badge « Planifié ».
    for (let i = 0; i < gaps.length; i++) {
        let rest = total;
        const parts = [];
        for (let j = i; j < gaps.length && rest > 0; j++) {
            const gap = gaps[j];
            const minutes = Math.min(rest, gap.duration);
            if (minutes < 15) continue;
            parts.push({ dateKey: gap.dateKey, planDay: gap.planDay, startTime: gap.startTime,
                endTime: addMinutes(gap.startTime, minutes), duration: minutes, dateStr: gap.dateStr });
            rest -= minutes;
        }
        if (rest !== 0) continue;
        const first = parts[0];
        options.push({ ...first, parts, label: parts.length === 1
            ? first.dateStr + ' · ' + first.startTime + ' – ' + first.endTime + ' (' + total + ' min)'
            : parts.map((p, index) => 'P' + (index + 1) + ' ' + p.dateStr + ' ' + p.startTime + '–' + p.endTime).join(' · ') +
                ' (' + total + '/' + total + ' min)' });
    }
    options.sort((a, b) => a.parts.length - b.parts.length || a.dateKey.localeCompare(b.dateKey) || a.startTime.localeCompare(b.startTime));
    return options.slice(0, 8);
}

// Aucun remplacement silencieux d'un cours, d'une activité ou d'une exception.
function findReplacementSlots() { return []; }

function refreshPlanningAfterExercise(part) {
    if (part) {
        selectedDay = part.planDay;
        const choisi = exoLireDate(part.dateKey);
        if (choisi && typeof getWeekDates === 'function') {
            const lundi = getWeekDates(new Date())[0].date;
            const debut = new Date(choisi.getFullYear(), choisi.getMonth(), choisi.getDate() - part.planDay);
            planningDecalageSemaine = Math.round((debut - lundi) / 604800000);
        }
    }
    if (typeof v3Save === 'function') v3Save();
    else localStorage.setItem('studyPlanIB_customEvents_juliss', JSON.stringify(customEvents));
    exoSauvegarder();
    if (typeof renderPlanning === 'function' && document.getElementById('eventsContainer')) renderPlanning();
}

function openPlanifier(exoId) {
    planifyTarget = exoId;
    switchExoTab('planifier');
    renderPlanifier();
}

function scheduleExo(exoId, slotIdx, expectedDate, expectedTime) {
    const exo = exercices.find(e => e.id === exoId && !e.done);
    if (!exo || typeof customEvents === 'undefined') return;
    const slot = findAvailableSlots(exo)[slotIdx];
    if (!slot || (expectedDate && expectedDate !== slot.dateKey) ||
        (expectedTime && expectedTime !== slot.startTime)) { renderPlanifier(); return; }
    // Une validation sans place suffisante ne change rien. Ne toucher qu'aux
    // événements liés à CET exercice ; garder une copie pour « Annuler ».
    if (slot.parts.reduce((sum, part) => sum + part.duration, 0) !== Number(exo.duration)) return;
    const avant = customEvents.slice();
    const anciennePlace = exo.scheduledSlot;
    const ancienPlan = exo.planVersion;
    const nouveauPlan = exoNouveauId();
    try {
        customEvents = customEvents.filter(e => !e || e.exoId !== exoId);
        slot.parts.forEach((part, i) => customEvents.push({
            id: exoNouveauId(), day: part.planDay, date: part.dateKey,
            title: 'Exercices ' + exo.subject + (slot.parts.length > 1 ? ' (Partie ' + (i + 1) + '/' + slot.parts.length + ')' : ''),
            startTime: part.startTime, endTime: part.endTime, type: 'study', icon: exo.subjectIcon,
            source: 'exercice', exoId: exo.id, planVersion: nouveauPlan, pinned: true, timestamp: Date.now() + i
        }));
        exo.scheduledSlot = slot.label;
        exo.planVersion = nouveauPlan;
        exo.etatAt = new Date().toISOString();
        refreshPlanningAfterExercise(slot.parts[0]);
    } catch (e) {
        customEvents = avant; exo.scheduledSlot = anciennePlace; exo.planVersion = ancienPlan;
        exo.etatAt = new Date().toISOString();
        refreshPlanningAfterExercise();
        throw e;
    }
    exoMajBadge();
    renderPlanifier(); renderExoList();
    if (typeof v3Toast === 'function') v3Toast('Exercice planifié sur ' + slot.parts.length + ' créneau(x), ' + exo.duration + '/' + exo.duration + ' min.', 'success', { undo: function () {
        customEvents = avant; exo.scheduledSlot = anciennePlace; exo.planVersion = ancienPlan;
        exo.etatAt = new Date().toISOString();
        refreshPlanningAfterExercise(); renderPlanifier(); renderExoList();
    } });
}

function switchExoTab(tab) {
    ['ajouter','liste','planifier'].forEach(t => {
        document.getElementById('tabContent' + t.charAt(0).toUpperCase() + t.slice(1)).style.display = t === tab ? 'block' : 'none';
        const btn = document.getElementById('tab' + t.charAt(0).toUpperCase() + t.slice(1));
        if (btn) {
            btn.setAttribute('aria-selected', String(t === tab));
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
