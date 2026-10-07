# Supply verified immutable official-image digests at release build time.
ARG NODE_IMAGE
FROM ${NODE_IMAGE} AS build
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY src ./src
COPY deployment/build.mjs ./deployment/build.mjs
COPY deployment/d160-sync.ts ./deployment/d160-sync.ts
COPY deployment/d161-sync.ts ./deployment/d161-sync.ts
COPY deployment/d167-protected-sync.ts ./deployment/d167-protected-sync.ts
COPY deployment/sermon-durations-sync.ts ./deployment/sermon-durations-sync.ts
RUN node deployment/build.mjs

FROM ${NODE_IMAGE} AS runtime
ARG RELEASE_COMMIT
LABEL org.opencontainers.image.revision=${RELEASE_COMMIT}
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /build/dist-staging/server.cjs ./server.cjs
COPY --from=build --chown=node:node /build/dist-staging/database.cjs ./database.cjs
COPY --from=build --chown=node:node /build/dist-staging/sermonaudio-sync.cjs ./sermonaudio-sync.cjs
COPY --from=build --chown=node:node /build/dist-staging/completed-sync.cjs ./completed-sync.cjs
COPY --from=build --chown=node:node /build/dist-staging/sermonaudio-completion-sync.cjs ./sermonaudio-completion-sync.cjs
COPY --from=build --chown=node:node /build/dist-staging/sermon-durations-sync.cjs ./sermon-durations-sync.cjs
COPY --from=build --chown=node:node /build/dist-staging/related-themes-sync.cjs ./related-themes-sync.cjs
COPY --from=build --chown=node:node /build/dist-staging/draft-preview.cjs ./draft-preview.cjs
COPY --from=build --chown=node:node /build/dist-staging/d160-sync.cjs ./d160-sync.cjs
COPY --from=build --chown=node:node /build/dist-staging/d161-sync.cjs ./d161-sync.cjs
COPY --from=build --chown=node:node /build/dist-staging/d167-protected-sync.cjs ./d167-protected-sync.cjs
COPY --chown=node:node db/migrations ./db/migrations
USER node
EXPOSE 8080
CMD ["node", "server.cjs"]
