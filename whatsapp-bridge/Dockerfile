# syntax=docker/dockerfile:1.6
#
# Safarmate WhatsApp bridge — single-stage image with Debian Chromium
# pre-installed so puppeteer doesn't have to download its own copy.

FROM node:20-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive \
    NODE_ENV=production \
    PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    HOST=0.0.0.0 \
    PORT=5555 \
    WHATSAPP_SESSION_DIR=/data/wwebjs_auth

# Chromium and the X/font libs it needs at runtime, plus dumb-init so
# Ctrl-C / Fly stop signals reach the Node process cleanly.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      chromium \
      dumb-init \
      ca-certificates \
      fonts-liberation \
      fonts-noto \
      fonts-noto-color-emoji \
      libnss3 \
      libatk1.0-0 \
      libatk-bridge2.0-0 \
      libcups2 \
      libdrm2 \
      libxkbcommon0 \
      libxcomposite1 \
      libxdamage1 \
      libxfixes3 \
      libxrandr2 \
      libgbm1 \
      libpango-1.0-0 \
      libcairo2 \
      libasound2 \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install ALL deps (including devDeps like typescript / @types) so we can
# run `tsc`. We set NODE_ENV=production above, which makes npm skip devDeps
# by default — --include=dev overrides that just for this step. After the
# build we `npm prune --omit=dev` to strip them back out of the final image.
COPY package.json package-lock.json* ./
RUN npm install --include=dev --no-audit --no-fund

COPY tsconfig.json ./
COPY src ./src

RUN npx tsc -p tsconfig.json \
 && npm prune --omit=dev \
 && rm -rf /root/.npm /root/.cache

# Pre-create the volume mount point so puppeteer can write to it
# before the volume actually gets mounted (e.g. first boot).
RUN mkdir -p /data/wwebjs_auth

# Drop privileges. Chromium refuses to run as root without --no-sandbox,
# which we already pass anyway, but running as a non-root user is still
# the right default for a long-lived daemon.
RUN groupadd --system --gid 1001 bridge \
 && useradd  --system --uid 1001 --gid 1001 --create-home --shell /usr/sbin/nologin bridge \
 && chown -R bridge:bridge /app /data
USER bridge

EXPOSE 5555

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]
