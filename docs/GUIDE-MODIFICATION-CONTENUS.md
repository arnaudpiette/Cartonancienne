# Modifier les contenus du site

Les textes éditoriaux du site sont dans `src/content/`. Les composants et pages Astro affichent ces données sans en recopier les formulations.

## Fichiers de contenu

| Page ou contenu | Fichier JSON |
| --- | --- |
| Accueil et Cabinet de curiosités | [`src/content/accueil.json`](../src/content/accueil.json) |
| Bonjour | [`src/content/bonjour.json`](../src/content/bonjour.json) |
| Tarot et offres | [`src/content/tarot.json`](../src/content/tarot.json) |
| Ateliers | [`src/content/ateliers.json`](../src/content/ateliers.json) |
| Contact et modèles de messages | [`src/content/contact.json`](../src/content/contact.json) |
| Illustrations | [`src/content/illustrations.json`](../src/content/illustrations.json) |
| Céramiques | [`src/content/ceramiques.json`](../src/content/ceramiques.json) |
| Presse | [`src/content/presse.json`](../src/content/presse.json) |
| Réservation et libellés de son parcours | [`src/content/reservation.json`](../src/content/reservation.json) |
| Fiches des œuvres locales et textes alternatifs | [`src/content/oeuvres.json`](../src/content/oeuvres.json) |
| Navigation et libellés du menu | [`src/content/navigation.json`](../src/content/navigation.json) |
| Pied de page | [`src/content/footer.json`](../src/content/footer.json) |
| Titres et description SEO | [`src/content/seo.json`](../src/content/seo.json) |
| Libellés partagés des galeries | [`src/content/galerie.json`](../src/content/galerie.json) |
| Écran de connexion | [`src/content/login.json`](../src/content/login.json) |

Les imports et la validation TypeScript des fichiers JSON sont regroupés dans [`src/lib/content/`](../src/lib/content/).
Ce guide concerne les pages publiques ; les écrans et textes de l’administration restent dans leurs composants existants.

## Modifier un titre, un paragraphe ou un bouton

1. Ouvrez le fichier JSON de la page dans VS Code.
2. Repérez la section concernée, dont les clés suivent l’ordre d’affichage de la page. Par exemple, le titre d’introduction de Bonjour est dans `intro.title`; ses paragraphes sont dans les tableaux `sections[].paragraphs`.
3. Remplacez uniquement la valeur entre guillemets. Conservez les guillemets doubles, les virgules entre les propriétés et les crochets des listes.
4. Les libellés et les destinations des liens sont généralement conservés ensemble dans le même objet JSON.
5. Enregistrez le fichier (`Cmd+S` sur macOS, `Ctrl+S` sous Windows/Linux).

Les accents et la ponctuation sont préservés tels quels. N’ajoutez pas de commentaires dans un fichier JSON : le format JSON ne les accepte pas.

## Tarifs et réservations

Les titres, descriptions, prix et durées des séances réservables sont dans `bookingServices` de [`src/content/tarot.json`](../src/content/tarot.json). Le site et le traitement des réservations utilisent ces mêmes valeurs ; ne créez pas de copie des prix dans un autre fichier. Les libellés du formulaire, ses messages d’état et le texte du paiement sur place se trouvent dans `reservation.json`.

Les messages d’erreur retournés par les API et les règles de validation restent associés au code de réservation afin de préserver le comportement métier.

## Modifier un texte alternatif ou une image

Les textes alternatifs des images éditoriales et des œuvres locales sont dans le JSON de la page correspondante ou dans `oeuvres.json`. Les illustrations décoratives ont volontairement un texte alternatif vide.

Les images sources sont organisées dans `src/assets/` et sont importées ou chargées par glob statique afin qu’Astro puisse les optimiser au build. Pour remplacer une image précise :

1. Placez la nouvelle image dans le dossier éditorial correspondant, sans déplacer d’autres fichiers.
2. Pour une image importée individuellement, modifiez son import dans la page Astro concernée (par exemple `src/pages/index.astro`) et gardez son texte alternatif dans le JSON.
3. Pour une galerie chargée par glob, placez le fichier dans le dossier correspondant : `editorial/tarot`, `editorial/presse`, `editorial/illustrations/portfolio`, `editorial/ateliers/<collection>` ou `editorial/ceramiques/<collection>`. Les noms de sous-dossiers des collections d’ateliers et de céramiques sont indiqués dans leurs JSON.
4. Les chemins des vidéos publiques, comme la vidéo des céramiques, sont modifiables dans `ceramiques.json`.
5. Pour changer le visuel d’une œuvre locale du Cabinet, modifiez l’import et l’association de slug dans `src/data/artworks.ts`; son titre, sa description, son crédit et son texte alternatif restent éditables dans `oeuvres.json`.

Les chemins d’images importées ne sont pas stockés en JSON : Astro doit les connaître statiquement pour optimiser les fichiers de `src/assets/`. Les médias déjà gérés par l’administration et Supabase restent inchangés.

## Visualiser et vérifier en local

Utilisez Node 22.23.4, conformément au fichier `.nvmrc` :

```bash
nvm install 22.23.4
nvm use 22.23.4
npm run dev
```

Ouvrez `http://localhost:4321`, puis vérifiez la page modifiée aux formats desktop et mobile. Avant de publier, exécutez :

```bash
npm run check
npm test
npm run build
npm run preview
```

`npm run test:e2e` lance les tests navigateur. Les tests de base de données et d’intégration nécessitent une configuration dédiée et ne doivent pas être dirigés vers la Production.

## Publier avec le workflow du dépôt

Le dépôt utilise l’intégration Git de Vercel décrite dans le `README.md` : une branche de travail produit une Preview et la branche `main` déploie en Production. Il n’y a pas de workflow GitHub Actions de déploiement dans ce dépôt.

1. Vérifiez le contenu sur la Preview de votre branche.
2. Après validation, fusionnez le changement dans `main` selon le processus Git du projet.
3. Avant un déploiement, vérifiez le projet et l’environnement Vercel. Le réglage Node du projet Vercel doit être aligné séparément sur Node 22 ; `.nvmrc` ne modifie pas ce réglage distant.

Aucun changement Supabase ni aucune migration n’est nécessaire pour modifier les fichiers éditoriaux.

## Revenir à une version précédente

Pour retrouver l’historique d’un fichier :

```bash
git log -- src/content/bonjour.json
```

Pour restaurer uniquement ce fichier depuis un commit donné, remplacez `<commit>` par son identifiant :

```bash
git restore --source=<commit> -- src/content/bonjour.json
```

Pour annuler un changement déjà publié, utilisez `git revert <commit>` afin de créer un commit d’annulation, puis suivez le workflow habituel de revue et de fusion.
