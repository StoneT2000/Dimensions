FROM alpine:3.11

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

RUN apk add --no-cache openjdk8
ENV JAVA_HOME=/usr/lib/jvm/java-1.8-openjdk
ENV PATH="$JAVA_HOME/bin:${PATH}"


RUN adduser -D dimensions_bot