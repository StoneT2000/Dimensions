#!/bin/bash

# clean out test artifacts
npm run clean


# test core, then api
nyc --reporter=html --no-clean mocha tests/core/**/*.spec.ts tests/api/**/*.spec.ts

