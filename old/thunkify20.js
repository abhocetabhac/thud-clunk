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
    let more = itGen.next(result); 
    console.log('more =', more);
    if (more.done)
      return; // [..18] Begin reversing the callback recursion ending to the asynchronous IO operation.
    cbNext(null, more.value); // [11] Call "fs.readFile" thunk.
  }
};

thunkify.run = function run(genFn, ...args) {
  const itGen = genFn(...args); 
  const fnToThunkify = itGen.next().value;
  const tkProvider = thunkify(fnToThunkify);
  let cbParent;
  if (module.isFunction(args[args.length - 1]))
    cbParent = args.pop();
  const thunk = tkProvider(...args);
  let cbNext = clCbNext(itGen);
  itGen.next(cbParent);
  thunk(cbNext);
  //cbNext(null, cbNext); // [12]
  //return cbNext; // []
};

// Produces thunk wrappers.
thunkify.factory = function factory(genFn) { // Produces thunk wrappers.
  return function wrapper(...args) {
    return thunkify.run(genFn, ...args);
  };
};

// Produces standard generator functions
thunkify.generatorFactory =
  function generatorFactory(fnToThunkifyOrGnChild, fn) {
    let fnToThunkify; // "fnToThunkify" may be an asynchronous IO function or a thunk wrapper returned by "thunkify.factory".
    if (module.isGeneratorFunction(fnToThunkifyOrGnChild)) {
      fnToThunkify = thunkify.factory(fnToThunkifyOrGnChild);
    } else if (module.isFunction(fnToThunkifyOrGnChild)) {
      fnToThunkify = fnToThunkifyOrGnChild;
    } else {
      process.exitCode = 2;
      throw new Error(`DevError: method "thunkify.generatorFactory" requires a function or generator function as paramater "fnToThunkifyOrGnChild", but instead recieved a "${typeof fnToThunkifyOrGnChild}".`);
    }
    return function* (...args){
      let io;
      const cbParent = yield fnToThunkify;
      try {
        io = yield; 
        module.isFunction(fn) ? (io = fn(null, io)) : void 0;
        module.isFunction(cbParent) ? (cbParent(null, io)) : void 0;
      } catch (err) { // Errors from the thunk are delegate by its callback to the generator.
        module.isFunction(fn) ? (err = fn(err, null)) : void 0;
        module.isFunction(cbParent) ? cbParent(err, null) : void 0;
      }  
      return io;
    };
  };

module.exports = thunkify;


