# -------- Build Stage --------
FROM node:20-alpine AS build

# working directory
WORKDIR /app

# copy package files first
COPY package.json package-lock.json ./

# install dependencies
RUN npm install

# copy project source
COPY . .

# build the project
RUN npm run build

# -------- Production Stage --------
FROM nginx:alpine

# remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# copy build files from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# expose port
EXPOSE 80

# start nginx
CMD ["nginx", "-g", "daemon off;"]