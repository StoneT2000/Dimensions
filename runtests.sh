#!/bin/bash

# clean out test artifacts
npm run clean

# seed dbs

npm run test-seed

# test core, then api
nyc --reporter=html --no-clean mocha tests/core/agent/**/*.spec.ts
nyc --reporter=html --no-clean mocha tests/core/database/**/*.spec.ts
nyc --reporter=html --no-clean mocha tests/core/dimension/**/*.spec.ts
nyc --reporter=html --no-clean mocha tests/core/engine/**/*.spec.ts
nyc --reporter=html --no-clean mocha tests/core/logger/**/*.spec.ts
nyc --reporter=html --no-clean mocha tests/core/rating/**/*.spec.ts
nyc --reporter=html --no-clean mocha tests/core/tourney/**/*.spec.ts
nyc --reporter=html --no-clean mocha tests/api/**/*.spec.ts

