FROM node:20 AS build

WORKDIR /app

COPY package*.json ./
<<<<<<< HEAD
RUN npm ci
=======
RUN npm install --include=dev && npm install -g typescript vite
>>>>>>> origin/main

COPY . .

RUN npm run build

FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf