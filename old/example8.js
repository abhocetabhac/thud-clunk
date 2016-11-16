// Usage:
//   node ./example8 testfile2.txt testfile1.txt
//
// Nested thunks.

const myFiles = process.argv.slice(2);

const
  fs = require('fs'),
  thunkify = require('./thunkify8');

// Generate helper functions to test variable types:
// "isArguments", "isFunction", "isString", "isNumber", "isDate", "RegExp".
['Arguments', 'Function', 'String', 'Number', 'Date', 'RegExp'].forEach( 
  function(type) { 
    (module || global || window)['is' + type] = function(obj) {
      return Object.prototype.toString.call(obj) == `[object ${type}]`;
    }; 
});

const generatorFactory =
  function generatorFactory(fnToThunkify, fn, isParent = false) {
  return function* (...args){
    const tkProvider = thunkify(fnToThunkify);
    let 
      io,
      cbChild; 
    const cbSelf = yield;
    try {
      if (isParent) {
        io = yield tkProvider(cbSelf, ...args);
        module.isFunction(fn) ? fn(io) : void 0;
      }
      else {
        let cbParentGn = args[0];
        args = args.slice(1);
        io = yield tkProvider(...args); // [28] Obtain the thunk per se of "fs.readfile".
                                                 // [30] Freeze the execution of the generator returning (yielding) the thunk that effectively calls "fs.readfile".
                                                 // [..15] Execution is regained and "input" is assigned with the "result" passed from the callback of "fs.readfile".
        module.isFunction(cbParentGn) ? cbParentGn(null, io) : void 0; // [..16]
      }
    } catch (err) { // Errors from "fs.readFile" are delegate by its callback to the generator.
      module.isFunction(cbParentGn) ? cbParentGn(err, null) : void 0;
    }  
    return io;
  };
};

const gnReadFile = generatorFactory(fs.readFile);
const readFile = thunkify.factory(gnReadFile);

const fnRender = function(input) {
  console.log(input);
};
const gnRender = generatorFactory(readFile, fnRender, true);
const render = thunkify.factory(gnRender); // Named thunk caller.

for (let i = 0, len = myFiles.length; i < len; i++)
  render(myFiles[i], 'utf-8'); // [5, 45...]
