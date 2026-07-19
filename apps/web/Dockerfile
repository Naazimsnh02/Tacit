FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
COPY apps/web/package.json apps/web/package.json
# npm must see every workspace package before resolving @tacit/* dependencies.
# Otherwise it treats them as registry packages and fails with E404 during Docker builds.
COPY packages ./packages
RUN npm install
COPY . .

# NEXT_PUBLIC_* values are inlined into the browser bundle at `next build`.
# Runtime compose `environment:` alone is not enough for client-side auth.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_DEMO_MODE_ENABLED=true
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_DEMO_MODE_ENABLED=$NEXT_PUBLIC_DEMO_MODE_ENABLED

RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "start", "--workspace=@tacit/web"]
