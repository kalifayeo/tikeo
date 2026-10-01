-- ============================================================
-- TIKEO — Paiement réel via CinetPay (agrégateur Wave / Orange Money /
-- MTN MoMo / Moov Money / Djamo / carte bancaire, Côte d'Ivoire)
-- ============================================================
-- CONTEXTE : jusqu'ici, confirm_order_payment() (migration 0019) n'était
-- appelée que manuellement par un admin. On branche maintenant un vrai
-- fournisseur : CinetPay redirige l'acheteur vers une page de paiement
-- hébergée, puis notifie notre serveur (notify_url = webhook) une fois le
-- paiement traité.
--
-- PROBLÈME À RÉSOUDRE : le webhook CinetPay ne reçoit qu'un identifiant de
-- transaction (cpm_trans_id) — il faut pouvoir retrouver la commande Tikeo
-- correspondante, sans jamais faire confiance à des données envoyées par le
-- navigateur ou dans le corps du webhook (cahier des charges §64).
--
-- SOLUTION : une colonne sur `orders` qui mémorise l'identifiant de la
-- tentative de paiement en cours. Générée par le serveur au moment de
-- l'initialisation du paiement (jamais par le client), unique, un seul
-- identifiant "vivant" par commande (une nouvelle tentative écrase la
-- précédente si l'acheteur relance un paiement après échec).
-- ============================================================

alter table orders add column if not exists pending_transaction_ref text;

create unique index if not exists orders_pending_transaction_ref_idx
  on orders (pending_transaction_ref)
  where pending_transaction_ref is not null;

comment on column orders.pending_transaction_ref is
  'Identifiant de transaction envoyé au fournisseur de paiement (CinetPay) pour la tentative de paiement en cours. Sert à retrouver la commande depuis le webhook de notification.';
