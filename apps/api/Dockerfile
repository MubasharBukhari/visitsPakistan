FROM node:22.20.0-bookworm-slim AS build
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV NX_DAEMON=false
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /workspace
RUN npm install --global pnpm@10.29.2
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm nx run api:build
RUN pnpm nx run search:build

FROM node:22.20.0-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /workspace
ENV API_HOST=0.0.0.0
ENV API_PORT=4000
COPY --from=build --chown=node:node /workspace/node_modules ./node_modules
COPY --from=build --chown=node:node /workspace/dist/apps/api ./dist/apps/api
COPY --from=build --chown=node:node /workspace/dist/tools/search-index.cjs ./dist/tools/search-index.cjs
RUN mkdir -p /workspace/.data/media && chown -R node:node /workspace/.data
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:4000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/apps/api/main.cjs"]
