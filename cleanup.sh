#!/bin/bash

rm -fv $(find "."  -name "*.class")
rm -fv $(find "."  -name "*.out")
rm -fv $(find "./tests/ts-kit"  -name "*.js")
rm -fv $(find "./tests/kits/ts"  -name "*.js")

rm -rf ./.nyc_output
rm -rf ./coverage
rm -rf /tmp/dbot