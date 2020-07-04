#!/bin/bash

# clean out test artifacts
sudo npm run clean


# test core, then api
sudo nyc --reporter=html --reporter=json --no-clean mocha tests/core/**/*.spec.ts tests/api/**/*.spec.ts



