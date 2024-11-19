import { diffLines, structuredPatch } from 'diff';

const original = `a
b
c
d
e`;

const modified = `a
a1
b
c1
e
f`;

const res = diffLines(original, modified);
console.log(res);
