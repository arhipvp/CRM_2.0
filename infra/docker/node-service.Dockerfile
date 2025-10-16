# syntax=docker/dockerfile:1.5
ARG NODE_IMAGE=node:20-alpine

FROM ${NODE_IMAGE} AS base
WORKDIR /app
RUN corepack enable

FROM base AS deps
ARG SERVICE_PATH
COPY ${SERVICE_PATH}/pnpm-lock.yaml ./pnpm-lock.yaml
COPY ${SERVICE_PATH}/package.json ./package.json
RUN pnpm install --frozen-lockfile

FROM base AS build
ARG SERVICE_PATH
ARG BUILD_COMMAND="pnpm run build"
COPY ${SERVICE_PATH}/pnpm-lock.yaml ./pnpm-lock.yaml
COPY ${SERVICE_PATH}/package.json ./package.json
COPY --from=deps /app/node_modules ./node_modules
COPY ${SERVICE_PATH}/ ./
RUN ${BUILD_COMMAND}

FROM base AS production-deps
ARG SERVICE_PATH
COPY ${SERVICE_PATH}/pnpm-lock.yaml ./pnpm-lock.yaml
COPY ${SERVICE_PATH}/package.json ./package.json
COPY --from=deps /app/node_modules ./node_modules
RUN pnpm prune --prod

FROM ${NODE_IMAGE} AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
ARG SERVICE_PATH
COPY --from=production-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY ${SERVICE_PATH}/package.json ./package.json
ARG START_COMMAND="node dist/main.js"
CMD ["sh", "-c", "${START_COMMAND}"]
