# syntax=docker/dockerfile:1
ARG TARGETARCH

# ---- Build frontend ----
FROM node:22-alpine AS frontend-builder
WORKDIR /build/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# ---- Build Go backend ----
FROM golang:1.26-alpine AS backend-builder
ARG TARGETARCH
WORKDIR /build
COPY backend/ ./backend/
COPY --from=frontend-builder /build/frontend/dist ./frontend/dist
RUN CGO_ENABLED=0 GOOS=linux GOARCH=$TARGETARCH go build -o dns-firewall ./backend/

# ---- Runtime ----
FROM alpine:3.21
RUN apk add --no-cache ca-certificates
WORKDIR /app
COPY --from=backend-builder /build/dns-firewall .
COPY --from=backend-builder /build/frontend/dist ./frontend/dist
EXPOSE 8080 8053
CMD ["./dns-firewall", "--dns-addr", ":8053", "--api-addr", ":8080", "--frontend-dir", "/app/frontend/dist", "--db-path", "/app/dns-firewall.db"]
