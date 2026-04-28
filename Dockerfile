# syntax=docker/dockerfile:1
# Voice WS server for Fly.io deployment.
# Builds a minimal Node image with only what voice-server.ts needs at runtime.

FROM node:20-alpine

WORKDIR /app

# Cache deps separately from source.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --omit=optional && npm cache clean --force

# Add tsx back (it's a regular dep, but --omit=dev would skip it if it were dev-only).
# We pin and copy only the files the voice-server actually imports.
COPY tsconfig.json ./
COPY prompts ./prompts
COPY src/lib ./src/lib
COPY src/voice-server.ts ./src/

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["npm", "run", "voice-server:prod"]
