FROM node:24-slim AS build
# Build tools in case better-sqlite3 has no prebuilt binary for this platform
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production PORT=3000 DB_PATH=/data/doomsday.db
COPY package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
VOLUME /data
EXPOSE 3000
# Seed the sample data on first start only, then run the API
CMD ["sh", "-c", "node dist/seed.js --if-empty && node dist/index.js"]
