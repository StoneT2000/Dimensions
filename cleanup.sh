#!/bin/bash

rm -fv $(find "."  -name "*.class")
rm -fv $(find "."  -name "*.out")
rm -fv $(find "./tests/kits/ts"  -name "*.js")

rm -rf ./.nyc_output
rm -rf ./coverage
rm -rf /tmp/dbot

# clean up files related to storage tests
rm -rf ../../local/testname_test_dim_id

# clean up LRU Cache files
rm -rf $(find "../../local"  -name "cache_test_*")