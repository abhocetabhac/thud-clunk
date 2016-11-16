/*
Node.js Module thunkify

Converts node's asynchronous IO functions to thunks. The thunks can then
be use like synchronous functions in try/catch error scheme while preserving
the non-blocking advantages.

Inspired in "https://strongloop.com/strongblog/how-to-generators-node-js-yield-use-cases/".
*/

// Generate helper functions to test variable types:
// "isArguments", "isFunction", "isString", "isNumber", "isDate", "isRegExp",
// "isGeneratorFunction", "isUndefined".
// ['Arguments', 'Function', 'String', 'Number', 'Date',
//   'RegExp', 'GeneratorFunction', 'Undefined'].forEach(function(type) { 
//     const gEval = eval; // Run "eval" in the scope of the global object.
//     gEval(`function is${type}(obj) { 
//       return Object.prototype.toString.call(obj) === '[object ${type}]'; 
//     };`, module);
// });
['Arguments', 'Function', 'String', 'Number', 'Date',
  'RegExp', 'GeneratorFunction', 'Undefined'].forEach(function(type) { 
    (module || global || window)['is' + type] = function(obj) {
      return Object.prototype.toString.call(obj) === `[object ${type}]`;
    }; 
});

// thunkify
// ES6 version   
function thunkify(asyncIoFn) { 
  return function tkPre(_cbNext) { // [10, 27] Return the thunk provider of "readfile". 
    return function thunk(...args) { // [16, 29] Return the thunk per se of "readfile". 
      args.push(_cbNext); // [20, 33]
      de&&bug('asynvIoFn args =', args);
      asyncIoFn.apply(this, args); // [21, 34, 39]
      return; // [35, ]
    };
  };
}

const cl_cbNext = function(itGen) {
  // "_cbNext()" is the recursive callback function that retro-feeds the "yield"s
  // in the generator function "genFn" called from function "run". It iterates
  // through the post-processing functions provided to the generator.
  return function _cbNext(err = null, io = null) { 
    let more;
    if (err) // Let the generator lead with exceptions too.
      more = itGen.throw(err); // more = {done: true, value: [Err]} . The assignment to "more" is unnecessary. Just "return itGen.throw(err);" would also work fine.
    else 
      more = itGen.next(io); 
    de&&bug('more =', more);
    if (more.done)
      return more.value; // Just "return;" would also work fine. When using nested thunk wrappers, this will return "more.value" to the deeper generator function, but could not devise an application for that. [..18] Begin reversing the callback recursion ending to the asynchronous IO operation.
    return _cbNext(null, more.value); // Just "_cbNext(null, more.value)" would also work fine. When using nested thunk wrapper, this will return "more.value" to the deeper "_cbNext", but could not devise an application for that. [11] Call "fs.readFile" thunk.
  };
};

thunkify.run = function run(genFn, fnPreProcess, ...args) {
  const itGen = genFn(args); // Each instance of the generator corresponds to an iterator. That is vital to allow running multiple instances simultaneously, each step (next()/yield) independently.
  const fnToThunkify = itGen.next().value;
  const tkPre = thunkify(fnToThunkify);
  let _cbNext = cl_cbNext(itGen);
  const thunk = tkPre(_cbNext);
  args = itGen.next(fnPreProcess).value;
  de&&bug('thunk args =', args);
  thunk(...args);
};

// Produces thunk wrappers.
thunkify.factory = function factory(genFn, fnPreProcess) { // Produces thunk wrappers.
  return function wrapper(...args) {
    return thunkify.run(genFn, fnPreProcess, ...args);
  };
};

// Produces standard generator functions
thunkify.generatorFactory =
  function generatorFactory(fnToThunkifyOrGnChild, ...fnsPostProcess) {
    let fnToThunkify; // "fnToThunkify" may be an asynchronous IO function or a thunk wrapper returned by "thunkify.factory".
    if (module.isGeneratorFunction(fnToThunkifyOrGnChild)) {
      fnToThunkify = thunkify.factory(fnToThunkifyOrGnChild);
    } else if (module.isFunction(fnToThunkifyOrGnChild)) {
      fnToThunkify = fnToThunkifyOrGnChild;
    } else {
      console.error(`DevError: method "thunkify.generatorFactory" requires a function or generator\nfunction as paramater "fnToThunkifyOrGnChild", but instead recieved "${typeof fnToThunkifyOrGnChild}".\nIgnoring. Using "fnToThunkify = () => {}".`);
      fnToThunkify = () => {};
    }
    for (let i = 0, leni = fnsPostProcess.length; i < leni; i++) {
      if (!module.isFunction(fnsPostProcess[i])) {
        console.error(`DevError: method "thunkify.generatorFactory" requires functions for\npostprocessing as paramaters "...fns", but instead recieved "${fns[i]}".\nSuppressing bad type argument.`);
        fnsPostProcess.splice(i,1);
        i--, leni--;
      }
    }
    return function* genFn (args) {
      let fns = fnsPostProcess.slice(0); // Creating a fresh copy of "fnsPostProcess" is sine qua non to allow running multiple instances simultaneously, otherwise "fns" would add up for each instance because it would be a reference to "fnsPostProcess", which is accessible and preserved in the closure. 
      de&&bug('args to gen =', args);
      // if (module.isFunction(args[args.length-1])   // Detect a nested thunk wrapper being called
      //   && args[args.length-1].name === '_cbNext') // and captures the callback of the parent.
      //   fns.push(args.pop()); // The adopted child (typically the true async IO thunk wrapper) must call the parent's callback at the end to pass on the IO result (-Mom, I've finished!).
      de&&bug('fns =', fns);
      for (let i = 0, leni = args.length; i < leni; i++) { // Scan "args" for additional post-processing function.
        if (module.isFunction(args[i])) { // Place any function found in "args" in the same order
          fns.push(args.splice(i,1)[0]);  // at end of post-processing functions array.
          i--, leni--; // Notice: There is no need to explicitly detect the calling of nested thunk wrappers, because the parent's callback (its "_cbNext")
        }              // is automatically passed as the last item in "args" of the adopted child (typically the true async IO thunk wrapper).
      }                // Thus, the parent's "_cbNext" is correctly placed as the last post-processing function of the adopted child to pass on the IO result (-Mom, I've finished!).
      de&&bug('fns =', fns);
      let fnPreProcess = yield fnToThunkify;
      de&&bug('fnPreProcess =', fnPreProcess);
      if (!module.isUndefined(fnPreProcess)) {
        if (module.isFunction(fnPreProcess)) {
          let argsTmp = fnPreProcess(args);
          if (Array.isArray(argsTmp))
            args = argsTmp;
          else
            console.error(`DevError: the function passed as argument "fnPreProcess" to "thunkify.factory"\nmust return an "array", but instead recieved "${typeof argsTmp}".\nIgnoring bad argument to method "thunkify.factory".`);
        } else {
          console.error(`DevError: "fnPreProcess" must be a function passed to the generator function\nfor preprocessing "args" array before sending it to the thunk, but instead recieved "${fnPreProcess}".\nIgnoring bad argument to method "thunkify.factory".`);
        }
      }
      let io;
      let err = null;
      let j = 0, lenj = fns.length;
      try { // The "thunk" is called implicitly from this "try". Exception are caught below.
        io = yield args; // Yield the preprocessed "args" array and wait for "io" data to be received.
      }
      catch (error) { // Errors from the thunk are delegate by its callback to the generator.
        if (lenj === 0) {
          console.error(`DevWarning: no post-processing function has been provided to the generator\nfunction "${genFn.name}" in module "${module.id}".\nIncidentaly, it is unknown how to treat exceptions:`);
          console.error(error);
          return error; // Return to "{done: true, value: [error]}" to" "itGen.throw(err)" in function "_cbNext". It is unnecessary, just good practice.
        }
        err = error;
      } 
      for (; j < lenj; j++) {
        try {
          de&&bug(`Post-processing "${fns[j].name}" at (j=${j}, lenj=${lenj}).`);
          io = yield fns[j](err, io); // If an error is thrown from "fns[j]", it will be caught below and the "yield" will not occur.
          if (err) de&&bug(`Warning: "${fns[j].name}" recovered from error:\n\tcode="${err.code}" ("${module.filename.match(/\/(\w+$|[^/\0:*?|\"<>,;&%]+$)/)[1]}" at j=${j}, lenj=${lenj}).`);
          err = null; // Recover from error.
        } catch (error) { // "fns[j]" could not recover from error passed to it or raised an exception by its own. 
          if (error.recoverable) {
            de&&bug(`Warning: recoverable error in post-processing function:\n\t"${fns[j].name}" ("${module.filename.match(/\/(\w+$|[^/\0:*?|\"<>,;&%]+$)/)[1]} at "j=${j}, lenj=${lenj}).`);
            err = error;
          } else {
            de&&bug(`Warning: UNRECOVERABLE error in post-processing function:\n\t"${fns[j].name}" ("${module.filename.match(/\/(\w+$|[^/\0:*?|\"<>,;&%]+$)/)[1]} at j=${j}, lenj=${lenj}).`);
            console.error(error.stack);
            break;
          }
        }
      }
      return err ? err : io;
    };
  };

let de = false;
const bug = console.log;

thunkify.debug = function debug(toggle = false) {
  de = toggle;
};

module.exports = thunkify;
