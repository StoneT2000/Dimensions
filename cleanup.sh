#!/bin/bash

rm -fv $(find "."  -name "*.class")
rm -fv $(find "."  -name "*.out")
rm -fv $(find "./tests/ts-kit"  -name "*.js")

rm -rf ./.nyc_output