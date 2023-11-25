FROM node:18-alpine

WORKDIR /app/authorization-fivem-v2

RUN npm install pm2 -g
COPY package*.json ./
COPY tsconfig.json ./

COPY . .
RUN npm ci

RUN npx prisma generate
RUN npm run build

EXPOSE 5555
CMD ["pm2-runtime", "start", "processes.json"]