/* ============================================================
   PAGE Transport
   Voiture ou moto, trajets et préparation.
   Vue : pages/onboarding-transport.html
   ============================================================ */

// Page 5 - Transport
function showTransportPage() {
    document.getElementById('subjectsModal').classList.remove('active');
    document.getElementById('transportModal').classList.add('active');
}

function hideTransportPage() {
    document.getElementById('transportModal').classList.remove('active');
    document.getElementById('subjectsModal').classList.add('active');
}

let transportMode = '';

function selectTransport(mode) {
    transportMode = mode;
    document.getElementById('transportModal').classList.remove('active');
    if (mode === 'voiture') {
        document.getElementById('carConfigModal').classList.add('active');
        updateCarPrepTime();
    } else {
        document.getElementById('motoConfigModal').classList.add('active');
        updateMotoPrepTime();
    }
}

// Page 6a - Car Configuration
let carDeparture = '07:30';
let carToSchool = 30;
let carFromSchool = 40;

function calculatePrepTime(departure) {
    const [hours, minutes] = departure.split(':').map(Number);
    let prepHour = hours;
    let prepMin = minutes - 30;
    if (prepMin < 0) {
        prepMin += 60;
        prepHour -= 1;
        if (prepHour < 0) prepHour += 24;
    }
    return prepHour.toString().padStart(2, '0') + ':' + prepMin.toString().padStart(2, '0');
}

function updateCarPrepTime() {
    document.getElementById('carPrepTime').textContent = calculatePrepTime(carDeparture);
}

function hideCarConfig() {
    document.getElementById('carConfigModal').classList.remove('active');
    document.getElementById('transportModal').classList.add('active');
}

function saveCarConfig() {
    document.getElementById('carConfigModal').classList.remove('active');
    document.getElementById('activitiesModal').classList.add('active');
    renderActivities();
}

function saveCarConfigOld2() {
    alert('Configuration voiture enregistrée !\n\n• Départ : ' + carDeparture + '\n• Préparation : ' + calculatePrepTime(carDeparture) + '\n• Trajet aller : ' + carToSchool + ' min\n• Trajet retour : ' + carFromSchool + ' min\n\n' + userName + ', ton planning personnalisé est prêt ! Score visé: ' + targetScore + ' points.');
}

// Page 6b - Moto Configuration
let motoDeparture = '07:30';
let motoReturn = '17:00';
let motoToSchool = 25;
let motoFromSchool = 25;

function updateMotoPrepTime() {
    document.getElementById('motoPrepTime').textContent = calculatePrepTime(motoDeparture);
}

function hideMotoConfig() {
    document.getElementById('motoConfigModal').classList.remove('active');
    document.getElementById('transportModal').classList.add('active');
}

function saveMotoConfig() {
    document.getElementById('motoConfigModal').classList.remove('active');
    document.getElementById('activitiesModal').classList.add('active');
    renderActivities();
}

function saveCarConfigOld() {
    alert('Configuration moto enregistrée !\n\n• Départ : ' + motoDeparture + '\n• Préparation : ' + calculatePrepTime(motoDeparture) + '\n• Trajet aller : ' + motoToSchool + ' min\n• Retour école : ' + motoReturn + '\n• Trajet retour : ' + motoFromSchool + ' min\n\n' + userName + ', ton planning personnalisé est prêt ! Score visé: ' + targetScore + ' points.');
}
