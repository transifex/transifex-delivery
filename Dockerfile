#####################
### builder image ###

FROM node:14.8-alpine as builder

ARG USER_ID
ARG GROUP_ID

RUN deluser node && \
    addgroup -g ${GROUP_ID} node && \
    adduser -u ${USER_ID} -D node -G node

COPY --chown=node:node package.json package-lock.json /usr/app/

USER node
WORKDIR /usr/app

EXPOSE 10300 9090

##########################
#### production image ###
FROM builder as transifex-delivery

ENV NODE_ENV=production

# Install packages from package-lock.json to avoid deploying unexpected
# package versions. Then, remove all not production packages.
RUN npm ci --only=prod

COPY --chown=node:node config /usr/app/config
COPY --chown=node:node ./src /usr/app/src

CMD ["npm", "start"]

##########################
#### devel image ###
FROM builder as transifex-delivery-devel

ENV NODE_ENV=development

RUN npm ci

COPY --chown=node:node config /usr/app/config
COPY --chown=node:node ./src /usr/app/src
COPY --chown=node:node ./tests /usr/app/tests

CMD ["npm", "run", "start-dev"]