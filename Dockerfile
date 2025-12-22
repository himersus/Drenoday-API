FROM node:24-alpine

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

# instalar git e docker-cli
RUN apk add --no-cache git openssh docker-cli bash
RUN apt-get update && apt-get install -y docker.io docker-compose

RUN yarn install 

RUN yarn prisma generate

COPY . .

EXPOSE 3000
CMD ["yarn", "start"]