FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . ./
RUN npm run typecheck

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app ./

EXPOSE 19000 19001 19002
CMD ["npm", "run", "start", "--", "--host", "0.0.0.0"]

