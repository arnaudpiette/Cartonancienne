# La Cartonancienne

Site Astro de Séverine Piette, rendu côté serveur avec l’adaptateur Vercel. Les pages publiques, l’administration et les API sont dans `src/pages/`. Astro/Sharp produit les variantes WebP nécessaires au build à partir des images source.

## Environnement local

Utiliser Node 22.23.4, indiqué dans `.nvmrc` ; `package.json` accepte Node 22.x.

```bash
nvm install 22.23.4
nvm use 22.23.4
npm ci
npm run dev
```

Ouvrir `http://localhost:4321`. Les commandes de vérification disponibles sont `npm run check`, `npm test`, `npm run build` et `npm run test:e2e`. `npm run preview` sert à vérifier le build local. Les tests de base de données (`npm run test:db`) et d’intégration (`npm run test:integration`) nécessitent une configuration dédiée ; ne pas les diriger vers la Production.

Le build utilise `output: 'server'` et `@astrojs/vercel` dans `astro.config.mjs`. Une branche de travail déploie une Preview ; la branche `main` déploie en Production. Vérifier le projet et l’environnement Vercel avant toute opération de déploiement. Le réglage Node du projet Vercel doit être aligné séparément avec Node 22 avant mise en ligne ; le fichier `.nvmrc` ne change pas ce réglage distant.

## Services et configuration

- Astro/Vercel : pages, API et rendu serveur.
- Supabase Auth, PostgreSQL et Storage : connexion, réservations, œuvres et médias. Le bucket `artworks` est privé ; `/api/artwork-image` contrôle la publication avant de servir une image.
- Resend : transport des notifications de réservation lorsque le mode serveur est explicitement `live`. Tout autre mode reste simulé.
- One.com : DNS et messagerie du domaine. Le réglage `Reply-To` du site ne crée pas de boîte mail chez One.com.

Les projets Supabase Production et Test sont distincts. Les variables locales et Vercel doivent viser l’environnement voulu, sans copier de clés dans le dépôt. Le Login utilise le nom d’utilisateur public `C@rtosev`, puis Supabase Auth côté serveur ; le rôle administrateur vient de `app_metadata.role`. Ne jamais inscrire de mot de passe dans le code ou la documentation.

## Migrations locales

Le dépôt contient, dans `supabase/migrations/` :

1. `001_cartonancienne.sql`
2. `002_booking_agenda.sql`
3. `003_fix_booking_slot_ambiguity.sql`
4. `004_fix_agenda_admin_grants.sql`
5. `005_fix_agenda_move_ambiguity.sql`
6. `006_notification_delivery_outbox.sql`
7. `007_artwork_portfolio_management.sql`
8. `008_published_artworks_require_slug.sql`
9. `009_booking_request_idempotency.sql`
10. `20261111222342_keep_legacy_booking_rpc_during_rollout.sql`
11. `20261112000222_notification_email_event_timestamp.sql`

La présence de ces fichiers ne prouve pas que l’historique distant est aligné. Réconcilier d’abord les objets et les versions réellement présents sur chaque projet Supabase. Ne pas rejouer les anciennes migrations en Production sur des objets existants. Les migrations de transition de réservation se coordonnent avec la version du serveur en service.

## Réservations et images

Les créneaux sont gérés dans `/admin/agenda`. Les réservations et notifications utilisent les fonctions et la boîte d’envoi définies par les migrations locales ; les dates sont affichées en `Europe/Paris`. L’envoi réel exige une configuration serveur explicite et une validation séparée. Le tunnel public est dans `/reservation`. Le compte rendu de recette est dans [reservation-qa.md](reservation-qa.md).

Les images décoratives sont référencées dans `src/data/ornaments.ts`. L’inventaire des sources et variantes est dans [IMAGE_AUDIT.md](IMAGE_AUDIT.md). Les fichiers originaux exclus du build restent protégés par `.gitignore` ; `dist/`, `.astro/`, `.vercel/`, les résultats Playwright et les fichiers d’environnement ne doivent pas être versionnés.
