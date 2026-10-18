FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./

RUN npm install

# The source code will be mounted as a volume during development

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
