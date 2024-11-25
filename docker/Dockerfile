# syntax=docker/dockerfile:1

ARG NODE_VERSION=22
ARG VSCE_VERSION=3.2.1

ARG AIDER_BASE_IMAGE=paulgauthier/aider-full

###
# https://aider.chat/docs/install/docker.html
FROM ${AIDER_BASE_IMAGE} AS chat-service

RUN pip install flask

COPY ./server /server

WORKDIR /workspace
ENTRYPOINT []

ENV FLASK_RUN_HOST=0.0.0.0

EXPOSE 5000

# https://github.com/lee88688/aider-composer/blob/master/src/aiderChatService.ts
CMD [ "python", "-m", "flask", "-A", "/server/main.py", "run", "--port", "5000" ]

###
FROM node:${NODE_VERSION} AS builder

WORKDIR /app

COPY ./package*.json ./
RUN npm install
RUN npm install -g @vscode/vsce@${VSCE_VERSION}

ARG VSCE_TARGET

COPY ./ ./

RUN <<EOF
#!/bin/bash
set -e

cd /app/ui
npm install
npm run build

cd /app/
npm install
npm run vscode:prepublish
vsce package --out /app/aider-composer.vsix --target $VSCE_TARGET
EOF

###
FROM scratch AS vsce

COPY --link --from=builder /app/aider-composer.vsix /aider-composer.vsix
###