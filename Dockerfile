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

# Copy server files first to ensure prisma directory exists
COPY server/ ./

# Explicitly create the prisma directory and copy schema
RUN mkdir -p ./prisma
COPY server/prisma/schema.prisma ./prisma/

# Create a temporary .env file with a dummy DATABASE_URL for Prisma to generate
RUN echo 'DATABASE_URL="postgresql://dummy:password@localhost:5432/dummy"' > .env

# Install server dependencies
RUN npm install

# Ensure the output directory for Prisma exists
RUN mkdir -p ./generated/prisma

# Generate Prisma client with explicit schema path
RUN npx prisma generate --schema=./prisma/schema.prisma

# Remove the temporary .env file
RUN rm .env

# Set environment variables
ENV NODE_ENV=production

# Expose port
EXPOSE 5001

# Start the application
CMD ["npm", "start"] 