// Usage:
//   node ./example21 testfile2.txt testfile1.txt
//
// Nested thunks.

const myFiles = process.argv.slice(2);

const
  fs = require('fs'),
  thunkify = require('./thunkify21');

const fnReadFile = function(err = null, input = null) {
  if (err) {
    if (err.code === "ENOENT") {
      process.exitCode = 2;
      let filepath = err.message.match(/'(.*)'/)[1]; 
      err.message = `Error: failed to find file "${filepath}".`;
    }
    return err;
  } else { 
    return input;
  }  
};
const gnReadFile = thunkify.generatorFactory(fs.readFile, fnReadFile);

const fnRender = function(err = null, input = null) {
  if (err) {
    if (process.exitCode > 1)
      console.error(err.message)
    else
      console.error(err.stack);
    return err;
  } else { // Errors from "fs.readFile" are delegate by its callback to the generator.
    console.log('');
    console.log(input);
  } 
};
// Nesting thunks may be implemented in two way:
//1) Directly providing the child generator to the parent one.
const gnRender1 = thunkify.generatorFactory(gnReadFile, fnRender);
const render1 = thunkify.factory(gnRender1); // Named thunk wrapper.
for (let i = 0, len = myFiles.length; i < len; i++)
  render1(myFiles[i], 'utf-8'); // [5, 45...]

// 2) Alternatively, providing the child thunk wrapper to the parent generator.
//    Requires explicitly telling the generator it is parent of a thunk.
const readFile = thunkify.factory(gnReadFile);
const gnRender2 = thunkify.generatorFactory(readFile, fnRender, true);
const render2 = thunkify.factory(gnRender2); 
for (let i = 0, len = myFiles.length; i < len; i++)
  render2(myFiles[i], 'utf-8');