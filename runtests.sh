#!/bin/bash

# clean out test artifacts
npm run clean

# seed dbs

npm run test-seed

# test core, then api
nyc --reporter=html --no-clean mocha tests/core/**/*.spec.ts

