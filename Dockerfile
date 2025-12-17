FROM node:24-alpine

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

# instalar git
RUN apk add --no-cache git openssh

RUN yarn install 

RUN yarn prisma generate

COPY . .

EXPOSE 3000
CMD ["yarn", "start"]