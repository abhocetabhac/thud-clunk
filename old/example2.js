// Usage:
//   node ./example2 testfile1.txt
//
// Generator function calling a callback function.


const myFile = process.argv.slice(2)[0];

const
  fs = require('fs'),
  thunkify = require('./thunkify');

// Generate helper functions to test variable types:
// "isArguments", "isFunction", "isString", "isNumber", "isDate", "RegExp".
['Arguments', 'Function', 'String', 'Number', 'Date', 'RegExp'].forEach( 
  function(type) { 
    (module || global || window)['is' + type] = function(obj) {
      return Object.prototype.toString.call(obj) == `[object ${type}]`;
    }; 
});

const gnReadFile = function*(cb, filepath, ...args) {
  let input;
  const tkReadFile = thunkify(fs.readFile); // [5] Obtain the thunk provider of "fs.readfile".
  try {
    if (!module.isFunction(cb)) {
      throw new Error(`generator function "gnReadFile" requires a \
function as paramater "cb", but instead recieved a "${typeof cb}".`);
   }
    if (!module.isString(filepath)) {
      throw new Error(`generator function "gnReadFile" requires a \
string as paramater "filepath", but instead recieved a "${typeof filepath}".`);
    }
    input = yield tkReadFile(filepath, ...args); // [7] Obtain the thunk per se of "fs.readfile".
                                                 // [9] Freeze the execution of the generator returning (yielding) the thunk that effectively calls "fs.readfile".
                                                 // [..15] Execution is regained and "input" is assigned with the "result" passed from the callback of "fs.readfile".
  } catch (err) { // Errors from "fs.readFile" are delegate by its callback to the generator.
    console.error(err.stack);
    process.exit(1);
  }
  cb(input); // [..16]
  // Or
  // // Helper ending function useful to do some extra processing before passing
  // // the "input" to "cb".
  // const fileIsAvailable = function() {
  //   cb(input);
  // }
  // yield fileIsAvailable; // [..16] 
}; 

{
  const readFileEnded = function(contents) {
    console.log(contents); // Print the input buffer as is, i.e., in raw or as encoded string if read so.
    console.log(contents.toString('utf8')); // Convert to UTF-8 encoded string if "content" was a raw buffer.
  };

  const readFile = thunkify.factory(gnReadFile); // Named thunk caller.
  readFile(readFileEnded, myFile, 'utf-8');
}
