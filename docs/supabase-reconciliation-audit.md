# Audit de réconciliation Supabase — La Cartonancienne

Observation en lecture seule du 16 novembre 2026. Aucun SQL de mutation, appel RPC applicatif, upload, connexion administrateur ou envoi de courriel n'a été effectué. Les preuves viennent des catalogues PostgreSQL des deux projets, de leurs historiques `supabase_migrations.schema_migrations`, des advisors Supabase et du commit local `4f428d61f6c39b31b1bebc05851fa6612ced4e3e`. Les catalogues prouvent l'état observé, pas la provenance historique exacte d'un objet. Le script associé est `supabase/preflight/production-readiness-readonly.sql`.

## Périmètre et état Git

| Élément | Constat |
| --- | --- |
| Source | `origin/chore/production-readiness` = `4f428d61f6c39b31b1bebc05851fa6612ced4e3e` au contrôle initial |
| Travail | worktree isolé, branche locale `audit/supabase-reconciliation`, même HEAD, propre avant les deux rapports |
| Référence distante main | `ceb13e37140c4ae8340ef2b22da54bea9950ec76` après `git fetch origin --prune` |
| Production | `Cartonancienne Project`, ref `ujyftupbmveeztqqchje`, ACTIVE_HEALTHY, PostgreSQL 17.11, région `eu-west-2` |
| Test | `Cartonancienne-test`, ref `wutmhtypevenekzuiejd`, ACTIVE_HEALTHY, PostgreSQL 17.11, région `eu-west-2` |

Le checkout d'origine n'a pas été touché. Il portait déjà `.env.example` et `supabase/migrations/001_cartonancienne.sql` modifiés, ainsi que `design-qa.md` non suivi. Le travail d'audit ne lit ni ne réécrit ces fichiers locaux sensibles ou préexistants.

## Historique effectivement enregistré

| Projet | Version | Nom enregistré |
| --- | --- | --- |
| Production | `20261111222624` | `booking_request_idempotency_compatible` |
| Production | `20261112001115` | `notification_email_event_timestamp` |
| Test | `20261108010151` | `notification_delivery_outbox` |
| Test | `20261111213536` | `artwork_portfolio_management` |
| Test | `20261111213542` | `published_artworks_require_slug` |
| Test | `20261111213550` | `booking_request_idempotency` |
| Test | `20261111222617` | `keep_legacy_booking_rpc_during_rollout` |

Ni 001–005 ni la plupart des étapes suivantes ne sont enregistrées sous leurs noms locaux en Production ou Test. Les effets de 001–009 sont pourtant présents dans les deux schémas. La Production possède la réponse `event_at` de `claim_booking_notification_delivery`, absente de Test. L'historique Production contient une migration « compatible » sans fichier homonyme local. Les versions des migrations de compatibilité et d'horodatage diffèrent aussi des noms de fichiers locaux. Cela est compatible avec des applications manuelles ou d'autres artefacts de migration, sans permettre de prouver lesquels ni quand. Aucune ligne ne prouve qu'une migration locale donnée a été exécutée telle quelle. À l'inverse, l'absence d'une ligne ne prouve pas qu'elle n'a jamais été exécutée manuellement.

### Inventaire exhaustif des migrations locales

Abréviations : T = tables, F = fonctions ou triggers, P = politiques, I = index ou contraintes, D = droits. « Mutation de données » désigne une écriture sur les lignes métier, même si le fichier est une migration légitime. La colonne « rejeu » décrit le risque sur les projets *déjà peuplés en objets*, pas un essai réalisé.

| Fichier / version locale | Objectif, objets et dépendances | D, données, caractère rejouable |
| --- | --- | --- |
| `001_cartonancienne.sql` / `001` | T `artworks`, `artwork_media`, bucket `artworks`; P lecture publiée/admin, gestion admin et 4 P Storage. I PK, slug unique, chemin média unique, FK. Départ du portfolio. | `CREATE TABLE IF NOT EXISTS`, mais P non conditionnelles et UPSERT de configuration du bucket. **Non idempotente globalement** ; rejouer échoue sur P déjà créées et peut réécrire la configuration du bucket. Pas de suppression de données. |
| `002_booking_agenda.sql` / `002` | Extension `btree_gist`; T `booking_services`, `availability_windows`, `appointments`, `booking_notifications`; F `admin_booking`, `public_available_slots`, `create_public_booking`, `admin_set_availability`, `admin_change_appointment`; P admin/RLS; I PK/FK/CHECK + exclusion GiST. Dépend de PostgreSQL/Supabase. | D table `REVOKE` puis lectures/mise à jour admin, `GRANT EXECUTE` RPC. Deux services insérés **avec mise à jour en conflit**. Non rejouable : T/P/contrainte existantes, risque de changer services et de remplacer les RPC. |
| `003_fix_booking_slot_ambiguity.sql` / `003` | Remplace F `create_public_booking` pour qualifier `slot.start_at`; dépend de 002. Pas de T/P/I. | `GRANT EXECUTE` anon/auth. Pas de lignes métier, mais remplace le code et retourne seulement 2 colonnes : **échec ou régression** face au retour actuel à 4 colonnes de 006. |
| `004_fix_agenda_admin_grants.sql` / `004` | Ajuste D de `availability_windows`, `appointments`, `booking_notifications`; dépend de 002. Pas de T/F/P/I. | `GRANT SELECT` à authenticated et `GRANT UPDATE` notifications. Rejeu techniquement répétable, mais ne pas l'utiliser pour « réparer » l'historique sans audit. |
| `005_fix_agenda_move_ambiguity.sql` / `005` | Remplace F `admin_change_appointment` pour qualifier les colonnes; dépend de 002. Pas de T/P/I. | `GRANT EXECUTE` authenticated. Définition réappliquée même si déjà présente; pas de mutation de lignes, mais réécriture de fonction en production. |
| `006_notification_delivery_outbox.sql` / `006` | T `booking_notification_deliveries`, colonne token de `booking_notifications`; F trigger `create_notification_deliveries`, `claim_…`, `complete_…`, nouvelle signature de `create_public_booking`; P lecture admin; I token unique et paire notification/destinataire unique. Dépend de 002–005. | D `REVOKE`/`GRANT`; **DROP TRIGGER** puis recréation et **DROP FUNCTION** de l'ancienne RPC; non rejouable (P déjà créée, dépendances et signatures). Préserve les lignes existantes mais ne rétro-remplit pas les livraisons anciennes. |
| `007_artwork_portfolio_management.sql` / `007` | Colonnes `year`, `show_in_cabinet`, `display_order`; I listing publié et couverture unique; P Storage lecture d'un média lié à une œuvre publiée. Dépend de 001. | D `GRANT SELECT` anon/auth et DML authenticated. Additive, partiellement idempotente. L'index couverture échouerait si plusieurs couvertures existaient; les deux projets ont aujourd'hui zéro média. |
| `008_published_artworks_require_slug.sql` / `008` | CHECK de publication avec slug non blanc sur `artworks`; dépend de 001/007. | Ni D ni données modifiées. Conditionnelle sur nom de contrainte; échouerait si des œuvres déjà publiées avaient un slug null/blanc. Aujourd'hui zéro œuvre. |
| `009_booking_request_idempotency.sql` / `009` | T `booking_request_keys`; F `create_public_booking_once`; I PK et unicité `appointment_id`; RLS sans policy. Dépend de 006 et de l'ancienne RPC. | `REVOKE` sur T et ancienne RPC; `GRANT` wrapper. Non rejouable (`CREATE TABLE/FUNCTION` sans garde). Pas de lignes métier modifiées. Le `REVOKE` final est contredit par la migration de compatibilité suivante. |
| `20261111222342_keep_legacy_booking_rpc_during_rollout.sql` | Rétablit temporairement l'ancienne RPC `create_public_booking` pour anciens clients; dépend de 009. Pas de T/P/I. | `GRANT EXECUTE` anon/auth; techniquement répétable, mais laisse le contournement de l'idempotence ouvert. |
| `20261112000222_notification_email_event_timestamp.sql` | F `claim_booking_notification_delivery` retourne aussi `event_at`, pour rendre les répétitions de notification stables; dépend de 006. Pas de T/P/I. | **DROP FUNCTION** puis recréation et D `REVOKE`/`GRANT`. Pas de mutation de lignes; non rejouable sans vérifier dépendances et signature. Effet présent en Production, absent en Test. |

Ordre logique *théorique* sur une base vierge isolée : 001 → 002 → 003 → 004 → 005 → 006 → 007 → 008 → 009 → compatibilité → horodatage. Ce rejeu intégral n'a pas été exécuté sur une base vierge dans cet audit et ne doit jamais être tenté sur Production ou Test. Les fichiers 003, 005, 006 et le dernier modifient des fonctions existantes; leur ordre et leurs signatures sont déterminants. L'ordre lexicographique des fichiers horodatés n'implique pas que les opérations observées aient suivi exactement cet ordre.

## Inventaire réel Production et Test

Les deux projets ont les mêmes huit tables publiques, 65 colonnes, 36 contraintes, 16 index, 14 politiques observées (9 publiques et 5 Storage), 1 trigger applicatif, 1 bucket, 6 extensions et 9 fonctions applicatives. RLS est activée pour les huit tables, sans `FORCE RLS`. Il n'y a pas de séquence dans `public`. L'inventaire exhaustif des noms, types, valeurs par défaut, expressions et droits peut être régénéré avec le preflight associé. Schémas observés : `auth`, `extensions`, `graphql`, `graphql_public`, `public`, `realtime`, `storage`, `supabase_migrations`, `vault`.

| Table | Colonnes actuelles communes aux deux projets | Contraintes structurantes |
| --- | --- | --- |
| `artworks` | `id`, `title`, `slug` nullable, `category`, `description` nullable, `status`, `created_at`, `updated_at`, `year` nullable, `show_in_cabinet`, `display_order` | PK; slug unique; catégorie/status limités; année 1000–9999; publié ⇒ slug non blanc |
| `artwork_media` | `id`, `artwork_id`, `storage_path`, `alt_text`, `credit` nullable, `position`, `is_cover`, `width`/`height` nullable, `created_at` | PK; FK œuvre avec `ON DELETE CASCADE`; chemin unique; index partiel couverture unique par œuvre |
| `booking_services` | `slug`, `title`, `duration_minutes`, `price_eur`, `active` | PK; slugs admis; durée 60/90; prix positif |
| `availability_windows` | `id`, `start_at`, `end_at`, `kind`, `note` nullable, `created_at` | PK; `end_at > start_at`; kind `open`/`blocked` |
| `appointments` | `id`, `service_slug`, `customer_name`, `customer_email`, `start_at`, `end_at`, `status`, `created_at`, `updated_at`, `cancelled_at` nullable, `cancellation_reason` nullable | PK/FK; longueurs du nom/courriel; dates ordonnées; exclusion GiST des rendez-vous confirmés qui se chevauchent |
| `booking_notifications` | `id`, `appointment_id`, `event`, `status`, `attempts`, `last_error` nullable, `created_at`, `sent_at` nullable, `notification_token` | PK/FK cascade; événements/statuts limités; token unique |
| `booking_notification_deliveries` | `id`, `notification_id`, `recipient`, `status`, `attempts`, `last_error` nullable, `sent_at`/`locked_at`/`lease_id` nullable, `created_at` | PK/FK cascade; destinataire et statut limités; tentatives positives; paire notification/destinataire unique |
| `booking_request_keys` | `request_id`, `appointment_id`, `created_at` | PK; `appointment_id` unique, FK cascade |

Extensions : `btree_gist` 1.7 en `public`, `pg_stat_statements` 1.11, `pgcrypto` 1.3, `plpgsql` 1.0, `supabase_vault` 0.3.1, `uuid-ossp` 1.1. Le trigger `booking_notifications_create_deliveries` agit après insertion et appelle `create_notification_deliveries()`. Le bucket `artworks` est **privé** dans les deux projets, limite de 10 485 760 octets et types JPEG/PNG/WebP. Aucun objet Storage dans ce bucket. Les 9 fonctions applicatives ont les mêmes définitions dans les deux projets, à l'exception de `claim_booking_notification_delivery` : `TABLE(claimed boolean, lease_id uuid, event_at timestamptz)` en Production, seulement les deux premiers champs en Test.

| Agrégat | Production | Test |
| --- | ---: | ---: |
| `artworks` / `artwork_media` / objets du bucket | 0 / 0 / 0 | 0 / 0 / 0 |
| `booking_services` | 2 | 2 |
| `availability_windows` | 0 | 4 ouvertes |
| `appointments` | 0 | 5 : 2 confirmés, 3 annulés |
| `booking_notifications` | 0 | 9 : 5 pending, 4 sent |
| `booking_notification_deliveries` | 0 | 8 : 8 sent |
| `booking_request_keys` | 0 | 2 |
| Comptes admin confirmés, agrégat | 1 | 2 |

La présence de données en Test est prouvée, leur caractère fictif n'a pas été vérifié parce que l'audit s'interdit de lire les lignes personnelles. Les 9 notifications et 8 livraisons de Test ne suffisent pas à conclure à une perte : des notifications plus anciennes peuvent ne pas avoir été rétro-remplies; une vérification *agrégée par événement* est requise avant toute conclusion opérationnelle.

## Matrice de réconciliation à trois sources

« Conforme » signifie conforme aux invariants visibles dans les fichiers et catalogues, pas historique prouvé. Pour les lignes 001–005, l'effet présent sans version enregistrée doit rester « provenance non prouvée ».

| Objet | Local | Production | Test | Migration probable | Écart / risque |
| --- | --- | --- | --- | --- | --- |
| `artworks`, `artwork_media` | 001 + 007 + 008 | présents, vides, RLS | idem | 001/007/008 | effet conforme; versions non enregistrées en Production; 007/008 seulement enregistrées en Test; provenance incertaine |
| `booking_services` | 002 | présent, 2 lignes | idem | 002 | effet présent sans 002 enregistrée; rejouer 002 réécritrait les services |
| `availability_windows` | 002 | présent, vide | présent, 4 | 002 | effets présents sans 002 enregistrée; ne pas effacer Test |
| `appointments` | 002 | présent, vide | présent, 5 | 002 | exclusion active; effets présents sans 002 enregistrée |
| `booking_notifications` | 002 + 006 | présent, vide | présent, 9 | 002/006 | token/trigger présents; 006 enregistrée seulement en Test |
| `booking_notification_deliveries` | 006 | présent, vide | présent, 8 | 006 | effet présent, historique incomplet en Production |
| `booking_request_keys` | 009 | présent, vide | présent, 2 | 009 | effet présent; noms/versions d'historique divergents |
| `public_available_slots` | 002 | présente, anon/auth EXECUTE | idem | 002 | lecture seule de créneaux; définition conforme, provenance non prouvée |
| `create_public_booking` | 002 → 003 → 006 | présente, anon/auth EXECUTE | idem | 006 + compatibilité | **RPC ancienne encore exposée**; contourne la clé de requête |
| `create_public_booking_once` | 009 | présente, anon/auth EXECUTE | idem | 009 / migration compatible | garde d'idempotence présente, mais non exclusive |
| `admin_set_availability` | 002 | présente, anon/auth EXECUTE, garde interne admin | idem | 002 | grant anon plus large que l'intention; garde interne protège l'écriture |
| `admin_change_appointment` | 002 + 005 | présente, anon/auth EXECUTE, garde interne admin | idem | 005 | idem |
| `claim_booking_notification_delivery` | 006 + horodatage | retour avec `event_at`, anon/auth EXECUTE | retour sans `event_at`, anon/auth EXECUTE | 006 puis horodatage | **définition différente** : code récent lit `event_at`; le mode réel exige cette valeur |
| `complete_booking_notification_delivery` | 006 | présente, anon/auth EXECUTE | idem | 006 | garde admin ou token éphémère + lease, reste une surface publique à surveiller |
| `admin_booking` | 002 | invoker, anon/auth EXECUTE | idem | 002 | JWT app_metadata contrôlé, `search_path` mutable |
| Bucket `artworks`, politiques Storage | 001 + 007 | privé; 4 admin + 1 lecture publiée | idem | 001/007 | accès brouillon interdit par expressions observées; origine historique incertaine |
| Anti-chevauchement | 002 | contrainte GiST active | idem | 002 | conforme; risque de rejeu de 002 |
| Slug publié | 001 + 008 | unique + CHECK non blanc | idem | 008 | conforme; slug brouillon peut rester null, comme voulu |
| Couverture unique | 007 | index unique partiel actif | idem | 007 | conforme; zéro média, pas de conflit actuel |

## Droits, RLS et sécurité

`roles={public}` dans `pg_policies` exprime l'ensemble de rôles auquel la politique peut s'appliquer; ce n'est pas une permission d'écriture autonome. Sur `artworks` et `artwork_media`, les politiques `ALL` exigent `auth.jwt()->'app_metadata'->>'role' = 'admin'` en `USING` **et** en `WITH CHECK`. Les politiques de lecture laissent voir les œuvres `published` et leurs médias, ou les lignes aux admins. Les quatre politiques Storage d'écriture/lecture admin exigent le bucket `artworks` et le même rôle; la lecture publique Storage exige `bucket_id='artworks'` **et** une jointure `storage_path=objects.name` vers une œuvre `published`. Aucune politique Storage publique d'INSERT/UPDATE/DELETE. RLS et contraintes empêchent, selon les définitions observées, l'accès anonyme aux brouillons et leur écriture. Aucun test d'attaque avec compte n'a été fait.

Les tables `artworks` et `artwork_media` accordent pourtant directement SELECT/INSERT/UPDATE/DELETE à anon **et** authenticated; les politiques RLS font donc toute la séparation. À l'inverse, les tables de réservation n'accordent aucun accès direct à anon; `booking_services` et `booking_request_keys` n'ont ni policy ni droits anon/auth. `booking_notifications` accorde SELECT/UPDATE à authenticated, mais l'expression de la policy UPDATE exige admin en `USING` (`WITH CHECK` est non explicite) et SELECT exige aussi admin. Les données de rendez-vous restent sous RLS admin. FORCE RLS est désactivé partout; les rôles privilégiés et `SECURITY DEFINER` gardent leurs capacités habituelles.

| Priorité | Alerte et preuve | Action future, sans exécution ici |
| --- | --- | --- |
| P0 | **Aucune exposition non autorisée directement démontrée** par les catalogues. | Conserver ce constat limité aux preuves statiques; tester avec rôles contrôlés en environnement isolé avant toute promesse de sécurité exhaustive. |
| P1 | Ancienne `create_public_booking` exécutable par anon/auth dans les deux projets, malgré le `REVOKE` de 009; la migration de compatibilité a rétabli le grant. Elle n'a ni clé de requête ni les validations complètes du wrapper. Le runtime actuel appelle uniquement `create_public_booking_once`. | Après vérification des autres clients et de la Preview en service, retirer l'accès public à la RPC legacy par une **nouvelle migration additive de droits**, avec recette/rollback de privilèges. Ne pas modifier les anciennes migrations. |
| P1 | Supabase Auth signale « leaked password protection » désactivée dans les deux projets. | Faire valider l'activation Auth avant ouverture élargie des connexions; vérifier compatibilité du parcours login. |
| P1 | Test n'a pas le champ de retour `event_at` de la fonction de claim, alors que le code récent l'utilise pour stabiliser le courriel réel; Production l'a. | Ne pas activer les courriels réels en Test avant alignement autorisé, revue de dépendances et essai isolé. Ne pas rejouer aveuglément la migration horodatée qui fait un `DROP FUNCTION`. |
| P2 | Advisors : 7 fonctions `SECURITY DEFINER` exécutables par anon et authenticated. Admin RPCs contrôlent `admin_booking()`, livraison contrôle rôle admin ou token de 15 min et lease; `public_available_slots` ne lit que créneaux; wrapper et legacy créent des réservations. | Réduire les grants aux seules entrées nécessaires; maintenir guards internes et tester chaque fonction avec rôles réels en Test isolé. Le grant anon ne prouve pas à lui seul une mutation non autorisée des RPC admin. |
| P2 | `admin_booking` a un `search_path` mutable (advisor); elle est `SECURITY INVOKER` et lit `auth.jwt()` qualifié. `btree_gist` est installé dans `public`. | Durcir le search_path de la fonction après revue des dépendances; envisager emplacement d'extension conforme aux recommandations Supabase seulement avec plan de migration sûr. |
| P2 | DML direct anon sur `artworks`/`artwork_media` malgré policies admin. Les multiples policies permissives sont signalées (10 cas). | Réduire les grants DML à authenticated/admin; vérifier qu'aucune policy permissive ajoutée plus tard n'ouvre les écritures. Les expressions actuelles bloquent anon. |
| P2 | La fonction de livraison par token éphémère reste publique; le token n'est pas exposé par les tables RLS, mais toute fuite dans un autre canal autoriserait claim/complete pendant 15 min. | Vérifier absence de jeton dans réponses et logs, maintenir lease, contrôler les accès de bout en bout. |
| P2 | `booking_request_keys` et `booking_services` ont RLS sans policy (2 advisors INFO). | Garder privé si intentionnel; documenter l'absence de lecture directe. |
| P3 | Appels `auth.jwt()` évalués dans huit policies (advisor `auth_rls_initplan`); deux FK sans index couvrant (`appointments.service_slug`, `booking_notifications.appointment_id`). | Optimiser via migrations séparées après mesure de charge et revue de plans. |

Les advisors sécurité et performance émettent les mêmes catégories dans les deux projets. Leur niveau Supabase (`WARN` ou `INFO`) n'est pas la priorité de risque ci-dessus. Les politiques `multiple_permissive_policies` s'additionnent pour SELECT; l'expression admin n'élargit pas la lecture au-delà des œuvres publiées, tandis que les écritures restent administrateur.

### RPC de réservation et limites observées

Le site utilise `public_available_slots` en GET et `create_public_booking_once` en POST; les routes admin appellent `admin_set_availability` et `admin_change_appointment` après contrôle serveur `isAdmin`. Les deux RPC admin refont le contrôle `admin_booking()` côté SQL. Le wrapper vérifie UUID de requête, heure future, nom/courriel, sérialise les tentatives concurrentes avec un advisory lock, vérifie l'égalité des paramètres en retry et appelle la RPC legacy sous transaction. La legacy vérifie service actif et créneau disponible; la contrainte d'exclusion GiST interdit deux rendez-vous confirmés chevauchants même en course. Les durées viennent de `booking_services` (60/90 min imposées); le stockage est en `timestamptz` et les conversions d'interface en `Europe/Paris`. Les tables personnelles n'ont pas de droit direct anon; les réponses de créneaux ne contiennent pas de nom/courriel. **L'exposition directe de la legacy contourne toutefois la garantie de retry sûr et les validations du wrapper.** Aucun appel d'essai de ces fonctions n'a été fait.

Les fonctions de claim/complete contrôlent le destinataire, le rôle admin ou token opaque lié à la notification et âgé de moins de 15 minutes; la livraison est verrouillée par `lease_id`. La Production retourne le timestamp de l'événement pour un payload de courriel stable; Test ne le retourne pas. Les données Test montrent des notifications en attente mais leurs détails n'ont pas été lus. Il faut une validation humaine avant traitement ou reprise de ces lignes.

## Portfolio statique, import et bascule

Les trois œuvres ci-dessous viennent de `src/data/artworks.ts`; les tables distantes sont vides. `publishedPortfolio` sélectionne uniquement les œuvres `published` avec slug et média, puis fournit une URL interne `/api/artwork-image?slug=…`. L'endpoint refait la sélection `published` et télécharge depuis le bucket privé; sa réponse est cacheable publiquement 60 secondes, donc une dépublication peut laisser l'image en cache pendant ce délai. Aucune URL Storage permanente n'est produite. Pour une fiche, l'œuvre distante du même slug prend le pas sur la statique. Dans chaque galerie et dans le Cabinet, un slug statique est retiré seulement s'il figure parmi les œuvres distantes *de ce périmètre*. Conséquences : un brouillon Supabase de même slug laisse la statique visible; `show_in_cabinet=false` laisse la statique au Cabinet; un changement de catégorie peut laisser une statique dans l'ancienne galerie et la nouvelle distante dans l'autre. La déduplication par slug évite certains doublons, pas une bascule générale.

L'admin peut créer, modifier les champs de l'œuvre, ajouter des images et supprimer l'œuvre (cascade des lignes média). Il ne peut pas dans l'interface modifier/supprimer un média individuel ni choisir une autre couverture déjà chargée. Les fichiers Storage ne sont pas supprimés par la suppression SQL; des orphelins seraient conservés. L'API enregistre l'œuvre avant de vérifier les champs alt de toutes les photos et avant l'upload; un échec tardif peut laisser une œuvre partielle ou un objet Storage sans ligne média. Ajouter une nouvelle couverture à une œuvre qui en a déjà une heurte l'index unique. Ces limites imposent une recette d'import manuelle et une évolution applicative séparée avant une bascule sans risque.

| Œuvre / slug | Catégorie, texte actuellement vérifié dans le code | Source / alt actuel | Crédit, ordre, Cabinet et état initial proposés |
| --- | --- | --- | --- |
| La Lune / `la-lune` | illustration; « Illustration au trait noir portant le titre « La Lune ». » | `src/assets/originals/la-lune.jpg`; « Illustration au trait noir d’une femme tenant un médaillon, titrée La Lune. » | Crédit actuellement **à confirmer**; `display_order=0`, `show_in_cabinet=true` pour parité; **draft** jusqu'à validation du crédit, de la description et du rendu. |
| Œuf Phénix / `oeuf-phenix` | céramique; « Œuf en céramique ivoire peint d’un phénix bleu. » | `src/assets/originals/oeuf-phenix-ivoire-ombre-douce.png`; « Œuf en céramique ivoire, décoré d’un phénix bleu. » | Crédit artiste déjà présent dans la fiche; `display_order=1`, `show_in_cabinet=true` proposés; **draft** jusqu'à revue du média et de la fiche. |
| Assiette au crabe / `assiette-au-crabe` | céramique; « Assiette en céramique décorée d’un crabe bleu. » | `src/assets/originals/assiette-au-crabe.png`; « Assiette en céramique blanche décorée d’un crabe bleu. » | Crédit artiste déjà présent dans la fiche; `display_order=2`, `show_in_cabinet=true` proposés; **draft** jusqu'à revue du média et de la fiche. |

Les trois originaux existent localement (JPEG 1093×1093, PNG 1086×1448, PNG 1364×1362). Les descriptions et alts ci-dessus sont **des valeurs du code, pas une attestation éditoriale**. L'ordre 0/1/2 est une proposition pour garder l'ordre actuel; les lignes distantes sont actuellement vides. `pendingIllustrations` contient seulement une note de travail pour Gloria, sans fiche ni visuel : ne pas l'importer et ne pas en déduire une œuvre publiée.

Plan futur soumis à accord : (1) sauvegarder les originaux et confirmer droits/crédits/alt et ordre; (2) en environnement isolé, tester un import contrôlé en **draft**, une seule couverture et chaque échec partiel de l'API; (3) préparer l'évolution applicative qui retire explicitement les trois statiques du rendu lors de la bascule, ou tient un registre de slugs migrés indépendant du statut/catégorie/Cabinet; (4) valider toutes les fiches et les chemins, puis seulement autoriser upload et publication en Production, une œuvre à la fois; (5) garder les mêmes slugs pour préserver `/oeuvres/<slug>`; (6) vérifier les liens, galeries et cache 60 s; (7) pour rollback, republier le rendu statique via un déploiement approuvé et remettre les lignes distantes en brouillon, sans supprimer les médias ni les données. Un rollback du code n'annule pas les fichiers stockés; leur inventaire doit être conservé.

## Choix de réconciliation et ordre futur

La documentation Supabase précise que `migration repair` ne joue aucun SQL métier mais **modifie la table de suivi**; elle exige une preuve de l'état réel avant d'inscrire une version comme appliquée. Voir [déploiement des migrations](https://supabase.com/docs/guides/deployment/database-migrations) et [référence CLI](https://supabase.com/docs/reference/cli/introduction). La [documentation des fonctions](https://supabase.com/docs/guides/database/functions) recommande de contrôler explicitement le `search_path` des fonctions `SECURITY DEFINER`; les [advisors](https://supabase.com/docs/guides/observability/advisors) décrivent aussi les grants de fonctions.

| Stratégie | Avantages | Risques et prérequis | Réversibilité / avis |
| --- | --- | --- | --- |
| A. Réparer l'historique version par version | Conserve les projets et données; évite le rejeu de DDL existante. | **Risque d'affirmer un faux historique** : les fichiers 001–009 ne sont pas prouvés appliqués à l'identique, et des noms/versions distants ne correspondent pas. Exige snapshot exportable, diff catalogues/fonctions/policies complet, correspondance des artefacts et approbation. | Les entrées de suivi peuvent être retirées, mais l'erreur humaine peut provoquer un `db push` ultérieur dangereux. **Ne pas faire maintenant.** |
| B. Baseline documentée de l'état réel | Repart d'un schéma observé et de deltas additifs futurs; conserve Production et Test. | Il faut figer les définitions (y compris Storage/Auth utiles), documenter l'historique inconnu, comparer au code et exécuter une restauration sur projet vierge. Ne doit pas « nettoyer » Test. | Rollback par sauvegarde et retour applicatif approuvé. **Recommandée**, avec validation humaine de la baseline avant toute entrée de suivi. |
| C. Nouveau projet vierge et rejeu complet | Valide réellement la chaîne 001→dernier fichier et révèle dépendances/échecs. | Nouveau projet isolé nécessaire; la chaîne actuelle peut échouer, notamment versions/signatures/droits et données de services. Ne jamais viser Test ni Production. | Projet jetable, réversible par abandon. **Complément obligatoire de validation** avant d'utiliser ces migrations comme source de vérité, pas une substitution silencieuse de Production. |

Ordre proposé : faire approuver ce constat et le preflight → capturer une sauvegarde vérifiable et un export de schéma **sans lignes personnelles dans le rapport** → reproduire le schéma actuel dans un projet vierge isolé et comparer contraintes, fonctions, grants, RLS/Storage → corriger les écarts futurs par nouvelles migrations **additives** et testées → lever la compatibilité de la RPC legacy seulement après vérification des clients → choisir et valider la baseline et, si nécessaire, la réparation de suivi version par version → répéter le preflight juste avant toute opération approuvée. Les changements Auth (protection mots de passe), les courriels réels et le transfert des œuvres demandent des accords séparés. Aucun ordre ici n'autorise un `db push` automatique.

### Décisions humaines requises

1. Valider la source officielle de l'historique des applications SQL manuelles et les migrations dont les versions distantes divergent.
2. Approuver une baseline documentée et l'environnement vierge dédié aux essais, avec plan de sauvegarde/retour.
3. Confirmer qu'aucun autre client n'appelle encore la RPC legacy avant tout retrait de grant.
4. Décider du sort agrégé des notifications Test en attente sans consulter de données personnelles dans cet audit.
5. Valider les crédits et textes des trois œuvres, la bascule des slugs statiques, l'ordre, et le comportement après dépublication.
6. Autoriser séparément toute modification de schéma, Auth, Storage, Production/Test ou e-mail réel.

## Limites de preuve

L'audit ne prouve pas l'absence d'un exploit par un test adversarial, ni la provenance exacte des objets dont l'histoire n'est pas enregistrée. Il ne vérifie pas le caractère fictif des lignes Test. Il n'a pas exécuté la chaîne complète sur une base vierge, n'a pas testé d'authentification ni appelé de RPC. La présence des objets et le contenu des définitions ont été confirmés, mais une revue d'exploitation des logs, du trafic des anciens clients et des sauvegardes reste nécessaire avant mutation. L'état distant peut changer après l'observation; refaire le preflight au moment d'une décision.

## Vérification locale de cet audit

Node `v22.23.4` : `npm run check` réussi (0 erreur, 0 warning, 1 indication de signature dépréciée dans `src/lib/supabase.ts`); `npm test` réussi (9/9); `npm run test:e2e` réussi (20/20, serveur local uniquement, variables Supabase vides et courrier en simulation dans la configuration Playwright); `npm run build` réussi avec l'adaptateur `@astrojs/vercel`. Le premier essai Playwright dans le sandbox a reçu `listen EPERM` sur `127.0.0.1:4322`; la reprise autorisée du même test local a réussi. Aucun test n'a créé de réservation distante ni envoyé de courriel. `git diff --check`, le statut final et l'absence de fichiers suivis modifiés sont vérifiés séparément dans le compte rendu final.
