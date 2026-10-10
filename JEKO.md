# Paiement Jèko — mise en route

CinetPay a été remplacé par **Jèko Checkout** (Wave, Orange Money, MTN MoMo, Moov Money, Djamo).

## 1. Variables d'environnement (local `.env` ET Vercel → Settings → Environment Variables)

| Variable | Où la trouver |
|---|---|
| `JEKO_API_KEY` | Clé API (affichée une seule fois à la création) |
| `JEKO_API_KEY_ID` | Identifiant de la clé — Dashboard Jèko → Paramètres → API & Webhooks |
| `JEKO_WEBHOOK_SECRET` | Secret de signature — même écran, section Webhooks |
| `JEKO_STORE_ID` | Optionnel. Vide = premier magasin du compte (`GET /partner_api/stores`) |

Après modification des variables sur Vercel : **Redeploy**.

## 2. Webhook (obligatoire)

Dashboard Jèko → Paramètres → API & Webhooks → URL du webhook :

    https://<votre-domaine>/api/payments/jeko/webhook

Sans webhook, les paiements aboutissent chez Jèko mais les billets ne sont jamais générés.

## 3. Test

Jèko n'a pas de sandbox : créez un **magasin dédié** aux tests et payez un petit montant réel.

## Fichiers modifiés

- `server/utils/jeko.ts` (nouveau) — appels API + vérification de signature
- `server/api/orders/[id]/pay.post.ts` — crée la demande de paiement Jèko
- `server/api/payments/jeko/webhook.post.ts` (nouveau) — confirmation sécurisée
- `pages/commande/[id]/index.vue`, `retour.vue`, `composables/useOrderCheckout.ts` — interface
- `nuxt.config.ts`, `.env.example`, `.env`, `Dockerfile` — configuration
- Supprimés : `server/utils/cinetpay.ts`, `server/api/payments/cinetpay/`

Aucune migration SQL à appliquer.


## 4. Paiement « API direct » (sans page Jèko)

La page de paiement hébergée par Jèko (saisie du numéro) n'est plus affichée. Tikeo envoie
`forceProviderDirect: true` + `payerPhone` (numéro du profil de l'acheteur, enregistré à l'inscription).

| Réseau | Ce que voit l'acheteur |
|---|---|
| Wave / Orange Money / Djamo | Ouverture directe de l'application de l'opérateur, puis retour sur `/commande/:id/retour` (page Tikeo) |
| MTN MoMo / Moov Money | Aucune page : demande de code (USSD) sur le téléphone + écran d'attente Tikeo ; la page se met à jour toute seule |

- Jèko confirme **en arrière-plan** par webhook (inchangé : c'est lui qui génère les billets).
- Si le profil n'a pas de numéro valide, un champ s'affiche **une seule fois** sur la page de commande
  (numéro ensuite mémorisé). Le champ « Modifier » permet de payer avec un autre numéro MTN/Moov.
- Un numéro qui ne correspond pas au réseau (MTN/Moov) est refusé par l'opérateur : message clair + nouvel essai.
- Fichiers : `server/utils/jeko.ts`, `server/utils/phone.ts`, `utils/ivorianPhone.ts`,
  `server/api/orders/[id]/pay.post.ts`, `server/api/payments/jeko/webhook.post.ts`,
  `composables/useOrderCheckout.ts`, `pages/commande/[id]/index.vue`, `pages/commande/[id]/retour.vue`.
- Aucune migration SQL. Pas de sandbox Jèko : testez avec un petit montant réel sur un magasin de test.
