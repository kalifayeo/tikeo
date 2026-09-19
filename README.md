# Tikeo — Plateforme de billetterie événementielle

Stack : **Nuxt.js 3 · Vue.js 3 · TypeScript · Tailwind CSS · Supabase (PostgreSQL, Auth, Storage) · Pinia**
(conforme au cahier des charges fourni).

## 🚀 Démarrage rapide

```bash
npm install
cp .env.example .env      # puis renseignez vos clés Supabase
npm run dev                # http://localhost:3000
```

L'application fonctionne **immédiatement**, même sans Supabase configuré : la page d'accueil
affiche des événements de démonstration (`composables/useEvents.ts`). Dès que vous renseignez
`NUXT_PUBLIC_SUPABASE_URL` / `NUXT_PUBLIC_SUPABASE_ANON_KEY` dans `.env` et que la table
`events` contient des événements `published`, ceux-ci remplacent automatiquement les données
de démo.

## 📦 État actuel du projet (vérifié en détail)

Le projet est **très avancé** : 39 des 40 pages de l'architecture prévue (§9-12 du
cahier des charges) sont réellement développées (pas de simples maquettes), avec
connexion Supabase réelle, RLS, i18n, etc. Seule `mon-espace/portefeuille` reste un
écran « à venir ».

### ✅ Fait et fonctionnel
- Authentification (inscription, connexion, mot de passe oublié) via Supabase Auth.
- Base de données complète avec RLS (`supabase/migrations/`, 16 migrations).
- Site public : accueil, liste/recherche d'événements, page événement, catégories,
  organisateurs, FAQ, contact, conditions, confidentialité.
- Espace acheteur : tableau de bord, commandes, favoris, notifications, profil,
  paramètres.
- Espace organisateur : dashboard, création d'événement (assistant en 4 étapes),
  gestion des événements, revenus, paramètres, demandes de modification.
- Administration : utilisateurs, organisateurs, événements, commandes, paiements,
  billets, catégories, messages, demandes.
- **Lien personnalisé des événements** (§14-16, §35) : sous-domaine dynamique
  (`himra.tikeo.com`) codé et prêt, URL de secours `/e/[slug]` fonctionnelle dès
  aujourd'hui sur `tikeo.vercel.app`, choix et vérification de disponibilité du
  lien à la création, écran de partage après publication (copier / WhatsApp /
  Facebook), bouton « Copier le lien » dans la liste des événements, SEO
  (`og:url`, lien canonique). Voir **`DOMAINE-VERCEL.md`** pour brancher un vrai
  domaine et obtenir de vrais sous-domaines.
- Multilingue (fr/en/es/pt), thème clair/sombre, mobile-first.

### 🚧 Pas encore fait (prochaines étapes, dans l'ordre du §63)
1. **Paiement réel** : `PaymentService` modulaire (Orange Money, MTN MoMo, Moov
   Money, Wave, carte) — pour l'instant, une commande est enregistrée en statut
   `pending` mais rien ne la fait passer à `paid` (§24-26).
2. **Génération du ticket numérique + QR Code sécurisé** (§19-20) — la dépendance
   `qrcode` est déjà installée (`package.json`) mais pas encore utilisée.
3. **Scanner de contrôle d'entrée** (§21-23) — la page existe mais est un simple
   écran d'attente, sans lecture de caméra ni vérification.
4. **Mode hors-ligne du scanner** (§23) — prévu comme optionnel/V2 par le cahier
   des charges lui-même.
5. **Supabase Edge Functions** (§6, §64) — dossier vide pour l'instant ; c'est là
   que devront vivre la validation de paiement, la génération de QR et les
   webhooks, pour respecter le principe du §64 (le frontend ne décide jamais
   seul qu'un paiement ou un ticket est valide).
6. Journal d'audit (`audit_logs`, §44) : table prévue en base mais pas encore
   alimentée par le code applicatif.
7. Fonctionnalités V2/V3 (§61-62) : notifications push, codes promo, placement
   numéroté, export, etc. — volontairement hors MVP.

## 🆕 Dernières retouches (retours sur la maquette)

- Logo agrandi et plus visible dans l'en-tête (desktop et mobile).
- Bannière d'accueil plus compacte, titres centrés, bordures resserrées.
- Cartes événements réduites sur mobile (image et textes plus compacts).
- Barre de navigation basse mobile redessinée (bouton Scanner flottant, style plus soigné).
- Icône Nuxt DevTools désactivée (`devtools: { enabled: false }`) — elle n'apparaît plus en bas de l'écran en développement.
- **Multilingue** : Français (par défaut), Anglais, Espagnol, Portugais via `@nuxtjs/i18n`.
  Sélecteur de langue dans l'en-tête (`components/LanguageSwitcher.vue`), traductions dans
  `i18n/locales/*.json`. Ajoutez une langue en dupliquant un fichier JSON et en la déclarant
  dans `nuxt.config.ts` (`i18n.locales`).
- **En-tête adaptatif** : version limitée quand personne n'est connecté (recherche, langue,
  Se connecter, Organisateur) ; version complète une fois connecté (favoris, notifications,
  mes billets, menu profil avec déconnexion). Géré via `useAuth()` / `stores/authStore.ts`.

## 🗂 Connecter Supabase

1. Créez un projet sur [supabase.com](https://supabase.com).
2. Dans **SQL Editor**, exécutez dans l'ordre :
   - `supabase/migrations/0001_init.sql`
   - `supabase/seed/seed.sql`
3. Copiez l'URL et la clé anonyme dans `.env`.
4. (Optionnel) Créez un bucket Storage `event-images` pour les affiches d'événements.

## 📁 Structure du projet

```
tikeo/
├── README.md
├── DOMAINE-VERCEL.md           # Guide : brancher un vrai domaine pour himra.tikeo.com
├── assets/css/main.css       # Tailwind + design tokens Tikeo
├── components/                # AppHeader, HeroSection, EventCard, SidebarFilters,
│                               # CategoriesRow, MobileBottomNav, QuickActionsGrid, AppFooter...
├── composables/                # useSupabase, useAuth, useEvents...
├── layouts/default.vue
├── pages/                      # Architecture complète (site public, mon-espace,
│                               # organisateur, admin) — voir cahier des charges §9-12
├── plugins/supabase.client.ts
├── stores/authStore.ts         # Pinia
├── supabase/
│   ├── migrations/0001_init.sql
│   ├── seed/seed.sql
│   └── functions/              # Edge Functions à venir (paiement, QR, webhooks)
├── capacitor/                  # Étape mobile (à venir)
├── types/database.ts
├── nuxt.config.ts
├── tailwind.config.ts
└── package.json
```

## 🔒 Principe de sécurité (cahier des charges §64)

Le frontend ne décide jamais si un paiement est valide ou si un billet peut entrer :
ces vérifications sont toujours faites côté Supabase (RLS + Edge Functions), jamais
dans le navigateur.
