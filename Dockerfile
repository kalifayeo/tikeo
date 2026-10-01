# =============================================================================
#  Tikeo — image de production (Nuxt 3 / Nitro)
#
#  Build multi-étapes : on compile dans une image « lourde » (avec tout npm),
#  puis on ne recopie que le résultat (.output) dans une image finale minimale.
#  Résultat : ~150 Mo au lieu de ~1,2 Go, et aucun code source en production.
#
#  Construire :  docker build -t tikeo .
#  Lancer     :  docker run --rm -p 3000:3000 --env-file .env tikeo
# =============================================================================

# ---------- Étape 1 : dépendances ----------
FROM node:20-alpine AS deps
WORKDIR /app
# On copie d'abord SEULEMENT les manifestes : tant qu'ils ne changent pas,
# Docker réutilise le cache et saute le npm ci (gain de plusieurs minutes).
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# ---------- Étape 2 : build ----------
FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Les variables NUXT_PUBLIC_* sont inlinées au build ; les clés serveur
# (SUPABASE_SERVICE_ROLE_KEY, CINETPAY_*) sont lues au runtime, donc jamais
# intégrées à l'image.
ARG NUXT_PUBLIC_SUPABASE_URL
ARG NUXT_PUBLIC_SUPABASE_ANON_KEY
ARG NUXT_PUBLIC_ROOT_DOMAIN
ENV NODE_ENV=production
RUN npm run build

# ---------- Étape 3 : image finale ----------
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NITRO_PORT=3000 \
    NITRO_HOST=0.0.0.0

# Ne jamais tourner en root : si le conteneur est compromis, l'attaquant
# n'est qu'un utilisateur sans privilèges.
RUN addgroup -S tikeo && adduser -S tikeo -G tikeo
COPY --from=build --chown=tikeo:tikeo /app/.output ./.output
USER tikeo

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", ".output/server/index.mjs"]
