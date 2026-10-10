export interface TikeoCountry {
  code: string
  name: string
  flag: string
}

// Pays prioritaires pour Tikeo (marché ivoirien et africain — cahier des
// charges §1 et §61 "déploiement dans plusieurs pays africains").
export const TIKEO_COUNTRIES: TikeoCountry[] = [
  { code: 'CI', name: "Côte d'Ivoire", flag: '🇨🇮' },
  { code: 'SN', name: 'Sénégal', flag: '🇸🇳' },
  { code: 'GH', name: 'Ghana', flag: '🇬🇭' },
  { code: 'NG', name: 'Nigeria', flag: '🇳🇬' },
  { code: 'CM', name: 'Cameroun', flag: '🇨🇲' },
  { code: 'ML', name: 'Mali', flag: '🇲🇱' },
  { code: 'BJ', name: 'Bénin', flag: '🇧🇯' },
  { code: 'TG', name: 'Togo', flag: '🇹🇬' },
]

/**
 * Pays sélectionné pour parcourir les événements (persistant en cookie).
 * Utilisé par le sélecteur de localisation de la barre supérieure et,
 * plus tard, comme filtre par défaut sur /evenements et /recherche.
 */
export function useCountry() {
  const countryCode = useCookie<string>('tikeo_country', { default: () => 'CI' })

  const country = computed<TikeoCountry>(
    () => TIKEO_COUNTRIES.find((c) => c.code === countryCode.value) ?? TIKEO_COUNTRIES[0]
  )

  function setCountry(code: string) {
    countryCode.value = code
  }

  return { country, countryCode, countries: TIKEO_COUNTRIES, setCountry }
}
