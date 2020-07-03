#!/bin/bash

# clean out test artifacts
sudo npm run clean

# run core tests
# TODO, split core into parts
nyc --reporter=html --no-clean mocha tests/core/**/*.spec.ts

# run api tests
nyc --reporter=html --no-clean mocha tests/api/**/*.spec.ts

