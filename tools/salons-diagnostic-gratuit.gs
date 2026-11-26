/** Diagnostic manuel, sans envoi, sans lecture de secrets ni écriture Firestore.
 * À ajouter dans le projet Apps Script une fois les autorisations configurées.
 * Ne jamais publier le jeton OAuth ou une clé dans le journal.
 */
function spDiagnosticGratuit() {
  var url='https://firestore.googleapis.com/v1/projects/study-plan-ib/databases/(default)/documents/salons_focus/' + '0'.repeat(48);
  var r=UrlFetchApp.fetch(url,{headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},muteHttpExceptions:true});
  var code=r.getResponseCode();
  if(code===200 || code===404) Logger.log('Lecture Firestore : autorisée.');
  else if(code===401 || code===403) Logger.log('Lecture Firestore : refusée. Vérifie les autorisations du projet et du compte.');
  else Logger.log('Lecture Firestore : diagnostic non concluant (code '+code+').');
  var mail=Session.getEffectiveUser().getEmail();
  Logger.log('Compte exécutant : '+(mail || 'non communiqué par Google'));
  Logger.log('Aucun email envoyé, aucun document modifié. La lecture seule ne prouve pas le droit d’écrire.');
}

/** Test séparé : crée puis supprime un document de diagnostic sans données
 * personnelles. Ne lancer qu'avec l'accord du responsable du projet. */
function spDiagnosticEcriture() {
  var id='test_'+Utilities.getUuid().replace(/-/g,''), chemin='salons_test_acces/'+id;
  var base='https://firestore.googleapis.com/v1/projects/study-plan-ib/databases/(default)/documents/';
  var headers={Authorization:'Bearer '+ScriptApp.getOAuthToken()}, cree=false;
  try {
    var r=UrlFetchApp.fetch(base+chemin+'?currentDocument.exists=false',{method:'patch',headers:headers,contentType:'application/json',payload:JSON.stringify({fields:{diagnostic:{booleanValue:true}}}),muteHttpExceptions:true});
    if(r.getResponseCode()!==200){Logger.log('Écriture non confirmée (code '+r.getResponseCode()+'). Vérifie l’absence de '+chemin+'.');return;}
    cree=true;Logger.log('Écriture Firestore : autorisée.');
  } catch(e) {
    Logger.log('Écriture non confirmée. Vérifie l’absence de '+chemin+'.');
  } finally {
    if(cree) {
      try {
        var efface=UrlFetchApp.fetch(base+chemin,{method:'delete',headers:headers,muteHttpExceptions:true});
        if(efface.getResponseCode()===200)Logger.log('Document de diagnostic supprimé.');
        else Logger.log('Suppression non confirmée : '+chemin+' (code '+efface.getResponseCode()+').');
      } catch(e) {Logger.log('Suppression non confirmée : '+chemin+'.');}
    }
  }
  Logger.log('Aucun email envoyé.');
}
