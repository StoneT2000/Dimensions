FROM node:12.16.3

RUN mkdir ./scripts
COPY ./scripts ./scripts

# install tooling and langs
RUN apt-get update
RUN apt-get install -y sudo
RUN apt-get install -y g++ default-jdk python3-pip


RUN bash ./scripts/php.sh

RUN bash ./scripts/go.sh

RUN npm install -g typescript


RUN apt-get clean

# other security related setup

RUN  useradd dimensions_bot && \
chsh dimensions_bot -s /bin/rbash && \
mkdir /home/dimensions_bot && \
chown -R dimensions_bot /home/dimensions_bot