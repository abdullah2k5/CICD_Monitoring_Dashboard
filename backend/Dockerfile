FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --chown=node:node src ./src

USER node

EXPOSE 5000

CMD ["node", "src/server.js"]
