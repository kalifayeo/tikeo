# Lien personnalisé des événements (himra.tikeo.com) sur Vercel

Ce document explique où en est la fonctionnalité de lien personnalisé
(cahier des charges §14-16 et §35), pourquoi elle ne peut pas encore
fonctionner en sous-domaine sur `tikeo.vercel.app`, et les étapes exactes
pour l'activer quand vous aurez un nom de domaine.

## Ce qui fonctionne déjà, aujourd'hui, sans rien configurer

Chaque événement a toujours un lien utilisable, sous la forme :

```
https://tikeo.vercel.app/e/himra
```

C'est l'« URL de secours » prévue au §16 du cahier des charges. C'est ce
lien qui est proposé automatiquement :

- lors de la création d'un événement (l'organisateur choisit/édite le
  « lien personnalisé », par ex. `himra`, avec vérification de
  disponibilité en direct) ;
- sur l'écran affiché juste après la publication, avec un bouton
  « Copier » et des boutons WhatsApp / Facebook ;
- dans la liste « Mes événements » de l'organisateur (bouton
  « Copier le lien ») ;
- sur la page publique de l'événement (boutons de partage) ;
- dans les métadonnées SEO (`og:url`, lien canonique) pour un bon rendu
  quand le lien est partagé.

Toute cette logique est centralisée dans
`composables/useEventPublicUrl.ts`.

## Pourquoi pas de vrai sous-domaine sur `tikeo.vercel.app` ?

`*.vercel.app` est un domaine **partagé entre tous les projets Vercel**.
Vercel ne permet pas à un projet de revendiquer un sous-domaine
arbitraire de `vercel.app` (ex. `himra.tikeo.vercel.app`) : ce serait un
risque de sécurité pour l'ensemble de la plateforme (n'importe qui
pourrait squatter le sous-domaine d'un autre). Il n'existe donc aucune
configuration côté Vercel qui débloquerait ça sur le domaine gratuit.

La seule vraie solution est d'utiliser **votre propre nom de domaine**
(ex. `tikeo.com`), sur lequel vous contrôlez le DNS et pouvez créer un
enregistrement « wildcard » (`*.tikeo.com`).

Le code, lui, est déjà prêt : `server/middleware/subdomain.ts` reconnaît
n'importe quel sous-domaine du domaine configuré et le réécrit en
interne vers `/e/[slug]`. Rien à recoder le jour venu.

## Étapes pour activer les sous-domaines une fois un domaine acheté

En supposant que vous achetiez `tikeo.com` (chez Namecheap, Google
Domains, un registrar ivoirien, etc.) :

1. **Ajouter le domaine dans Vercel**
   - Dashboard Vercel → votre projet → *Settings* → *Domains*.
   - Ajoutez `tikeo.com` **et** `*.tikeo.com` (le wildcard). Vercel vous
     donnera les enregistrements DNS à créer.

2. **Configurer le DNS chez votre registrar**
   - Un enregistrement `A` (ou `ALIAS`/`ANAME`) pour `tikeo.com` pointant
     vers l'IP fournie par Vercel (souvent `76.76.21.21`).
   - Un enregistrement `CNAME` pour `*.tikeo.com` pointant vers
     `cname.vercel-dns.com`.
   - Vercel gère automatiquement le certificat SSL (Let's Encrypt), y
     compris pour le wildcard, une fois le DNS propagé (§52).

3. **Configurer la variable d'environnement**
   - Dans Vercel → *Settings* → *Environment Variables*, ajoutez :
     ```
     NUXT_PUBLIC_ROOT_DOMAIN=tikeo.com
     ```
   - Redéployez. C'est cette variable que lit à la fois
     `server/middleware/subdomain.ts` (pour reconnaître les
     sous-domaines) et `useEventPublicUrl.ts` (pour générer les liens).

4. **Vérifier**
   - `https://tikeo.com` doit afficher le site normalement.
   - `https://himra.tikeo.com` (avec un événement existant de slug
     `himra`) doit afficher directement la page de l'événement.
   - Depuis ce moment, tous les nouveaux liens copiés/partagés dans
     l'app utiliseront automatiquement la forme `himra.tikeo.com` — sans
     aucune autre modification de code.

## Tester en local avant d'avoir le vrai domaine

Pas besoin de DNS réel pour tester le mécanisme de sous-domaine en
développement :

```bash
# Terminal 1
npm run dev

# Terminal 2 — simule une requête sur himra.localhost
curl -H "Host: himra.localhost:3000" http://localhost:3000/
```

Ou ajoutez une ligne dans `/etc/hosts` :
```
127.0.0.1 himra.localhost
```
puis ouvrez `http://himra.localhost:3000` dans le navigateur.

## Sous-domaines réservés

`www`, `app`, `admin`, `api`, `dev`, `staging` ne sont jamais traités
comme des slugs d'événement (voir `RESERVED_SUBDOMAINS` dans
`server/middleware/subdomain.ts`) — ils continueront de servir
l'application normale, conformément au §51 du cahier des charges.
