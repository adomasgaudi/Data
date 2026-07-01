# Multi-stage build for the new React app (app/) → static files served by nginx.
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build:app

FROM nginx:alpine AS serve
COPY --from=build /app/dist-app /usr/share/nginx/html
# SPA fallback: route every path to index.html so React Router owns navigation.
RUN printf 'server {\n  listen 80;\n  root /usr/share/nginx/html;\n  location / {\n    try_files $uri /index.html;\n  }\n}\n' > /etc/nginx/conf.d/default.conf
EXPOSE 80
