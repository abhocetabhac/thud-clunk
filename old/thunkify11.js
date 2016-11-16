/*
Node.js Module thunkify

Converts node's asynchronous IO functions to thunks. The thunks can then
be use like synchronous functions in try/catch error scheme while preserving
the non-blocking advantages.

Inspired in "https://strongloop.com/strongblog/how-to-generators-node-js-yield-use-cases/".
*/

// Generate helper functions to test variable types:
// "isArguments", "isFunction", "isString", "isNumber", "isDate", "isRegExp",
// "isGeneratorFunction".
['Arguments', 'Function', 'String', 'Number', 'Date',
  'RegExp', 'GeneratorFunction'].forEach(function(type) { 
    (module || global || window)['is' + type] = function(obj) {
      return Object.prototype.toString.call(obj) == `[object ${type}]`;
    }; 
});

// thunkify
// ES6 version   
function thunkify(asyncIoFn) { 
  return function(...args) { // [10, 27] Return the thunk provider of "readfile". 
    return function(cbNext) { // [16, 29] Return the thunk per se of "readfile". 
      args.push(cbNext); // [20, 33]
      console.log('Thunk called.');
      let cbChild = asyncIoFn.apply(this, args); // [21, 34, 39]
      console.log('Thunk returning.', 'cbChild =', cbChild);
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

thunkify.run = function run(genFn, ...args) {
  console.log('thunkify.run');
  let itGen = genFn(...args); // [7] Setup the function generator, but execute none of it.
  let cbNext = clCbNext(itGen);
  let fnToThunkify = itGen.next().value;
  const tkProvider = thunkify(fnToThunkify);
  //let cbChild = itGen.next(tkProvider).value; // [8] Start the recursive "gen.next()" calls.
  const isAdopted = itGen.next(tkProvider).value;
  console.log('isAdopted =',isAdopted);
          if (isAdopted) {
          // If the generator function is made child of another (is adopted),
          // it gets the  obligation of calling the parent's callback to alert
          // it when finished. (-Mom, I've finished!)
          console.log('I am here 2.');
          cbParentGn = args[0];
          args = args.slice(1);
          io = yield tkProvider(...args); // [28] Obtain the thunk per se of "fs.readfile".
                                                  // [30] Freeze the execution of the generator returning (yielding) the thunk that effectively calls "fs.readfile".
                                                 // [..15] Execution is regained and "input" is assigned with the "result" passed from the callback of "fs.readfile".
          console.log('I am here 3.');
          module.isFunction(fn) ? (io = fn(io)) : void 0;
          module.isFunction(cbParentGn) ? cbParentGn(null, io) : void 0; // [..16]
        } else {
          //const cbSelf = yield;
          console.log('I am here 1.');
          io = yield tkProvider(cbSelf, ...args);
          console.log('I am here 4.');
          module.isFunction(fn) ? fn(io) : void 0;
          console.log('I am here 5.');
        }
  cbNext(null, cbNext); // [12]
  //itGen.next(cbNext);
  return cbNext; // []
};

thunkify.factory = function factory(genFn) {
  return function(...args) {
    return thunkify.run(genFn, ...args);
  };
};

thunkify.generatorFactory =
  function generatorFactory(fnToThunkifyOrGnChild, fn, isParent = false) {
    console.log(arguments);
    let fnToThunkify;
    if (module.isGeneratorFunction(fnToThunkifyOrGnChild)) {
      fnToThunkify = thunkify.factory(fnToThunkifyOrGnChild);
      console.log(Object.prototype.toString.call(fnToThunkifyOrGnChild));
      isParent = true;
    } else {
      fnToThunkify = fnToThunkifyOrGnChild;
    }
    const isAdopted = !isParent;
    return function* (...args){
      let io;
      let cbParentGn;
      tkProvider = yield fnToThunkify;
      const cbSelf = yield isAdopted;
      try {
        // if (isAdopted) {
        //   // If the generator function is made child of another (is adopted),
        //   // it gets the  obligation of calling the parent's callback to alert
        //   // it when finished. (-Mom, I've finished!)
        //   console.log('I am here 2.');
        //   cbParentGn = args[0];
        //   args = args.slice(1);
        //   io = yield tkProvider(...args); // [28] Obtain the thunk per se of "fs.readfile".
        //                                           // [30] Freeze the execution of the generator returning (yielding) the thunk that effectively calls "fs.readfile".
        //                                          // [..15] Execution is regained and "input" is assigned with the "result" passed from the callback of "fs.readfile".
        //   console.log('I am here 3.');
        //   module.isFunction(fn) ? (io = fn(io)) : void 0;
        //   module.isFunction(cbParentGn) ? cbParentGn(null, io) : void 0; // [..16]
        // } else {
        //   //const cbSelf = yield;
        //   console.log('I am here 1.');
        //   io = yield tkProvider(cbSelf, ...args);
        //   console.log('I am here 4.');
        //   module.isFunction(fn) ? fn(io) : void 0;
        //   console.log('I am here 5.');
        // }
      } catch (err) { // Errors from "fs.readFile" are delegate by its callback to the generator.
        module.isFunction(cbParentGn) ? cbParentGn(err, null) : void 0;
      }  
      return io;
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
