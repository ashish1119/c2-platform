# -------- Build Stage --------
FROM node:20 AS build

WORKDIR /app

COPY package*.json ./
RUN npm install --include=dev && npm install -g typescript vite

COPY . .
RUN npm run build

# -------- Production Stage --------
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf