FROM node:22-alpine

# Set the working directory
WORKDIR /app

COPY package*.json ./
COPY ./src ./src
COPY ./biome.json ./
COPY ./tsconfig.json ./

# Install dependencies for both client and server
RUN npm install --legacy-peer-deps

# Build the application
RUN npm run build

COPY ./.eun.env ./dist/
COPY ./private/scrilexia.crt ./dist/
COPY ./private/private.key ./dist/

# RUN npx playwright install

# Expose the application port
EXPOSE 4310

# Start the application
CMD ["npm", "start"]
