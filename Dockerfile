# Supply verified immutable official-image digests at release build time.
ARG NODE_IMAGE
FROM ${NODE_IMAGE} AS build
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY src ./src
COPY deployment/build.mjs ./deployment/build.mjs
RUN node deployment/build.mjs

FROM ${NODE_IMAGE} AS runtime
ARG RELEASE_COMMIT
LABEL org.opencontainers.image.revision=${RELEASE_COMMIT}
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /build/dist-staging/server.cjs ./server.cjs
COPY --from=build --chown=node:node /build/dist-staging/database.cjs ./database.cjs
COPY --chown=node:node db/migrations ./db/migrations
USER node
EXPOSE 8080
CMD ["node", "server.cjs"]
