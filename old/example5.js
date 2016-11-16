// Usage:
//   node ./example4 testfile.txt testfile1.txt
//
// Nested thunks.

const myFiles = process.argv.slice(2);

const
  fs = require('fs'),
  thunkify = require('./thunkify5');

// Generate helper functions to test variable types:
// "isArguments", "isFunction", "isString", "isNumber", "isDate", "RegExp".
['Arguments', 'Function', 'String', 'Number', 'Date', 'RegExp'].forEach( 
  function(type) { 
    (module || global || window)['is' + type] = function(obj) {
      return Object.prototype.toString.call(obj) == `[object ${type}]`;
    }; 
});

const gnReadFile = function*(itParent, filepath, ...args) {
  const tkFsReadFile = thunkify(fs.readFile); // [5] Obtain the thunk provider of "fs.readfile".
  let input;
  try {
    if (!module.isString(filepath)) {
      process.exitCode = 2
      throw new Error(`Error: generator function "gnReadFile" requires a string as paramater "filepath", but instead recieved a "${typeof filepath}".`);
    }
    input = yield tkFsReadFile(filepath, ...args); // [7] Obtain the thunk per se of "fs.readfile".
                                                 // [9] Freeze the execution of the generator returning (yielding) the thunk that effectively calls "fs.readfile".
                                                 // [..15] Execution is regained and "input" is assigned with the "result" passed from the callback of "fs.readfile".
    itParent.next(input); // [..16]
  } catch (err) { // Errors from "fs.readFile" are delegate by its callback to the generator.
    if (err.code === "ENOENT") {
      process.exitCode = 3;
      err.message = `Error: failed to find file "${filepath}".`;
    }
    itParent.throw(err);
  }  
}; 

const readFile = thunkify.factory(gnReadFile); // Named thunk caller.

const gnRender = function*(filepath, ...args) {
  const tkReadFile = thunkify(readFile); // [5] Obtain the thunk provider of "fs.readfile".
  let input;
  let itSelf = yield; 
  try {
    if (!module.isString(filepath)) {
      process.exitCode = 4;
      throw new Error(`Error: generator function "gnRender" requires a string as paramater "filepath", but instead recieved a "${typeof filepath}".`);
    }
    input = yield tkReadFile(itSelf, filepath, ...args); // [7] Obtain the thunk per se of "fs.readfile".
                                                 // [9] Freeze the execution of the generator returning (yielding) the thunk that effectively calls "fs.readfile".
                                                 // [..15] Execution is regained and "input" is assigned with the "result" passed from the callback of "fs.readfile".
    console.log(input); // [..16]
  } catch (err) { // Errors from "fs.readFile" are delegate by its callback to the generator.
    if (process.exitCode > 1)
      console.error(err.message)
    else
      console.error(err.stack);
  }
}

const render = thunkify.factory(gnRender, true); // Named thunk caller.

for (let i = 0, len = myFiles.length; i < len; i++)
  render(myFiles[i], 'utf-8');
