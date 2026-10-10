// Types générés à partir du schéma Supabase (voir supabase/migrations/0001_init.sql)
// À remplacer plus tard par `supabase gen types typescript` une fois le projet lié.

export type EventStatus = 'draft' | 'published' | 'paused' | 'sold_out' | 'completed' | 'cancelled'
export type TicketStatus = 'pending' | 'valid' | 'used' | 'cancelled' | 'refunded' | 'expired'
export type OrderStatus = 'pending' | 'paid' | 'failed' | 'cancelled' | 'refunded'
export type PaymentStatus = 'pending' | 'processing' | 'success' | 'failed' | 'cancelled' | 'refunded'
export type UserRole = 'visitor' | 'buyer' | 'organizer' | 'agent' | 'admin'
export type ProfileStatus = 'active' | 'suspended'

// RBAC administrateurs (supabase/migrations/0021_admin_rbac_and_suspension_fix.sql)
export type PermissionKey =
  | 'users.view' | 'users.create' | 'users.update' | 'users.suspend' | 'users.reactivate' | 'users.delete' | 'users.manage_roles'
  | 'organizers.view' | 'organizers.approve' | 'organizers.suspend'
  | 'events.view' | 'events.validate' | 'events.update' | 'events.delete'
  | 'tickets.view' | 'tickets.manage'
  | 'orders.view'
  | 'payments.view' | 'payments.refund' | 'payments.confirm'
  | 'support.view' | 'support.manage'
  | 'moderation.manage'
  | 'marketing.manage' | 'onboarding.manage' | 'popups.manage' | 'partners.manage'
  | 'admin.manage_admins' | 'admin.manage_permissions'
  | 'settings.manage'
  | 'audit.view'

export interface AdminRole {
  id: string
  key: string
  name: string
  description: string | null
  is_system: boolean
  created_at: string
  updated_at: string
}

export interface Permission {
  id: string
  key: PermissionKey
  category: string
  description: string
}

export interface AdminContext {
  isAdmin: boolean
  isSuperAdmin: boolean
  roles: Array<{ key: string; name: string }>
  permissions: PermissionKey[]
}

export interface AppUser {
  id: string
  email: string
}

export interface Profile {
  id: string
  user_id: string
  full_name: string
  phone: string | null
  email: string
  avatar_url: string | null
  role: UserRole
  status: string
  notify_email: boolean
  notify_sms: boolean
  notify_promotions: boolean
  /** Exige un facteur de double authentification vérifié pour se connecter (migration 0034). */
  mfa_required: boolean
  created_at: string
  updated_at: string
}

export interface Organizer {
  id: string
  user_id: string
  name: string
  slug: string
  logo_url: string | null
  description: string | null
  phone: string | null
  email: string | null
  status: string
  /** Ancien forfait (migration 0024) : conservé en base, plus utilisé depuis la migration 0047. */
  plan?: OrganizerPlan
  /** Taux négocié (offre sur mesure), prioritaire sur les paliers (migration 0047). */
  custom_commission_rate?: number | null
  /** Date du dernier changement de formule (migration 0046). */
  plan_changed_at?: string | null
  created_at: string
  updated_at: string
}

export type OrganizerPlan = 'decouverte' | 'essentiel' | 'pro' | 'business'

export interface EventRecord {
  id: string
  organizer_id: string
  title: string
  slug: string
  description: string | null
  cover_image: string | null
  category_id: string | null
  start_date: string
  end_date: string | null
  location_name: string | null
  address: string | null
  city: string | null
  country: string | null
  seating_plan_url: string | null
  status: EventStatus
  visibility: 'public' | 'private'
  /** Nombre maximum de billets qu'un même acheteur peut prendre pour cet événement (NULL = illimité). */
  max_tickets_per_buyer: number | null
  /** Coordonnées facultatives, pour la carte du lieu (composants VenueMap*). */
  latitude: number | null
  longitude: number | null
  /** L'organisateur peut désactiver le transfert de billet pour cet événement (migration 0032). */
  allow_ticket_transfers: boolean
  created_at: string
  updated_at: string
}

export interface TicketType {
  id: string
  event_id: string
  name: string
  description: string | null
  price: number
  quantity: number
  sold_quantity: number
  sale_start: string | null
  sale_end: string | null
  status: string
  created_at: string
  updated_at: string
}

export interface Category {
  id: string
  name: string
  slug: string
  icon: string | null
  status: string
  position: number
}

export interface Order {
  id: string
  user_id: string
  event_id: string
  order_number: string
  subtotal: number
  fees: number
  /** Montant de la remise appliquée par le code promo, le cas échéant (migration 0029). */
  discount: number
  total: number
  currency: string
  status: OrderStatus
  /** Code promo saisi par l'acheteur à la création de la commande (migration 0029), ou null. */
  promo_code: string | null
  promo_code_id: string | null
  /** Taux (%) et montant de la commission Tikeo figés à la création de la commande (migration 0046). */
  commission_rate?: number
  commission_amount?: number
  /** Qui a payé la commission sur cette commande : 'organizer' (déduite) ou 'buyer' (frais de service). */
  commission_payer?: 'organizer' | 'buyer'
  /** Fin de la réservation de stock d'une commande « pending » (migration 0017). */
  expires_at?: string | null
  /** Masquée par l'acheteur de son historique (migration 0038). Jamais supprimée en base. */
  hidden_by_user_at?: string | null
  created_at: string
  updated_at: string
}

export interface OrderItem {
  id: string
  order_id: string
  ticket_type_id: string
  quantity: number
  unit_price: number
  total: number
}

export interface Payment {
  id: string
  order_id: string
  provider: string
  transaction_reference: string | null
  amount: number
  currency: string
  status: PaymentStatus
  metadata: Record<string, unknown>
  paid_at: string | null
  created_at: string
  updated_at: string
}

export interface Ticket {
  id: string
  order_id: string
  event_id: string
  ticket_type_id: string
  user_id: string
  ticket_number: string
  qr_token: string
  status: TicketStatus
  used_at: string | null
  used_by: string | null
  /** Nombre de fois où ce billet a changé de propriétaire (migration 0032, plafond 3). */
  transferred_count: number
  /** Masqué par l'acheteur de son historique (migration 0038). Reste valide pour l'organisateur. */
  hidden_by_user_at?: string | null
  created_at: string
}

// --- Transfert de billet (migration 0032) -----------------------------------
export type TicketTransferStatus = 'pending' | 'accepted' | 'declined' | 'cancelled' | 'expired'

export interface TicketTransfer {
  id: string
  ticket_id: string
  from_user_id: string
  to_email: string
  to_user_id: string | null
  token: string
  message: string | null
  status: TicketTransferStatus
  expires_at: string
  responded_at: string | null
  created_at: string
}

// --- Codes promo (migration 0030) -------------------------------------------
export type PromoDiscountType = 'percent' | 'fixed'

/**
 * Code promo (migration 0029) : toujours rattaché à UN événement précis
 * (pas de portée "tous mes événements" côté base ; pour couvrir plusieurs
 * événements d'un organisateur, créer un code par événement).
 */
export interface PromoCode {
  id: string
  event_id: string
  code: string
  discount_type: PromoDiscountType
  discount_value: number
  max_uses: number | null
  used_count: number
  max_uses_per_buyer: number
  starts_at: string | null
  ends_at: string | null
  status: 'active' | 'inactive'
  created_at: string
  updated_at: string
  event?: Pick<EventRecord, 'id' | 'title'> | null
}

// --- Liste d'attente (migration 0031) ---------------------------------------
export type WaitlistStatus = 'waiting' | 'notified' | 'converted' | 'expired' | 'cancelled'

export interface WaitlistEntry {
  id: string
  event_id: string
  ticket_type_id: string
  user_id: string
  quantity: number
  status: WaitlistStatus
  notified_at: string | null
  hold_expires_at: string | null
  created_at: string
  updated_at: string
  ticket_type?: Pick<TicketType, 'id' | 'name' | 'price'> | null
  event?: Pick<EventRecord, 'id' | 'title' | 'slug' | 'cover_image' | 'start_date'> | null
}

// --- Avis (migration 0033) ---------------------------------------------------
export interface EventReview {
  id: string
  event_id: string
  user_id: string
  order_id: string | null
  rating: number
  comment: string | null
  organizer_reply: string | null
  organizer_replied_at: string | null
  status: 'visible' | 'hidden'
  hidden_reason: string | null
  created_at: string
  updated_at: string
  author?: Pick<Profile, 'full_name' | 'avatar_url'> | null
  event?: Pick<EventRecord, 'id' | 'title' | 'slug'> | null
}

export interface EventReviewStats {
  event_id: string
  review_count: number
  average_rating: number | null
}

export interface Notification {
  id: string
  user_id: string
  title: string
  message: string
  type: string
  read_at: string | null
  created_at: string
}

export type EventEditRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'

// Champs d'un événement pouvant faire l'objet d'une demande de modification
// (cf. supabase/migrations/0009_event_edit_requests.sql — la table events
// verrouille ces colonnes par trigger dès que l'événement n'est plus en
// brouillon).
export interface EditableEventFields {
  title: string
  description: string | null
  cover_image: string | null
  seating_plan_url: string | null
  category_id: string | null
  start_date: string
  end_date: string | null
  location_name: string | null
  address: string | null
  city: string | null
  country: string | null
  max_tickets_per_buyer: number | null
  latitude: number | null
  longitude: number | null
  allow_ticket_transfers: boolean
  /** Qui paie la commission Tikeo : l'organisateur (déduite) ou l'acheteur (frais de service) — migration 0047. */
  fees_payer?: 'organizer' | 'buyer'
}

export interface EditableTicketTypeFields {
  id: string
  name: string
  description: string | null
  price: number
  quantity: number
  sale_start: string | null
  sale_end: string | null
}

export interface EventEditRequestChanges {
  event?: Partial<EditableEventFields>
  ticket_types?: EditableTicketTypeFields[]
}

export interface EventEditRequest {
  id: string
  event_id: string
  organizer_id: string
  requested_by: string
  status: EventEditRequestStatus
  previous_snapshot: EventEditRequestChanges
  changes: EventEditRequestChanges
  organizer_note: string | null
  admin_note: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
  // Jointures optionnelles utilisées par les pages admin
  event?: Pick<EventRecord, 'id' | 'title' | 'slug' | 'status'>
  organizer?: Pick<Organizer, 'id' | 'name' | 'slug'>
}

// Interface minimale utilisée côté front pour l'affichage des cartes événement
export interface EventCardData {
  id: string
  slug: string
  title: string
  city: string
  country?: string
  startDate: string
  /** Date de fin (optionnelle) : sert à retirer l'événement des listes une fois passé */
  endDate?: string | null
  coverImage: string
  priceFrom: number
  category?: string
  /** Organisateur vérifié (badge coché sur la miniature, comme Tikerama) */
  verified?: boolean
  /** Nombre de personnes ayant mis l'événement en favori */
  favoritesCount?: number
  organizerName?: string
  organizerAvatar?: string | null
}

// Détail complet d'un événement (page publique /e/[slug]) : au-delà des
// champs affichés sur les cartes (EventCardData), on a besoin de la
// description, du lieu précis, des billets disponibles et des infos
// organisateur pour construire une page produit complète.
export interface TicketTypeOption {
  id: string
  name: string
  description: string | null
  price: number
  remaining: number | null
  soldOut: boolean
}

export interface EventDetailData {
  id: string
  slug: string
  title: string
  description: string | null
  city: string
  country?: string
  locationName?: string | null
  address?: string | null
  startDate: string
  endDate?: string | null
  coverImage: string
  category?: string
  /** URL de l'image/PDF du plan de salle, si renseignée par l'organisateur */
  seatingPlanUrl?: string | null
  organizerId: string
  organizerName?: string
  organizerLogo?: string | null
  organizerDescription?: string | null
  verified?: boolean
  /** Limite de billets par acheteur pour cet événement, tous types confondus (null = illimité). */
  maxTicketsPerBuyer?: number | null
  latitude?: number | null
  longitude?: number | null
  allowTicketTransfers?: boolean
  reviewCount?: number
  averageRating?: number | null
  ticketTypes: TicketTypeOption[]
}

export interface Favorite {
  id: string
  user_id: string
  event_id: string
  created_at: string
}

// Vue "acheteur" d'une commande : la commande brute + le strict nécessaire
// de l'événement et des lignes pour l'affichage dans mon-espace/mes-commandes.
export interface OrderWithDetails extends Order {
  event?: Pick<EventRecord, 'id' | 'title' | 'slug' | 'cover_image' | 'start_date' | 'city'> | null
  items?: (OrderItem & { ticket_type?: Pick<TicketType, 'id' | 'name'> | null })[]
}

// Vue "acheteur" d'un billet : le ticket brut + l'événement et le type de
// billet nécessaires pour l'affichage dans mon-espace/mes-billets.
export interface TicketWithDetails extends Ticket {
  event?: Pick<EventRecord, 'id' | 'title' | 'slug' | 'cover_image' | 'start_date' | 'city' | 'location_name'> | null
  ticket_type?: Pick<TicketType, 'id' | 'name' | 'price'> | null
  order?: Pick<Order, 'order_number'> | null
}

// Messages envoyés depuis le formulaire public /contact (voir
// supabase/migrations/0011_contact_messages.sql). Personne côté client ne
// peut les relire : seul l'admin y a accès (RLS).
export interface ContactMessage {
  id: string
  full_name: string
  email: string
  subject: string
  message: string
  status: 'new' | 'read' | 'archived'
  // 'account_deletion' : demande de suppression de compte, posée uniquement
  // par server/api/account/request-deletion.post.ts (jamais par le client
  // directement) — voir migration 0022.
  request_type: 'contact' | 'account_deletion'
  user_id: string | null
  // Réponse envoyée depuis /admin/messages (migration 0042).
  admin_reply?: string | null
  replied_at?: string | null
  replied_by?: string | null
  created_at: string
}

// Avis d'un visiteur sur la plateforme (migration 0042, page publique /avis).
export type SiteFeedbackCategory = 'praise' | 'idea' | 'bug' | 'other'
export interface SiteFeedback {
  id: string
  user_id: string | null
  display_name: string
  email: string | null
  rating: number
  category: SiteFeedbackCategory
  message: string
  allow_public: boolean
  status: 'new' | 'read' | 'archived'
  is_public: boolean
  admin_reply: string | null
  replied_at: string | null
  created_at: string
}
export type SiteFeedbackPublic = Pick<SiteFeedback, 'id' | 'display_name' | 'rating' | 'category' | 'message' | 'admin_reply' | 'replied_at' | 'created_at'>
export interface SiteFeedbackStats { total: number; average: number; c1: number; c2: number; c3: number; c4: number; c5: number }

// Vue "admin" d'un billet : le ticket brut + l'événement, le type de billet
// et la commande nécessaires pour l'affichage dans /admin/billets.
export interface TicketWithAdminDetails extends Ticket {
  event?: Pick<EventRecord, 'id' | 'title' | 'city'> | null
  ticket_type?: Pick<TicketType, 'id' | 'name' | 'price'> | null
  order?: Pick<Order, 'id' | 'order_number'> | null
}

// Vue "admin" d'une commande : la commande brute + l'événement pour
// l'affichage dans /admin/commandes.
export interface OrderWithAdminDetails extends Order {
  event?: Pick<EventRecord, 'id' | 'title' | 'city'> | null
}

// Vue "admin" d'un paiement : le paiement brut + la commande (et son
// événement) pour l'affichage dans /admin/paiements.
export interface PaymentWithAdminDetails extends Payment {
  order?: (Pick<Order, 'id' | 'order_number' | 'user_id'> & {
    event?: Pick<EventRecord, 'id' | 'title'> | null
  }) | null
}

// Une image/gif qui défile dans la bannière d'accueil : `zone` détermine
// où elle apparaît (grande bannière centrale ou colonne latérale gauche/
// droite), `position` détermine son ordre dans le défilement de sa zone.
export interface HomeSlide {
  id: string
  zone: 'center' | 'left' | 'right'
  media_url: string
  media_type: 'image' | 'gif'
  position: number
  status: 'active' | 'inactive'
  created_at: string
}

// Texte affiché par-dessus la grande bannière centrale (ligne unique, id = 1).
export interface HomeHeroContent {
  id: number
  title: string | null
  subtitle: string | null
  cta_label: string | null
  cta_url: string | null
  /** Lien de la vidéo de présentation (YouTube, Vimeo ou .mp4) — migration 0045. */
  presentation_video_url?: string | null
  updated_at: string
}

export interface Database {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Partial<Profile>; Update: Partial<Profile> }
      organizers: { Row: Organizer; Insert: Partial<Organizer>; Update: Partial<Organizer> }
      events: { Row: EventRecord; Insert: Partial<EventRecord>; Update: Partial<EventRecord> }
      ticket_types: { Row: TicketType; Insert: Partial<TicketType>; Update: Partial<TicketType> }
      categories: { Row: Category; Insert: Partial<Category>; Update: Partial<Category> }
      orders: { Row: Order; Insert: Partial<Order>; Update: Partial<Order> }
      order_items: { Row: OrderItem; Insert: Partial<OrderItem>; Update: Partial<OrderItem> }
      payments: { Row: Payment; Insert: Partial<Payment>; Update: Partial<Payment> }
      tickets: { Row: Ticket; Insert: Partial<Ticket>; Update: Partial<Ticket> }
      favorites: { Row: Favorite; Insert: Partial<Favorite>; Update: Partial<Favorite> }
      notifications: { Row: Notification; Insert: Partial<Notification>; Update: Partial<Notification> }
      contact_messages: { Row: ContactMessage; Insert: Partial<ContactMessage>; Update: Partial<ContactMessage> }
      home_slides: { Row: HomeSlide; Insert: Partial<HomeSlide>; Update: Partial<HomeSlide> }
      home_hero_content: { Row: HomeHeroContent; Insert: Partial<HomeHeroContent>; Update: Partial<HomeHeroContent> }
      promo_codes: { Row: PromoCode; Insert: Partial<PromoCode>; Update: Partial<PromoCode> }
      waitlist_entries: { Row: WaitlistEntry; Insert: Partial<WaitlistEntry>; Update: Partial<WaitlistEntry> }
      ticket_transfers: { Row: TicketTransfer; Insert: Partial<TicketTransfer>; Update: Partial<TicketTransfer> }
      event_reviews: { Row: EventReview; Insert: Partial<EventReview>; Update: Partial<EventReview> }
    }
    // Fonctions SQL appelées uniquement depuis les routes serveur (service_role).
    Functions: {
      create_order: {
        Args: { p_user_id: string; p_event_id: string; p_items: Array<{ ticket_type_id: string; quantity: number }> }
        Returns: {
          id: string
          order_number: string
          subtotal: number
          fees: number
          total: number
          currency: string
          status: OrderStatus
          expires_at: string
        }
      }
      release_expired_orders: { Args: Record<string, never>; Returns: number }
    }
  }
}

// --- Introduction, visite guidée et pop-ups (migration 0027) ---------------
export type EngagementStatus = 'active' | 'inactive'

export interface OnboardingSlide {
  id: string
  title: string
  description: string | null
  image_url: string | null
  /** Nom d'une icône du dictionnaire AppIcon (migration 0041). */
  icon: string | null
  /** @deprecated Remplacé par `icon` : on n'utilise plus d'emoji. */
  emoji?: string | null
  position: number
  status: EngagementStatus
  created_at: string
  updated_at: string
}

export type TourTarget =
  | 'search' | 'publish' | 'pricing' | 'community' | 'notifications' | 'favorites' | 'account' | 'theme' | 'language'
  // Barre de navigation du bas (mobile uniquement) — migration 0038
  | 'nav-home' | 'nav-explore' | 'nav-scanner' | 'nav-profile' | 'nav-settings'

export interface TourStep {
  id: string
  target: TourTarget
  title: string
  description: string | null
  position: number
  status: EngagementStatus
  created_at: string
  updated_at: string
}

export interface Popup {
  id: string
  title: string
  message: string | null
  image_url: string | null
  cta_label: string | null
  cta_url: string | null
  frequency: 'once' | 'session' | 'always'
  audience: 'all' | 'visitors' | 'members'
  starts_at: string | null
  ends_at: string | null
  revision: number
  status: EngagementStatus
  created_at: string
  updated_at: string
}

// Partenaires (supabase/migrations/0048_partners.sql)
export type PartnerCategory = 'sponsor' | 'payment' | 'media' | 'venue' | 'tech' | 'institution' | 'other'

export interface Partner {
  id: string
  name: string
  description: string | null
  logo_url: string | null
  website_url: string | null
  category: PartnerCategory
  is_featured: boolean
  position: number
  status: 'active' | 'inactive'
  created_at: string
  updated_at: string
}
