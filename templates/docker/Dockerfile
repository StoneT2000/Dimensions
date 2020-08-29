#
# This is a Docker file that installs every language necessary to use this for every agent regardless of language
# provided the language is supported by Dimensions. This is also used to build the standard image used for testing on 
# circleci
#

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

# needed to make pidusage work
RUN apk --no-cache add procps

RUN apk --no-cache add docker-cli

RUN adduser -D dimensions_bot