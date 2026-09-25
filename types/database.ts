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
  | 'marketing.manage'
  | 'admin.manage_admins' | 'admin.manage_permissions'
  | 'settings.manage'

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
  created_at: string
  updated_at: string
}

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
  total: number
  currency: string
  status: OrderStatus
  /** Fin de la réservation de stock d'une commande « pending » (migration 0017). */
  expires_at?: string | null
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
  created_at: string
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
  created_at: string
}

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
