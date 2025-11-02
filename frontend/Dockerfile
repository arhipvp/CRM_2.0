# Multi-stage build для React Frontend
# Build context: проект корня (C:\Dev\CRM_2.0)
# Dockerfile path: frontend/Dockerfile

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Копируем package.json и package-lock.json из frontend
COPY frontend/package.json frontend/package-lock.json* frontend/pnpm-lock.yaml* frontend/npm-shrinkwrap.json* ./

# Устанавливаем зависимости
RUN npm install --ci 2>/dev/null || npm install

# Копируем исходный код frontend
COPY frontend/ .

# Собираем приложение
RUN npm run build

# Stage 2: Runtime (development)
FROM node:20-alpine AS dev

WORKDIR /app

# Копируем package.json
COPY frontend/package.json frontend/package-lock.json* frontend/pnpm-lock.yaml* frontend/npm-shrinkwrap.json* ./

# Устанавливаем зависимости (используем package-lock.json если доступен)
RUN npm ci 2>/dev/null || npm install

# Копируем исходный код
COPY frontend/ .

# Экспортируем порт
EXPOSE 3000

# Команда запуска в dev режиме
CMD ["npm", "run", "dev"]

# Stage 3: Runtime (production)
FROM nginx:alpine AS prod

# Копируем Nginx конфигурацию
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Копируем собранное приложение из builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Экспортируем порт
EXPOSE 80

# Nginx будет работать в foreground режиме
CMD ["nginx", "-g", "daemon off;"]
