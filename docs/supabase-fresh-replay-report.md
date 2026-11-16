# Rejeu local du durcissement Supabase

## Portée et provenance

Worktree : `fix/supabase-production-hardening`, base `d7ba1bc14971a32dbb58def0579513b70883079f`. Le précédent worktree temporaire et ses fichiers non suivis avaient disparu. Les fichiers présents ici sont **reconstruits**, pas des copies certifiées des fichiers perdus. La migration créée est `20261116215223_harden_booking_rpc_and_delivery.sql`.

Les vérifications décrites ici ont été exécutées sur des instances Docker locales et des données fictives. La Production autorisée a ensuite été interrogée en lecture seule pour ses métadonnées et des compteurs agrégés ; aucun projet Supabase hébergé n'a été modifié. Aucun e-mail réel n'a été envoyé. Node 22.23.4, Supabase CLI 3.1.0 et PostgreSQL local 17.11 ont été utilisés.

## Bases isolées

Les deux projets ont été démarrés successivement, sans partage de volumes :

| Instance | Répertoire | Projet Docker | État initial | Ports utilisés successivement |
| --- | --- | --- | --- | --- |
| A | `/private/tmp/cartonancienne-local-hardening-a` | `cartonancienne-hardening-a` | onze migrations, `event_at` présent | API 54321, PostgreSQL 54322, Studio 54323 |
| B | `/private/tmp/cartonancienne-local-hardening-b` | `cartonancienne-hardening-b` | dix migrations jusqu'à `20261111222342`, ancien contrat sans `event_at` | mêmes ports, après arrêt de A |

A : les migrations 001 à 009, `20261111222342_keep_legacy_booking_rpc_during_rollout.sql` et `20261112000222_notification_email_event_timestamp.sql` ont été rejouées, puis la migration corrective a été exécutée deux fois avec `psql`. B : les dix premières ont été rejouées, puis la corrective a été exécutée deux fois. Ces applications explicites par `psql` vérifient le SQL et son idempotence ; elles ne prouvent pas l'enregistrement de la version corrective dans l'historique Supabase.

Les volumes portaient respectivement les suffixes `cartonancienne-hardening-a` et `cartonancienne-hardening-b`. Chaque instance possédait ses propres conteneurs `supabase_db`, `supabase_auth`, `supabase_kong`, `supabase_rest`, `supabase_storage`, `supabase_realtime`, `supabase_inbucket`, `supabase_studio`, `supabase_pg_meta`, `supabase_edge_runtime`, `supabase_vector` et `supabase_analytics`, ainsi que ses volumes `supabase_db`, `supabase_storage` et `supabase_edge_runtime`. A utilisait le réseau `supabase_network_cartonancienne-hardening-a`; B utilisait `cartonancienne-hardening-b-loopback`. Les conteneurs et volumes des deux stacks ont été supprimés après les essais ; le réseau B a aussi été supprimé. Les images sont conservées en cache.

**Exposition locale constatée :** bien que tous les appels de recette aient ciblé `127.0.0.1`, Docker Desktop a affiché des ports publiés sur `0.0.0.0` pour A et B, y compris avec le réseau B configuré pour le loopback. Ces stacks contenaient exclusivement des données fictives et sont désormais arrêtées et supprimées. Une prochaine recette devra obtenir une liaison effectivement limitée à l'interface locale avant démarrage si cette isolation réseau est exigée.

## Effets de la migration et résultats

- La RPC legacy reste présente ; son droit `EXECUTE` est retiré à `PUBLIC`, `anon` et `authenticated`. Le wrapper reste accessible aux rôles attendus et utilise `SECURITY DEFINER` avec un propriétaire autorisé à appeler la fonction interne.
- Si `event_at` existe déjà, la définition de la fonction de bail n'est pas remplacée. Pour l'ancien contrat exact connu, la fonction est recréée dans la même transaction, sans `CASCADE`, avec conservation des droits directs testés ; une définition inconnue provoque une erreur et un rollback. L'opération peut prendre un verrou et doit être vérifiée au préalable sur la base cible.
- `admin_booking` reçoit le `search_path` `public, pg_temp`. Les index `appointments_service_slug_idx` et `booking_notifications_appointment_id_idx` sont créés si absents, et leur structure est contrôlée. La création non concurrente peut bloquer les écritures pendant sa durée.
- Dans A et B, la double application a réussi. Les empreintes des lignes fictives des disponibilités, rendez-vous, notifications, livraisons et clés de requête étaient identiques avant et après. Dans B, les droits directs du bail étaient identiques avant et après.
- Les tests SQL transactionnels ont vérifié les signatures, les droits, les refus de la RPC legacy pour les deux rôles, le wrapper et son idempotence, un chevauchement refusé, `event_at`, les index, le `search_path`, l'activation et les contrôles RLS, le refus admin et un bail séquentiel. Un test supplémentaire utilisant deux connexions simultanées dans chaque instance a confirmé une seule acquisition du bail ; ses données ont été nettoyées et les empreintes initiales vérifiées.
- Le preflight `supabase/preflight/production-readiness-readonly.sql` s'est exécuté sans erreur SQL sur les deux bases locales. Cela ne vaut pas preflight de la Production.

## Parcours Astro connecté à A

Avec une instance Auth locale et un compte fictif doté de `app_metadata.role = admin`, la connexion via `/login`, l'accès à l'agenda et l'ouverture d'une disponibilité ont réussi. Deux demandes concurrentes sur un même créneau ont donné une réservation et un conflit ; la réservation est apparue dans l'agenda. La création de l'outbox et une relance en mode simulé ont été vérifiées : seul le destinataire en échec a été retenté. Le déplacement, l'annulation, la libération du créneau et la stabilité de l'UID ICS ont réussi. Aucun message réel n'a été envoyé. Les données et le compte fictifs ont été supprimés avec les volumes locaux.

Le scénario connecté a porté sur l'offre Solo. L'offre Roue a été couverte par les tests Playwright généraux, qui utilisent un backend simulé ; elle n'a pas fait l'objet d'une seconde réservation connectée dans cette reprise.

## Contrôles applicatifs

- `npm run check` : 0 erreur, 0 avertissement, 1 indication de dépréciation.
- `npm test` : 9 tests réussis.
- `npm run test:e2e` : 20 tests réussis, backend simulé pour les parcours concernés.
- `npm run build` : réussi avec l'adaptateur Vercel.
- `git diff --check` : réussi pour les fichiers suivis ; les nouveaux fichiers doivent aussi être vérifiés lors d'une indexation ciblée ultérieure.

## Préflight et retour arrière avant Production

Aucune migration n'a été appliquée en Production lors de cette reprise. En lecture seule, le projet autorisé est `ACTIVE_HEALTHY` sous PostgreSQL 17.11 ; les trois compteurs agrégés de rendez-vous, notifications et livraisons sont à zéro. Les empreintes des corps SQL (espaces ignorés) du wrapper, de la legacy et du bail correspondent aux migrations locales respectives 009, 006 et `20261112000222`. Le contrat `event_at` est présent, les deux noms d'index de la migration sont absents, RLS est activée sur les trois tables concernées et le wrapper, propriétaire `postgres`, est `SECURITY DEFINER` et appelle la legacy. Celle-ci est encore exécutable par `anon` et `authenticated`. L'historique consulté comporte deux versions ; aucune version corrective reconstruite n'y figure. Ces constats sont ponctuels et devront être refaits immédiatement avant toute écriture. Les advisors renvoient six catégories sécurité, trois catégories performance et aucune catégorie santé ; notamment `function_search_path_mutable`, fonctions `SECURITY DEFINER` accessibles aux rôles publics, clés étrangères non indexées et remarques RLS. Ces avis ne constituent pas un feu vert pour appliquer la migration et certains restent hors de sa portée.

L'alias du domaine principal pointe vers le déploiement Production `dpl_61ubYQfhdXEzTiBDnGqEAJETE7s4` au commit `ceb13e37140c4ae8340ef2b22da54bea9950ec76`, dont le code utilise le wrapper idempotent. Quatre déploiements historiques trouvés sur des commits utilisant la RPC legacy ont répondu par une redirection SSO Vercel lors d'un GET sans réservation ; cela ne démontre pas qu'aucun client autorisé ou autre alias ne les utilise.

Aucune sauvegarde restaurable n'a été confirmée et aucune sauvegarde logique réelle n'a été créée. Le propriétaire a explicitement décidé de poursuivre sans sauvegarde complète et d'accepter le rollback SQL ciblé comme seule solution de retour arrière. Ce rollback ne restaure pas les données métier ni une base complète. Avant toute écriture : vérifier le projet cible, les clients encore actifs, les signatures, propriétaires, dépendances et droits réels, les noms et définitions des index, les compteurs agrégés, l'historique et le besoin d'une fenêtre tenant compte des verrous. Comparer le fichier exact à celui validé et enregistré en version ; ne pas rejouer les anciennes migrations. Refaire tous les tests affectés par toute modification de la migration.

Le retour arrière est spécifique à l'état capturé juste avant l'application : restaurer seulement les grants antérieurs de la RPC legacy ; restaurer exactement le `search_path` antérieur ; retirer uniquement les index dont la création par cette migration est prouvée ; si la fonction de bail a dû être recréée, restaurer sa définition, son propriétaire et ses droits capturés, dans une transaction après contrôle des dépendances. Un retour à l'ancien contrat doit aussi être vérifié contre les clients actuels. Ne pas restaurer ni effacer les données métier par ces opérations.

## Limites

- Le propriétaire accepte explicitement l'absence de sauvegarde complète ; le rollback SQL ciblé ne permet pas une restauration complète. Le preflight et la recherche de tous les clients historiques doivent être actualisés avant application.
- Aucun enregistrement de migration, post-check, smoke test, commit ou push n'a été effectué.
- Le worktree a été déplacé vers le chemin durable `~/Corsaire/Website/Website-Sev/Portfolio Sev-production-hardening`. L’entrée Git en double a été retirée après archivage réversible de sa métadonnée sous `.git/cartonancienne-worktree-metadata-backup` ; les trois fichiers non suivis ont été comparés octet par octet avant et après.

## Reprise : préparation de sauvegarde

La Production autorisée a été consultée en lecture seule : taille PostgreSQL approximative 12 Mo, zéro rendez-vous, zéro notification, zéro livraison, zéro objet Storage et un compte Auth ; ces nombres peuvent évoluer. PostgreSQL 17.11 est disponible dans l'image Docker locale, avec `pg_dump` et `pg_restore` 17.11. Le CLI isolé ne dispose pas d'une authentification permettant le dump ; aucun mot de passe ou clé n'a été demandé ou affiché. Aucun dump n'a encore été créé ni restauré. Le serveur PostgreSQL Production utilise IPv6 ; un contrôle sans authentification indique que le conteneur local peut le joindre en réseau host.

Un essai indépendant de rollback a rétabli les définitions, droits, propriétaires, paramètres et index initiaux sur une base factice. Une archive factice du schéma complet du projet a été restaurée dans le conteneur PostgreSQL Supabase 17.11 isolé sans réseau après création des rôles gérés nécessaires. Un script temporaire a passé l'auto-test : copie par mémoire temporaire Docker, image disque AES-256, relecture de l'archive, restauration isolée, migration et rollback comparés, démontage et réouverture avec vérification d'empreinte. Aucun dump de Production n'a encore été créé.

Le script temporaire `/private/tmp/cartonancienne-secure-backup.py` a passé son auto-test avec une archive exclusivement factice : un stockage temporaire Docker en mémoire, une image disque chiffrée AES-256, une archive PostgreSQL complète et un fichier de rôles sans mots de passe, tous deux contrôlés par empreinte après transfert et réouverture. La restauration factice et la recette de rollback sont exécutées dans un conteneur sans réseau et sans ports. Les rôles locaux manquants sont créés sans connexion ; leurs attributs ne sont pas rejoués. Les objets Storage externes et secrets ou configurations de la plateforme ne sont pas inclus dans une sauvegarde PostgreSQL. Aucun chemin de sauvegarde Production n'a encore été créé ; aucun mot de passe PostgreSQL n'a été demandé à l'agent.

## Décision du propriétaire avant application

Le propriétaire autorise explicitement l'application en Production sans sauvegarde complète, avec un rollback SQL ciblé comme seule solution de retour arrière. Les tests de sauvegarde documentés plus haut restent des essais sur données fictives ; ils ne constituent pas une sauvegarde de Production. Aucune donnée du projet exclu n'est utilisée.

## Préflight final et rollback ciblé

Le contrôle Production le plus récent confirme PostgreSQL 17.11, `event_at` déjà présent, les deux noms d'index absents, `admin_booking.proconfig` non défini, et la RPC legacy exécutable directement par `anon`, `authenticated`, `postgres` et `service_role`, sans grant `PUBLIC`. Le wrapper est `SECURITY DEFINER` et appartient à `postgres`, comme la legacy ; les empreintes des corps SQL correspondent aux migrations locales. Les trois compteurs de rendez-vous, notifications et livraisons sont à zéro. Les observations doivent être réactualisées juste avant la migration.

Sous réserve que cet état soit toujours confirmé juste avant application, le rollback testé sur la base locale factice est le suivant. Il retire seulement les index dont l'absence antérieure et la création par la migration auront été vérifiées ; il ne modifie pas le grant `service_role`, ne rétablit pas de grant `PUBLIC` et ne modifie pas la fonction de livraison déjà au contrat moderne. Il ne doit pas être exécuté si l'état initial diffère ou si des changements ultérieurs nécessitent une autre analyse.

```sql
begin;
grant execute on function public.create_public_booking(text,timestamptz,text,text) to anon, authenticated;
alter function public.admin_booking() reset search_path;
drop index public.appointments_service_slug_idx;
drop index public.booking_notifications_appointment_id_idx;
commit;
```

Le propriétaire accepte explicitement que ce retour arrière ciblé ne remplace pas une sauvegarde complète. L'outil Supabase MCP disponible attribue une version de migration côté serveur : l'alignement avec le fichier local `20261116215223` doit être résolu avant toute application ; aucune réparation de l'historique n'est autorisée par cette recette.
