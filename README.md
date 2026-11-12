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

## Réservations et agenda

1. Exécuter les migrations dans l’ordre (`001_cartonancienne.sql` à `006_notification_delivery_outbox.sql`). Elles créent les offres réservable, les plages, les rendez-vous et la boîte d’envoi. Les instants sont en UTC ; les saisies et l’affichage sont en `Europe/Paris`. La contrainte PostgreSQL `appointments_no_active_overlap` bloque les chevauchements, même en cas de réservations simultanées.
2. Connectée avec `C@rtosev`, Séverine ouvre des plages dans `/admin/agenda`. Aucun créneau n’est inventé ni public avant cette action. Les blocages qui recouvrent un rendez-vous sont refusés.
3. Pour l’envoi réel, créer une clé Resend et définir `PRIVATE_RESEND_API_KEY`, `PRIVATE_ADMIN_EMAIL`, `PRIVATE_MAIL_FROM` et `PRIVATE_BOOKING_MAIL_MODE=live` dans l’environnement du serveur. Le mode est `simulation` par défaut : il ne transmet aucun e-mail. Chaque destinataire possède son état, son erreur et son compteur de tentatives ; une relance ne réclame jamais un destinataire déjà envoyé. Un bail SQL atomique évite les doubles envois lors de relances simultanées. Pour tester un échec sans e-mail réel, définir `PRIVATE_BOOKING_MAIL_SIMULATE_FAILURES=admin` (ou `customer`). Les déplacements et annulations confirment d’abord la transaction puis tentent l’envoi : un échec ne revient jamais sur le rendez-vous.
4. Les invitations `.ics` ont un UID stable dérivé du rendez-vous, ce qui permet aux mises à jour/annulations de viser le même événement.

## Contenu à confirmer

Le brief de reprise confirme Tarot Solo (60 minutes, 50 €) et Tarot Roue (90 minutes, 70 €), avec paiement exclusivement sur place. Les créneaux dépendent de l’agenda effectivement configuré. Les autres contenus annoncés historiquement doivent être vérifiés dans leurs sources avant publication.

## Tunnel de réservation et recette

Le tunnel comporte quatre vues successives dans `/reservation`, puis une confirmation après enregistrement. Les coordonnées restent en mémoire pendant les retours ; elles ne sont pas placées dans l’URL ni dans un stockage persistant du navigateur.

La migration additive `009_booking_request_idempotency.sql` ajoute la reconnaissance des nouvelles tentatives réseau. Elle a été validée en environnement isolé. Le nouveau serveur appelle `create_public_booking_once` ; sans cette fonction, il refuse de confirmer une réservation. Pour une base déjà utilisée, appliquer 009 et `20261111222342_keep_legacy_booking_rpc_during_rollout.sql` dans une seule transaction : cette transition conserve l’ancienne RPC pendant la migration des serveurs. Ne retirer cet accès historique qu’après migration de tous les appelants et autorisation de mise en service.

Les commandes, résultats, limites et observations hors périmètre sont détaillés dans [reservation-qa.md](reservation-qa.md).

## E-mails de réservation

Les confirmations, déplacements et annulations partent de `La Cartonancienne <reservations@lacartonancienne.com>`. Les notifications internes arrivent à l’adresse définie dans `PRIVATE_ADMIN_EMAIL`. Les réponses des clients sont dirigées vers cette adresse ; Séverine peut répondre aux notifications internes directement au client.

Configurer dans Vercel Production `PRIVATE_MAIL_FROM`, `PRIVATE_ADMIN_EMAIL`, la clé Resend serveur existante et `PRIVATE_BOOKING_MAIL_MODE=live`. Garder `simulation` pour les tests locaux et les previews de recette. Aucun secret ne doit figurer dans le dépôt. Le domaine doit être vérifié dans Resend.

Appliquer également `20261112000222_notification_email_event_timestamp.sql` avant cette version du serveur. Elle ajoute à la réponse de réclamation de notification son horodatage d’origine. Les relances utilisent une clé d’idempotence par notification et destinataire, avec un contenu et un ICS stables ; un échec d’e-mail ne supprime jamais le rendez-vous. La boîte d’envoi reste consultable et relançable dans l’agenda administrateur.

Le réglage `Reply-To` assure les réponses vers Séverine. Il ne crée pas de boîte mail ni de redirection chez one.com : les messages écrits directement à l’adresse d’expédition dépendent de la configuration de messagerie existante du domaine.

## Images

L’inventaire avant/après est dans `IMAGE_AUDIT.md`. Les fichiers originaux restent hors du build grâce à `.gitignore`; seules les variantes demandées par les pages sont générées dans `dist/`.
