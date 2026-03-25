FROM node:20 AS build

WORKDIR /app

COPY package*.json ./

# Install dependencies (including dev for build)
RUN npm install

COPY . .

# Build frontend
RUN npm run build

FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf