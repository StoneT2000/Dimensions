#!/bin/bash

sudo npm run clean
nyc --reporter=html --no-clean mocha tests/api/**/*.spec.ts
nyc --reporter=html --no-clean mocha tests/core/**/*.spec.ts