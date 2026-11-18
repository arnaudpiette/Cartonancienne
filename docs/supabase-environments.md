# Environnements Supabase — La Cartonancienne

Dernière mise à jour : 18 novembre 2026.

## Projet unique

Le seul projet Supabase utilisé par le site est Production :

- Project ref : `ujyftupbmveeztqqchje`
- URL : `https://ujyftupbmveeztqqchje.supabase.co`

Il n’y a plus d’environnement Supabase Test dans la configuration opérationnelle. Le `.env` local audité pointe vers Production ; `.env.example` documente la même URL sans contenir de clé.

## Vercel Preview et Production

Preview et Production restent des environnements Vercel distincts. Chacun doit avoir ses propres variables d’environnement et son propre cycle de déploiement, mais `PUBLIC_SUPABASE_URL` doit pointer vers le projet Production dans les deux environnements. La clé `PUBLIC_SUPABASE_ANON_KEY` doit être celle de ce même projet. Ne jamais utiliser ni exposer une clé `service_role` dans le site.

Un déploiement Preview utilisant la base Production n’est pas une base isolée : les réservations, modifications d’agenda, envois de notifications et opérations d’administration peuvent affecter des données ou des services réels. Les contrôles Preview doivent rester en lecture seule. Ne pas soumettre de réservation, déplacer ou annuler de rendez-vous, modifier des œuvres, téléverser de média, ni envoyer d’e-mail pour tester. Garder `PRIVATE_BOOKING_MAIL_MODE=simulation` en Preview sauf autorisation explicite distincte pour l’envoi réel.

La protection Vercel du déploiement Preview ne remplace pas l’authentification applicative. Toute ouverture ciblée d’une Preview au public doit préserver les contrôles d’administration dans l’application et être autorisée séparément ; aucune règle de protection Vercel n’est modifiée par ce document.

## Authentification et données

Le client Supabase du site utilise la clé anon et les cookies serveur de Supabase Auth. `isAdmin` vérifie côté serveur `auth.getUser()` puis `app_metadata.role === 'admin'`. Les pages d’administration redirigent les visiteurs non autorisés vers `/login` et les API d’administration répondent `403`. Les permissions RLS restent indispensables côté base ; l’accès public à une Preview ne doit jamais être interprété comme un accès administrateur.

## Migrations et contrôles

- Toute inspection distante doit être explicitement ciblée sur `ujyftupbmveeztqqchje` et strictement en lecture seule.
- Ne jamais recréer ou supprimer une table, appliquer une migration, modifier une politique ou une configuration Auth, écrire des données de test ou supprimer des données Production sans accord préalable.
- Les fichiers de `supabase/migrations/` et les anciens rapports ne prouvent pas à eux seuls l’état courant de la base.
- `docs/supabase-reconciliation-audit.md` conserve la photographie historique de novembre 2026 où deux projets étaient comparés. Ses références à Test ne sont pas des cibles actuelles.

Lors de cette mise à jour, les commandes Supabase distantes n’ont pas pu être authentifiées. Le dernier inventaire documenté en lecture seule date du 16 novembre 2026 ; les tables, politiques RLS et versions de migration en Production doivent donc être revalidées avant toute opération distante. Aucun accès à des lignes réelles ni aucune écriture n’a été utilisé pour cette mise à jour.
