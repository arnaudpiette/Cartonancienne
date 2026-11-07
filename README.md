# La Cartonancienne

Site Astro de Séverine Piette. Les originaux fournis sont conservés dans `src/assets/originals/`; Astro/Sharp en produit des WebP responsives au build, sans modifier ces sources.

## Démarrer

```bash
npm install
npm run dev
```

Puis ouvrir `http://localhost:4321`. Vérifier la production avec `npm run check && npm run build`, puis `npm run preview`.

## Supabase (requis pour Login et Admin)

1. Créer un projet Supabase et exécuter `supabase/migrations/001_cartonancienne.sql` dans SQL Editor.
2. Créer l’utilisatrice Auth avec son e-mail réel et un mot de passe choisi au provisionnement. Ne jamais inscrire ce mot de passe dans le dépôt.
3. Ajouter au compte, via l’API Admin ou le Dashboard, `app_metadata: { "role": "admin" }`.
4. Dans `.env`, définir `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY` et `PRIVATE_ADMIN_EMAIL` (l’e-mail réel du compte). Le nom d’utilisateur présenté est strictement `C@rtosev`; l’e-mail ne sort jamais dans le navigateur.

Les RLS empêchent toute écriture hors du compte ayant ce rôle. Le bucket `artworks` est privé : les originaux téléversés sont contrôlés (JPEG/PNG/WebP, 10 Mo, 36 MP), redressés et servis en WebP 2000 px max. Pour l’affichage public des médias publiés, ajouter une route serveur qui ne délivre des URLs signées que pour une œuvre `published`.

## Contenu à confirmer

Les tarifs, durées et créneaux de tarot, les dates/lieux/prix/liens de réservation des ateliers, l’adresse de contact et les liens précis vers les articles de presse ne figuraient pas dans les sources exploitables. Ils sont signalés dans l’interface plutôt qu’inventés.

## Images

L’inventaire avant/après est dans `IMAGE_AUDIT.md`. Les fichiers originaux restent hors du build grâce à `.gitignore`; seules les variantes demandées par les pages sont générées dans `dist/`.
