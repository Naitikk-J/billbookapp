# syntax=docker/dockerfile:1.6
#
# Safarmate WhatsApp bridge — Baileys build. No Chromium, no Puppeteer.
# Final image ~150 MB, RAM at rest ~90 MB, boots in <2 s.

FROM node:20-bookworm-slim

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=5555 \
    WHATSAPP_MONGO_COLLECTION=whatsapp_session

# dumb-init  → clean SIGTERM propagation on Render deploy/stop lifecycles.
# ca-certificates → TLS to Mongo Atlas + WhatsApp.
# git → one of Baileys' transitive deps (libsignal-node) is a git+ssh tarball,
#       not an npm package, so npm shells out to git during install.
# We also rewrite the ssh:// URL to https:// so anonymous cloning works
# without needing an SSH key inside the container.
RUN apt-get update \
 && apt-get install -y --no-install-recommends dumb-init ca-certificates git \
 && rm -rf /var/lib/apt/lists/* \
 && git config --global url."https://github.com/".insteadOf "ssh://git@github.com/" \
 && git config --global url."https://github.com/".insteadOf "git@github.com:"

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
