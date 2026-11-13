FROM node:20-alpine

WORKDIR /app
COPY web-pc ./web-pc

ENV NODE_ENV=production
ENV NO_OPEN=1
ENV PORT=8080

EXPOSE 8080

CMD ["node", "web-pc/server.js"]
