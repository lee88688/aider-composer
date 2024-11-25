# Build Aider-Composer extension and service in docker container

Install [Docker](https://docs.docker.com/engine/install/) on your host machine and run:

```bash
npm run build-vsce
npm run build-service
```

## Start/stop chat service

```bash
npm run start-service
npm run stop-service
```

## Install extension

```text
Activity Bar -> Extensions -> Install from VSIX...
docker/build/aider-composer.vsix
```

## Configuration

```text
Code -> Settings -> Extensions -> Aider Composer
[x] Use remote Aider chat service
```
