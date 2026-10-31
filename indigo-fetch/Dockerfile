FROM mcr.microsoft.com/playwright:v1.64.1-jammy

USER root
RUN apt-get update && apt-get install -y --no-install-recommends xvfb \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN npm ci --omit=dev
COPY src ./src

ENV NODE_ENV=production
ENV PORT=10000
EXPOSE 10000

CMD ["sh", "-c", "echo indigo-fetch boot; Xvfb :99 -screen 0 1280x900x24 -ac +extension GLX +render -noreset >/tmp/xvfb.log 2>&1 & export DISPLAY=:99; exec node src/server.mjs"]
