/* ============================================================
   PAGE Matières
   6 matières IB, 3 HL et 3 SL.
   Vue : pages/onboarding-matieres.html
   ============================================================ */

// Page 4 - Subjects
function showSubjectsPage() {
    if (typeof ibYear !== 'undefined' && ibYear !== 'DP1' && ibYear !== 'DP2' && typeof showClassePage === 'function') {
        classeRetour = '';
        showClassePage();
        return;
    }
    document.getElementById('sleepModal').classList.remove('active');
    var objectif = document.getElementById('objectivesModal');
    if (objectif) objectif.classList.remove('active');
    var classe = document.getElementById('classeModal');
    if (classe) classe.classList.remove('active');
    document.getElementById('subjectsModal').classList.add('active');
    updateSubjectsUI();
}

function hideSubjectsPage() {
    document.getElementById('subjectsModal').classList.remove('active');
    if (typeof showObjectivesPage === 'function') {
        showObjectivesPage();
        return;
    }
    document.getElementById('classeModal').classList.add('active');
}

let subjects = [];

let optionalSubjects = [];

const availableSubjectsList = [
    { name: 'Mathématiques AA', icon: '🔢', conflicts: [] },
    { name: 'Anglais A', icon: '📕', conflicts: ['Anglais B'] },
    { name: 'Anglais B', icon: '🇬🇧', conflicts: ['Anglais A'] },
    { name: 'Français A', icon: '🇫🇷', conflicts: ['Français B'] },
    { name: 'Français B', icon: '📘', conflicts: ['Français A'] },
    { name: 'Biologie', icon: '🧬', conflicts: ['Physique'] },
    { name: 'Physique', icon: '⚛️', conflicts: ['Biologie'] },
    { name: 'Chimie', icon: '🧪', conflicts: [] },
    { name: 'Histoire', icon: '📜', conflicts: ['Géographie'] },
    { name: 'Géographie', icon: '🌍', conflicts: ['Histoire'] },
    { name: 'Économie', icon: '💹', conflicts: [] },
    { name: 'Philosophie', icon: '🏛️', conflicts: [] },
    { name: 'ESS', icon: '🌱', conflicts: [] }
];

function chosenSubjects() {
    return subjects.concat(optionalSubjects);
}

function studentTakesEconomics() {
    return chosenSubjects().some(function (s) { return s && s.name === 'Économie'; });
}

function enforceSubjectRules() {
    const blocked = {};
    function keep(list) {
        const out = [];
        list.forEach(function (s) {
            if (!s || !s.name || blocked[s.name]) return;
            blocked[s.name] = true;
            const def = availableSubjectsList.find(function (a) { return a.name === s.name; });
            (def && def.conflicts ? def.conflicts : []).forEach(function (name) { blocked[name] = true; });
            const copy = Object.assign({}, s);
            delete copy.required;
            out.push(copy);
        });
        return out;
    }
    subjects = keep(subjects);
    optionalSubjects = keep(optionalSubjects);
}

function getAvailableSubjects() {
    const selectedNames = chosenSubjects().map(function (s) { return s.name; });
    const conflicts = [];
    selectedNames.forEach(function (name) {
        const subjectDef = availableSubjectsList.find(function (a) { return a.name === name; });
        if (subjectDef && subjectDef.conflicts) conflicts.push.apply(conflicts, subjectDef.conflicts);
    });
    return availableSubjectsList.filter(function (s) {
        return selectedNames.indexOf(s.name) === -1 && conflicts.indexOf(s.name) === -1;
    });
}

function countLevels() {
    const allSubjects = [...subjects, ...optionalSubjects];
    const hlCount = allSubjects.filter(s => s.level === 'HL').length;
    const slCount = allSubjects.filter(s => s.level === 'SL').length;
    return { hlCount, slCount };
}

function addOptionalSubject(name) {
    const subjectDef = availableSubjectsList.find(function (s) { return s.name === name; });
    const total = chosenSubjects().length;
    if (!subjectDef || total >= 6) return;
    if (!getAvailableSubjects().some(function (s) { return s.name === name; })) return;
    subjects.push({
        name: subjectDef.name,
        level: '',
        grade: notesSur7() ? '' : '',
        icon: subjectDef.icon
    });
    updateSubjectsUI();
}

function removeOptionalSubject(name) {
    subjects = subjects.filter(function (s) { return s.name !== name; });
    optionalSubjects = optionalSubjects.filter(function (s) { return s.name !== name; });
    updateSubjectsUI();
}

function updateSubjectLevel(name, level) {
    const apply = function (s) {
        return s.name === name ? Object.assign({}, s, { level: level }) : s;
    };
    subjects = subjects.map(apply);
    optionalSubjects = optionalSubjects.map(apply);
    updateSubjectsUI();
    if (window.__profilComplet && typeof renderPlanning === 'function') {
        try { renderPlanning(); } catch (e) {}
    }
}

function notesSur7() {
    return typeof ibYear !== 'undefined' && ibYear === 'DP2';
}

function majApparenceNotes() {
    if (!document.body) return;
    document.body.classList.toggle('annee-dp2', notesSur7());
}

function noteMatiere(s) {
    if (!notesSur7() || !s || s.grade == null || s.grade === '') return null;
    var n = Number(s.grade);
    if (!isFinite(n) || n < 1 || n > 7) return null;
    return n;
}

function matierePrioritaire(s) {
    if (!s) return false;
    if (s.level === 'HL') return true;
    var n = noteMatiere(s);
    return n != null && n <= 4;
}

function sujetsParPriorite(list) {
    return (list || []).slice().sort(function (a, b) {
        var d = (matierePrioritaire(a) ? 0 : 1) - (matierePrioritaire(b) ? 0 : 1);
        if (d) return d;
        var na = noteMatiere(a);
        var nb = noteMatiere(b);
        if (na != null && nb != null && na !== nb) return na - nb;
        if (na != null && nb == null) return -1;
        if (nb != null && na == null) return 1;
        if (a && a.level === 'HL' && !(b && b.level === 'HL')) return -1;
        if (b && b.level === 'HL' && !(a && a.level === 'HL')) return 1;
        return String(a && a.name || '').localeCompare(String(b && b.name || ''), 'fr');
    });
}

function filePriorite(list) {
    var file = [];
    (list || []).forEach(function (s) {
        if (!s) return;
        var poids = 1;
        if (s.level === 'HL') poids += 1;
        var n = noteMatiere(s);
        if (n != null && n <= 4) poids += 1;
        var i;
        for (i = 0; i < poids; i++) file.push(s);
    });
    return sujetsParPriorite(file);
}

function sujetDuJour(list, slot) {
    var file = filePriorite(list);
    if (!file.length) return null;
    var i = ((slot % file.length) + file.length) % file.length;
    return file[i];
}

function dureePrioritaire(s, longue, courte) {
    if (s && s.level === 'HL') return longue;
    var n = noteMatiere(s);
    if (n != null && n <= 4) return longue;
    return courte;
}

function sousTitreMatiere(s) {
    if (!s) return '';
    var n = noteMatiere(s);
    if (n == null) return s.level || '';
    return (s.level ? s.level + ' · ' : '') + n + '/7';
}

function couleurMatiere(s) {
    var n = noteMatiere(s);
    if (n == null || typeof getStudyColor !== 'function') return 'study';
    return getStudyColor(n);
}

function updateSubjectGrade(name, grade) {
    if (!notesSur7()) return;
    var brut = String(grade == null ? '' : grade).trim();
    var suivant = brut === '' ? '' : Math.max(1, Math.min(7, parseInt(brut, 10) || 1));
    const apply = function (s) {
        return s.name === name ? Object.assign({}, s, { grade: suivant }) : s;
    };
    subjects = subjects.map(apply);
    optionalSubjects = optionalSubjects.map(apply);
    if (window.__profilComplet && typeof renderPlanning === 'function') {
        try { renderPlanning(); } catch (e) {}
    }
}

function isSubjectsValid() {
    const totalSubjects = subjects.length + optionalSubjects.length;
    const { hlCount, slCount } = countLevels();
    return totalSubjects === 6 && hlCount === 3 && slCount === 3;
}

function levelChoiceHTML(subject) {
    function btn(value) {
        const on = subject.level === value;
        return '<button type="button" onclick="updateSubjectLevel(\'' + subject.name + '\', \'' + value + '\')" style="min-width:2.6rem;padding:0.35rem 0.55rem;border-radius:0.65rem;border:1.5px solid ' + (on ? '#059669' : '#e5e7eb') + ';background:' + (on ? '#10b981' : 'white') + ';color:' + (on ? 'white' : '#374151') + ';font-weight:800;font-size:0.78rem;cursor:pointer;">' + value + '</button>';
    }
    return '<div style="display:flex;gap:0.3rem;">' + btn('HL') + btn('SL') + '</div>';
}

function subjectCardHTML(subject) {
    const removeBtn = '<button onclick="removeOptionalSubject(\'' + subject.name + '\')" class="remove-btn">✕</button>';
    var note = '';
    if (notesSur7()) {
        var valeur = subject.grade == null || subject.grade === '' ? '' : subject.grade;
        note = '<div class="grade-input-wrapper"><input type="number" min="1" max="7" value="' + valeur + '" onchange="updateSubjectGrade(\'' + subject.name + '\', this.value)" class="grade-input" inputmode="numeric"><span class="grade-suffix">/7</span></div>';
    }
    return '<div class="subject-card"><div class="subject-info"><div class="subject-icon">' + subject.icon + '</div><span class="subject-name">' + subject.name + '</span></div><div class="subject-controls">' + levelChoiceHTML(subject) + note + removeBtn + '</div></div>';
}

function updateSubjectsUI() {
    enforceSubjectRules();
    const { hlCount, slCount } = countLevels();
    const total = subjects.length + optionalSubjects.length;

    majApparenceNotes();
    var sousTitre = document.getElementById('subjectsSubtitle');
    if (sousTitre) {
        sousTitre.textContent = notesSur7()
            ? 'Choisis tes matières, le niveau de tes matières et la note sur 7 obtenue sur ton dernier bulletin.'
            : 'Choisis tes matières et le niveau de tes matières de l\'IB ci-dessous.';
    }
    document.getElementById('hlCounter').textContent = 'HL: ' + hlCount + '/3';
    document.getElementById('hlCounter').className = 'counter-badge ' + (hlCount === 3 ? 'valid' : 'invalid-hl');
    document.getElementById('slCounter').textContent = 'SL: ' + slCount + '/3';
    document.getElementById('slCounter').className = 'counter-badge ' + (slCount === 3 ? 'valid' : 'invalid-sl');

    const countEl = document.getElementById('subjectsCount');
    if (countEl) countEl.textContent = total + '/6';

    const list = document.getElementById('subjectsList');
    list.innerHTML = total === 0
        ? '<p style="margin:0;color:#6b7280;font-size:0.9rem;text-align:center;">Aucune matière pour l’instant. Ajoute celles que tu suis.</p>'
        : subjects.map(function (subject) { return subjectCardHTML(subject); }).join('')
            + optionalSubjects.map(function (subject) { return subjectCardHTML(subject); }).join('');
    if (!notesSur7()) {
        list.querySelectorAll('.grade-input-wrapper').forEach(function (el) { el.remove(); });
    }
    const addSubjectSelect = document.getElementById('addSubjectSelect');
    const available = getAvailableSubjects();
    addSubjectSelect.innerHTML = '<option value="">+ Ajouter une matière...</option>' + available.map(s =>
        '<option value="' + s.name + '">' + s.icon + ' ' + s.name + '</option>'
    ).join('');
    const addWrap = document.getElementById('addSubjectWrap');
    if (addWrap) addWrap.style.display = total < 6 ? 'block' : 'none';
    
    // Update validation message
    const validationMsg = document.getElementById('validationMsg');
    if (isSubjectsValid()) {
        validationMsg.className = 'validation-box valid';
        validationMsg.innerHTML = '✅ Configuration valide ! Tu as 6 matières avec 3 HL et 3 SL';
    } else {
        validationMsg.className = 'validation-box invalid';
        validationMsg.innerHTML = '⚠️ Configuration incomplète. Il te faut exactement 6 matières (3 HL et 3 SL)';
    }
    
    // Update continue button
    document.getElementById('subjectsContinueBtn').disabled = !isSubjectsValid();
}

function handleAddSubject(select) {
    if (select.value) {
        addOptionalSubject(select.value);
        select.value = '';
    }
}

function validateSubjects() {
    if (isSubjectsValid() && typeof showSleepPage === 'function') showSleepPage();
}
