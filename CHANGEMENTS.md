# Tikeo — Ajustements de l'audit pré-lancement

Ce document résume tout ce qui a été modifié à la suite de l'audit basé sur la
checklist « 20 choses à vérifier avant de lancer son site », comment déployer, et
ce qu'il reste à faire.

> ⚠️ **Avant de déployer** : les fichiers ont été vérifiés par compilation (Vue, TypeScript,
> Tailwind/CSS, JSON) et par relecture, mais le projet n'a **pas pu être lancé** ni la migration
> SQL exécutée dans l'environnement de travail. Suivez la liste « Tester après déploiement »
> en bas de ce document, d'abord sur une preview / un projet Supabase de test.

---

## 1. Résultat par point de la checklist

| # | Point | Avant | Maintenant | Où |
|---|---|---|---|---|
| 1 | Page RGPD | 🟡 | ✅ Citation de la loi ivoirienne n° 2013-450 et de l'ARTCI ; section cookies alignée avec la bannière | `i18n/locales/*.json` (`privacyPage`) |
| 2 | Page CGU | 🟡 | ✅ Case « J'accepte… » obligatoire à l'inscription (horodatée dans les métadonnées du compte) ; liens légaux + « Gérer les cookies » ajoutés au menu mobile | `pages/inscription`, `components/AppHeader.vue` |
| 3 | API hors front-end | 🔴 | ✅ La commande passe par `POST /api/orders` ; prix, stock et statut sont décidés en base, plus dans le navigateur | `server/api/orders.post.ts`, migration `0017` |
| 4 | Forcer le HTTPS | 🔴 | ✅ Redirection 301 (hors Vercel), HSTS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` | `server/middleware/https.ts`, `nuxt.config.ts` |
| 5 | Bannière cookies | 🔴 | ✅ Accepter / Refuser (même poids), choix mémorisé 6 mois, réversible via « Gérer les cookies » | `components/CookieBanner.vue`, `composables/useCookieConsent.ts` |
| 6 | Meta title | 🟡 | ✅ Titre + description propres à chaque page (4 langues), suffixe « — Tikeo » automatique | `composables/useRouteSeo.ts` |
| 7 | Image réseaux (og:image) | 🔴 | ✅ Page événement rendue côté serveur avec `og:title/description/image`, Twitter Card, JSON-LD `Event` ; image par défaut 1200×630 pour le reste du site | `composables/useEventDetail.ts`, `server/api/events/[slug].get.ts`, `public/og-default.jpg` |
| 8 | Favicon | 🟡 | ✅ `favicon.ico`, PNG, `apple-touch-icon`, manifest PWA (icônes 192/512/maskable) | `public/`, `nuxt.config.ts` |
| 9 | Sitemap + robots.txt | 🔴 | ✅ Générés dynamiquement (pages publiques + tous les événements publiés) ; zones privées en `Disallow` + `X-Robots-Tag: noindex` | `server/routes/robots.txt.ts`, `sitemap.xml.ts` |
| 10 | Textes des images | ✅ | ✅ (déjà bon) | — |
| 11 | Compression des images | 🔴 | ✅ Logo 1,3 Mo → 24 Ko, image démo 317 → 31 Ko ; uploads redimensionnés et convertis en WebP côté navigateur ; SVG refusés | `public/`, `composables/useMediaUpload.ts`, migration `0018` |
| 12 | Vitesse des pages | 🟡 | ✅ Polices en `<link>` non bloquant (plus d'`@import`), `loading="lazy"` sur les cartes, 1re image de la bannière et image de l'événement prioritaires | `nuxt.config.ts`, `components/EventCard.vue`, `HeroSection.vue` |
| 13 | Contraste | 🔴 | ✅ Boutons et textes orange passés à `#B05400` (5,1:1 avec du blanc) ; thème sombre : texte sombre sur orange | `assets/css/main.css` |
| 14 | Site responsive | ✅ | ✅ Zoom autorisé (retrait de `maximum-scale=1`) | `nuxt.config.ts` |
| 15 | Page 404 custom | 🔴 | ✅ `error.vue` (404 + erreurs inattendues, 4 langues, `noindex`) ; vraie réponse HTTP 404 pour un événement inconnu | `error.vue` |
| 16 | Liens cassés | ✅ | ✅ (déjà bon — voir « À faire ensuite » pour les réseaux sociaux du footer) | — |
| 17 | Validation formulaires | 🟡 | ✅ `autocomplete`, `maxlength`, `minlength` (mots de passe ≥ 8), `aria-label` ; validation serveur stricte de la commande | pages d'auth, `server/api/orders.post.ts` |
| 18 | Anti-spam | 🟡 | ✅ Honeypot à l'inscription + Cloudflare Turnstile (optionnel) sur inscription / connexion / mot de passe oublié + limites de débit sur les commandes | `components/TurnstileWidget.vue`, `composables/useCaptcha.ts` |
| 19 | Outil d'analytics | 🔴 | ✅ Plausible, chargé **uniquement** si configuré ET si le visiteur a accepté les cookies | `plugins/analytics.client.ts` |
| 20 | Un seul CTA | ✅ | ✅ (déjà bon) | — |

---

## 2. Les deux problèmes critiques corrigés

### a) Aperçu de partage vide (WhatsApp / Facebook / Google)
La page `/e/[slug]` était rendue **vide côté serveur** (le client Supabase n'existe que dans le
navigateur). Elle est maintenant alimentée par `GET /api/events/:slug` (clé *anon*, RLS respectée)
via `useAsyncData` → le HTML servi contient le titre, la description, l'image, l'URL canonique
et les données structurées. Un événement introuvable renvoie un vrai code **404**.

*Choix SEO à connaître* : chaque événement n'a qu'**une seule URL indexée** (`tikeo.com/e/himra`,
balise `canonical`). Le lien `himra.tikeo.com` reste le lien de **partage** et affiche son propre
aperçu.

### b) Commande créée depuis le navigateur
Avant, le navigateur écrivait lui-même `orders` / `order_items` avec les prix de son choix.
Maintenant :

1. Le navigateur envoie seulement `{ eventId, items: [{ ticketTypeId, quantity }] }`.
2. `POST /api/orders` vérifie CSRF, limite de débit, session et compte non suspendu.
3. La fonction SQL `create_order()` relit les prix en base, **verrouille** les types de billets
   (`FOR UPDATE`), contrôle statut / fenêtre de vente / stock, réserve le stock de façon
   **atomique** et crée la commande (`TKO-2026-000001`, format du §18).
4. Les policies RLS d'insertion directe sont **supprimées**.

Règles appliquées : 10 billets max par type, 10 lignes max, 5 commandes en attente max par compte,
**réservation de 15 minutes** (`orders.expires_at`) puis libération automatique du stock.

---

## 3. Déploiement

### Étape 1 — Base de données (Supabase → SQL Editor, dans cet ordre)
1. `supabase/migrations/0017_server_side_orders.sql`
2. `supabase/migrations/0018_media_no_svg.sql`

> Déployez le code **et** exécutez la migration 0017 dans la même fenêtre : une fois les policies
> d'insertion supprimées, l'ancien code (qui écrivait directement) ne pourrait plus créer de commande.

### Étape 2 — Variables d'environnement (Vercel → Settings → Environment Variables)
Aucune n'est obligatoire. Toutes sont décrites dans `.env.example` :

| Variable | Rôle |
|---|---|
| `ALLOW_INDEXING=true` | Seulement si le site tourne sur `tikeo.vercel.app` sans domaine perso (sinon `robots.txt` interdit l'indexation hors domaine racine) |
| `NUXT_PUBLIC_PLAUSIBLE_DOMAIN` | Active la mesure d'audience (après consentement) |
| `NUXT_PUBLIC_PLAUSIBLE_SRC` | Uniquement si Plausible est auto-hébergé |
| `NUXT_PUBLIC_TURNSTILE_SITE_KEY` | Active l'anti-robots (voir étape 3) |

### Étape 3 — Turnstile (optionnel, recommandé avant le lancement)
1. Créez un widget Turnstile sur le dashboard Cloudflare (gratuit) ; ajoutez `tikeo.com` et
   `tikeo.vercel.app` comme domaines.
2. Mettez la **clé de site** dans `NUXT_PUBLIC_TURNSTILE_SITE_KEY`.
3. Supabase → *Authentication* → *Attack Protection* → *Enable CAPTCHA protection* → fournisseur
   *Turnstile* → collez la **clé secrète**.

Faites les points 2 et 3 ensemble : si Supabase exige le captcha alors que le site n'envoie pas de
jeton (ou l'inverse), les connexions échouent.

### Étape 4 — Après mise en ligne
- Déclarer `https://tikeo.com/sitemap.xml` dans Google Search Console.
- Tester un partage WhatsApp d'un lien d'événement (voir liste ci-dessous).

---

## 4. Tester après déploiement

- [ ] `/robots.txt` et `/sitemap.xml` s'affichent (le sitemap liste vos événements publiés).
- [ ] « Afficher le code source » de `/e/<un-slug>` : on voit `og:title`, `og:image` (URL absolue) et le JSON-LD.
- [ ] Partager un lien d'événement sur WhatsApp / Facebook Sharing Debugger : titre + image corrects.
- [ ] `/une-page-qui-nexiste-pas` et `/e/slug-inconnu` : page 404 (et code HTTP 404).
- [ ] Bannière cookies : Refuser → pas de script Plausible ; Accepter → script chargé ; « Gérer les cookies » la rouvre.
- [ ] Inscription : impossible sans cocher la case ; connexion / mot de passe oublié fonctionnent (avec Turnstile si activé).
- [ ] **Commande** : connecté, réserver 2 billets → numéro `TKO-…` ; le stock restant baisse ; une 2e réservation qui dépasse le stock est refusée (« plus assez de billets ») ; le total correspond aux prix en base.
- [ ] **Sécurité de la commande** : depuis la console du navigateur, un `insert` direct dans `orders` doit être refusé (RLS).
- [ ] Attendre 15 min (ou passer `expires_at` dans le passé) puis créer une commande : l'ancienne commande `pending` passe à `cancelled` et le stock est rendu.
- [ ] Upload d'une grosse affiche : le fichier stocké est en WebP, ≤ 1600 px ; un `.svg` est refusé.
- [ ] Boutons orange lisibles en thème clair **et** sombre ; le focus clavier (Tab) est visible.
- [ ] Menu mobile : liens « Conditions », « Confidentialité », « Gérer les cookies ».
- [ ] Sur un vrai sous-domaine (`himra.tikeo.com`) : la page événement s'ouvre et le partage affiche l'aperçu.
- [ ] Lighthouse mobile (Chrome DevTools) sur l'accueil et une page événement.

---

## 5. À faire ensuite (non inclus dans cet ajustement)

1. **Paiement, webhooks, génération des tickets/QR** (§19-26) — les commandes restent `pending`
   et retiennent leur stock 15 min ; le webhook devra passer la commande à `paid` et créer les
   tickets (Edge Function / route serveur, comme `create_order`).
2. **Commissions** (§38) : `fees` vaut 0 dans `create_order()` ; à brancher sur la configuration admin.
3. **CSP complète** (`script-src`, `connect-src`…) : à introduire en `Content-Security-Policy-Report-Only`
   puis à durcir après test réel (Supabase, polices Google, Turnstile, Plausible). Seules les
   directives sans risque (`frame-ancestors`, `base-uri`, `object-src`) sont actives.
4. **Limite de débit** (`server/utils/rateLimit.ts`) : elle est en mémoire, donc par instance
   serverless. Pour une protection réelle en production, la brancher sur Upstash / Vercel KV.
5. **Nettoyage régulier des réservations** : la libération se fait à chaque nouvelle commande ;
   pour un nettoyage même sans trafic, planifier `release_expired_orders()` avec `pg_cron`
   (commande fournie en commentaire dans la migration 0017).
6. **Textes juridiques** : faites relire CGU et politique de confidentialité par un juriste ;
   vérifiez si une déclaration / autorisation auprès de l'ARTCI est requise pour votre activité.
   Une page « Mentions légales » dédiée reste à écrire (le lien du footer pointe aujourd'hui vers les CGU).
7. **Réseaux sociaux du footer** : les icônes Facebook / Instagram / X pointent sur `#` — à remplacer
   par vos vraies pages (ou à retirer) avant le lancement.
8. `/organisateur/tarifs` est rendue côté client uniquement (`ssr: false`) ; si vous voulez qu'elle
   soit indexée, retirez-la de cette règle.
9. `.env.example` : un identifiant SMTP Brevo réel figurait en commentaire ; il a été remplacé par un
   exemple générique. Il reste dans l'historique Git.

---

## 6. Liste des fichiers

**Ajoutés** — `error.vue`, `components/CookieBanner.vue`, `components/TurnstileWidget.vue`,
`composables/useCookieConsent.ts`, `useCaptcha.ts`, `useRouteSeo.ts`, `useSiteOrigin.ts`,
`plugins/analytics.client.ts`, `server/api/orders.post.ts`, `server/api/events/[slug].get.ts`,
`server/routes/robots.txt.ts`, `server/routes/sitemap.xml.ts`, `server/middleware/https.ts`,
`server/utils/siteOrigin.ts`, `server/utils/userAuth.ts`, `supabase/migrations/0017_*.sql`,
`0018_*.sql`, `public/` (`favicon.ico`, `apple-touch-icon.png`, `icon-192/512/maskable`, `og-default.jpg`,
`manifest.webmanifest`), `CHANGEMENTS.md`.

**Modifiés** — `app.vue`, `nuxt.config.ts`, `assets/css/main.css`, `types/database.ts`, `.env.example`,
`README.md`, `DOMAINE-VERCEL.md`, `i18n/locales/{fr,en,es,pt}.json`, `composables/useAuth.ts`,
`useEventDetail.ts`, `useMediaUpload.ts`, `server/utils/adminAuth.ts` (réutilise `requireUser`),
`pages/e/[slug].vue`, `pages/index.vue`, `pages/evenements/index.vue`, `pages/recherche/index.vue`,
`pages/inscription`, `pages/connexion`, `pages/mot-de-passe-oublie`, `components/AppHeader.vue`,
`AppFooter.vue`, `EventCard.vue`, `HeroSection.vue`, `public/logo-tikeo.png`, `favicon.png`, `sample-event.jpg`.

Aucune nouvelle dépendance npm : pas de `npm install` supplémentaire.
