#!/bin/bash

# clean out test artifacts
npm run clean

# seed dbs

npm run test-seed

TS_NODE_COMPILER_OPTIONS='{"module":"commonjs"}' \
nyc --reporter=html --no-clean mocha --recursive tests/core/**/*.spec.ts tests/api/**/*.spec.ts

# testpaths=( \
# tests/core/engine/01*.spec.ts \
# tests/core/engine/02*.spec.ts \
# tests/core/engine/03*.spec.ts \
# tests/core/engine/04*.spec.ts \
# tests/core/utilstest/**/*.spec.ts \
# tests/core/agent/**/*.spec.ts \
# tests/core/database/**/*.spec.ts \
# tests/core/storage/**/*.spec.ts \
# tests/core/dimension/**/*.spec.ts \
# tests/core/logger/**/*.spec.ts \
# tests/core/match/**/*.spec.ts \
# tests/core/rating/**/*.spec.ts \
# tests/core/tourney/**/*.spec.ts \
# tests/api/**/*.spec.ts \
# )

# errcount=0

# for path in ${testpaths[@]}; do
#   nyc --reporter=html --no-clean mocha $path
#   errcount=$((errcount + $?))
# done

# exit ${errcount}