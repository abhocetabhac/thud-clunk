// Usage:
//   node ./example11 testfile2.txt testfile1.txt
//
// Nested thunks.

const myFiles = process.argv.slice(2);

const
  fs = require('fs'),
  thunkify = require('./thunkify11');

const gnReadFile = thunkify.generatorFactory(fs.readFile);

const fnRender = function(input) {
  console.log('');
  console.log(input);
};
// Nesting thunks may be implemented in two way:
// 1) Directly providing the child generator to the parent one.
const gnRender1 = thunkify.generatorFactory(gnReadFile, fnRender);
const render1 = thunkify.factory(gnRender1); // Named thunk caller.

for (let i = 0, len = myFiles.length; i < len; i++)
  render1(myFiles[i], 'utf-8'); // [5, 45...]

// 2) Alternatively, providing the child thunk caller to the parent generator.
//    Requires explicitly telling the generator it is parent of a thunk.
// const readFile = thunkify.factory(gnReadFile);
// const gnRender2 = thunkify.generatorFactory(readFile, fnRender, true);
// const render2 = thunkify.factory(gnRender2); 
// for (let i = 0, len = myFiles.length; i < len; i++)
//   render2(myFiles[i], 'utf-8');