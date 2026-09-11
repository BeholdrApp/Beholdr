# syntax=docker/dockerfile:1

# ---- stage 1: build the SvelteKit UI ----
# Every base image is pinned by digest, not by tag: a tag is mutable, so a
# floating tag silently changes the contents of a "reproducible" build. The
# tag is kept alongside the digest purely so a human can read which release
# the digest refers to. Renovate/Dependabot bumps these (.github/dependabot.yml).
FROM node:26-alpine@sha256:ef24c5053d50fdc3e4e56eb4e7ddb7861874ab0fdc797046ba897581deb8e868 AS ui
WORKDIR /ui
COPY web/package.json web/package-lock.json ./
# npm ci requires the lock file and never modifies it, so the exact dependency
# tree installed here matches what's committed.
RUN npm ci --no-audit --no-fund
COPY web/ ./
RUN npm run build          # -> /ui/build (static SPA)

# ---- stage 2: build the Go binary with the UI embedded ----
# Pinned to a current patch release, not a floating minor tag: the Go
# standard library ships inside the compiled binary, so the build toolchain
# itself is part of the release's vulnerability surface (see #6).
FROM golang:1.25.14-alpine@sha256:1ae0735f00daffa3aaf1363a5184c0d2dc55c78e3db4ec70241cdac97bf84b59 AS build
WORKDIR /src
COPY go.mod go.sum ./
# go.sum is committed, so this only downloads/verifies against it — it never
# resolves or rewrites the module graph the way `go mod tidy` would.
RUN go mod download
COPY . .
# drop the stub UI and embed the real build output
RUN rm -rf internal/webui/dist && mkdir -p internal/webui/dist
COPY --from=ui /ui/build/ internal/webui/dist/
# static, stripped binary
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags "-s -w" \
    -o /out/beholdr ./cmd/beholdr

# ---- stage 3: minimal runtime ----
FROM gcr.io/distroless/static-debian12:nonroot@sha256:afa5c872c891853ca7fcf1f12c3edb23f7eeef36189728842dd51042ff57f7ab
COPY --from=build /out/beholdr /beholdr
EXPOSE 8000
USER nonroot:nonroot
ENTRYPOINT ["/beholdr"]
