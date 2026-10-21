# Production image of the Glacier Team Task Manager API.
#
# Build and push it with Google Cloud Build from the repository root:
#   gcloud builds submit --tag REGION-docker.pkg.dev/PROJECT_ID/glacier/api:latest server
#
# The image only contains the production dependencies and the application
# source. The dev dependencies (supertest) are not installed, and the
# container runs as the unprivileged `node` user.

# ---- dependencies -----------------------------------------------------------
FROM node:22-alpine AS dependencies

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---- runtime ----------------------------------------------------------------
FROM node:22-alpine AS runtime

ENV NODE_ENV=production \
    PORT=8080

# tini reaps the zombie processes and forwards SIGTERM, so Cloud Run can stop
# the container gracefully.
RUN apk add --no-cache tini

WORKDIR /app

COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src

# The Cloud Run runtime refuses to start a container that runs as root.
USER node

EXPOSE 8080

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/server.js"]
