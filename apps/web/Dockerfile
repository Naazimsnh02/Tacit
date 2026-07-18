FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
COPY apps/web/package.json apps/web/package.json
# npm must see every workspace package before resolving @tacit/* dependencies.
# Otherwise it treats them as registry packages and fails with E404 during Docker builds.
COPY packages ./packages
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "start", "--workspace=@tacit/web"]
