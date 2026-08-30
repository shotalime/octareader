FROM node:24.11.1-bookworm

ARG PLAYWRIGHT_VERSION=1.62.1

ENV NPM_CONFIG_UPDATE_NOTIFIER=false \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

RUN npx --yes "playwright@${PLAYWRIGHT_VERSION}" install --with-deps chromium webkit \
    && chmod -R a+rX /ms-playwright \
    && rm -rf /var/lib/apt/lists/*

USER node
