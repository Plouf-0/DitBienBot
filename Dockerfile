FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm install --no-audit --no-fund

COPY . .

EXPOSE 3000

CMD ["sh", "-c", "node commands.js && npm start"]
