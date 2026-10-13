/* ============================================================
   Configuration
   Colle ici l'ID client OAuth Google (application Web), ou
   renseigne-le dans Mon compte. Vide = mémoire de l'appareil seule.
   ============================================================ */

window.STUDYPLAN_GOOGLE_CLIENT_ID = '775918983331-8igka68v1a6otqudt6nqr2ab1qtqiehj.apps.googleusercontent.com';
window.STUDYPLAN_FIREBASE_CONFIG = {
    apiKey: 'AIzaSyCip0suxr92DLM6Cx5pX0z_SjWEKYWR23E',
    authDomain: 'study-plan-ib.firebaseapp.com',
    projectId: 'study-plan-ib',
    storageBucket: 'study-plan-ib.firebasestorage.app',
    messagingSenderId: '203767781568',
    appId: '1:203767781568:web:c2bcf12433c0e1aa73b525',
    measurementId: 'G-N4N8Z2BWY4'
};

function iconeDrapeau(icon) {
    var s = String(icon || '');
    if (s.indexOf('\uD83C\uDDEB\uD83C\uDDF7') !== -1) return 'fr';
    if (s.indexOf('\uD83C\uDDEC\uD83C\uDDE7') !== -1) return 'gb';
    return '';
}

function iconeEchap(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function iconeHtml(icon, taille) {
    var code = iconeDrapeau(icon);
    if (!code) return iconeEchap(icon);
    var largeur = taille || '1.45rem';
    var alt = code === 'fr' ? 'Français' : 'Anglais';
    var src = code === 'fr' ? 'images/drapeau-fr.svg' : 'images/drapeau-gb.svg';
    return '<img class="drapeau-matiere" alt="' + alt + '" src="' + src + '" style="width:' + largeur + ';height:calc(' + largeur + ' * 0.67);display:inline-block;vertical-align:-0.12em;border-radius:3px;object-fit:cover;box-shadow:0 0 0 1px rgba(17,24,39,0.12);">';
}
