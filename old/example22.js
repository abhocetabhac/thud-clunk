// Usage:
//   node ./example22 testfile2.txt testfile1.txt
//
// Nested thunks.

const myFiles = process.argv.slice(2);

const
  fs = require('fs'),
  thunkify = require('./thunkify22');

const fnReadFile = function (err = null, input = null) {
  if (err) { // Errors from "fs.readFile" are delegate by its callback to the generator.
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
const gnReadFile = thunkify.generatorFactory(fs.readFile);

const fnRender = function(err = null, input = null) {
  if (err) {
    if (process.exitCode > 1)
      console.error(err.message)
    else
      console.error(err.stack);
    return err;
  } else { 
    console.log('fnRender:');
    console.log(input);
    return input;
  } 
};

const fn1 = function(err = null, input = null) {
  if (err) {
    if (process.exitCode > 1)
      console.error(err.message)
    else
      console.error(err.stack);
    return err;
  } else { 
    console.log('fn1:');
    console.log(input);
    return input;
  } 
};
const fn2 = function(err = null, input = null) {
  if (err) {
    if (process.exitCode > 1)
      console.error(err.message)
    else
      console.error(err.stack);
    return err;
  } else { 
    console.log('fn2:');
    console.log(input);
    return input;
  } 
};
// Nesting thunks may be implemented in two way:
//1) Directly providing the child generator to the parent one.
// const gnRender1 = thunkify.generatorFactory(gnReadFile);
// const render1 = thunkify.factory(gnRender1); // Named thunk wrapper.
// for (let i = 0, len = myFiles.length; i < len; i++)
//   render1(myFiles[i], 'utf-8', fnRender); // [5, 45...]

// 2) Alternatively, providing the child thunk wrapper to the parent generator.
//    Requires explicitly telling the generator it is parent of a thunk.
const readFile = thunkify.factory(gnReadFile, fnReadFile);
const gnRender2 = thunkify.generatorFactory(readFile);
const render2 = thunkify.factory(gnRender2, fn1, fnRender, fn2); 
for (let i = 0, len = myFiles.length; i < len; i++)
  render2(myFiles[i], 'utf-8');