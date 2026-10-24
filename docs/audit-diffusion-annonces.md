# Vérification statique du circuit des annonces — 24 octobre 2026

**Aucun e-mail, aucune annonce et aucune fiche n’ont été envoyés ou créés pour cet audit.** Les tests utilisent des comptes et adresses fictifs en mémoire ; ils interceptent toute tentative d’envoi.

## Parcours observé dans le code

1. L’auteur conserve éventuellement un brouillon dans son propre document `comptes/{uid}` (lecture/écriture restreinte au propriétaire dans `firestore.rules`). À la soumission, l’annonce rejoint `publie` sous forme d’événements immuables.
2. Trois autres comptes personnels distincts approuvent. Le dernier accord lance immédiatement `annoncePublierMaintenant`, ou `annonceProgrammer` si une date future est choisie. L’envoi programmé n’a **pas** de serveur planificateur : il est repris quand un navigateur visite le site (`annonceEnvoyerDues`).
3. Après la publication, le navigateur de l’administrateur collecte les destinataires dans son cache de fiches `emplois`, `questions`, `feedbacks`, `profils` et dans sa session (`annonceDestinataires`). `annonceLireComptes()` renvoie toujours une liste vide : il n’existe pas de répertoire exhaustif de comptes abonnés dans ce circuit.
4. Pour chaque adresse retenue, `annoncePosterMail` poste à un script Apps Script utilisant `GmailApp.sendEmail`, avec un secret récupéré via une configuration réservée aux administrateurs. Une réponse `success` signifie que le script a accepté sa tentative, **pas** que la boîte de réception a effectivement reçu ou lu le courriel.
5. Les échecs sont comptés, et le bouton « Renvoyer les mails manquants » permet une nouvelle tentative depuis un compte autorisé.

## Conclusion : « tous les utilisateurs » n’est pas vérifiable ni garanti

- Le nombre de destinataires est plafonné à **40 adresses** par annonce (`slice(0, 40)` dans `annonceDestinataires`). Un test simulé avec 50 adresses valides n’en retient que 40.
- Un utilisateur inscrit n’ayant aucune fiche dans les catégories consultées peut manquer. Inversement, une adresse déclarée dans une question ou un feedback n’est pas nécessairement celle d’un compte inscrit. Les lectures privées sont elles-mêmes limitées/paginées (`boiteChargerListes`, `boiteFusionner`).
- Une publication programmée dépend d’un passage sur le site à partir de l’heure prévue ; elle ne part pas exactement à cette heure si personne n’ouvre le site.
- Les limites ou indisponibilités d’Apps Script/Gmail, l’expiration du secret et le classement en spam ne sont pas mesurables par ces tests. Aucune authentification au service distant ni interrogation des boîtes réelles n’a été faite.
- Les annonces **soumises mais non publiées** sont encore stockées dans la collection `publie` lisible publiquement au niveau Firestore ; l’interface élèves les masque, mais cela ne garantit pas leur confidentialité côté base. Les brouillons privés, eux, restent dans `comptes/{uid}`. Il faudrait séparer les annonces en attente dans une collection privée et adapter les règles/lectures pour fermer cette exposition.

**Vérification automatisée sans e-mail :** `node tools/verifier-flux-annonce.js`. Une garantie de diffusion à tous nécessiterait un registre serveur complet des abonnés, un service d’envoi côté serveur, une pagination sans plafond arbitraire, et un suivi des erreurs et des envois confirmé côté service, puis une vérification indépendante des réceptions (sans tests sur des comptes réels sans autorisation).
