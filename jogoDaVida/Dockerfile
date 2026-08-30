# Imagem de desenvolvimento do protótipo jogoDaVida.
# npm install completo (inclui nodemon) — é protótipo, o container roda com hot-reload.
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY server/ ./server/
COPY public/ ./public/
EXPOSE 3004
CMD ["node", "server/index.js"]
