FROM node:20-alpine
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package.json .
RUN npm install --production
COPY src ./src
ENV NODE_ENV=production DATA_DIR=/data PORT=4000
EXPOSE 4000
CMD ["node", "src/index.js"]
