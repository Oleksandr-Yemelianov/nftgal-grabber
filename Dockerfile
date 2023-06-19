# ---------------------DEV-------------------------
FROM node:18-alpine as start_dev
WORKDIR /app
RUN apk update && apk add --no-cache python3 g++ make
COPY ./ .
COPY dev-entrypoint.sh /usr/local/bin/dev-entrypoint
RUN chmod +x /usr/local/bin/dev-entrypoint
ENTRYPOINT ["dev-entrypoint"]
CMD [ "npm", "run", "start:dev" ]

# ---------------------PROD-------------------------
FROM node:18-alpine as build
WORKDIR /otp/app
RUN apk update && apk add --no-cache python3 g++ make
COPY ./ .
RUN npm ci --audit false
RUN npm run build

FROM node:18-alpine as start_prod
WORKDIR /app
RUN apk update && apk add --no-cache python3 g++ make
COPY ./package*.json ./
RUN npm install --omit=dev
COPY ./.env .
COPY --from=build /otp/app/dist ./dist
EXPOSE 3000
CMD [ "npm", "run", "start:prod" ]
