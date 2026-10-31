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

CMD ["xvfb-run", "-a", "--server-args=-screen 0 1280x900x24", "node", "src/server.mjs"]
