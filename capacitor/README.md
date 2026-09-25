# Capacitor — étape mobile (à venir)

Ce dossier accueillera la configuration Capacitor une fois la version Web
validée, conformément au cahier des charges (section 5 et 51).

Étapes prévues :
1. `npm install @capacitor/core @capacitor/cli`
2. `npx cap init tikeo com.tikeo.app`
3. `nuxt generate` (export statique) puis pointer `webDir` vers `.output/public`
4. `npx cap add android` / `npx cap add ios`

Aucune ligne de code Capacitor n'est encore générée : l'app Web (Nuxt) reste
la source unique de vérité, partagée ensuite avec le mobile.
