# Partenaires : section d'accueil, page publique et gestion admin

- Nouveau : `supabase/migrations/0048_partners.sql` (table `partners`, permission `partners.manage`, rôle « Admin Partenaires », dossier Storage `partner-logos/`), `composables/usePartners.ts`, `components/PartnersSection.vue`, `components/PartnerLogo.vue`, `pages/partenaires/index.vue`, `pages/admin/partenaires/index.vue`.
- Accueil : section « Nos partenaires » sous les chiffres de confiance (grandes cartes pour les partenaires à la une, bandeau de logos défilant pour les autres, appel « Devenir partenaire »). Elle n'apparaît que s'il y a au moins un partenaire actif.
- Page publique `/partenaires` : en-tête, filtres par catégorie, partenaires à la une, grille, bloc « Pourquoi s'associer ». Liens ajoutés dans le menu, le pied de page, le sitemap et le SEO.
- Admin > Partenaires : ajout, modification (fenêtre avec import du logo), suppression avec confirmation, monter / descendre, mettre à la une, afficher / masquer, recherche et filtres. Boutons à icônes avec infobulle.
- `/contact?sujet=partenaire` pré-remplit le sujet. Textes fr/en/es/pt (`partners.*`, `adminPartners.*`).

## À faire
- Appliquer `supabase/migrations/0048_partners.sql` dans Supabase (SQL Editor).

# Correctif : « Profil mis à jour » mais rien d'enregistré (Mon profil)

- Cause : à l'enregistrement, `updateProfile()` (nom, téléphone) renouvelait `profile`, ce qui relançait `syncFromServer()` et réécrivait le formulaire avec les anciennes valeurs AVANT l'envoi de la ville, de la présentation et de la date de naissance. Ces champs partaient donc vides, alors que le message de succès s'affichait.
- Correction (`pages/mon-espace/profil/index.vue`) : le formulaire n'est plus resynchronisé pendant un enregistrement, l'envoi part d'un instantané des valeurs saisies, et le formulaire est ensuite aligné sur ce qui a réellement été enregistré. Les centres d'intérêt sont renvoyés avec le reste pour ne pas être écrasés.

# Audit de sécurité pré-lancement

- Nouveau : `server/utils/escapeHtml.ts`, `server/api/promo/validate.post.ts`, `supabase/migrations/0043_security_hardening.sql`, `supabase/security/audit_rls.sql`, `GUIDE-TESTS-SECURITE.md`.
- Modifié : gabarits d'e-mails (échappement), `userAuth.ts` (comptes suspendus), `brevo.ts` (logs), webhook Jèko (trace), cron (comparaison à temps constant), aperçu de transfert (limite de débit), `usePromoCode.ts` (passe par le serveur).
- Détail et checklist : voir `SECURITE.md` sections 5 à 7.

# Admin > Bannière d'accueil : alignée sur le nouveau hero

- Le hero public fusionne les zones centre / gauche / droite dans un seul diaporama ; la page admin ne propose plus trois zones mais une liste unique, dans l'ordre exact de défilement (monter / descendre, activer / désactiver, supprimer). Les nouvelles images sont ajoutées en fin de diaporama.
- Aperçu en direct (colonne de droite) : visuel avec cadre orange et perforation, titre, sous-titre et bouton mis à jour pendant la saisie ; clic sur une miniature = prévisualiser cette image. Indicateur « texte non enregistré », valeurs par défaut affichées en placeholder quand un champ est vide.
- `useAdminHomeSlides` : ajout de `slideshow` (liste fusionnée) et `moveInSlideshow` (réordonne tout en zone `center`, positions 1..n). Aucune migration SQL.
- Textes fr/en/es/pt : clés `adminHomeSlides.*` ajoutées / reformulées.

# Avis des visiteurs + messages de contact en pop-up

## Avis sur Tikeo (visiteurs)
- Nouvelle page publique `/avis` : note globale et répartition, formulaire (étoiles interactives, catégorie Compliment / Idée / Problème / Autre, prénom, email optionnel, consentement d'affichage, anti-spam Turnstile + honeypot) et mur des avis publiés avec réponse de l'équipe.
- Bandeau « Votre avis compte » sur l'accueil (`SiteFeedbackStrip`) : un clic sur une étoile ouvre `/avis` avec la note choisie. Lien « Donner mon avis » dans le pied de page et le plan du site.
- Envoi par `server/api/feedback.post.ts` (CSRF, limite de débit, honeypot, Turnstile) ; seule la vue `site_feedback_public` est lisible du public (jamais l'email).
- Admin > Avis : deux onglets, « Avis sur Tikeo » (nouveau) et « Avis sur les événements » (existant). Cartes-filtres, recherche, filtres catégorie/note, pop-up de détail, publication / retrait de la page publique, archivage, suppression, réponse (email + affichée sous l'avis publié).

## Admin > Messages de contact
- Page réorganisée : cartes-filtres cliquables (En cours / Nouveaux / Suppressions de compte / Archivés), filtres type + tri, « Tout marquer comme lu », liste groupée par jour avec avatar, aperçu du message et point « non lu ».
- Clic sur un message = pop-up (`AdminModal`) : coordonnées (copie de l'email), message complet, alerte suppression de compte, réponse envoyée par email depuis la plateforme (modèles rapides) et conservée, précédent / suivant (boutons ou flèches du clavier), archiver, marquer non lu, supprimer le compte.
- `server/api/admin/reply.post.ts` : réponse (permissions `support.manage` / `moderation.manage`, CSRF, 2FA), envoi via Brevo.

## À faire
- Appliquer `supabase/migrations/0042_site_feedback_and_message_replies.sql` (table `site_feedback`, vues publiques, colonnes de réponse sur `contact_messages`).
- Variables Brevo (`BREVO_API_KEY`, expéditeur) nécessaires pour que les réponses partent réellement par email.

# PDF du billet reçu par email : la photo de l'événement s'affiche

- Cause : côté serveur, seuls les JPEG/PNG (reconnus par l'en-tête Content-Type) étaient acceptés ; une affiche WebP, AVIF, GIF ou SVG donnait un billet sans photo. « Mes billets » fonctionnait car le navigateur convertit l'image via un canvas.
- Correctif (`server/utils/ticketPdf.ts`) : `sharp` décode n'importe quel format, réduit à 1400 px max et ré-encode en JPEG (fond blanc si transparence) ; lien relatif géré ; délai maximum 10 s ; échec journalisé. Repli sur l'ancien chemin puis sur « sans photo ».
- `utils/ticketPdfDoc.ts` : le repli reconnaît JPEG/PNG par leurs octets et non plus par le Content-Type.
- Nouvelle dépendance `sharp` (`package.json` + `package-lock.json` mis à jour) : lancer `npm install`.

# Création d'événement : libellés clairs sur les 4 étapes

- Nouveaux composants `WizardField` (libellé visible + « * » obligatoire / « (optionnel) » + aide) et `WizardSection` (blocs titrés).
- Étape 1 : sections Informations générales, Visuels, Date et heure, Lieu, Options ; chaque champ a son libellé, les placeholders deviennent des exemples. Libellé aussi sur la recherche d'adresse de la carte (`VenueMapPicker`, textes désormais traduits) et sur les zones d'import (`MediaInput`, libellé plus lisible).
- Étape 2 : chaque billet est une carte « Billet N » avec Nom du billet / Prix (FCFA) / Quantité disponible.
- Étape 3 : récapitulatif en liste Nom / Date / Lieu / Lien / Billets / Limite + explication Brouillon vs Publier.
- Étape 4 : libellés « Lien de votre événement » et « Partager sur ».
- En-tête « Étape N sur 4 » avec une phrase d'explication. Clés `eventForm.*` ajoutées en fr/en/es/pt.

# Durcissement sécurité

- `.env` retiré du projet livré (il contenait de vraies clés) ; guide `SECURITE.md` (rotation des clés, Turnstile, CSP, HSTS).
- Turnstile : déjà branché partout ; nouveau rappel `[sécurité]` dans les logs au démarrage tant que les clés sont vides (`server/plugins/securityWarnings.ts`).
- `nuxt.config.ts` : CSP complète en production (script-src, connect-src, img-src, frame-src...), interrupteur `NUXT_CSP_REPORT_ONLY=true` ; HSTS passé à 1 an + `includeSubDomains`.

# Intro en icônes, portefeuille, scanner réservé

## Introduction : icônes au lieu d'emojis + centrée sur mobile
- `OnboardingIntro` : plus aucun emoji, la page sans image affiche une icône SVG (`AppIcon`). Sur mobile, l'intro n'occupe plus tout l'écran : carte centrée avec marges (max 400 px, 86 % de la hauteur) ; desktop inchangé.
- Admin > Introduction : le champ « Emoji » est remplacé par un sélecteur d'icônes (liste dans `utils/introIcons.ts`).
- Migration `supabase/migrations/0041_onboarding_icons.sql` (à appliquer) : colonne `icon`, retire les emojis du contenu de départ et vide l'ancienne colonne `emoji`.

## Mon portefeuille
- `/mon-espace/portefeuille` n'est plus une page vide : total dépensé, remboursé, billets valides, commandes payées, billets prêts pour l'entrée et dernières transactions.
- Lien « Mon portefeuille » ajouté dans la navigation de Mon compte (`AccountNav`), entre « Mes commandes » et « Mes favoris ». « Mes commandes » passe sur l'icône `receipt`.
- Clés i18n `buyerWallet.*` en fr/en/es/pt.

## Scanner : admin et organisateur uniquement
- Nouveau `composables/useCanScan.ts`. L'icône Scanner (barre du bas mobile et raccourcis d'accueil) reste visible pour tous. Admin et organisateur ouvrent le scanner ; visiteurs et acheteurs sont envoyés vers `/scanner` (`pages/scanner/index.vue`), une page qui explique quand le scan s'active. La vraie page reste protégée par le middleware `organizer`.

# Introduction, visite guidée, pop-up et footer

- `OnboardingIntro` : refonte complète. Mobile = feuille plein écran (scène colorée + bord de billet perforé, balayage tactile) ; desktop = fenêtre en deux volets. Barre de progression « stories » cliquable, numérotation 01/04, billet flottant pour les pages sans image, Ken Burns sur les images, précharge de la page suivante, touches clavier, animations coupées si « réduire les animations ».
- `HeaderTour` : bulle refaite (pictogramme par bouton, barre de marque, progression segmentée, boutons à icônes), projecteur animé, choix dessus/dessous plus fiable.
- `AnnouncementPopup` : même langage visuel, feuille du bas sur mobile.
- `AppFooter` : « Suivez-nous » et « Paiement mobile & carte » sur une seule ligne ; marges et espacements réduits (footer nettement moins haut).

# Administration : style organisateur, icônes, 2FA admin uniquement, journal

## 2FA réservée aux administrateurs
- Retrait de la 2FA côté clients : section « Double authentification » de Mon espace > Paramètres et étape code de `/connexion` supprimées ; `composables/useTwoFactor.ts` supprimé.
- La 2FA n'est demandée qu'à l'entrée du panneau admin (`middleware/admin.ts` -> `/admin/verification-2fa`). Un admin qui se connecte sans destination précise est envoyé sur `/admin`.
- Migration `supabase/migrations/0040_mfa_admin_only.sql` (à appliquer) : remet `mfa_required` à false et SUPPRIME les facteurs TOTP des comptes non admin ; interdit à un non-admin d'activer `mfa_required` ; nettoie un compte qui perd le rôle admin.

## Journal d'activité
- Cause : jointure `profiles` invalide dans la requête (erreur avalée, page vide). La page utilise désormais `useAuditLogs` : recherche instantanée, filtres élément/dates, actualisation manuelle + auto (30 s), détails dépliables, « Voir plus », erreur visible.
- Nouvelles écritures dans le journal : publication/suspension/annulation d'événements, suspension/réactivation/rôle d'utilisateurs, organisateurs, catégories, rôles et permissions admin, masquage d'avis, validation 2FA.

## Icônes et style
- Boutons texte remplacés par `OrgIconButton` (infobulle) sur toutes les pages admin (événements, utilisateurs, organisateurs, demandes, commandes, billets, paiements, messages, avis, catégories, administrateurs, introduction, popups, accueil). Emojis/glyphes (▶ 👁 ↻ ★ ✓ ✕ ⬇ 📣) remplacés par `AppIcon`.
- Nouveaux composants : `StatusPill`, `AdminEmpty`, `AdminSearch`, `useAdminConfirm` (confirmations aux couleurs du site à la place de `confirm()`).
- ~22 icônes ajoutées à `AppIcon` (dont `flag`, `bolt`, `next`, `approved`, `valid`, `password`).
- Clés i18n ajoutées en fr/en/es/pt.

# Tikeo — Correctif 2FA admin + espace Administration au nouveau style

Aucune migration SQL, aucune variable `.env`.

**Correctif : le bouton « Activer la double authentification » ne réagissait pas**
1. Cause : un facteur TOTP « non vérifié » abandonné (page rechargée pendant l'inscription) reste chez Supabase et fait échouer toute nouvelle inscription (nom déjà utilisé). `listFactors().totp` ne renvoie que les facteurs vérifiés, donc rien ne le nettoyait ; et l'erreur n'était affichée que dans l'étape suivante, donc invisible.
2. `useAdminMfa.startEnroll` supprime maintenant les facteurs non vérifiés restants, donne un nom unique au facteur et fixe l'émetteur « Tikeo ».
3. Les erreurs s'affichent dans la page d'activation, avec un message dédié si le TOTP est désactivé côté Supabase (Authentication → Multi-Factor → « TOTP (Enroll) »). Le bouton montre un indicateur de chargement et ne peut plus être déclenché deux fois.

**Style Administration**
4. Pages « porte » (`securite`, `verification-2fa`) : nouveau cadre `AdminGate` (fond encre, carte billet à filet de marque), saisie du code en 6 cases (`OtpInput` : avance seule, collage, remplissage automatique, secousse si faux), secret copiable, étapes numérotées.
5. Layout admin : menu latéral à pastilles carrées, tiroir mobile avec carte d'identité, en-tête collant, **bandeau encre avec le titre de la rubrique** (le `<h1>` de chaque page reste dans le DOM mais est masqué visuellement quand le bandeau est affiché).
6. Tableau de bord admin : chiffres animés cliquables, panneaux graphiques, raccourcis à icônes.
7. Toutes les autres pages admin héritent de l'habillage commun (`.admin-main` dans `main.css`) : largeur harmonisée, tableaux (en-têtes, survol), apparition animée.
8. Nouveaux composants : `AdminGate`, `OtpInput`. Nouvelles icônes `AppIcon` : image, megaphone, briefcase, star, clipboard, wrench, activity, user-check. Nouvelle clé i18n (fr/en/es/pt) : `adminMfa.enrollDisabled`.

---

# Tikeo — Scanner d'entrée (contrôle d'accès par QR code)

Aucune migration SQL, aucune variable `.env`. Nouvelle dépendance : `jsqr` (lecture du QR sur les navigateurs sans lecteur natif, ex. Safari iOS) → lancer `npm install`.

1. **Page** `/organisateur/evenements/scanner` : choix de l'événement, caméra arrière avec viseur animé, lampe torche, changement de caméra, bip + vibration, résultat plein écran (vert = entrée validée, orange = déjà utilisé avec l'heure du premier scan, rouge = annulé / inconnu / autre événement / non payé), saisie manuelle du numéro de billet, compteurs en direct (entrés / restants / total + barre de progression) et historique des 20 derniers scans, rafraîchis toutes les 10 s.
2. **Validation côté serveur** (`server/api/scan/validate.post.ts`) : le navigateur ne décide de rien. Droits vérifiés (propriétaire de l'événement, agent actif de `event_agents`, ou admin), CSRF, limite de débit. Passage `valid → used` atomique (`update … where status = 'valid'`) : deux agents ne peuvent pas valider le même billet. Chaque scan est journalisé dans `ticket_scans`.
3. **Compteurs** (`server/api/scan/stats.get.ts`), mêmes droits.
4. **Raccourcis** : icône « scanner » sur chaque événement publié de « Mes événements » et sur le bandeau « Prochain événement » du tableau de bord (l'événement est présélectionné).
5. La caméra exige **HTTPS** (ou localhost) ; sinon un message propose la saisie manuelle. Elle s'éteint quand l'onglet passe en arrière-plan.
6. Nouvelles clés i18n (fr/en/es/pt) : bloc `organizerScanner.*`.

---

# Tikeo — Espace organisateur au style du site visiteur

Aucune migration SQL, aucune variable `.env`. Toute la logique (chargement, duplication, pause/republication, copie du lien, codes promo, réglages) est inchangée.

1. **Layout** (`layouts/organisateur.vue`) : menu latéral à pastilles carrées (actif en encre, orange en thème sombre), filet orange→bleu, tiroir mobile avec fond flouté et carte d'identité, barre du bas mobile avec bouton « Créer » central, en-tête collant, bandeaux d'alerte avec icône.
2. **Boutons à icônes** (`OrgIconButton`) : Pause/Republier, Modifier, Dupliquer, Statistiques, Voir, Copier le lien (coche verte après copie), Supprimer — avec infobulle. **Supprimer** n'apparaît que sur les brouillons (règle RLS existante) et passe par `ConfirmDeleteModal`.
3. **Pages restylées** : tableau de bord (chiffres animés, talons de date), Mes événements (cartes avec affiche, onglets, recherche, liste animée), Revenus (classement + barre de part), Scanner, Statistiques, Codes promo, Paramètres, et les en-têtes de Créer / Modifier / Liste d'attente / Codes promo d'un événement.
4. **Animations** : apparition en cascade (`.org-rise`, `--i`), compteurs (`OrgCountUp`), squelettes à reflet, pastille « en ligne » pulsante, liste animée (`org-list`), viseur du scanner. Désactivées si « réduire les animations » est actif.
5. Nouveaux composants : `OrgPageHeader`, `OrgIconButton`, `OrgCountUp`. Nouvelles icônes `AppIcon` : edit, trash, copy, duplicate, chart, pause, play, grid, scan, home, save, alert… Nouvelles clés i18n (fr/en/es/pt) : `organizerEvents.delete*`.

---

# Tikeo — Paiement + connexion / inscription / mot de passe oublié

Aucune migration SQL, aucune variable `.env`. Toute la logique (paiement Jèko, Orange/Maxit, numéro du payeur, minuteur, Turnstile, 2FA, OTP) est inchangée : seuls les gabarits et styles ont été refaits.

1. **Page de paiement** (`pages/commande/[id]/index.vue`) : en-tête encre avec compte à rebours (passe au rouge sous 2 min) et étapes Billets → Paiement → Confirmation ; carte événement en forme de billet (photo, perforation, date/lieu) ; « Votre commande » avec bandeau « Total à payer » ; panneau de paiement structuré (pays, moyens en tuiles avec coche, récapitulatif, aide numérotée, numéro du payeur, conditions, gros bouton orange avec cadenas, 3 pastilles de réassurance). Version « événement gratuit » assortie. Panneau de paiement collant sur grand écran.
2. **Retour de paiement** (`retour.vue`) : même en-tête, carte de succès façon billet, états attente / USSD / échec / délai dépassé restylés.
3. **Connexion, inscription, mot de passe oublié** : nouveau gabarit `AuthSplitLayout` (grand billet à deux volets : panneau marque encre avec promesse et 3 atouts, perforation à encoches, formulaire à droite ; bandeau compact sur mobile), nouveau champ `AuthField` (libellé en capitales, champ carré 48 px, œil afficher/masquer le mot de passe), onglets Mot de passe / Code par email en pastilles, barre de progression à 3 étapes sur « mot de passe oublié ».
4. Nouveaux composants : `PageHero`, `AuthField`. Nouvelles classes CSS : `.field-input`, `.acc-alert-info`. Nouvelles icônes : `lock`, `eye`, `eye-off`, `phone`. Nouvelles clés i18n (fr/en/es/pt) : bloc `authLayout.*`.

---

# Tikeo — Nouveau billet PDF (email + Mes billets)

Aucune migration SQL, aucune variable `.env`. Le PDF du mail et celui de « Mes billets » sont désormais **identiques** : un seul dessin partagé.

1. **Page A4 portrait** : le billet en haut, et juste en dessous un bloc structuré « Conditions d'accès & consignes » (8 consignes numérotées sur 2 colonnes, encadré « À retenir », pied de page avec n° de commande et rang du billet).
2. **Le billet** (inspiré de ton image, aux couleurs Tikeo marine + orange) : logo Tikeo, ruban avec le type de billet, titre, DATE & HEURE, LIEU, TITULAIRE, N° DE BILLET avec icônes, photo de l'événement en fond (voile marine), talon détachable avec encoches et perforation, QR code encadré, prix (ou GRATUIT) et « BILLET 1 / 3 ».
3. **Fichiers** : `utils/ticketPdfDoc.ts` (dessin partagé, modifiable : palette, textes des conditions `CONDITIONS`, géométrie), `utils/ticketLogo.ts` (logo en base64). `server/utils/ticketPdf.ts` et `pages/mon-espace/mes-billets/index.vue` n'ont plus leur propre dessin.
4. **Titulaire** : nom de l'acheteur (email) / nom du compte connecté (Mes billets). `holderName` ajouté à `ticketsEmailTemplate` et passé par les 3 routes d'envoi (confirm-payment, claim-free, webhook Jeko).
5. Un mail = un PDF par billet (inchangé). « Tout télécharger » = un PDF, une page par billet.

---

# Tikeo — Espace « Mon compte » au style de l'accueil et de la page événement

Aucune migration SQL, aucune variable `.env` à changer. Toute la logique (commandes, billets, transferts, suppression, 2FA, notifications…) est inchangée : seuls les gabarits et styles ont été refaits.

1. **Nouveau gabarit commun** `components/AccountShell.vue`, utilisé par toutes les pages « Mon espace » :
   - hero encre (filet orange→bleu, trame de perforation, étiquette « Mon espace », titre en Bricolage) ;
   - barre de navigation en pastilles carrées avec icônes, comme la barre de sections de la page événement (`components/AccountNav.vue` : pastille active en encre, orange en thème sombre, badge de notifications, défilement mobile qui recentre la page active) ;
   - contenu **centré** dans une largeur adaptée : `full` (tableau de bord, favoris), `wide` (listes, profil), `narrow` (paramètres).
2. **Tableau de bord** : « Bonjour {prénom} » avec avatar carré, 3 chiffres clés cliquables dans le hero, prochains billets en **forme de ticket** (talon de date, perforation, « Aujourd'hui / Demain / Dans N jours »), dernières commandes, accès rapide.
3. **Mes billets** : cartes de commande avec affiche, statut, déroulé des billets avec QR ; la modale « Voir » et la modale de transfert reprennent le style billet.
4. **Mes commandes, Liste d'attente, Notifications, Favoris, Profil, Paramètres, Portefeuille** : même univers (angles carrés, liseré orange, étiquettes de statut, états vides illustrés, sections de paramètres en blocs avec icône, zone « Compte » en rouge).
5. Nouvelles classes CSS (`assets/css/main.css`) : `.acc-panel`, `.acc-h2`, `.acc-label`, `.acc-empty`, `.acc-tag`, `.acc-link`, `.acc-btn-ghost`, `.acc-btn-danger`, `.acc-alert-error`, `.acc-alert-success`. `UserAvatar` gagne une option `square`.
6. Nouvelles clés i18n (fr/en/es/pt) : bloc `account.*`.

---

# Tikeo — Header, footer et page détail événement (style accueil)

Aucune migration SQL, aucune variable `.env` à changer. Après installation : `npm install` puis `npm run dev`.

1. **Header** (`components/AppHeader.vue`) : filet orange→bleu, recherche carrée avec suggestions, bouton « Publier » encre (orange en thème sombre), menu compte avec bandeau encre.
   - **Mobile** : ligne aérée (logo · recherche · notifications · menu). La recherche se déplie avec suggestions en direct. Le menu est un **tiroir plein hauteur** (bandeau identité, accès rapide Billets / Favoris / Portefeuille / Notifications, bouton Publier, navigation, **thème + langue**, déconnexion).
   - Le sélecteur de langue desktop vit dans la barre du haut (`AppTopBar`, repère `data-tour="language"` déplacé là). Sur mobile, thème et langue sont dans le tiroir : une étape de visite guidée dont la cible n'est pas visible reste simplement ignorée.
   - Correctif : le libellé de rôle (Admin / Organisateur) ne s'affichait jamais à côté du nom ; il s'affiche désormais.
2. **Barre du haut** (`AppTopBar.vue`) passée en encre, réseaux sociaux partagés avec le footer (`utils/socialLinks.ts`).
3. **Footer** (`components/AppFooter.vue`) : fond encre, bord de billet déchiré, mot-symbole géant, 4 colonnes de liens, réseaux sociaux, logos de paiement, barre légale, langue, retour en haut. **Désormais visible aussi sur mobile** (`layouts/default.vue`), avec la place réservée pour la barre du bas.
   - Les liens factices `#` (« Points de vente physique », « Nos références ») ont été retirés ; « Politique de remboursement » pointe vers `/conditions`.
4. **Page événement** (`pages/e/[slug].vue`) :
   - Hero encre comme l'accueil : affiche avec talon de date, titre, date, lieu, organisateur, compte à rebours, prix « à partir de », bouton **Choisir mes billets**, calendrier, partage.
   - Barre de sections (Billets · À propos · Lieu · Avis) à la place des onglets, puis sections empilées.
   - **Billets en forme de ticket** (perforation + souche avec − / +), récapitulatif collant sur desktop, **barre de réservation mobile permanente** (« à partir de… » puis total) qui se retire en arrivant au footer.
   - Lieu avec bouton **Itinéraire** (Google Maps) + carte, avis avec note moyenne, « Vous aimerez aussi » en carrousel.
   - Le bouton « S'abonner » (sans action) a été retiré. Toute la logique (commande, promo, liste d'attente, avis, SEO, JSON-LD) est inchangée.
5. Nouveaux composants : `AppIcon`, `SearchSuggestions`. Nouvelles classes CSS : `.btn-ink`, `.btn-brand`, `.drawer-row`, `.drawer-icon`. Nouvelles clés i18n (fr/en/es/pt) : `header.*`, `footer.*`, `event.*`.

---

# Tikeo — Maintenance, page de succès, paiements (Orange / MTN / Moov / Djamo / Wave)

1. **Page de maintenance** : le lien « Accès administrateur » est supprimé (`components/MaintenanceNotice.vue`). L'admin reste joignable en tapant `/connexion` à la main.
2. **Page de succès après paiement** (`pages/commande/[id]/retour.vue`) : grand écran « Paiement réussi ! » avec événement, date, lieu, n° de commande, montant et le bouton **Voir mes billets** → `/mon-espace/mes-billets`. Le lien « Suivre ma commande » (ancienne route cassée) pointe maintenant sur `/mon-espace/mes-commandes`.
3. **Orange Money** (`pages/commande/[id]/index.vue`) : choix « J'ai l'application Maxit » / « Je n'ai pas Maxit ».
   - Avec Maxit : redirection vers Orange, qui ouvre Maxit.
   - Sans Maxit : lien cliquable `#144*82#` (génère le code temporaire Orange CI), champ de collage 4 chiffres (bouton « Coller », nettoie les espaces/lettres), puis le code est **copié dans le presse-papiers** au clic sur « Payer » pour être collé sur la page Orange.
   - ⚠️ L'API Jèko ne documente aucun champ « OTP » : le code ne peut donc pas être envoyé par notre serveur, il est saisi sur la page Orange.
4. **Wave / MTN / Moov / Djamo** : bloc d'aide avant paiement (étapes claires par réseau). MTN : `*133#`, Moov : `*155#` en secours si la demande USSD n'arrive pas (rappelé aussi sur l'écran d'attente).

Aucune migration SQL à exécuter. Fichier de variables `.env` inchangé.

---

# Tikeo — Mode maintenance piloté par l'admin + écran de démarrage avec le loader du site

> ⚠️ **À faire une seule fois** : exécuter `supabase/migrations/0039_site_maintenance.sql` dans l'éditeur SQL de Supabase.
> Sans elle, le site reste ouvert normalement (jamais fermé par erreur) mais la page `/admin/maintenance` affichera une erreur à l'enregistrement.

1. **Écran de démarrage** : le logo s'affiche comme avant, avec en dessous le **même loader orange que celui des pages de
   paiement/chargement** (nouveau composant réutilisable `TikeoSpinner`) à la place de la barre qui glissait.
   Fichiers : `components/SplashScreen.vue`, `components/TikeoSpinner.vue`.
2. **Page de maintenance gérée par l'admin** — menu *Administration → Maintenance* (`/admin/maintenance`, permission
   `settings.manage`, donc Super Admin par défaut) : interrupteur, type (programmée / urgente), titre, message, retour estimé,
   aperçu en direct de la page visiteur. Chaque changement est écrit dans le journal d'audit.
   - Visiteurs : redirigés vers `/maintenance` (réponse HTTP **503** + `Retry-After`, non indexée). La page se rouvre toute seule dès que la maintenance est coupée.
   - Les **nouvelles commandes sont bloquées côté serveur** (aussi par appel direct à l'API). Les paiements déjà lancés se terminent (webhook Jèko, confirmation, pages `/commande/*`).
   - Restent ouverts : `/admin`, `/connexion`, `/mot-de-passe-oublie`, fichiers statiques.
   - Un admin connecté peut parcourir le site pendant la maintenance (cookie d'aperçu posé par le layout admin).
   - Cache serveur de 15 s : un changement est visible partout en ≤ 15 s. Si la lecture en base échoue, le site reste ouvert.
   Fichiers : `supabase/migrations/0039_site_maintenance.sql`, `server/middleware/maintenance.ts`, `server/utils/maintenance.ts`,
   `server/api/maintenance.get.ts`, `server/api/admin/maintenance.post.ts`, `middleware/maintenance.global.ts`, `utils/maintenance.ts`,
   `components/MaintenanceNotice.vue`, `pages/maintenance/index.vue`, `pages/admin/maintenance/index.vue`, `layouts/admin.vue`,
   `nuxt.config.ts`, `composables/useRouteSeo.ts`, `i18n/locales/*.json` (clés `adminMaintenance`, `maintenancePage`, `adminNav.maintenance`).

**Tester après déploiement** : (1) ouvrir le site dans un onglet privé → logo + loader orange ; (2) `/admin/maintenance` → activer →
onglet privé : page de maintenance ; `curl -I https://votre-domaine/` doit répondre 302 vers `/maintenance`, puis `curl -I …/maintenance` → 503 ;
(3) tenter d'acheter un billet → refusé ; (4) désactiver → le site revient en ≤ 30 s.

---

# Tikeo — Dernier lot d'ajustements (espace visiteur, démarrage, visite guidée mobile)

> ⚠️ **À faire une seule fois** : exécuter `supabase/migrations/0038_buyer_hide_history_and_bottom_tour.sql`
> dans l'éditeur SQL de Supabase. Sans elle, la suppression de billets/commandes affichera une erreur
> (le reste du site continue de fonctionner normalement).

1. **Supprimer des billets** (Mes billets : par billet ou toute la commande, Tableau de bord), **des commandes**
   (Mes commandes, Tableau de bord) et **des notifications** (une par une ou « Tout supprimer »), avec confirmation.
   - Billets et commandes sont *masqués* de l'historique de l'acheteur (colonne `hidden_by_user_at`), jamais effacés :
     l'organisateur, l'admin, les revenus et le scan à l'entrée gardent leurs données. Un message prévient si le billet est encore valide.
   - Les commandes « en attente de paiement » ne peuvent pas être supprimées (elles expirent seules).
   - Notifications : vraie suppression (la règle RLS existante l'autorise).
   - Fichiers : `server/api/account/hide-items.post.ts`, `composables/useBuyerSpace.ts`, `components/ConfirmDeleteModal.vue`, pages `mon-espace/*`.
2. **Écran de démarrage** : le logo Tikeo s'affiche plein écran (≈1,5 s) avant la page d'accueil, une fois par visite.
   Fichiers : `components/SplashScreen.vue`, `app.vue`.
3. **Visite guidée mobile** : elle présente maintenant aussi les boutons de la **barre du bas** (Accueil, Explorer, Scanner, Profil,
   Paramètres), en plus de ceux du haut. Étapes ajoutées par la migration 0038, modifiables dans `/admin/introduction`.
   Sur ordinateur ces étapes sont ignorées. Pour la revoir sur un appareil déjà passé : vider la clé `tikeo:tour-done:v1` du stockage local.
   Fichiers : `components/MobileBottomNav.vue`, `types/database.ts`, `pages/admin/introduction/index.vue`, `i18n/locales/*.json`.

---

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

1. **Paiement en ligne (fournisseur réel : CinetPay, Wave, Orange Money…)** (§19-26) — les
   commandes restent créées en `pending` et retiennent leur stock 15 min. La suite du parcours
   (commande payée → billets → email) existe désormais (voir § 7 ci-dessous) mais est déclenchée
   **manuellement par un admin** faute de fournisseur de paiement branché : quand un vrai
   fournisseur sera intégré, son webhook n'aura qu'à appeler la fonction SQL
   `confirm_order_payment()` (migration `0019`) au lieu du bouton admin.
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
`manifest.webmanifest`), `CHANGEMENTS.md`, `server/api/orders/[id]/confirm-payment.post.ts`,
`supabase/migrations/0019_confirm_order_payment.sql`.

**Modifiés** — `app.vue`, `nuxt.config.ts`, `assets/css/main.css`, `types/database.ts`, `.env.example`,
`README.md`, `DOMAINE-VERCEL.md`, `i18n/locales/{fr,en,es,pt}.json`, `composables/useAuth.ts`,
`useEventDetail.ts`, `useMediaUpload.ts`, `server/utils/adminAuth.ts` (réutilise `requireUser`),
`server/utils/brevo.ts` (nouveau template `ticketsEmailTemplate`),
`pages/e/[slug].vue`, `pages/index.vue`, `pages/evenements/index.vue`, `pages/recherche/index.vue`,
`pages/inscription`, `pages/connexion`, `pages/mot-de-passe-oublie`, `components/AppHeader.vue`,
`AppFooter.vue`, `EventCard.vue`, `HeroSection.vue`, `public/logo-tikeo.png`, `favicon.png`, `sample-event.jpg`,
`pages/admin/evenements/index.vue`, `pages/admin/utilisateurs/index.vue`, `pages/admin/billets/index.vue`,
`pages/admin/paiements/index.vue`, `pages/admin/commandes/index.vue`, `pages/admin/demandes/index.vue`.

Aucune nouvelle dépendance npm : pas de `npm install` supplémentaire.

---

## 7. Session « responsive admin + billets par email »

### Responsive (panneau admin, mobile / petit écran)

Les pages du panneau **admin** utilisaient de simples `<table>` HTML sans adaptation mobile :
sur petit écran, les colonnes (STATUT, ACTIONS…) étaient coupées et invisibles, sans moyen de
défiler pour les voir. Le panneau **organisateur** n'était pas concerné (il utilise déjà des
cartes empilées responsives) — aucun changement n'y a été nécessaire là.

Corrigé en reprenant le même principe que le panneau organisateur : cartes empilées sous `md`,
tableau classique à partir de `md` (assez de place pour toutes les colonnes) :
- `pages/admin/evenements/index.vue`
- `pages/admin/utilisateurs/index.vue`
- `pages/admin/billets/index.vue`
- `pages/admin/paiements/index.vue`
- `pages/admin/commandes/index.vue`
- `pages/admin/demandes/index.vue` (tableaux de comparaison avant/après : passés en défilement
  horizontal contenu, moins critique car déjà utilisés dans une carte plus étroite)

### Billets envoyés par email après paiement

Constat : le paiement en ligne n'est **pas encore branché** (voir point 1 de la section
« À faire ensuite » et les commentaires dans `composables/useEventDetail.ts`) : une commande
reste `pending` et aucun billet n'était jamais généré ni envoyé. Ce n'était pas un bug de la
version précédente, la chaîne « paiement → billets → email » n'existait simplement pas encore.

Ajouté, sans toucher à la logique de commande existante (`create_order`, réservation de stock,
expiration à 15 min) :
- `supabase/migrations/0019_confirm_order_payment.sql` — fonction SQL atomique
  `confirm_order_payment(order_id, provider, transaction_reference)` : vérifie que la commande
  est bien `pending`, enregistre un paiement `success`, passe la commande à `paid`, génère un
  billet par unité achetée (statut `valid`, numéro unique `TIK-AAAA-NNNNNN`), et renvoie tout ce
  qu'il faut pour l'email (acheteur, événement, liste des billets).
- `server/api/orders/[id]/confirm-payment.post.ts` — route serveur (réservée aux admins, clé
  `service_role`) qui appelle cette fonction puis envoie l'email de confirmation. L'échec de
  l'email n'annule jamais le paiement ni les billets (déjà enregistrés en base).
- `server/utils/brevo.ts` — nouveau template `ticketsEmailTemplate()` (liste des numéros de
  billets, événement, date, montant).
- `pages/admin/commandes/index.vue` — bouton **« Marquer payée »** sur chaque commande
  `pending` : déclenche la confirmation, la génération des billets et l'envoi de l'email.
  Dès qu'un vrai fournisseur de paiement sera branché, son webhook pourra appeler directement
  `confirm_order_payment()` et ce bouton deviendra inutile (mais restera disponible pour les
  cas de paiement reçu hors ligne, ex. virement).
- `i18n/locales/{fr,en,es,pt}.json` — nouvelles clés `adminOrders.confirmPayment`,
  `confirming`, `confirmedNotice`, `errorConfirm`, `colActions`.

**À faire avant d'utiliser cette fonctionnalité** : appliquer la migration `0019` dans Supabase
(SQL Editor ou `supabase db push`) — sans elle, le bouton « Marquer payée » échouera.

---

## 8. Session « 11 fonctionnalités » (codes promo, liste d'attente, transfert de
billet, avis, Apple/Google Wallet, rappels par notification, billets hors
connexion, carte du lieu, journal d'activité, double authentification,
graphiques admin)

Toute la logique sensible (calcul de remise, verrouillage de stock, génération
du QR code à l'acceptation d'un transfert, etc.) vit en base dans des fonctions
SQL `security definer`, testées de bout en bout sur une instance Postgres
locale avant d'écrire la moindre ligne de front (voir le détail de chaque
fonction dans les migrations citées). Le projet compile et `npm run build`
termine sans erreur avec ces ajouts.

### Codes promo
- `supabase/migrations/0030_promo_codes.sql` — tables `promo_codes` /
  `promo_redemptions`, fonctions `apply_promo_to_order()` /
  `remove_promo_from_order()` (recalcul du total en base, jamais côté client).
- `server/api/orders/[id]/promo.{post,delete}.ts`, `composables/usePromoCode.ts`
  (application acheteur + CRUD organisateur), `pages/organisateur/codes-promo/index.vue`.

### Liste d'attente
- `supabase/migrations/0031_waitlist.sql` — table `waitlist_entries`,
  `create_order()` et `release_expired_orders()` mis à jour pour réserver/rendre
  les places ; `process_waitlist()` réveille automatiquement la file dès qu'un
  billet se libère (expiration de commande ou augmentation de quantité par
  l'organisateur). `0036_waitlist_public_count.sql` ajoute un compteur public.
- `server/api/waitlist/join.post.ts`, `composables/useWaitlist.ts`,
  `pages/mon-espace/liste-attente/index.vue`, bouton sur `pages/e/[slug].vue`.

### Transfert de billet
- `supabase/migrations/0032_ticket_transfers.sql` — invitation par email,
  `qr_token` régénéré à l'acceptation (l'ancien QR, même capturé, ne fonctionne
  plus), plafond de 3 transferts par billet, organisateur peut désactiver le
  transfert par événement (`allow_ticket_transfers`).
- `server/api/tickets/[id]/transfer.post.ts`, `server/api/transfers/**`,
  `composables/useTicketTransfers.ts`, `pages/transfert/[token].vue`.

### Avis
- `supabase/migrations/0033_event_reviews.sql` — seul un détenteur de billet
  d'un événement **terminé** peut noter ; réponse organisateur et modération
  admin dans des fonctions dédiées, jamais par écriture directe de la note.
- `composables/useEventReviews.ts`, section « Avis » sur `pages/e/[slug].vue`,
  `pages/admin/avis/index.vue`.

### Apple / Google Wallet
- `server/utils/googleWallet.ts` — lien « Enregistrer » signé (JWT RS256) avec
  la classe et l'objet du billet embarqués, sans appel API préalable.
- `server/utils/appleWallet.ts` — génère un vrai `.pkpass` (manifeste SHA-1 +
  signature PKCS#7 avec `node-forge`). **Nécessite les certificats Apple
  Developer et le compte de service Google Wallet pour fonctionner** (voir
  `.env.example`) ; sans eux, les boutons renvoient une erreur propre et
  peuvent être masqués.
- `server/api/tickets/[id]/wallet/{google,apple}.get.ts`, boutons dans
  `pages/mon-espace/mes-billets/index.vue`.

### Rappels par notification (email + push) & billets hors connexion
- `supabase/migrations/0029_notifications_delivery_and_reminders.sql` —
  `notifications` devient une vraie file de livraison (`email_pending`,
  `push_pending`) ; `generate_event_reminders()` crée un rappel 24h puis 3h
  avant chaque événement ; `claim_pending_notifications()` (verrou
  `skip locked`) évite les envois en double entre deux exécutions.
- `server/api/cron/tick.post.ts` — tâche planifiée unique (rappels,
  expiration liste d'attente/transferts, envoi email + push), protégée par
  `CRON_SECRET` : **à brancher sur un déclencheur planifié externe**
  (Vercel Cron ou équivalent), rien ne se déclenche seul sinon.
- `server/utils/webPush.ts`, `composables/usePushNotifications.ts`, section
  dans `pages/mon-espace/parametres/index.vue`.
- Hors connexion : `composables/useBuyerSpace.ts` met en cache localStorage la
  dernière liste de billets chargée avec succès (bannière si on retombe
  dessus) ; `public/sw.js` garde une « coquille » de l'app pour que l'espace
  acheteur se recharge même sans réseau (le QR code est déjà généré localement
  depuis `qr_token`, sans appel réseau).

### Carte du lieu
- `supabase/migrations/0034_*.sql` — colonnes `latitude`/`longitude`,
  verrouillées après publication comme les autres champs de localisation.
- `components/VenueMap.vue` (affichage, OpenStreetMap/Leaflet, sans clé API),
  `components/VenueMapPicker.vue` (recherche d'adresse + pointage, formulaires
  organisateur `nouveau.vue`/`modifier.vue`).

### Double authentification
- S'appuie entièrement sur `supabase.auth.mfa.*` (natif, aucun secret stocké
  par Tikeo) ; `supabase/migrations/0034_*.sql` ajoute `profiles.mfa_required`
  et fait en sorte que `is_admin()` refuse le rôle si la 2FA est exigée mais
  qu'aucun facteur n'est vérifié (garantie réelle, pas un simple texte).
- `composables/useTwoFactor.ts`, section dans `pages/mon-espace/parametres`,
  étape de vérification ajoutée à `pages/connexion/index.vue`.

### Journal d'activité
- `supabase/migrations/0034_*.sql` — nouvelle permission `audit.view`,
  policy de lecture dédiée sur `audit_logs` (jusqu'ici chacun ne voyait que
  ses propres lignes, inutilisable comme journal d'administration).
- `pages/admin/journal/index.vue`, lien dans `layouts/admin.vue`.

### Graphiques admin
- `supabase/migrations/0035_admin_analytics.sql` — fonctions `security
  invoker` (la RLS s'applique normalement) pour les séries temporelles
  revenus/inscriptions et le top événements.
- `components/AdminLineChart.vue` / `AdminBarChart.vue` (SVG pur, sans
  dépendance de rendu), intégrés à `pages/admin/index.vue`.

### Dépendances ajoutées
`leaflet` (+ `@types/leaflet`), `node-forge` (+ `@types/node-forge`), `jszip`,
`web-push` (+ `@types/web-push`) — **un `npm install` est nécessaire**.

### Variables d'environnement à renseigner (`.env.example`)
`CRON_SECRET`, `NUXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` /
`VAPID_SUBJECT`, `GOOGLE_WALLET_ISSUER_ID` / `GOOGLE_WALLET_SERVICE_ACCOUNT_JSON`,
`APPLE_WALLET_TEAM_ID` / `APPLE_WALLET_PASS_TYPE_ID` / `APPLE_WALLET_CERT_BASE64` /
`APPLE_WALLET_KEY_BASE64` / `APPLE_WALLET_KEY_PASSPHRASE` / `APPLE_WALLET_WWDR_BASE64`.
Toutes facultatives : sans elles, les fonctionnalités correspondantes se
désactivent proprement (bouton masqué ou erreur explicite) sans rien casser
d'autre.

### À appliquer avant utilisation
1. `npm install` (nouvelles dépendances).
2. Appliquer les migrations `0029` à `0036` dans Supabase.
3. Renseigner les variables d'environnement souhaitées ci-dessus.
4. Brancher un déclencheur planifié externe sur `POST /api/cron/tick`.

---

## 9. Réconciliation avec les migrations ajoutées manuellement dans Supabase
(codes promo, journal d'audit, liste d'attente)

Pendant la session précédente, des migrations ont été écrites et appliquées
directement dans Supabase, en parallèle : `0029_promo_codes.sql`,
`0030_audit_log_viewer.sql`, `0031_waitlist.sql`. Elles ont un schéma
différent de celui proposé initialement par Claude pour les mêmes
fonctionnalités, ce qui provoquait des erreurs (`column "organizer_id" does
not exist`) en essayant d'appliquer les migrations suivantes par-dessus.

### Ce qui a changé par rapport à la session précédente

- **Numérotation** : les migrations 0001 à 0031 sont désormais **exactement**
  celles déjà présentes dans votre projet Supabase (vérifiées fichier par
  fichier, identiques 0001-0028, et 0029-0031 = vos ajouts). Les
  fonctionnalités suivantes ont été renumérotées pour s'enchaîner à la suite :
  `0032_notifications_delivery_and_reminders.sql`,
  `0033_reconcile_waitlist_and_promo.sql`,
  `0034_ticket_transfers.sql`, `0035_event_reviews.sql`,
  `0036_venue_coordinates_2fa_and_audit_log_writer.sql`,
  `0037_admin_analytics.sql`.
  **Vous n'avez donc à exécuter que les migrations `0032` à `0037`** (les
  0001-0031 sont déjà chez vous).

- **Codes promo** : conservés tels que vous les avez créés (0029) — un code
  est rattaché à **un seul événement** (`event_id`, colonnes `starts_at`/
  `ends_at`/`max_uses_per_buyer`/statut `active`/`inactive`), appliqué
  directement à `create_order()` via un 4ᵉ paramètre `p_promo_code`, et
  prévisualisable sans l'appliquer via `validate_promo_code()`. L'interface
  (page organisateur, champ sur la page événement) a été entièrement réécrite
  pour coller à ce schéma — **le code promo n'est plus une portée
  "organisateur, tous événements" comme proposé initialement, mais un code
  par événement**, conformément à ce qui était déjà en place.

- **Bug corrigé, indépendant de tout ajout** : `create_order()` existait déjà
  en DEUX versions dans votre base (3 paramètres depuis la migration 0026, 4
  paramètres depuis votre 0029). Un appel avec les 3 paramètres historiques —
  ce que faisait `server/api/orders.post.ts` jusqu'ici — résout TOUJOURS vers
  la version à 3 paramètres, qui ignore totalement les codes promo. **Un code
  promo n'a donc jamais pu réellement s'appliquer**, même avant toute
  intervention de Claude. La migration `0033_reconcile_waitlist_and_promo.sql`
  supprime les deux anciennes versions et n'en recrée qu'une seule (4
  paramètres, le 4ᵉ par défaut `null`) ; `server/api/orders.post.ts` a été mis
  à jour pour toujours le préciser explicitement.

- **Liste d'attente** : votre version (0031) est une simple capture d'email
  avec notification manuelle par l'organisateur. Pour obtenir une file
  d'attente automatique (réservation temporaire de 24h dès qu'une place se
  libère, conversion automatique en commande), un modèle de données différent
  est nécessaire. La migration `0033_reconcile_waitlist_and_promo.sql`
  **remplace votre table `waitlist_entries`** par la version complète.
  ⚠️ **Toute inscription déjà présente dans votre table actuelle sera
  perdue.** Vérifiez avant d'exécuter la migration :
  ```sql
  select count(*) from waitlist_entries;
  ```
  Si ce nombre n'est pas 0 et que ces données comptent, dites-le avant
  d'exécuter `0033` : on écrira une étape de conversion au lieu d'un
  remplacement.

- **Journal d'audit** : votre migration 0030 couvrait déjà exactement le
  besoin (permission `audit.view`, policy de lecture globale) — rien n'a été
  dupliqué, seule une fonction d'écriture (`log_admin_action`) a été ajoutée
  pour les routes serveur.

### Comment appliquer la suite chez vous

1. Dans l'éditeur SQL Supabase, exécutez **dans l'ordre** les fichiers
   `0032_notifications_delivery_and_reminders.sql` →
   `0037_admin_analytics.sql` (ne touchez pas aux fichiers 0001-0031, déjà en
   place).
2. `npm install` (nouvelles dépendances : `leaflet`, `node-forge`, `jszip`,
   `web-push`).
3. Variables d'environnement facultatives : voir `.env.example` (section 8).


---

## Réservation mobile + paiement direct (octobre 2026)

- **Page événement (mobile)** : une barre fixe monte du bas de l'écran dès qu'on clique sur « + »
  (nombre de billets, montant total, bouton « Réserver », code promo repliable) et disparaît à 0 billet.
- **Paiement** : plus de page Jèko (saisie du numéro) ni de retour sur Jèko — voir `JEKO.md` §4.
  Wave/Orange/Djamo : direct vers l'application ; MTN/Moov : demande de code sur le téléphone + attente dans Tikeo.
- **Webhook** : retrouve aussi la commande à partir d'une référence d'une tentative précédente
  (cas d'un nouvel essai alors qu'une demande USSD était encore en attente).

# Header : compteurs en direct (favoris + notifications)

- Le cœur du header affiche le nombre de favoris, la cloche le nombre de notifications non lues (pastille orange, animation à chaque changement, « 99+ » au-delà). Visible aussi sur mobile (cœur ajouté) et dans le menu compte / tiroir.
- Tout se met à jour sans actualiser : clic sur un cœur = compteur immédiat ; nouvelle notification = pastille + petit toast ; lecture / suppression = compteur mis à jour. Synchronisé entre onglets et appareils.
- Technique : `composables/useMyNotifications.ts` (nouveau, sorti de `useBuyerSpace.ts`) et `composables/useFavorites.ts` partagent un état global et s'abonnent à Supabase Realtime ; filet de sécurité par relecture silencieuse (30 s / 60 s, retour sur l'onglet, retour du réseau). Démarrage global dans `app.vue`.
- **À faire une fois** : exécuter `supabase/migrations/0044_realtime_live_updates.sql` dans Supabase > SQL Editor (active le temps réel sur `notifications` et `favorites`). Sans cela, le rafraîchissement automatique fonctionne quand même via la relecture périodique.

# Admin & Organisateur : menu latéral masquable (grands écrans)

- Un bouton dans la barre du haut (à gauche, écrans ≥ md) masque / affiche le menu latéral ; le contenu prend alors toute la largeur (animation de 300 ms). Raccourci : Ctrl + B (⌘ + B sur Mac).
- Le logo Tikeo apparaît dans la barre du haut quand le menu est masqué. Le choix est mémorisé (cookie, séparément pour l'admin et l'organisateur). Sur mobile rien ne change (tiroir hamburger).
- Fichiers : `composables/useSidebarCollapse.ts` (nouveau), `layouts/admin.vue`, `layouts/organisateur.vue`, clés `hideSidebar` / `showSidebar` dans les 4 langues.

# Admin & Organisateur : en-tête et barre du bas mobiles refaits

- En-tête : filet de marque orange → bleu, bouton menu plein (encre / orange en sombre), logo + pastille de rôle (dès 430 px), **thème = un seul bouton carré** dont l'icône pivote soleil ↔ lune (plus de curseur), langue et déconnexion en boutons carrés de 40 px alignés. Même rendu sur desktop.
- Barre du bas : nouveau composant `components/DashBottomNav.vue` (barre flottante comme le site public, élément actif orangé avec filet, pastilles de compteur, bouton central « Créer » en dégradé de marque pour l'organisateur). L'admin en reçoit une aussi : 3 accès rapides selon ses permissions (Tableau de bord, Messages, Événements…) + « Menu » qui ouvre le tiroir.
- `ThemeToggle` et `LanguageSwitcher` : nouvelle option `boxed` (le site public n'est pas modifié). Clé `adminNav.menu` ajoutée (4 langues).

# Vidéo de présentation + bouton WhatsApp flottant

- Bouton « Voir la vidéo » (play orange pulsant) dans le hero de l'accueil et dans la barre du haut (desktop) : ouvre une fenêtre de lecture (`components/PresentationVideoModal.vue`, Échap / clic extérieur / ✕ pour fermer, lecture stoppée à la fermeture). Si la vidéo est introuvable, un message propre s'affiche.
- Source de la vidéo (sans toucher au code) : `NUXT_PUBLIC_PRESENTATION_VIDEO_URL` = lien YouTube, Vimeo ou .mp4 ; par défaut le fichier `public/videos/presentation.mp4` (voir `public/videos/LISEZ-MOI.txt`). Aperçu facultatif : `NUXT_PUBLIC_PRESENTATION_VIDEO_POSTER`.
- Bouton WhatsApp vert flottant en bas à droite (`components/WhatsAppFloat.vue`), au-dessus de la barre du bas sur mobile, bulle « Rejoindre la communauté WhatsApp » au survol sur desktop. Lien : `NUXT_PUBLIC_WHATSAPP_COMMUNITY_URL` (vide = bouton masqué).
- CSP (production) : `frame-src` autorise YouTube (nocookie) et Vimeo, `media-src` autorise https:. Bannière cookies décalée à gauche du bouton WhatsApp sur desktop.
- Variables ajoutées à `.env.example` et `nuxt.config.ts` ; textes dans les 4 langues.

# Ajustements : chaîne WhatsApp + vidéo gérée depuis /admin/accueil

- Le bouton WhatsApp pointe vers la **chaîne** officielle (https://whatsapp.com/channel/0029Vb8vVkw2kNFnqt0cAx0c), intégrée par défaut dans `nuxt.config.ts` (il s'affiche donc sans aucune variable). Libellé : « Suivre notre chaîne WhatsApp » (4 langues). Surcharge possible : `NUXT_PUBLIC_WHATSAPP_CHANNEL_URL`.
- La vidéo de présentation se gère dans **/admin/accueil** (section « Vidéo de présentation » : lien YouTube, Vimeo ou .mp4, validé https). Priorité : lien admin > variable d'environnement > /videos/presentation.mp4.
- **À faire une fois** : exécuter `supabase/migrations/0045_presentation_video.sql` (ajoute la colonne `presentation_video_url`). Sans elle, le reste de la page admin continue de fonctionner.
