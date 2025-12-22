FROM node:24-alpine

# instalar dependências necessárias
RUN apk add --no-cache \
    git \
    openssh \
    docker-cli \
    docker-cli-compose \
    bash

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN yarn install 

RUN yarn prisma generate

COPY . .

EXPOSE 3000
CMD ["yarn", "start"]