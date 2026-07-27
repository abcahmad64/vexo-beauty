FROM docker.arvancloud.ir/node:24-bookworm-slim AS dependencies

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci


FROM docker.arvancloud.ir/node:24-bookworm-slim AS builder

WORKDIR /app

ARG APP_ENV=production
ARG NEXT_PUBLIC_SITE_URL=https://vexobeauty.ir
ARG INTERNAL_API_BASE_URL=http://backend:4000/api
ARG NEXT_PUBLIC_API_BASE_URL=https://vexobeauty.ir/backend-api
ARG NEXT_PUBLIC_MEDIA_BASE_URL=https://vexobeauty.ir/uploads

ENV NODE_ENV=production \
    APP_ENV=$APP_ENV \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    INTERNAL_API_BASE_URL=$INTERNAL_API_BASE_URL \
    NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL \
    NEXT_PUBLIC_MEDIA_BASE_URL=$NEXT_PUBLIC_MEDIA_BASE_URL \
    NEXT_TELEMETRY_DISABLED=1

COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

RUN npm run build


FROM docker.arvancloud.ir/node:24-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    NEXT_TELEMETRY_DISABLED=1

RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
