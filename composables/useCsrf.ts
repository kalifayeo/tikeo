/**
 * Jeton CSRF (voir ~/server/utils/csrf.ts) : récupéré une fois par session
 * de navigation et réutilisé pour tous les appels aux routes serveur qui
 * modifient des données (création d'utilisateur admin, etc.).
 *
 * Utilisation avant un $fetch qui écrit des données :
 *   const { csrfHeader } = useCsrf()
 *   await $fetch('/api/admin/users', { method: 'POST', headers: { ...(await csrfHeader()) }, body })
 */
export function useCsrf() {
  const token = useState<string | null>('tikeo-csrf-token', () => null)

  async function ensureToken() {
    if (!token.value) {
      const res = await $fetch<{ token: string }>('/api/csrf-token')
      token.value = res.token
    }
    return token.value as string
  }

  async function csrfHeader(): Promise<Record<string, string>> {
    const value = await ensureToken()
    return { 'x-csrf-token': value }
  }

  return { ensureToken, csrfHeader }
}
