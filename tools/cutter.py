#!/usr/bin/env python

import sys

out = sys.stdout

for line in open(sys.argv[1], 'r'):
    if line.find("cuthere") > -1:
      break
    out.write(line)
