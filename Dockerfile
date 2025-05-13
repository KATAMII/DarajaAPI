FROM node:18-slim as build

# Install OpenSSL which is needed for Prisma
RUN apt-get update && apt-get install -y openssl

# Set working directory for the frontend
WORKDIR /app

# Copy package files for the frontend
COPY package*.json ./

# Install frontend dependencies
RUN npm install

# Copy frontend files
COPY . .

# Build the frontend
RUN npm run build

# Backend stage
FROM node:18-slim

# Install OpenSSL which is needed for Prisma
RUN apt-get update && apt-get install -y openssl

# Set working directory
WORKDIR /app

# Copy the built frontend files
COPY --from=build /app/dist ./public

# Copy server package files
COPY server/package*.json ./

# Install server dependencies
RUN npm install

# Copy prisma schema files
COPY server/prisma ./prisma/

# Copy server files
COPY server/ ./

# Ensure the output directory for Prisma exists
RUN mkdir -p ./generated/prisma

# Generate Prisma client
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy?schema=public"
RUN npx prisma generate
ENV DATABASE_URL=""

# Expose port
EXPOSE 5001

# Start the application
CMD ["npm", "start"] 