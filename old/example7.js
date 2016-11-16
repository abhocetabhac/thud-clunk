// Usage:
//   node ./example5 testfile.txt testfile1.txt
//
// Nested thunks.

const myFiles = process.argv.slice(2);

const
  fs = require('fs'),
  thunkify = require('./thunkify7');

// Generate helper functions to test variable types:
// "isArguments", "isFunction", "isString", "isNumber", "isDate", "RegExp".
['Arguments', 'Function', 'String', 'Number', 'Date', 'RegExp'].forEach( 
  function(type) { 
    (module || global || window)['is' + type] = function(obj) {
      return Object.prototype.toString.call(obj) == `[object ${type}]`;
    }; 
});

const gnReadFile = function*(itParent, filepath, ...args) {
  const tkFsReadFile = thunkify(fs.readFile); // [26] Obtain the thunk provider of "fs.readfile".
  let input;
  try {
    if (!module.isString(filepath)) {
      process.exitCode = 2
      throw new Error(`Error: generator function "gnReadFile" requires a string as paramater "filepath", but instead recieved a "${typeof filepath}".`);
    }
    console.log('I am here 1');
    input = yield tkFsReadFile(filepath, ...args); // [28] Obtain the thunk per se of "fs.readfile".
                                                 // [30] Freeze the execution of the generator returning (yielding) the thunk that effectively calls "fs.readfile".
                                                 // [..15] Execution is regained and "input" is assigned with the "result" passed from the callback of "fs.readfile".
    console.log(input);
    console.log('I am here 2');
    //itParent.next(input); // [..16]
  } catch (err) { // Errors from "fs.readFile" are delegate by its callback to the generator.
    if (err.code === "ENOENT") {
      process.exitCode = 3;
      err.message = `Error: failed to find file "${filepath}".`;
    }
    itParent.throw(err);
  }  
  return input;
}; 

const readFile = thunkify.factory(gnReadFile); // [1]

const gnRender = function*(filepath, ...args) {
  const tkReadFile = thunkify(readFile); // [9] Obtain the thunk provider of "fs.readfile".
  let
    cbChild,
    input;
  let itSelf = yield; // [11, 14]
  try {
    if (!module.isString(filepath)) {
      process.exitCode = 4;
      throw new Error(`Error: generator function "gnRender" requires a string as paramater "filepath", but instead recieved a "${typeof filepath}".`);
    }
    cbChild = yield tkReadFile(itSelf, filepath, ...args); // [15] Obtain the thunk per se of "fs.readfile".
                                                 // [17] Freeze the execution of the generator returning (yielding) the thunk that effectively calls "fs.readfile".
                                                 // [..42] Execution is regained and "input" is assigned with the "result" passed from the callback of "fs.readfile".
    console.log(cbChild); // [43]
    //input = cbChild(null);
    input = yield cbChild; // [44]
    console.log(input);
  } catch (err) { // Errors from "fs.readFile" are delegate by its callback to the generator.
    if (process.exitCode > 1)
      console.error(err.message)
    else
      console.error(err.stack);
  }
  return;
}

const render = thunkify.factorySelfAware(gnRender); // [3] 

for (let i = 0, len = myFiles.length; i < len; i++)
  render(myFiles[i], 'utf-8'); // [5, 45...]
