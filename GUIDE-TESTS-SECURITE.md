# Guide de tests de sécurité — Tikeo (pas à pas)

Faites ces tests avec des **comptes de test** (jamais de vrais clients, jamais de vrais paiements).
Comptes à préparer : **A** (acheteur), **B** (autre acheteur), **ORG** (organisateur d'un événement de test gratuit), **ADMIN**, **C** (compte à suspendre).
Utilisez un navigateur (ou une fenêtre privée) par compte.

## Préparation commune (une seule fois par navigateur)
1. Connectez-vous au site avec le compte voulu, puis appuyez sur **F12** et ouvrez l'onglet **Console**.
2. Si le navigateur refuse le collage, tapez `allow pasting` puis Entrée.
3. Collez ce bloc (il récupère votre jeton de session et un jeton CSRF) :
```js
const k = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
const SESSION = JSON.parse(localStorage[k]);
const TOKEN = SESSION.access_token, ME = SESSION.user.id;
const CSRF = (await (await fetch('/api/csrf-token')).json()).token;
const H = { 'Content-Type': 'application/json', 'x-csrf-token': CSRF, Authorization: 'Bearer ' + TOKEN };
console.log('connecté en tant que', ME);
```
4. Pour les tests Supabase, ajoutez (valeurs dans Supabase > Project Settings > API : « Project URL » et clé « anon public ») :
```js
const SUPA = 'https://VOTRE-PROJET.supabase.co', ANON = 'VOTRE_CLE_ANON';
```
5. **Avant le test 2 et le test 4 : appliquer la migration** `supabase/migrations/0043_security_hardening.sql` (Supabase > SQL Editor > coller > Run), puis lancer `supabase/security/audit_rls.sql` requête par requête.

---

## Test 1 — Paiement falsifié
**But :** personne ne peut déclencher un faux paiement.

**1a. Webhook sans signature valide** (console du site, n'importe quel compte) :
```js
for (const sig of [undefined, 'abc']) {
  const r = await fetch('/api/payments/jeko/webhook', { method: 'POST', headers: sig ? { 'Jeko-Signature': sig } : {}, body: '{}' });
  console.log('signature =', sig, '→ statut', r.status);
}
```
**Attendu :** `401` les deux fois. Puis Admin > **Journal** > filtre action `SECURITY_WEBHOOK_BAD_SIGNATURE` : 2 lignes récentes.

**1b. Page de retour truquée**
1. Compte A : choisir un billet payant d'un événement de test, aller jusqu'à la page de paiement **sans payer** (la commande est créée « En attente »). Notez l'identifiant dans l'URL `/commande/<id>`.
2. Ouvrir à la main `SITE/commande/<id>/retour` puis `SITE/commande/<id>/retour?status=success`.

**Attendu :** la page n'affiche jamais « Paiement réussi » ; elle reste « en attente » / « n'a pas abouti ». Dans **Mes billets** aucun billet n'apparaît, et dans Admin > Commandes la commande reste **En attente**.
**Échec si :** un billet apparaît ou la commande passe à « Payée ».

---

## Test 2 — Droits Supabase
**But :** la base refuse tout ce qu'un visiteur ou un acheteur n'a pas le droit de faire.

**2a. Fonctions réservées au serveur** (console, avec `SUPA` et `ANON` définis) :
```js
const Z = '00000000-0000-0000-0000-000000000000';
const rpc = (fn, body) => fetch(`${SUPA}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { apikey: ANON, Authorization: 'Bearer ' + ANON, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(async r => console.log(fn, r.status, (await r.text()).slice(0, 120)));
await rpc('confirm_order_payment', { p_order_id: Z, p_provider: 'x', p_transaction_reference: 'x' });
await rpc('create_order', { p_user_id: Z, p_event_id: Z, p_items: [] });
await rpc('validate_promo_code', { p_event_id: Z, p_code: 'TEST' });
await rpc('has_permission_for', { p_user_id: Z, p_permission_key: 'x' });
```
**Attendu :** chaque ligne affiche `401` ou `403` avec « permission denied for function … ».
**Échec si :** statut `200`, ou un message métier (ex. `ORDER_NOT_FOUND`) : la fonction s'est exécutée.

**2b. Un acheteur ne voit que ses données** (console du compte A) :
```js
const get = p => fetch(`${SUPA}/rest/v1/${p}`, { headers: { apikey: ANON, Authorization: 'Bearer ' + TOKEN } }).then(r => r.json());
for (const t of ['orders', 'tickets']) { const rows = await get(`${t}?select=id,user_id`); console.log(t, rows.length, 'lignes — toutes à moi :', rows.every(r => r.user_id === ME)); }
```
**Attendu :** `toutes à moi : true` pour `orders` et `tickets` (compte A qui a déjà un achat de test).

**2c. Impossible de se donner le rôle admin** (compte A) :
```js
const r = await fetch(`${SUPA}/rest/v1/profiles?user_id=eq.${ME}`, { method: 'PATCH', headers: { apikey: ANON, Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify({ role: 'admin' }) });
console.log(r.status, await r.text());
console.log('rôle actuel :', (await get(`profiles?select=role&user_id=eq.${ME}`))[0].role);
```
**Attendu :** erreur (statut 4xx) et `rôle actuel : buyer`. **Échec si** le rôle devient `admin` (supprimez alors ce compte de test et prévenez-moi).

**2d. Modifier la commande de quelqu'un d'autre** (compte A, avec l'id d'une commande de B copié depuis Admin > Commandes) :
```js
const r2 = await fetch(`${SUPA}/rest/v1/orders?id=eq.ID_COMMANDE_DE_B`, { method: 'PATCH', headers: { apikey: ANON, Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify({ status: 'paid' }) });
console.log(r2.status, await r2.text());
```
**Attendu :** `[]` ou une erreur ; la commande de B reste inchangée.

**2e. Messages de contact** :
```js
const r3 = await fetch(`${SUPA}/rest/v1/contact_messages`, { method: 'POST', headers: { apikey: ANON, Authorization: 'Bearer ' + ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ full_name: 'x', email: 'x@x.com', subject: 'x', message: 'x' }) });
console.log(r3.status, await r3.text());
```
**Attendu :** `401`/`403` (« row-level security »). Le formulaire **/contact** du site doit continuer à fonctionner.

---

## Test 3 — Double scan simultané
**But :** un billet ne peut entrer qu'une seule fois, même si deux agents scannent en même temps.

1. Compte A : prendre **1 billet gratuit** de l'événement de test (propriétaire = ORG). Dans la console de A, récupérer le code : `(await get('tickets?select=id,qr_token,event_id,status&order=created_at.desc&limit=1'))[0]` (avec la fonction `get` du test 2b). Notez `qr_token` et `event_id`.
2. Dans la console du compte **ORG** (préparation commune faite), lancer 10 scans à la fois :
```js
const EVENT_ID = 'event_id_noté', CODE = 'qr_token_noté';
const body = JSON.stringify({ eventId: EVENT_ID, code: CODE });
const res = await Promise.all(Array.from({ length: 10 }, () => fetch('/api/scan/validate', { method: 'POST', headers: H, body }).then(r => r.json())));
console.log(res.map(r => r.result));
console.log('valid :', res.filter(r => r.result === 'valid').length);
```
**Attendu :** `valid : 1` et neuf `already_used`.
**Échec si** `valid` ≥ 2.
3. Variantes : rescanner le même billet → `already_used` ; scanner avec le compte A (simple acheteur) → statut `403`.
(Pour recommencer, utilisez un nouveau billet : celui-ci est maintenant « utilisé ».)

---

## Test 4 — Compte suspendu
**But :** un compte suspendu perd tout accès immédiatement, même avec un jeton encore valide.

1. Navigateur 2 : connecté en **C**, faire la préparation commune (garder la console ouverte : `TOKEN` et `H` sont en mémoire).
2. Navigateur ADMIN : Admin > **Utilisateurs** > compte C > **Suspendre** > confirmer.
3. Navigateur 2, console de C (sans recharger la page) :
```js
const r = await fetch('/api/tickets/00000000-0000-0000-0000-000000000000/transfer', { method: 'POST', headers: H, body: JSON.stringify({ toEmail: 'x@x.com' }) });
console.log(r.status, await r.text());
```
**Attendu :** `403` avec `ACCOUNT_LOCKED`.
**Échec si** autre chose que 403 (ex. 404 `TICKET_NOT_FOUND` = le compte suspendu a encore accès).
4. Recharger la page de C : il doit être déconnecté et voir le message de compte suspendu.
5. Réactiver C (Admin > Utilisateurs > Réactiver) et vérifier qu'il peut se reconnecter.
6. **Bonus mot de passe :** connectez-vous avec le même compte sur 2 navigateurs, changez le mot de passe dans l'un ; l'autre doit être déconnecté (au plus tard à son prochain rafraîchissement de session).

---

## Test 5 — Injection dans les e-mails
**But :** un texte contenant du HTML s'affiche en texte brut dans l'e-mail.

1. Compte A (avec un billet valide d'un événement qui autorise les transferts) : **Profil** → nom complet = `<b>GRAS</b> <a href="https://example.com">cliquez ici</a>` → Enregistrer.
2. **Mes billets** → Transférer le billet vers l'adresse e-mail réelle du compte B, message : `<h1>TEST</h1>`.
3. Ouvrir l'e-mail reçu par B.

**Attendu :** on lit littéralement `<b>GRAS</b> <a href=…>` et `<h1>TEST</h1>` dans l'e-mail, sans texte en gras, sans gros titre, sans lien cliquable « cliquez ici ».
**Échec si** le texte est mis en forme ou le lien est cliquable.
4. Remettre un vrai nom dans le profil de A.
(Limite : 10 transferts par heure. Un transfert ne marche pas si l'événement a commencé ou si l'organisateur l'a désactivé.)

---

## Test 6 — Limite d'essais des codes promo
**But :** impossible de deviner des codes promo à la chaîne.

1. Compte A connecté, console (préparation commune). Prendre l'id d'un événement (dans l'adresse de la page ou Admin > Événements).
2. Lancer :
```js
const EVENT_ID = 'id_de_l_evenement';
for (let i = 1; i <= 25; i++) {
  const r = await fetch('/api/promo/validate', { method: 'POST', headers: H, body: JSON.stringify({ eventId: EVENT_ID, code: 'TEST' + i }) });
  console.log(i, r.status);
}
```
**Attendu :** statut `200` de 1 à 20, puis `429` à partir du 21e. Attendre 10 minutes avant de refaire ce test.
3. **Non-régression :** compte ORG > Codes promo > créer le code `BIENVENUE10` sur l'événement ; compte A > page de l'événement > saisir `BIENVENUE10` : la réduction s'affiche. Un faux code affiche « code invalide ».

---

## Test 7 — Contrôles généraux
1. **Dépendances** — dans un terminal ouvert dans le dossier du projet : `npm install` puis `npm audit --omit=dev`. **Attendu :** aucune faille « high » ou « critical » (corriger avec `npm audit fix`, sans `--force` sans me demander).
2. **En-têtes de sécurité** — sur le site **en ligne** (pas en local), aller sur https://securityheaders.com, saisir l'adresse du site, **Scan**. **Attendu :** note A ou supérieure (la politique actuelle garde `unsafe-inline`, nécessaire à Nuxt ; une note A- est normale). Refaire sur https://observatory.mozilla.org.
3. **Secrets dans le code** — le plus simple : GitHub > dépôt > Settings > Code security > activer **Secret scanning** et **Push protection** (gratuit sur les dépôts publics, inclus sur les dépôts privés avec les offres adaptées). Ou en local avec Docker : `docker run --rm -v "%cd%:/repo" zricethezav/gitleaks:latest detect --source /repo -v`. **Attendu :** aucune fuite trouvée. Toute clé trouvée doit être régénérée.
4. **Clés visibles dans le navigateur** — F12 > Réseau : rechargez la page et cherchez (Ctrl+F dans les réponses) `service_role`, `xkeysib`, `JEKO`, `CRON_SECRET`. **Attendu :** aucun résultat (seules les variables `NUXT_PUBLIC_*` sont publiques).
5. **Audit SQL** — `supabase/security/audit_rls.sql` : chaque requête doit donner le résultat attendu écrit en commentaire.

## Réussite
Tous les tests ci-dessus donnent l'« Attendu », l'audit SQL est conforme, et la checklist de `SECURITE.md` section 7 est cochée.
