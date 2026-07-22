# syntax=docker/dockerfile:1
#
# Local-only. El binario Go corre desde FROM scratch: cero OS, solo el binario + certificados TLS.
# Uso: docker-compose up

#####################
# deps
#####################
FROM golang:1.25.1-alpine AS deps
WORKDIR /app

RUN apk add --no-cache ca-certificates && update-ca-certificates

COPY go.mod go.sum ./
RUN go mod download

#####################
# build
#####################
FROM golang:1.25.1-alpine AS build
WORKDIR /app

RUN apk add --no-cache ca-certificates && update-ca-certificates

COPY --from=deps /go/pkg /go/pkg
COPY --from=deps /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY . .

# Binario estático: sin libc, sin OS, listo para scratch
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /bin/api ./cmd/api

#####################
# local (scratch)
#####################
FROM scratch AS local
COPY --from=build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=build /bin/api /api

EXPOSE 8080
ENTRYPOINT ["/api"]
