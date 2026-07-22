# syntax=docker/dockerfile:1
#
# Local-only: servidor de desarrollo Vite con hot reload.
# El source code se monta como volumen desde docker-compose (no se copia aquí).
# Uso: docker-compose up

FROM node:20-alpine AS local
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.34.1 --activate

RUN addgroup -S app && adduser -S app -G app

COPY package.json pnpm-lock.yaml .npmrc* ./
RUN pnpm install --frozen-lockfile

EXPOSE 3000
USER app
CMD ["pnpm", "dev"]

#####################
# qa (build estático + Caddy)
#####################
# A diferencia del stage "local" (dev server con HMR), este compila un build de producción
# de Vite y lo sirve con Caddy — Caddy también hace de reverse proxy hacia la API bajo /api/*
# (ver deploy/qa/Caddyfile) y de terminador TLS (Let's Encrypt automático) en el servidor de
# QA. VITE_API_URL se hornea en el JS estático en build-time (Vite no lee env vars en
# runtime), por eso entra acá como build-arg y no en el .env.qa del servidor.
FROM node:20-alpine AS build-qa
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.34.1 --activate

COPY package.json pnpm-lock.yaml .npmrc* ./
RUN pnpm install --frozen-lockfile

COPY . .
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN pnpm build

FROM caddy:2-alpine AS qa
COPY --from=build-qa /app/dist /srv
COPY deploy/qa/Caddyfile /etc/caddy/Caddyfile


#####################
# prod (build estático + Caddy)
#####################
# Igual que el stage "qa", pero apuntando al Caddyfile de producción
# (deploy/prod/Caddyfile, dominio mydoctordata.net sin el subdominio qa.).
FROM node:20-alpine AS build-prod
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.34.1 --activate

COPY package.json pnpm-lock.yaml .npmrc* ./
RUN pnpm install --frozen-lockfile

COPY . .
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN pnpm build

FROM caddy:2-alpine AS prod
COPY --from=build-prod /app/dist /srv
COPY deploy/prod/Caddyfile /etc/caddy/Caddyfile