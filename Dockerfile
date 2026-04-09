# --- Stage 1: Base ---
FROM node:alpine AS base

RUN addgroup -S api-payments-subs-group && adduser -S -G api-payments-subs-group api-payments-subs-user
# # Debian-style user creation
# RUN groupadd -r api-payments-subs-group && useradd -r -g api-payments-subs-group api-payments-subs-user
WORKDIR /app
# Pre-set ownership of the workdir
RUN chown api-payments-subs-user:api-payments-subs-group /app
COPY --chown=api-payments-subs-user:api-payments-subs-group package*.json ./

# --- Stage 2: Development ---
FROM base AS development
RUN npm install --legacy-peer-deps
COPY --chown=api-payments-subs-user:api-payments-subs-group . .
# Create logs dir for dev environment
RUN mkdir -p /app/logs && chown api-payments-subs-user:api-payments-subs-group /app/logs
USER api-payments-subs-user
EXPOSE 9879
CMD ["npm", "run", "dev"]

# --- Stage 3: Build (Intermediate) ---
FROM development AS builder
# RUN npm run docker:pre-run
USER root
RUN npm run build
RUN npm prune --omit=dev --legacy-peer-deps

# --- Stage 4: Production ---
FROM base AS production
ENV NODE_ENV=production

# Copy artifacts from builder
COPY --from=builder --chown=api-payments-subs-user:api-payments-subs-group /app/node_modules ./node_modules
COPY --from=builder --chown=api-payments-subs-user:api-payments-subs-group /app/dist ./dist

# CRITICAL: Re-create and permission the logs directory in the final image
RUN mkdir -p /app/logs && chown api-payments-subs-user:api-payments-subs-group /app/logs

USER api-payments-subs-user
EXPOSE 9879

# Using 'node' directly is more memory-efficient than 'npm start'
CMD ["npm", "run","start"]