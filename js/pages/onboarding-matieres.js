/* ============================================================
   PAGE Matières
   6 matières IB, 3 HL et 3 SL.
   Vue : pages/onboarding-matieres.html
   ============================================================ */

// Page 4 - Subjects
function showSubjectsPage() {
    document.getElementById('sleepModal').classList.remove('active');
    var classe = document.getElementById('classeModal');
    if (classe) classe.classList.remove('active');
    document.getElementById('subjectsModal').classList.add('active');
    updateSubjectsUI();
}

function hideSubjectsPage() {
    document.getElementById('subjectsModal').classList.remove('active');
    if (typeof showClassePage === 'function') {
        classeRetour = 'sujets';
        showClassePage();
        return;
    }
    document.getElementById('sleepModal').classList.add('active');
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
        grade: 5,
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
}

function updateSubjectGrade(name, grade) {
    const clampedGrade = Math.max(1, Math.min(7, parseInt(grade) || 1));
    const apply = function (s) {
        return s.name === name ? Object.assign({}, s, { grade: clampedGrade }) : s;
    };
    subjects = subjects.map(apply);
    optionalSubjects = optionalSubjects.map(apply);
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
    return '<div class="subject-card"><div class="subject-info"><div class="subject-icon">' + subject.icon + '</div><span class="subject-name">' + subject.name + '</span></div><div class="subject-controls">' + levelChoiceHTML(subject) + '<div class="grade-input-wrapper"><input type="number" min="1" max="7" value="' + subject.grade + '" onchange="updateSubjectGrade(\'' + subject.name + '\', this.value)" class="grade-input"><span class="grade-suffix">/7</span></div>' + removeBtn + '</div></div>';
}

function updateSubjectsUI() {
    enforceSubjectRules();
    const { hlCount, slCount } = countLevels();
    const total = subjects.length + optionalSubjects.length;

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
    if (isSubjectsValid()) {
        showTravauxPage();
    }
}
