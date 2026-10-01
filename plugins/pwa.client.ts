/**
 * Enregistre le service worker (public/sw.js) en production uniquement :
 * en développement, un service worker en cache casserait le rechargement à
 * chaud et rendrait les tests trompeurs.
 * Capte aussi l'invitation d'installation du navigateur pour la proposer
 * via components/InstallAppPrompt.vue.
 */
export default defineNuxtPlugin(() => {
  const installEvent = useState<any>('tikeo-pwa-install-event', () => null)
  const installed = useState<boolean>('tikeo-pwa-installed', () => false)

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault() // on présente notre propre bouton, au bon moment
    installEvent.value = e
  })
  window.addEventListener('appinstalled', () => {
    installed.value = true
    installEvent.value = null
  })

  if (import.meta.dev || !('serviceWorker' in navigator)) return
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((err) => console.warn('[pwa] service worker non enregistré :', err))
  })
})
