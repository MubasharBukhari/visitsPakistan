FROM node:22.20.0-bookworm-slim AS build
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV NX_DAEMON=false
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /workspace
RUN npm install --global pnpm@10.29.2
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm nx run cms:build

FROM node:22.20.0-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /workspace
ENV HOSTNAME=0.0.0.0
ENV PORT=3001
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=build --chown=node:node /workspace/apps/cms/.next/standalone ./
COPY --from=build --chown=node:node /workspace/apps/cms/.next/static ./apps/cms/.next/static
COPY --from=build --chown=node:node /workspace/apps/cms/public ./apps/cms/public
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:3001/health/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/cms/server.js"]
