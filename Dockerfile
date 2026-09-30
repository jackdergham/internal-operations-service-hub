# Single-service deployment: the backend serves the built frontend from one
# origin (see backend/src/main.ts's STATIC_DIR handling), so this is the only
# Dockerfile the whole project needs — no separate frontend service, no CORS
# config to maintain.

# ---- Frontend build ----------------------------------------------------
FROM node:24-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---- Backend build -------------------------------------------------------
FROM node:24-alpine AS backend-build
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci
COPY backend/ ./
# The Prisma client's generated types are required for `nest build` to
# type-check; DATABASE_URL is not needed yet, generate only reads schema.prisma.
RUN npx prisma generate
RUN npm run build

# ---- Runtime --------------------------------------------------------------
FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Alpine ships neither OpenSSL nor the glibc compatibility layer, and Prisma's
# query engine links against libssl/libcrypto. Without these, `prisma generate`
# and the client fail at runtime with an opaque engine-load error.
RUN apk add --no-cache openssl libc6-compat

COPY backend/package.json backend/package-lock.json ./
# Not --omit=dev: the `prisma` CLI (needed here for `prisma generate`, and at
# runtime by railway.json's preDeployCommand for `prisma db push`) is a
# devDependency, not a regular one. Keeping it costs some image size but
# avoids `npx` trying to fetch it over the network at deploy time.
RUN npm ci

# Prisma's client is generated against the schema, not fetched from npm, so
# it must be regenerated here too — the dev-dependency install above does not
# carry over the client generated in the build stage.
COPY backend/prisma ./prisma
RUN npx prisma generate

COPY --from=backend-build /app/backend/dist ./dist
COPY --from=frontend-build /app/frontend/dist ./public

ENV STATIC_DIR=/app/public
EXPOSE 3000
CMD ["node", "dist/main.js"]
