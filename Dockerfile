# Stage 1: Build Angular frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend

# Install Angular dependencies
COPY frontend/package.json ./
RUN npm install --legacy-peer-deps --no-optional

# Copy source and build
COPY frontend/ .
RUN npx ng build --configuration production

# Debug: show output path so we know where files landed
RUN echo "=== Build output ===" && find dist -type f | head -20

# Stage 2: Production
FROM node:20-alpine
WORKDIR /app

# Install build tools for better-sqlite3 native compilation
RUN apk add --no-cache python3 make g++

# Copy backend
COPY backend/package.json ./
RUN npm install --production
COPY backend/src/ ./src/

# Copy built frontend to backend's public dir
# Angular 19 application builder outputs to dist/<project>/browser
COPY --from=frontend-build /app/frontend/dist/budget-app/browser ./public/

# Create data directory for SQLite
RUN mkdir -p /app/data

ENV PORT=3000
ENV DB_PATH=/app/data/budget.db
ENV NODE_ENV=production

EXPOSE 3000

# Volume for persistent data
VOLUME ["/app/data"]

CMD ["node", "src/server.js"]
