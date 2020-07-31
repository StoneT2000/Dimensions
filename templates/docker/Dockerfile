FROM docker:dind

RUN mkdir ./scripts
COPY ./scripts ./scripts

RUN apk update

RUN apk add --no-cache curl
RUN apk add --no-cache build-base

# install tooling and langs

RUN apk add --no-cache nodejs nodejs-npm

RUN apk add --no-cache go

RUN apk add --no-cache php7

RUN apk add --no-cache python3

RUN npm install -g typescript

RUN apk add --no-cache bash

RUN apk --update add openjdk7-jre

RUN adduser -D dimensions_bot

USER root