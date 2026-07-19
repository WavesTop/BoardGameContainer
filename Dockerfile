FROM node:24-alpine AS build

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

WORKDIR /workspace
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/cloudrun-server/package.json apps/cloudrun-server/package.json
COPY packages/protocol/package.json packages/protocol/package.json
COPY packages/game-sdk/package.json packages/game-sdk/package.json
COPY games/demo/package.json games/demo/package.json
RUN pnpm install --frozen-lockfile

COPY apps/cloudrun-server apps/cloudrun-server
COPY packages/protocol packages/protocol
COPY packages/game-sdk packages/game-sdk
COPY games/demo games/demo
RUN pnpm --filter @bgc/cloudrun-server build
RUN pnpm --filter @bgc/cloudrun-server --prod deploy --legacy /runtime

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
WORKDIR /app
COPY --from=build /runtime ./
EXPOSE 3000
CMD ["node", "dist/index.js"]
