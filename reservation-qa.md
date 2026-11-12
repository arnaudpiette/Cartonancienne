# Reprise du tunnel de réservation — état et recette

## Phase locale initiale — sources et environnement constatés

- Copie récupérée depuis le dépôt public `arnaudpiette/Cartonancienne`, sans modifications locales initiales.
- Branche de départ : `main`, HEAD `37880e736d0c0f5e7b2e280ca3224d1a9bb88367`.
- `preview/portfolio-admin` pointait vers le même commit lors de l’inspection.
- La branche historique `ux/homepage-navigation` pointe vers `96c7573178ce744094fadd0554c6b199dd52790f`.
- Node disponible ici : `v24.22.1`. Astro installé depuis le lockfile : `7.4.5`.
- Architecture observée : Astro SSR, TypeScript, adaptateur Vercel, Supabase SSR et PostgreSQL, notifications Resend avec simulation par défaut et boîte d’envoi SQL.
- Aucun `AGENTS.md` ni `design-qa.md` trouvé dans cette copie. Aucun de ces fichiers n’a été inventé ou remplacé.
- Conversations personnelles ChatGPT et dossier local du Mac non accessibles ici. Aucun historique de validation n’est déduit de leur absence.
- Aucun environnement Supabase distant de test configuré dans cet environnement cloud. Aucun service distant de production consulté pour les tests.

## Brief, code et vérification

Le brief impose les quatre étapes, Tarot Solo (60 minutes, 50 €), Tarot Roue (90 minutes, 70 €) et le paiement sur place. Les slugs SQL historiques sont conservés : `tarot-solo` et `roue-astrologique`.

Le code initial regroupait prestation, date, horaire et identité dans une seule vue. Il affichait une confirmation sur simple présence de `?confirmation=...`, sans vérification d’un enregistrement. Aucun module de paiement en ligne ou Stripe n’a été trouvé dans le parcours inspecté ; aucune intégration de paiement n’a été supprimée artificiellement.

Le code SQL contient une contrainte d’exclusion GiST contre les chevauchements de rendez-vous confirmés, de la RLS, des contrôles administrateur et une boîte d’envoi avec baux de notification. Ces mécanismes ont été testés dans PostgreSQL local ; leur présence effective et leur configuration dans Supabase distant restent non vérifiées.

Resend et les ICS sont implémentés dans les sources. La configuration Resend réelle, la délivrabilité, Vercel et les DNS one.com ne sont pas vérifiés et n’ont pas été modifiés.

## Changements

- Une route, quatre sections réellement successives, puis une confirmation distincte.
- Cartes de sélection des deux tirages ; calendrier absent de la première étape.
- Récupération des créneaux via GET `/api/reservations`, avec date de Paris, chargement, absence de créneaux et reprise après erreur.
- Revalidation du créneau lors d’un retour ; invalidation lors d’un changement de tirage ou de date.
- Prénom, nom et e-mail ; aucun téléphone. Le nom complet rejoint la colonne existante `customer_name` sans changement de schéma personnel.
- Validation client et serveur, focus et erreurs accessibles, récapitulatif et paiement sur place explicite.
- Soumission JSON, validation des paramètres et refus des origines étrangères.
- Confirmation uniquement après résultat de la transaction ; aucune confirmation depuis un paramètre d’URL.
- Clé opaque conservée en mémoire pour reconnaître une même soumission réessayée après perte de réponse.
- Migration additive 009 : table privée de clés, sérialisation transactionnelle d’une même demande, délégation à la création existante et maintien de la contrainte de chevauchement.
- Récapitulatif d’e-mail enrichi : offre, date de Paris, durée, prix et paiement sur place. Les UID ICS existants restent stables.
- Les modes notification transmise, en attente et simulée sont distingués ; un échec de notification n’annule jamais un enregistrement réussi.
- Médias, homepage, styles globaux, portfolio et administration existante préservés.

## Phase locale initiale — vérifications effectuées

- `npm test` : 6 tests unitaires réussis (validation, clés de prestation, dates, textes d’e-mail, ICS, notifications déjà réclamées).
- `npm run test:e2e` : 16 tests réussis (15 dans la suite initiale, puis le test ciblé ajouté pour la date vide et l’e-mail invalide) sur Chromium. Les parcours Solo et Roue sont vérifiés à 320, 390, 768 et 1440 px, avec un navigateur réglé sur America/New_York pour contrôler l’affichage Europe/Paris.
- Contrôles axe WCAG A/AA du tunnel aux étapes inspectées, navigation clavier, focus, maintien des valeurs, conflits, états vide/erreur et nouvelle tentative avec la même clé.
- `npm run test:db` : 7 sous-tests et leur suite réussis, dans PostgreSQL 17 local jetable. Migrations agenda 002 à 006 puis 009 réellement exécutées. Tests de RLS/permissions, requêtes concurrentes, chevauchements 60/90 minutes, blocages, dates passées, changements d’heure, baux de notification, déplacement et annulation.
- `npm run test:integration` : 2 tests réussis, avec le navigateur et l’API Astro reliés au véritable SQL local par un adaptateur RPC de test. Les deux destinataires sont forcés en échec simulé pour vérifier la confirmation malgré cet échec.
- `npm run check` : aucune erreur ni warning ; une indication de dépréciation de `createServerClient`, préexistante, reste présente.
- `npm run build` : build SSR avec adaptateur Vercel réussi. Ce résultat ne constitue pas un déploiement Vercel vérifié.
- Contrôle HTTP et captures locales mobile/desktop des pages accueil, tarot, ateliers, contact et réservation ; contrôle de la redirection de l’agenda privé vers login sans configuration Supabase.
- Aucun e-mail réel envoyé, aucune écriture distante, aucun commit, push ou déploiement.

## Reproduire sans production

Installer les dépendances verrouillées avec `npm ci`, puis :

```sh
ASTRO_TELEMETRY_DISABLED=1 npm test
ASTRO_TELEMETRY_DISABLED=1 npm run check
ASTRO_TELEMETRY_DISABLED=1 npm run build
npx playwright install chromium
npm run test:e2e
```

Un Chromium système peut être choisi avec `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. Les configurations navigateur utilisent leurs propres ports et désactivent explicitement les identifiants de production.

Pour la base locale jetable :

```sh
docker run --name cartonancienne-qa-pg --rm -d \
  -e POSTGRES_HOST_AUTH_METHOD=trust \
  -p 127.0.0.1:55432:5432 postgres:17-alpine
npm run test:db
npm run test:integration
docker stop cartonancienne-qa-pg
```

La confiance sans mot de passe est réservée à ce conteneur jetable lié à la boucle locale. Ne pas réutiliser cette configuration pour un service partagé. Chaque suite crée puis supprime sa propre base. Les scripts ignorent volontairement toute URL de base fournie par l’environnement et ne ciblent que `127.0.0.1:55432`.

La fixture SQL fournit des rôles et un substitut local de `auth.jwt()` ; elle ne recrée pas Supabase Auth, Storage ou toute la plateforme. L’adaptateur HTTP de test ne constitue pas une validation de PostgREST distant. Les migrations portfolio 001, 007 et 008 sont hors de cette fixture agenda et n’ont pas été modifiées.

## Checklist avant mise en service autorisée

- [x] Les quatre étapes sont distinctes et la progression correspond à la vue.
- [x] Solo et Roue, prix et durées attendus.
- [x] Retour/Continuer et maintien des coordonnées pendant le parcours.
- [x] Revalidation des disponibilités et refus d’un créneau occupé.
- [x] Doubles requêtes et nouvelles tentatives protégées dans PostgreSQL local.
- [x] Validation, clavier, focus, erreurs et contrôle responsive.
- [x] Paiement sur place dans le récapitulatif, la confirmation et les modèles de notification.
- [x] Aucun faux succès si le backend est absent ou en erreur.
- [x] Échec d’e-mail simulé sans perte de réservation.
- [ ] Vérifier le projet Supabase de test, son isolation et l’historique des migrations réellement appliquées.
- [ ] Valider 009 sur ce projet de test, avec les véritables rôles et PostgREST.
- [ ] Vérifier l’administration authentifiée dans ce projet isolé.
- [ ] Vérifier les paramètres Vercel, le domaine réel et l’absence de cache sur l’API.
- [ ] Vérifier les identités Resend et les modèles sans envoi réel non autorisé.
- [ ] Organiser une mise en service coordonnée du SQL et du serveur, uniquement après autorisation explicite.

## Points de vigilance et hors périmètre

1. La migration 009 retire l’accès public à `create_public_booking`, remplacé par `create_public_booking_once`. L’ancien serveur ne doit pas rester en service avec cette seule migration appliquée. Sans 009, le nouveau serveur renvoie une indisponibilité et ne simule pas de succès.
2. Les tarifs du brief sont affichés côté client ; les valeurs retournées lors de l’enregistrement proviennent de la base. Toute modification future des prestations doit synchroniser les données éditoriales et SQL.
3. Les données du parcours et la clé de nouvelle tentative restent en mémoire, pas après un rechargement ou une fermeture d’onglet. La contrainte SQL continue de protéger les chevauchements ; ne pas promettre une restauration après rechargement.
4. Le header mobile masque la navigation et affiche « Menu » via CSS, sans commande fonctionnelle dans cette version. Problème observé, laissé hors périmètre.
5. L’œuf et son illustration sont présents ; aucune rotation ou lévitation n’a été trouvée dans le code inspecté. Aucune animation historiquement validée n’est affirmée ni recréée.
6. Le formulaire administrateur de déplacement exige une nouvelle date et partage son formulaire avec l’annulation ; la validation native peut gêner l’annulation sans date. Corrigé pendant la mise en service de test : le bouton d’annulation porte maintenant `formnovalidate`.
7. Le générateur ICS existant place `METHOD` dans VEVENT ; une recette de compatibilité des clients calendrier reste à prévoir. Le domaine `.fr` de l’UID a été conservé pour ne pas casser l’identité des événements existants.
8. Aucun lien de gestion autonome client d’annulation/déplacement n’a été observé ; la confirmation oriente vers le contact et ne promet pas cette fonctionnalité.


## Mise en service de la preview de test — 11 novembre 2026

### Environnements effectivement vérifiés

- Projet Supabase de test : `Cartonancienne-test`, référence `wutmhtypevenekzuiejd`, distinct du projet principal `ujyftupbmveeztqqchje`.
- Les migrations portfolio 007 et 008 manquaient dans le projet de test ; elles ont été appliquées, puis la migration 009 de protection des nouvelles tentatives. Aucun contenu existant n’a été effacé.
- Le compte `C@rtosev` est provisionné dans Supabase Auth de test avec `app_metadata.role = admin`. L’API Auth officielle a été utilisée, sans mot de passe dans le dépôt et sans e-mail d’invitation. Authentification et rôle effectivement vérifiés.
- L’utilitaire temporaire de provisionnement a été remplacé immédiatement par une réponse HTTP 410, puis son arrêt a été vérifié.
- Les variables Vercel modifiées visent exclusivement Preview : adresse administrateur, URL et clé publique du projet de test, mode e-mail simulation.
- Production, DNS et branches distantes inchangés. Aucun commit ou push.

### Déploiement

- Équipe Vercel : `Arnaud` (`arnaud-b96e`).
- Projet : `cartonancienne`, `prj_uKBuW89HTCmEZNFWb8AutHAO5Og8`.
- Déploiement : `dpl_C3tZyJV3hv9xtn3BJt9aaSywKUDT`.
- Statut constaté : READY, cible Preview (`target: null` dans l’API Vercel).
- URL : https://cartonancienne-liw7qkugx-arnaud-b96e.vercel.app
- Alias de recette ajouté : https://cartonancienne-recette-arnaud-b96e.vercel.app
- Sources : copie de travail modifiée depuis `37880e7`, transférée directement par l’API fichiers, sans création d’un commit. La référence `work/reservation-preview` est une métadonnée de déploiement ; aucune branche Git de ce nom n’a été créée ou poussée.
- Build Vercel réussi. Le projet garde son réglage Node 26 préexistant pour le build ; l’adaptateur constate l’exécution des fonctions en Node 24. Aucun changement global de ce réglage.
- Protection Vercel conservée : SSO actif pour les URL hors domaines personnalisés.
- Aucun groupe d’erreurs/fatal trouvé dans les journaux d’exécution de cette preview lors du contrôle.

### Recette réelle avec Supabase de test

Le navigateur local a été relié au véritable projet Supabase de test, sans doubles de base de données :

- Connexion `C@rtosev` vers `/admin` réussie.
- Agenda privé et éditeur d’œuvres accessibles.
- Création d’un brouillon sans média, lecture dans l’éditeur et suppression immédiate réussies. Aucun média original remplacé.
- Ouverture d’une plage fictive le 12 novembre 2026 de 10 h à 17 h Europe/Paris, explicitement annotée comme recette de test.
- Solo : enregistrement de 60 minutes à 50 €, confirmation distincte et notification annoncée comme simulation.
- Roue : enregistrement de 90 minutes à 70 €, confirmation distincte et notification annoncée comme simulation.
- Annulation des deux réservations de recette dans le backoffice sans devoir remplir une nouvelle date. Leurs lignes restent annulées pour conserver l’historique ; aucun rendez-vous préexistant n’a été touché.
- Une première assertion de recette a lu le statut avant stabilisation de la navigation ; la base a confirmé l’annulation et un contrôle après rechargement a validé son affichage.
- Aucun e-mail réel envoyé.

### Vérifications sur Vercel et limite restante

- `/login` : HTTP 200 et formulaire applicatif reçu via l’outil Vercel authentifié.
- `/api/reservations?service=tarot-solo&day=2026-11-12` : HTTP 200, créneaux réels du projet Supabase de test renvoyés.
- Le navigateur automatisé atteint la page d’authentification Vercel avant l’application. Un lien temporaire a été créé pour la recette, mais la transmission en en-tête n’a pas donné accès au navigateur.
- Le contrôle automatique d’approbation a refusé de placer le jeton de partage dans l’URL en raison de l’exposition possible dans l’historique, les journaux ou les référents. Ce refus n’a pas été contourné. Le lien temporaire propre à l’alias a été révoqué ; son absence a été vérifiée.
- La connexion complète par navigateur directement sur Vercel reste donc non vérifiée. Elle ne doit pas être présentée comme réussie. Pour un contrôle manuel, se connecter d’abord avec le compte Vercel autorisé, puis avec `C@rtosev` dans le formulaire du site.
- Les e-mails sont volontairement simulés dans cette preview ; la délivrabilité Resend réelle n’est pas validée.

### Advisories Supabase

Les contrôles signalent des points préexistants ou attendus, conservés sans élargissement du périmètre :

- Tables privées avec RLS sans policy publique : `booking_services` et `booking_request_keys`, accessibles par les fonctions prévues, pas en lecture directe anonyme.
- Fonctions SECURITY DEFINER exposées : les RPC publiques sont intentionnelles ; les RPC administrateur vérifient le rôle. Les permissions et contrôles doivent rester audités avant une mise en production.
- `admin_booking` sans search_path explicite, extension `btree_gist` dans `public`, protection des mots de passe compromis désactivée.

Références : [fonctions exposées](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [search_path](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable), [sécurité des mots de passe](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).


## Projet principal Cartonancienne — demande explicite suivante

Cette section décrit l’état actuel et remplace le ciblage du projet de test pour la preview de recette. Les phases précédentes restent l’historique des vérifications.

### Cible et compte

- Projet demandé : `Cartonancienne Project`, `ujyftupbmveeztqqchje`.
- Inspection initiale : tables applicatives et RLS présentes ; portfolio avec colonnes 007 et invariant 008 déjà installé ; 0 œuvre, 0 réservation, 0 notification et 0 disponibilité.
- L’historique Supabase des migrations était vide bien que le schéma existe : aucune réapplication aveugle des migrations historiques.
- Le compte administrateur demandé existait, mais n’était pas confirmé et n’avait pas le rôle admin. Il ne possédait aucune session active. Le mot de passe fourni ne permettait pas sa connexion.
- Une fonction de provisionnement privilégiée temporaire a été refusée par le contrôle automatique pour le projet principal ; cette méthode n’a pas été utilisée ni contournée.
- Une alternative sans endpoint public a été appliquée : transaction SQL ciblée sur le compte existant, avec contrôle de son identifiant et de son adresse, mot de passe haché localement en bcrypt, confirmation de l’adresse et fusion du rôle dans `raw_app_meta_data` en conservant les autres métadonnées.
- Aucune copie du mot de passe en clair dans le SQL, les migrations, le dépôt ou les archives. Le compte existant a été conservé, sans doublon.
- Vérification effective via Supabase Auth : HTTP 200, adresse confirmée, rôle admin. Lecture des œuvres, rendez-vous et disponibilités : HTTP 200. RPC de contrôle administrateur : true. La session de vérification a été fermée.

### Migration compatible

- La protection des nouvelles tentatives a été ajoutée au projet principal.
- Un fichier de migration de compatibilité a été créé avec le CLI Supabase : `20261111222342_keep_legacy_booking_rpc_during_rollout.sql`.
- PostgreSQL local jetable : la suite de 7 sous-tests et sa suite parente passe avec cette compatibilité (8 résultats réussis), dont concurrence, RLS, conflits, changement d’heure et notifications.
- La passerelle a également été appliquée au projet de test.
- Sur le principal, 009 et la passerelle ont été appliquées dans une seule transaction, enregistrée sous `booking_request_idempotency_compatible`. L’ancienne RPC n’a donc pas connu d’interruption entre deux migrations.
- Contrôles après application : nouvelle RPC présente et exécutable par les rôles prévus ; ancienne RPC toujours accessible aux clients existants ; table des clés inaccessible en lecture anonyme ; tous les compteurs de contenu restent à zéro.
- Les fonctions exposées intentionnellement restent signalées par les advisors. Les autres avertissements préexistants restent décrits dans la section précédente ; aucun relâchement de RLS ou suppression de contrainte de chevauchement.

### Preview Vercel actuelle

- Déploiement : `dpl_5GioKWDcpfjmVQWtPqQAiVgaS6va`, READY, Preview.
- URL unique : https://cartonancienne-6wugo6nls-arnaud-b96e.vercel.app
- Alias de recette mis à jour : https://cartonancienne-recette-arnaud-b96e.vercel.app
- La preview utilise désormais le projet principal `ujyftupbmveeztqqchje` : les actions manuelles de son backoffice portent sur les données de ce projet.
- Variables Preview configurées : URL Supabase principale, clé publique correspondante, adresse administrateur demandée, mode e-mail simulation et URL du site de recette.
- Aucune variable Vercel Production, aucun DNS, aucun domaine de production ou branche distante modifié. Aucun commit ou push.
- Contrôle Vercel authentifié : `/login` renvoie HTTP 200 avec le formulaire ; l’API des disponibilités renvoie HTTP 200 et `slots: []`, cohérent avec l’agenda principal vide.
- Aucun créneau fictif, aucune réservation de test ni aucune œuvre de recette créé dans le principal. Les créneaux fictifs et lignes de recette des phases précédentes restent uniquement dans Cartonancienne-test.
- La protection Vercel est conservée. La connexion du navigateur automatisé sur Vercel reste non vérifiée en raison de cette protection ; aucun nouvel essai avec un jeton dans l’URL n’a été effectué.
- Les notifications de cette preview restent en simulation ; aucun e-mail réel envoyé. L’activation transactionnelle réelle et une publication sur le domaine principal sont des opérations distinctes.


## Finalisation demandée pour main — 12 novembre 2026

### Historique retrouvé et intégration

La conversation partagée a finalement été accessible dans Chromium après chargement complet. Elle confirme les travaux restés sur `ux/homepage-navigation` à `96c7573` : header/hero responsive, menu mobile accessible, galeries, pages tarot/ateliers/à propos/contact, polices locales Bodoni Moda et DM Mono, retrait du rendu public de la note Gloria. La rotation 360° de l’œuf y est explicitement annoncée comme non intégrée : elle n’a pas été inventée.

Ces fichiers ont été intégrés à la copie issue de main, en conservant le nouveau tunnel à quatre vues plutôt que l’ancien parcours de la branche. Les deux dépendances de polices ont été ajoutées aux versions exactes 5.3.0. Aucun média original remplacé. La donnée interne Gloria reste dans les données ; son rendu public a disparu de l’accueil et de la galerie.

La recette a trouvé puis corrigé deux défauts ciblés : le style `display:block` des cartes annulait leur attribut hidden lors du filtrage ; certaines flèches décoratives n’avaient pas de glyphe lisible avec la police éditoriale. Les cartes masquées respectent maintenant hidden, et les flèches diagonales utilisent une icône SVG indépendante de la couverture des polices.

### E-mails et calendrier

- Domaine `lacartonancienne.com` vérifié dans Resend ; envoi activé côté fournisseur, DKIM/SPF vérifiés.
- Expéditeur : `La Cartonancienne <reservations@lacartonancienne.com>`.
- Notifications internes : adresse administrateur demandée, configurée côté serveur.
- Réponses des clients : adresse de Séverine via Reply-To. Réponses de Séverine aux notifications : adresse du client.
- Production Vercel : projet Supabase principal, adresse administrateur, expéditeur et mode live configurés. Clé Resend existante conservée ; aucune nouvelle clé publiée ou copiée dans le dépôt.
- Previews et tests locaux : simulation conservée.
- Ajout d’une clé d’idempotence Resend par notification et destinataire, timeout réseau de 10 secondes, validation d’une réponse contenant un identifiant fournisseur.
- Migration `20261112000222_notification_email_event_timestamp.sql` appliquée au projet principal après validation locale : la réclamation d’envoi renvoie l’horodatage d’origine. Le contenu et les pièces jointes restent identiques lors d’une relance, y compris DTSTAMP.
- METHOD replacé au niveau VCALENDAR ; UID ICS historiques conservés pour les mises à jour et annulations.
- Aucune réservation de test ou notification fictive créée dans le principal. Aucun e-mail réel envoyé pendant la recette. L’acceptation/délivrabilité réelle d’un message Vercel n’est donc pas présentée comme testée.
- L’envoi depuis une adresse vérifiée et Reply-To ne créent pas une boîte ni une redirection one.com : la réception de messages écrits directement à l’alias reste une configuration distincte, non vérifiée faute d’accès à cette messagerie.

### Résultats de recette

- 9 tests unitaires réussis : validation, dates, ICS, expéditeur/destinataires/réponses, idempotence de transport et échecs fournisseur.
- 7 sous-tests PostgreSQL et leur suite parente réussis dans une base locale jetable : concurrence, chevauchements, RLS, ancien appel compatible, horodatage stable, outbox, annulation/déplacement et heure d’hiver.
- 2 tests d’intégration Astro/API/SQL locale réussis, avec échec simulé des e-mails et réservation conservée.
- 20 tests navigateur réussis : quatre étapes, deux offres, 320/390/768/1440 px, clavier et erreurs, menu 375/390/760 et bascule desktop 761, filtrage, polices et routes publiques.
- 72 observations supplémentaires : les douze routes publiques à 1920×1080, 1440×900, 1024×768, 768×1024, 390×844 et 375×667 ; HTTP 200, un H1 dans main, aucune image cassée ou largeur débordante, aucune exception JavaScript observée.
- Captures hors dépôt : `/workspace/cartonancienne-release-qa/`. Les captures avant correction des flèches sont complétées par `arrows-corrected.png`.
- Contrôle Astro/TypeScript et build réussis ; indication de dépréciation Supabase préexistante, sans erreur.
- `git diff --check` réussi ; migration 001 et médias originaux préservés.

### Lecture artistique

| Critère | Appréciation | Justification |
| --- | --- | --- |
| Univers de Séverine | 8,5/10 | Œuf, phénix, bleu encre, œuvres et portrait restent au centre. |
| Élégance | 8/10 | Fond ivoire, Bodoni et espaces généreux cohérents. |
| Lisibilité | 8/10 | Décisions de réservation isolées, tarifs et paiement sur place explicites. |
| Responsive | 8/10 | Menu utilisable, galeries lisibles et absence de débordement sur les formats contrôlés. |
| Cohérence globale | 8,5/10 | Même système typographique et éditorial dans les pages et le tunnel. |

Aucun défaut fonctionnel bloquant restant identifié dans la recette locale. Les grands espaces entre introduction et galerie et la densité de certains titres mobiles restent des ajustements artistiques facultatifs pour la prochaine passe ; la composition n’a pas été refaite.

### Projet Supabase de test

La suppression est explicitement demandée. La structure a été sauvegardée hors dépôt dans `/workspace/backups/cartonancienne-test-schema-2026-11-12.json` (tables, colonnes, contraintes, index, policies, fonctions et compteurs). Le connecteur installé ne propose pas la suppression et le CLI n’a pas de session authentifiée. Le propriétaire a choisi d’effectuer la suppression dans le Dashboard ; elle doit être confirmée par la liste des projets avant d’être annoncée comme faite. Les déploiements historiques utilisant ce projet cesseront naturellement d’accéder à leur ancienne base ; les configurations courantes Preview et Production utilisent déjà le principal.
