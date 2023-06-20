# ---------------------DEV-------------------------
FROM node:18-alpine as start_dev
WORKDIR /app
RUN apk update && apk add --no-cache python3 g++ make
COPY ./ .
RUN npm install
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
COPY ./.env .
COPY ./package*.json ./
RUN npm install --omit=dev
COPY --from=build /otp/app/dist ./dist
EXPOSE 3000
COPY prod-entrypoint.sh /usr/local/bin/prod-entrypoint
RUN chmod +x /usr/local/bin/prod-entrypoint
ENTRYPOINT ["prod-entrypoint"]
CMD [ "npm", "run", "start:prod" ]
