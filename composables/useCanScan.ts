/**
 * Le scanner de billets n'est utilisable que par les comptes admin et
 * organisateur (même règle que le middleware `organizer`, qui protège la
 * page elle-même). Les autres comptes gardent l'icône mais sont envoyés
 * vers /scanner, qui leur explique quand le scan devient disponible.
 */
export function useCanScan() {
  const { role } = useAuth()
  return computed(() => ['admin', 'organizer'].includes(role.value))
}
