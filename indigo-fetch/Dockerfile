FROM mcr.microsoft.com/playwright:v1.64.1-jammy

USER root
RUN apt-get update && apt-get install -y --no-install-recommends xvfb xfonts-base xauth \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN npm ci --omit=dev
COPY src ./src

ENV NODE_ENV=production
ENV PORT=10000
EXPOSE 10000

CMD ["sh", "-c", "echo indigo-fetch boot; nohup Xvfb :99 -screen 0 1280x900x24 -ac +extension GLX +render -noreset >/tmp/xvfb.log 2>&1 & i=0; while [ ! -S /tmp/.X11-unix/X99 ] && [ \"$i\" -lt 20 ]; do i=$((i+1)); sleep 0.25; done; if [ ! -S /tmp/.X11-unix/X99 ]; then echo xvfb-failed; cat /tmp/xvfb.log; else echo xvfb-ready; fi; export DISPLAY=:99; exec node src/server.mjs"]
