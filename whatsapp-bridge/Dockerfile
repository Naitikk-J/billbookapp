# syntax=docker/dockerfile:1.6
#
# Safarmate WhatsApp bridge — Baileys build. No Chromium, no Puppeteer.
# Final image ~150 MB, RAM at rest ~90 MB, boots in <2 s.

FROM node:20-bookworm-slim

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=5555 \
    WHATSAPP_MONGO_COLLECTION=whatsapp_session

# Only dumb-init and CA certs — dumb-init makes SIGTERM propagate cleanly on
# `render deploy stop` and other lifecycle events; ca-certificates lets us
# talk to Mongo Atlas + WhatsApp over TLS.
RUN apt-get update \
 && apt-get install -y --no-install-recommends dumb-init ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install all deps (incl. devDeps for tsc) then prune to prod-only.
COPY package.json package-lock.json* ./
RUN npm install --include=dev --no-audit --no-fund

COPY tsconfig.json ./
COPY src ./src

RUN npx tsc -p tsconfig.json \
 && npm prune --omit=dev \
 && rm -rf /root/.npm /root/.cache

# Drop privileges.
RUN groupadd --system --gid 1001 bridge \
 && useradd  --system --uid 1001 --gid 1001 --create-home --shell /usr/sbin/nologin bridge \
 && chown -R bridge:bridge /app
USER bridge

EXPOSE 5555

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]
