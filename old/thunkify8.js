/*
Node.js Module thunkify

Converts node's asynchronous IO functions to thunks. The thunks can then
be use like synchronous functions in try/catch error scheme while preserving
the non-blocking advantages.

Inspired in "https://strongloop.com/strongblog/how-to-generators-node-js-yield-use-cases/".
*/

const isFunction = function(obj) {
  return (Object.prototype.toString.call(cbChild) === '[object Function]');
};

// thunkify
// ES6 version   
function thunkify(asyncIoFn) { 
  return function(...args) { // [10, 27] Return the thunk provider of "readfile". 
    return function(cbNext) { // [16, 29] Return the thunk per se of "readfile". 
      args.push(cbNext); // [20, 33]
      let cbChild = asyncIoFn.apply(this, args); // [21, 34, 39]
      //if (isFunction(cbChild))
      //  cbNext(null, cbChild); // [40] "asyncIoFn" is not really an async IO function, but came from the "return cbNext;" in "thunkify.run()" ("cbManually != cbNext").
      return; // [35, ]
    };
  };
}

const clCbNext = function(itGen) {
  // "cbNext()" is the recursive callback function that retro-feeds the "yield"s
  // in the function generator "genFn" called from function "run". 
  return function cbNext(err = null, result = null) { 
    if (err) // Let the generator lead with exceptions on its own.
      return itGen.throw(err);
    let more = itGen.next(result); // [4] Execute the generator for the first time. "result" is ignored.
                                 // [10] "more = {value: <fs.readFile thunk>, done: false}". 
                                 // [..14] Now running as callback of "fs.readFile", call the generator a second time and deliver the "result" to it.
                                 // [..17] "more = {value: undefined, done: true}". 
    if (more.done)
      return; // [..18] Begin reversing the callback recursion ending to the asynchronous IO operation.
    (more.value)(cbNext); // [11] Call "fs.readFile" thunk.
    return;
  }
};

thunkify.run = function(genFn, ...args) {
  let itGen = genFn(...args); // [7] Setup the function generator, but execute none of it.
  let cbNext = clCbNext(itGen);
  itGen.next(); // [8] Start the recursive "gen.next()" calls.
  cbNext(null, cbNext); // [12]
  //itGen.next(cbNext);
  return cbNext; // []
};

thunkify.factory = function factory(genFn) {
  return function(...args) {
    return thunkify.run(genFn, ...args);
  };
};

module.exports = thunkify;

/*
// Simple usage example to ilustrate the implementation logic.
// Follow up the numeration aside in square brackets to grasp the
// logical sequence.

const myFile = process.argv.slice(2)[0];

const
  fs = require('fs'),
  thunkify = require('./thunkify');

const gnReadFile = function*(filename, ...args) {
  let input;
  const tkReadFile = thunkify(fs.readFile); // [5] Obtain the thunk provider of "fs.readfile".
  try {
    input = yield tkReadFile(filename, ...args); // [7] Obtain the thunk per se of "fs.readfile".
                                                 // [9] Freeze the execution of the generator returning (yielding) the thunk that effectively calls "fs.readfile".
                                                 // [..15] Execution is regained and "input" is assigned with the "result" passed from the callback of "fs.readfile".
  }
  catch (err) { // Errors from "fs.readFile" are delegate by its callback to the generator.
    console.error('Oops!');
    throw err;
  } 
  console.log(''); 
  console.log(input); // [..16] Output the retrieved raw buffer or encoded string to console.
  console.log(input.toString('utf8')); // Output the encoded string to console.
}; 

// First usage alternative - anonymous thunk calling
const run = thunkify.run;
run(gnReadFile, myFile); // [3]

// Second usage alternative - named thunk caller
const readFile1 = (function(){
  return (...args) => {thunkify.run(gnReadFile, ...args);} ;
}());
readFile1(myFile);

// Third usage alternative - named thunk caller (suggested way)
const readFile2 = thunkify.factory(gnReadFile);
readFile2(myFile, 'utf-8');
*/
