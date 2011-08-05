// Read js file
var line, jsfile = '';
while((line = readline()) !== null) {
  jsfile += line + '\n';
}

if (!JSHINT(jsfile, {evil: true, sub: true})) {
  print('jshint: Found ' + JSHINT.errors.length + ' errors.\n');
  for (i = 0; i < JSHINT.errors.length; i += 1) {
    e = JSHINT.errors[i];
    if (e) {
      print('Lint at line ' + e.line + ' character ' + e.character + ': ' + e.reason);
      print((e.evidence || '').replace(/^\s*(\S*(\s+\S+)*)\s*$/, "$1"));
      print('');
    }
  }
} else {
  print("jshint: No problems found.");
}
