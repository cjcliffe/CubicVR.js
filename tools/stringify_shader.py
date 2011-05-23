#!/usr/bin/env python

"""
Take a GL Shader and strip leading/trailing white space,
remove eol comments, delete empty lines, compress into
single line, suitable as string.  Prints to stdout.

Usage: python stringify_shader.py <shader-filename>
"""

import re
import sys

out = sys.stdout

# strip eol comments
comment_regex = re.compile('//.*$')

# todo: strip multi-line comments (use c++ tokenizer code)

out.write('"')

for line in open(sys.argv[1], 'r'):
    line = line.lstrip().rstrip()
    line = comment_regex.sub('', line)

    if len(line) > 0:
      line = line.replace('\t', ' ')
      out.write(line)
      out.write('\\n')

out.write('";\n')
