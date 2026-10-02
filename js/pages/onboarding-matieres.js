/* ============================================================
   PAGE Matières
   6 matières IB, 3 HL et 3 SL.
   Vue : pages/onboarding-matieres.html
   ============================================================ */

// Page 4 - Subjects
function showSubjectsPage() {
    document.getElementById('sleepModal').classList.remove('active');
    document.getElementById('subjectsModal').classList.add('active');
    updateSubjectsUI();
}

function hideSubjectsPage() {
    document.getElementById('subjectsModal').classList.remove('active');
    document.getElementById('sleepModal').classList.add('active');
}

let subjects = [
    { name: 'Mathématiques AA', level: 'SL', grade: 5, icon: '🔢', required: true },
    { name: 'Anglais B', level: 'HL', grade: 5, icon: '🇬🇧', required: true },
    { name: 'Français A', level: 'HL', grade: 5, icon: '🇫🇷', required: true }
];

let optionalSubjects = [];

const availableSubjectsList = [
    { name: 'Biologie', icon: '🧬', conflicts: ['Physique'] },
    { name: 'Physique', icon: '⚛️', conflicts: ['Biologie'] },
    { name: 'Chimie', icon: '🧪', conflicts: [] },
    { name: 'Histoire', icon: '📜', conflicts: ['Géographie'] },
    { name: 'Géographie', icon: '🌍', conflicts: ['Histoire'] },
    { name: 'Économie', icon: '💹', conflicts: [] },
    { name: 'Philosophie', icon: '🏛️', conflicts: [] },
    { name: 'Français B', icon: '📘', conflicts: [] },
    { name: 'ESS', icon: '🌱', conflicts: [] }
];

function getAvailableSubjects() {
    const selectedNames = [...subjects.map(s => s.name), ...optionalSubjects.map(s => s.name)];
    const conflicts = [];
    
    optionalSubjects.forEach(s => {
        const subjectDef = availableSubjectsList.find(a => a.name === s.name);
        if (subjectDef && subjectDef.conflicts) {
            conflicts.push(...subjectDef.conflicts);
        }
    });
    
    return availableSubjectsList.filter(s => 
        !selectedNames.includes(s.name) && !conflicts.includes(s.name)
    );
}

function countLevels() {
    const allSubjects = [...subjects, ...optionalSubjects];
    const hlCount = allSubjects.filter(s => s.level === 'HL').length;
    const slCount = allSubjects.filter(s => s.level === 'SL').length;
    return { hlCount, slCount };
}

function addOptionalSubject(name) {
    const subjectDef = availableSubjectsList.find(s => s.name === name);
    if (subjectDef && optionalSubjects.length < 3) {
        optionalSubjects.push({
            name: subjectDef.name,
            level: 'SL',
            grade: 5,
            icon: subjectDef.icon
        });
        updateSubjectsUI();
    }
}

function removeOptionalSubject(name) {
    optionalSubjects = optionalSubjects.filter(s => s.name !== name);
    updateSubjectsUI();
}

function updateSubjectLevel(name, level, isRequired) {
    const apply = function (s) {
        return s.name === name ? { ...s, level: level } : s;
    };
    if (isRequired) subjects = subjects.map(apply);
    else optionalSubjects = optionalSubjects.map(apply);
    updateSubjectsUI();
}

function updateSubjectGrade(name, grade, isRequired) {
    const clampedGrade = Math.max(1, Math.min(7, parseInt(grade) || 1));
    if (isRequired) {
        subjects = subjects.map(s => 
            s.name === name ? { ...s, grade: clampedGrade } : s
        );
    } else {
        optionalSubjects = optionalSubjects.map(s => 
            s.name === name ? { ...s, grade: clampedGrade } : s
        );
    }
}

function isSubjectsValid() {
    const totalSubjects = subjects.length + optionalSubjects.length;
    const { hlCount, slCount } = countLevels();
    return totalSubjects === 6 && hlCount === 3 && slCount === 3;
}

function subjectCardHTML(subject, isRequired) {
    const levelSelector = '<select onchange="updateSubjectLevel(\'' + subject.name + '\', this.value, ' + isRequired + ')" class="level-select ' + (subject.level === 'HL' ? 'hl' : 'sl') + '"><option value="HL"' + (subject.level === 'HL' ? ' selected' : '') + '>HL</option><option value="SL"' + (subject.level === 'SL' ? ' selected' : '') + '>SL</option></select>';
    const removeBtn = isRequired
        ? ''
        : '<button onclick="removeOptionalSubject(\'' + subject.name + '\')" class="remove-btn">✕</button>';
    return '<div class="subject-card"><div class="subject-info"><div class="subject-icon">' + subject.icon + '</div><span class="subject-name">' + subject.name + '</span></div><div class="subject-controls">' + levelSelector + '<div class="grade-input-wrapper"><input type="number" min="1" max="7" value="' + subject.grade + '" onchange="updateSubjectGrade(\'' + subject.name + '\', this.value, ' + isRequired + ')" class="grade-input"><span class="grade-suffix">/7</span></div>' + removeBtn + '</div></div>';
}

function updateSubjectsUI() {
    const { hlCount, slCount } = countLevels();
    const total = subjects.length + optionalSubjects.length;

    document.getElementById('hlCounter').textContent = 'HL: ' + hlCount + '/3';
    document.getElementById('hlCounter').className = 'counter-badge ' + (hlCount === 3 ? 'valid' : 'invalid-hl');
    document.getElementById('slCounter').textContent = 'SL: ' + slCount + '/3';
    document.getElementById('slCounter').className = 'counter-badge ' + (slCount === 3 ? 'valid' : 'invalid-sl');

    const countEl = document.getElementById('subjectsCount');
    if (countEl) countEl.textContent = total + '/6';

    const list = document.getElementById('subjectsList');
    list.innerHTML = subjects.map(subject => subjectCardHTML(subject, true)).join('')
        + optionalSubjects.map(subject => subjectCardHTML(subject, false)).join('');

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
        showTransportPage();
    }
}
