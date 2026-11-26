# Relais TURN du Salon focus

## État actuel

Le client sait charger une configuration TURN temporaire, mais **aucun relais public ni service d'identifiants n'est actuellement provisionné ou activé**. Sans configuration, il conserve le comportement précédent (STUN et liaison directe). Publier le site seul ne crée pas un relais. L'échec de ce service ne doit pas empêcher le salon de tenter une connexion directe.

`tools/tester-salon-voix-relais.mjs` démarre un relais TURN UDP **local et fictif** avec `node-turn`, impose `iceTransportPolicy: 'relay'`, transmet une onde synthétique dans chaque sens entre deux processus Chromium et vérifie que la paire sélectionnée utilise `relay` des deux côtés. Il ne valide ni TURN/TLS, ni un relais Internet, ni des téléphones, ni des règles Firebase réelles. `node-turn` ne sert ici que de double de test, ce n'est pas une recommandation de production.

## Contrat du service d'identifiants

Quand une infrastructure fiable sera choisie, exposer un point HTTPS dans `window.STUDYPLAN_TURN_ENDPOINT` au chargement du site, après avoir validé qu'il est bien intégré à l'assembleur Pages. Le client envoie une requête POST JSON `{ "salonId": "…" }` et un jeton Firebase de l'identité du participant dans `Authorization: Bearer …`, sans cookies, sans cache et sans suivre de redirection. Cela peut concerner une identité invitée anonyme distincte du compte principal.

Le service doit **vérifier cryptographiquement le jeton**, lire côté serveur les données du salon et n'émettre des identifiants que pour un membre de ce salon encore ouvert et non expiré. L'authentification seule n'est pas suffisante car n'importe qui peut créer une identité anonyme. Protéger aussi l'API et le relais contre les abus (quotas, limitation de débit, surveillance, révocation, coût), sécuriser l'accès au serveur et choisir une politique de confidentialité et de conservation. Le secret permanent reste exclusivement dans l'environnement sécurisé du service ; il n'est jamais envoyé au navigateur, au dépôt, à Firestore ou dans les journaux.

Réponse attendue, sans stockage :

```json
{
  "expireLe": 1900000000000,
  "iceServers": [
    { "urls": ["turn:turn.example.net:3478?transport=udp", "turns:turn.example.net:443?transport=tcp"], "username": "identifiant-temporaire", "credential": "secret-temporaire" }
  ]
}
```

`expireLe` est un timestamp absolu en millisecondes. Le client exige un TURN authentifié, une expiration d'au moins 13 h et d'au plus 48 h, pour couvrir la durée maximale d'un salon sans laisser expirer une allocation en cours. L'API doit émettre une durée suffisante (par exemple 14 h) et retourner `Cache-Control: no-store`, ainsi que les en-têtes CORS pour l'origine du site et les requêtes `Authorization` et `Content-Type`. Une expiration courte ne sera pas acceptée ; un mécanisme de renouvellement/réallocation serait nécessaire si ce choix évolue. Prévoir UDP et TURN/TLS sur 443 si le fournisseur le permet. Le serveur doit être accessible depuis les réseaux mobiles et les pare-feux concernés, avec les ports et les routes correctement configurés. Un nom de domaine d'exemple ne constitue pas un serveur opérationnel.

Le client contrôle la forme et la durée de la réponse, ajoute les serveurs à STUN et attend au maximum 10 secondes ; une configuration absente, invalide ou inaccessible ne coupe pas la liaison directe. « Configuré » ne signifie pas « utilisé » : pour vérifier un vrai déploiement, forcer temporairement `iceTransportPolicy: 'relay'` en environnement de test et contrôler les statistiques de la paire sélectionnée ainsi que le son dans les deux sens, puis tester normalement sur plusieurs appareils et réseaux. Les adresses et identifiants ne doivent pas figurer dans les diagnostics visibles.

Références : https://webrtc.org/getting-started/turn-server et https://developers.cloudflare.com/realtime/turn/generate-credentials/. Cloudflare et coturn sont des options possibles, pas des services déjà installés ; aucun fournisseur ni tarif n'est présumé.
