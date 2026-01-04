FROM oven/bun:latest

WORKDIR /app

ARG UBUNTU_VERSION
ENV UBUNTU_VERSION=$UBUNTU_VERSION

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

EXPOSE 4343
EXPOSE 8080

CMD ["bun", "run", "src/index.ts"]