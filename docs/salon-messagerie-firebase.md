# Règles de la messagerie du salon

À appliquer **manuellement** dans les règles Firestore réellement en place, après sauvegarde et comparaison. Pour le transfert et le réglage du nombre de séances, la mise à jour du seul bloc messages ci-dessous ne suffit pas : utiliser le fichier complet `firestore.rules`, après comparaison avec la production. La publication du site ne publie pas les règles. Ce dépôt ne permet pas de vérifier les règles actuellement déployées.

Dans `match /salons_focus/{salonId}`, remplacer le bloc `match /membres/{uid}` existant par le bloc ci-dessous, puis ajouter le bloc `match /messages/{messageId}` à côté du bloc `membres`, toujours dans ce même salon. Conserver les autres règles et fonctions du salon, notamment `membre()` et `salonIdValide()`, ainsi que toutes les autres collections. L'ensemble complet de référence est `firestore.rules` ; ne pas remplacer à l'aveugle des règles de production différentes.

```rules
      match /membres/{uid} {
        function parentActif() {
          return request.auth != null && salonIdValide(salonId)
            && existsAfter(/databases/$(database)/documents/salons_focus/$(salonId))
            && getAfter(/databases/$(database)/documents/salons_focus/$(salonId)).data.ferme == false
            && getAfter(/databases/$(database)/documents/salons_focus/$(salonId)).data.expireLe > request.time;
        }
        function parentDeverrouille() {
          return getAfter(/databases/$(database)/documents/salons_focus/$(salonId)).data.verrouille == false;
        }
        function parentLisible() {
          return request.auth != null && salonIdValide(salonId)
            && exists(/databases/$(database)/documents/salons_focus/$(salonId))
            && get(/databases/$(database)/documents/salons_focus/$(salonId)).data.ferme == false
            && get(/databases/$(database)/documents/salons_focus/$(salonId)).data.expireLe > request.time
            && (get(/databases/$(database)/documents/salons_focus/$(salonId)).data.verrouille == false || membre());
        }
        function pseudoValide() {
          return request.resource.data.keys().hasAll(['pseudo']) && request.resource.data.keys().hasOnly(['pseudo', 'vuLe', 'messageLe', 'dernierMessageId'])
            && request.resource.data.pseudo is string && request.resource.data.pseudo.size() > 0
            && request.resource.data.pseudo.size() <= 30 && request.resource.data.pseudo.matches('.*[^ ].*')
            && (!('vuLe' in request.resource.data) || request.resource.data.vuLe is timestamp)
            && (('messageLe' in request.resource.data) == ('dernierMessageId' in request.resource.data))
            && (!('messageLe' in request.resource.data) || (request.resource.data.messageLe is timestamp
                && request.resource.data.dernierMessageId is string
                && request.resource.data.dernierMessageId.matches('^[A-Za-z0-9]{20}$')));
        }
        function messageAutorise() {
          let d = request.resource.data;
          let cheminMessage = /databases/$(database)/documents/salons_focus/$(salonId)/messages/$(d.dernierMessageId);
          return ('messageLe' in d) && d.messageLe == request.time
            && (!('messageLe' in resource.data) || resource.data.messageLe <= request.time - duration.value(2, 's'))
            && existsAfter(cheminMessage) && getAfter(cheminMessage).data.auteurUid == uid
            && getAfter(cheminMessage).data.envoyeLe == request.time;
        }
        function champsMessageInchanges() {
          return !request.resource.data.diff(resource.data).affectedKeys().hasAny(['messageLe', 'dernierMessageId']);
        }
        allow get, list: if parentLisible();
        allow create: if parentActif() && parentDeverrouille() && request.auth.uid == uid && pseudoValide()
          && !('messageLe' in request.resource.data)
          && (!('vuLe' in request.resource.data) || request.resource.data.vuLe == request.time);
        allow update: if parentActif() && request.auth.uid == uid && pseudoValide()
          && (champsMessageInchanges() || messageAutorise())
          && (!request.resource.data.diff(resource.data).affectedKeys().hasAny(['vuLe'])
              || !('vuLe' in request.resource.data) || request.resource.data.vuLe == request.time);
        allow delete: if request.auth != null && request.auth.uid == uid;
      }
      // Les messages restent dans Firestore après la fermeture : prévoir une
      // suppression serveur/TTL séparée avant tout usage avec des données sensibles.
      match /messages/{messageId} {
        function membreActif() {
          return request.auth != null && salonIdValide(salonId)
            && exists(/databases/$(database)/documents/salons_focus/$(salonId))
            && get(/databases/$(database)/documents/salons_focus/$(salonId)).data.ferme == false
            && get(/databases/$(database)/documents/salons_focus/$(salonId)).data.expireLe > request.time
            && membre();
        }
        function identite() {
          return getAfter(/databases/$(database)/documents/salons_focus/$(salonId)/membres/$(request.auth.uid)).data;
        }
        allow get: if membreActif();
        allow list: if membreActif() && request.query.limit != null && request.query.limit <= 50;
        allow create: if membreActif() && messageId.matches('^[A-Za-z0-9]{20}$')
          && request.resource.data.keys().hasOnly(['auteurUid', 'pseudo', 'texte', 'envoyeLe'])
          && request.resource.data.keys().hasAll(['auteurUid', 'pseudo', 'texte', 'envoyeLe'])
          && request.resource.data.auteurUid == request.auth.uid
          && request.resource.data.pseudo == identite().pseudo
          && request.resource.data.texte is string && request.resource.data.texte.size() > 0
          && request.resource.data.texte.size() <= 1000 && request.resource.data.envoyeLe == request.time
          && identite().messageLe == request.time && identite().dernierMessageId == messageId;
        allow update, delete: if false;
      }
```

Les personnes authentifiées et inscrites dans un salon actif peuvent lire les 50 derniers messages et envoyer du texte (1000 caractères maximum). Un message est lié à l'identité et au pseudo du membre et daté par le serveur ; le document du membre et le message sont écrits atomiquement, avec un délai minimum de deux secondes par membre. Le lien du salon reste un secret : les personnes qui le possèdent peuvent rejoindre et lire les messages. Le compteur affiche les nouveaux messages reçus pendant la session et revient à zéro à l'ouverture ; il ne constitue pas un accusé de lecture partagé.

La fermeture ou l'expiration empêche la lecture mais **ne supprime pas** les documents ; Firestore ne supprime pas automatiquement les sous-collections. Avant un usage avec des informations sensibles, mettre en place une suppression côté serveur ou une politique TTL effectivement configurée pour les messages et vérifier sa portée. Les règles et le délai ne suffisent pas à empêcher tous les abus ou coûts : prévoir modération, limites et protections serveur. Les vérifications automatisées utilisent un projet d'émulation et des identités fictives, pas le projet de production.
