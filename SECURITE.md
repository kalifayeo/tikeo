# Sécurité — mise en place

## 1. Clés et secrets
- Le fichier `.env` n'est **jamais** livré avec le projet ni commité (`.gitignore`). Créez-le à partir de `.env.example`.
- En production, les variables se saisissent dans Vercel > Settings > Environment Variables.
- Si une clé a été partagée (zip, capture, message), **régénérez-la** : Supabase (`service_role`), Brevo, Jeko (clé API + secret webhook).

## 2. Activer l'anti-robot Cloudflare Turnstile
Le code est déjà branché (inscription, connexion, mot de passe oublié, contact, liste d'attente). Il suffit de fournir les clés :
1. Cloudflare > **Turnstile** > *Add widget*. Domaines : `tikeo.com` (et vos sous-domaines si besoin). Mode : *Managed*.
2. Copiez la **Site key** dans `NUXT_PUBLIC_TURNSTILE_SITE_KEY` et la **Secret key** dans `TURNSTILE_SECRET_KEY` (Vercel), puis redéployez.
3. Supabase > Authentication > **Attack Protection** > *Enable CAPTCHA protection* > fournisseur **Turnstile** > collez la **Secret key**.
   (Sans cette étape, connexion et inscription ne sont pas vérifiées côté Supabase.)
4. Au démarrage, le serveur affiche un avertissement `[sécurité]` tant que les clés manquent.

## 3. Content-Security-Policy (production)
- Définie dans `nuxt.config.ts` (constante `CSP`), active uniquement en production.
- Si un écran ne s'affiche plus après déploiement, mettez `NUXT_CSP_REPORT_ONLY=true` : plus rien n'est bloqué, la console du navigateur liste les violations. Ajoutez alors l'hôte manquant dans `CSP`.
- Nouveau service externe (script, API, iframe, polices) = à ajouter dans la CSP.

## 4. HSTS
`max-age=31536000; includeSubDomains` : tout le domaine et ses sous-domaines doivent rester en HTTPS.

## 5. Mesures ajoutées lors de l'audit pré-lancement (migration 0043 et code)
- **E-mails** : tout texte saisi par un utilisateur est échappé (`server/utils/escapeHtml.ts`) dans tous les gabarits (billets, transfert, liste d'attente, notifications, création de compte). Les liens/images n'acceptent que http(s) ou un chemin interne.
- **Comptes suspendus/supprimés** : refusés immédiatement par le serveur (`server/utils/userAuth.ts`), sessions fermées par trigger SQL ; changement de mot de passe = autres appareils déconnectés.
- **Codes promo** : vérification via `/api/promo/validate` (20 essais / 10 min), fonction SQL réservée au serveur.
- **Droits SQL** : `has_permission_for`, `is_super_admin_for`, `validate_promo_code` réservées à `service_role` ; insertion directe dans `contact_messages` supprimée ; envoi de fichiers refusé aux comptes suspendus.
- **Webhook Jèko** : tentatives à signature invalide tracées dans Admin > Journal (`SECURITY_WEBHOOK_BAD_SIGNATURE`).
- **Journaux** : en production, le contenu des e-mails (codes, QR, liens) n'est plus jamais écrit dans les logs. `CRON_SECRET` comparé à temps constant.

## 6. À faire côté services (non faisable dans le code)
1. **Régénérer toutes les clés** si le fichier `.env` a été partagé (zip, capture, message) : Supabase `service_role`, Brevo, Jèko (clé API, identifiant, secret webhook). Mettre les nouvelles dans Vercel.
2. **Cloudflare** : domaine derrière Cloudflare (proxy orange), WAF managé activé, règle de limitation de débit sur `/api/*`, mode « Under Attack » prêt en cas d'incident, protection DDoS (incluse), Bot Fight Mode.
3. **Supabase** : Authentication > Attack Protection (CAPTCHA Turnstile, protection contre les mots de passe divulgués), durée de vie du jeton (JWT expiry) 3600 s, expiration/inactivité des sessions (offre Pro), 2FA obligatoire pour les comptes du dashboard Supabase.
4. **Sauvegardes** : Supabase Pro avec sauvegardes quotidiennes (idéalement PITR), responsable de la restauration désigné, test de restauration chaque trimestre, copie périodique du bucket `media`.
5. **GitHub** : dépôt privé, Secret scanning + Push protection, Dependabot, branche `main` protégée, 2FA obligatoire pour les contributeurs.
6. **Alertes** : suivi d'erreurs (ex. Sentry) et supervision de disponibilité ; consulter Admin > Journal (échecs de signature, changements de rôle, suspensions, confirmations de paiement).
7. **Audit externe** : test d'intrusion autorisé avant le lancement ; grille OWASP ASVS.

## 7. Checklist finale
- [ ] Migration 0043 appliquée et `audit_rls.sql` conforme
- [ ] Toutes les clés régénérées et placées dans Vercel
- [ ] Turnstile actif (site + Supabase)
- [ ] Jèko : webhook configuré, signature testée
- [ ] Cloudflare WAF / limitation de débit actifs et testés
- [ ] Sauvegardes activées, restauration testée
- [ ] Tous les tests de `GUIDE-TESTS-SECURITE.md` passés
- [ ] `npm audit --omit=dev` sans faille high/critical
