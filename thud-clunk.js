/*
Node.js Module thunkify

Converts node's asynchronous IO functions to thunks. Each thunk is implicitly
used in tandem with a generator function that applies try/catch error scheme
while preserving the non-blocking advantages.

Inspired in "https://strongloop.com/strongblog/how-to-generators-node-js-yield-use-cases/".
*/

// Some ANSI terminal colors
const 
  RST = '\x1b[0m',  // reset
  RED = '\x1b[31m',
  GRE = '\x1b[32m',
  YEL = '\x1b[33m',
  BLU = '\x1b[34m',
  MAG = '\x1b[35m',
  CYA = '\x1b[36m';
const SECOND_LINE = /(?:(?:\r\n?)|\n|\u2028|\u2029)(?:(.*)(?:(?:\r\n?)|\n|\u2028|\u2029))/;
const FOUR_LINES = /^(?:(.*)(?:(?:\r\n?)|\n|\u2028|\u2029)){0,4}/;

// Generate helper functions to test variable types:
// "isArguments", "isFunction", "isString", "isNumber", "isDate", "isBoolean",
// "isRegExp", "isGeneratorFunction", "isGenerator", "isUndefined".
// ['Arguments', 'Function', 'String', 'Number', 'Date', 'RegExp', 
//   'GeneratorFunction', 'Generator','Undefined'].forEach(function(type) { 
//     const gEval = eval; // Run "eval" in the scope of the global object.
//     gEval(`function is${type}(obj) { 
//       return Object.prototype.toString.call(obj) === '[object ${type}]'; 
//     };`, module);
// });
['Arguments', 'Function', 'String', 'Number', 'Date', 'Boolean', 'RegExp',
  'GeneratorFunction', 'Generator', 'Undefined'].forEach(function(type) { 
    (module || global || window)['is' + type] = function(obj) {
      return Object.prototype.toString.call(obj) === `[object ${type}]`;
    }; 
});
const m = module || global || window;

// thunkify
// ES6 version   
function thunkify(asyncIoFn) { 
  return function tkPre(_cbNext) { // Return the thunk provider. 
    return function thunk(...args) { // Return the thunk per se. 
      args.push(_cbNext); 
      de&&bug(CYA+'asyncIoFn args ='+RST, args);
      asyncIoFn.apply(this, args); 
      return; 
    };
  };
}

const cl_cbNext = function(itGen) {
  // "_cbNext()" is the recursive callback function that retro-feeds the "yield"s
  // in the generator function "genFn" called from function "run". It iterates
  // through the post-processing functions provided to the generator.
  return function _cbNext(err = null, io = null) { 
    let more;
    if (err) { // Let the generator lead with exceptions too.
      if (io) // Only for nested thunk callers: a recoverable error occurred in the last post-processing function of the adopted child thunk caller.
        err.recoverable = io;
      more = itGen.throw(err); // more = {done: true, value: [Err]} . The assignment to "more" is unnecessary. Just "return itGen.throw(err);" would also work fine.
    } else 
      more = itGen.next(io); 
    de&&bug(CYA+'more ='+RST, more);
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
  de&&bug(CYA+'thunk args ='+RST, args);
  thunk(...args);
};

// Produces thunk wrappers.
thunkify.factory = function factory(genFn, fnPreProcess) { // Produces thunk wrappers.
  return function tkWrapper(...args) {
    return thunkify.run(genFn, fnPreProcess, ...args);
  };
};

// Produces standard generator functions
thunkify.generatorFactory =
  function generatorFactory(fnToThunkifyOrGnChild, ...fnOrItPostProcess) {
    let fnToThunkify; // "fnToThunkify" may be an asynchronous IO function or a thunk wrapper returned by "thunkify.factory".
    if (m.isGeneratorFunction(fnToThunkifyOrGnChild)) {
      fnToThunkify = thunkify.factory(fnToThunkifyOrGnChild);
    } else if (m.isFunction(fnToThunkifyOrGnChild)) {
      fnToThunkify = fnToThunkifyOrGnChild;
    } else {
      console.error(`${RED}DevError:${CYA} method "thunkify.generatorFactory" requires a function or generator\nfunction as paramater "fnToThunkifyOrGnChild", but instead recieved "${typeof fnToThunkifyOrGnChild}".\nIgnoring. Using "fnToThunkify = () => {}". ("${m.filename.match(/\/(\w+$|[^/\0:*?|\"<>,;&%]+$)/)[1]}")${RST}`);
      fnToThunkify = () => {};
    }
    for (let i = 0, leni = fnOrItPostProcess.length; i < leni; i++) {
      if (!(m.isFunction(fnOrItPostProcess[i]) || m.isGenerator(fnOrItPostProcess[i]))) {
        console.error(`${RED}DevError:${CYA} method "thunkify.generatorFactory" requires functions or iterators\nfor post-processing as paramaters "...fnsPostProcess", but instead recieved "${fns[i]}".\nSuppressing bad type argument. ("${m.filename.match(/\/(\w+$|[^/\0:*?|\"<>,;&%]+$)/)[1]}")${RST}`);
        fnOrItPostProcess.splice(i,1);
        i--, leni--;
      }
    }
    return function* genFn (args) {
      let fns = fnOrItPostProcess.slice(0); // Creating a fresh copy of "fnOrItPostProcess" is sine qua non to allow running multiple instances simultaneously, otherwise "fns" would add up for each instance because it would be a reference to "fnOrItPostProcess", which is accessible and preserved in the closure. 
      de&&bug(CYA+'args to gen ='+RST, args);
      // if (m.isFunction(args[args.length-1])   // Detect a nested thunk wrapper being called
      //   && args[args.length-1].name === '_cbNext') // and captures the callback of the parent.
      //   fns.push(args.pop()); // The adopted child (typically the true async IO thunk wrapper) must call the parent's callback at the end to pass on the IO result (-Mom, I've finished!).
      de&&bug(CYA+'fns in ='+RST, fns);
      for (let i = 0, leni = args.length; i < leni; i++) { // Scan "args" for additional post-processing function.
        if (m.isFunction(args[i]) || m.isGenerator(args[i])) { // Place any function or iterator found in "args" in the same order
          fns.push(args.splice(i,1)[0]);  // at end of post-processing functions array.
          i--, leni--; // Notice: There is no need to explicitly detect the calling of nested thunk wrappers, because the parent's callback (its "_cbNext")
        }              // is automatically passed as the last item in "args" of the adopted child (typically the true async IO thunk wrapper).
      }                // Thus, the parent's "_cbNext" is correctly placed as the last post-processing function of the adopted child to pass on the IO result (-Mom, I've finished!).
      de&&bug(CYA+'fns ='+RST, fns);
      let fnPreProcess = yield fnToThunkify;
      de&&bug(CYA+'fnPreProcess ='+RST, fnPreProcess);
      if (!m.isUndefined(fnPreProcess)) {
        if (m.isFunction(fnPreProcess)) {
          let argsTmp = fnPreProcess(args);
          if (Array.isArray(argsTmp))
            args = argsTmp;
          else
            console.error(`${RED}DevError:${CYA} the function passed as argument "fnPreProcess" to "thunkify.factory"\nmust return an "array", but instead recieved "${typeof argsTmp}".\nIgnoring bad argument to method "thunkify.factory". ("${m.filename.match(/\/(\w+$|[^/\0:*?|\"<>,;&%]+$)/)[1]}")${RST}`);
        } else {
          console.error(`${RED}DevError:${CYA} "fnPreProcess" must be a function passed to the generator function\nfor preprocessing "args" array before sending it to the thunk, but instead recieved "${fnPreProcess}".\nIgnoring bad argument to method "thunkify.factory". ("${m.filename.match(/\/(\w+$|[^/\0:*?|\"<>,;&%]+$)/)[1]}")${RST}`);
        }
      }
      let io;
      let err = null, errLog = [];
      let j = 0, lenj = fns.length;
      try { // The "thunk" is called implicitly from this "try". Exception are caught below.
        io = yield args; // Yield the preprocessed "args" array and wait for "io" data to be received.
      }
      catch (error) { // Errors from the thunk are delegate by its callback to the generator.
        if (lenj === 0) {
          console.error(`${YEL}DevWarning:${CYA} no post-processing function has been provided to the generator\nfunction "${genFn.name}" in module "${m.id}".\nIncidentaly, it is unknown how to treat exceptions ("${m.filename.match(/\/(\w+$|[^/\0:*?|\"<>,;&%]+$)/)[1]} at j=${j}, lenj=${lenj}"):${RST}`);
          console.error(error);
          return error; // Return to "{done: true, value: [error]}" to" "itGen.throw(err)" in function "_cbNext". It is unnecessary, just good practice.
        }
        if (error.recoverable) {
          de&&bug(`${YEL}DevWarning: ${CYA}recoverable error in the last post-processing function of the\n\t    adopted child thunk caller ("${m.filename.match(/\/(\w+$|[^/\0:*?|\"<>,;&%]+$)/)[1]}" at j=${j}, lenj=${lenj}).${RST}`);
          io = error.recoverable;
          delete error.recoverable;
        }
        errLog.push({fn: fnToThunkify.name || '"thunkified"' , args: args, error: error});
        err = error;
      } 
      for (; j < lenj; j++) {
        try {
          de&&bug(`${CYA}Post-processing "${fns[j].name || fns[j]}" ("${m.filename.match(/\/(\w+$|[^/\0:*?|\"<>,;&%]+$)/)[1]}" at j=${j}, lenj=${lenj}).${RST}`);
          if (m.isFunction(fns[j])) 
            io = yield fns[j](err, io, args, errLog); // If an error is thrown from "fns[j]", it will be caught below and the "yield" will not occur.
          else 
            io = yield fns[j].next([err, io, args, errLog]).value;
          if (err) de&&bug(`${YEL}DevWarning: ${CYA}"${fns[j].name || fns[j]}" recovered from error:\n\t    code="${err.code}" ("${m.filename.match(/\/(\w+$|[^/\0:*?|\"<>,;&%]+$)/)[1]}" at j=${j}, lenj=${lenj}).${RST}`);
          err = null; // Recover from error.
        } catch (error) { // "fns[j]" raised an exception. 
          if (error.recoverable) {
            de&&bug(`${YEL}DevWarning: ${CYA}recoverable error in post-processing function:\n\t    "${fns[j].name || fns[j]}" ("${m.filename.match(/\/(\w+$|[^/\0:*?|\"<>,;&%]+$)/)[1]}" at j=${j}, lenj=${lenj}).${RST}`);
            io = error.recoverable;
            delete error.recoverable;
            errLog.push({fn: fns[j].name, args: args, error: error});
            err = error; // Let the next "fn" ("fns[i+1]") know that a recoverable error happened in preceding post-processing function.
          } else {
            de&&bug(`${YEL}DevWarning: ${CYA}UNRECOVERABLE error in post-processing function:\n\t    "${fns[j].name || fns[j]}" ("${m.filename.match(/\/(\w+$|[^/\0:*?|\"<>,;&%]+$)/)[1]}" at j=${j}, lenj=${lenj}).${RST}`);
            error.stack = error.stack.replace(/^(.*?:\s)/, RED+'$1'+RST);
            de ? bug(error.stack) : bug((FOUR_LINES.exec(error.stack) || [error.stack])[0], '...'); 
            break;
          }
        }
      }
      if (debug()) {
        for (let e = 0, lene = errLog.length; e < lene; e++) {
          bug(`${BLU}errLog[${e}] = ${RST}`, errLog[e].fn, errLog[e].args, '\n '+RST, errLog[e].error.message);
          bug((SECOND_LINE.exec(errLog[e].error.stack) || [errLog[e].error.stack])[0].trim(), '...'); 
        }
      }
      return err ? err : io;
    };
  };

// "osculate" allows two or more post-processing function, which would be
// invoked by different generator function to momentarily share their
// "errLog"s.
thunkify.osculate = function osculate(...fns) {
  const gnOsculate = function* gnOsculate(fns) {
    let io;
    let errLog = [];
    let i = 0, leni = fns.length;
    let itSelf = yield;
    for (; i < leni; i++) {
      let err, args, errorLog;
      [err, io, args, errorLog] = yield io; // "[err, io, args, errLog]"
      args.push(itSelf);
      errLog = errLog.concat(errorLog);
      if (debug()) {
        for (let e = 0, lene = errLog.length; e < lene; e++) {
          bug(`${BLU}osculate errLog[${e}] = ${RST}`, errLog[e].fn, errLog[e].args, '\n '+RST, errLog[e].error.message);
          bug((SECOND_LINE.exec(errLog[e].error.stack) || [errLog[e].error.stack])[0].trim(), '...'); 
        }
      }
      io = fns[i](err, io, args, errLog);
    }
    return io;
  }
  const itOsculate = gnOsculate(fns);
  itOsculate.next();
  itOsculate.next(itOsculate);
  return itOsculate;
};

let de = false;
const bug = console.log;

const debug = thunkify.debug = function debug(toggle) {
  if (m.isBoolean(toggle)) 
    de = toggle;
  return de;
};

// Alternative slower "debug" function with static property and "this" binding.
// const debug = thunkify.debug = (function() {
//   function debug(...input) {
//     if (typeof new.target !== "undefined") // Make sure wasn't called with keyword "new".
//       throw new Error(`${RED}DevError:${CYA} function "debug" should not be called as a constructor (with keyword "new").${RST}`);
//     if (m.isBoolean(input[0])) 
//       this.state = input[0]; // "this" === "debug"
//     else if (this.state === true && m.isString(input[0]))  
//       console.log(...input);
//     return this.state;
//   }
//   debug.state = false; // Static property.
//   return debug.bind(debug);
// }());

// Alternative slower "debug" function with closure.
// const debug = thunkify.debug = (function() {
//   function debug(...input) { 
//     console.log('debug', state);
//     if (typeof new.target !== "undefined") // Make sure wasn't called with keyword "new".
//       throw new Error(`${RED}DevError:${CYA} function "debug" should not be called as a constructor (with keyword "new").${RST}`);
//     if (m.isBoolean(input[0])) 
//       state = input[0]; 
//     else if (state === true && m.isString(input[0]))  
//       console.log(...input);
//     return state;
//   }
//   let state = false; 
//   return debug;
// }());

module.exports = thunkify;
