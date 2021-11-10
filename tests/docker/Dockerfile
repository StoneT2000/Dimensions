#
# This is a Docker file that installs every language necessary to use this for every agent regardless of language
# provided the language is supported by Dimensions. This is also used to build the standard image used for testing on 
# circleci
#

FROM python:3.8.12-slim-buster

RUN apt-get update
RUN apt-get install -y curl

ENV NVM_DIR /usr/local/nvm
ENV NODE_VERSION 14.16.0

# install nvm
# https://github.com/creationix/nvm#install-script
RUN curl --silent -o- https://raw.githubusercontent.com/creationix/nvm/v0.31.2/install.sh | bash

# install node and npm
RUN . $NVM_DIR/nvm.sh \
    && nvm install $NODE_VERSION \
    && nvm alias default $NODE_VERSION \
    && nvm use default

ENV NODE_PATH $NVM_DIR/v$NODE_VERSION/lib/node_modules
ENV PATH $NVM_DIR/versions/node/v$NODE_VERSION/bin:$PATH

# confirm installation
RUN node -v
RUN npm -v

RUN python -m pip install --upgrade pip
RUN pip install numpy scipy pandas matplotlib scikit-learn gym pettingzoo

RUN npm i -g typescript