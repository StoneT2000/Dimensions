#!/bin/bash -eo pipefail

# clean out test artifacts
sudo npm run clean


# TODO, split core into parts
nyc --reporter=html --no-clean mocha tests/core/**/*.spec.ts && \
nyc --reporter=html --no-clean mocha tests/api/**/*.spec.ts



