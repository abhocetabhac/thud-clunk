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

Array.prototype.remove = function(from, to) {
  var rest = this.slice(parseInt(to || from) + 1 || this.length);
  this.length = from < 0 ? this.length + from : from;
  return this.push.apply(this, rest);
};

// thunkify
// ES6 version   
function thunkify(asyncIoFn) { 
  return function tkPre(...args) { // [10, 27] Return the thunk provider of "readfile". 
    return function thunk(_cbNext) { // [16, 29] Return the thunk per se of "readfile". 
      args.push(_cbNext); // [20, 33]
      console.log('asynvIoFn args =', args);
      let cbChild = asyncIoFn.apply(this, args); // [21, 34, 39]
      //if (isFunction(cbChild))
      //  _cbNext(null, cbChild); // [40] "asyncIoFn" is not really an async IO function, but came from the "return _cbNext;" in "thunkify.run()" ("cbManually != _cbNext").
      return; // [35, ]
    };
  };
}

const cl_cbNext = function(itGen) {
  // "_cbNext()" is the recursive callback function that retro-feeds the "yield"s
  // in the function generator "genFn" called from function "run". 
  return function _cbNext(err = null, result = null) { 
    if (err) // Let the generator lead with exceptions on its own.
      return itGen.throw(err);
    let more = itGen.next(result); 
    console.log('more =', more);
    if (more.done)
      return more.value; // Just "return;" works ok. When using nested thunk wrappers, this will return "more.value" to the deeper generator function, but could not divise an application for that. [..18] Begin reversing the callback recursion ending to the asynchronous IO operation.
    return _cbNext(null, more.value); // Just "_cbNext(null, more.value)" works ok. When using nested thunk wrapper, this will return "more.value" to the deeper "_cbNext", but could not divise an application for that. [11] Call "fs.readFile" thunk.
  }
};

thunkify.run = function run(genFn, ...args) {
  const itGen = genFn(...args); 
  const fnToThunkify = itGen.next().value;
  const tkPre = thunkify(fnToThunkify);
  args = itGen.next().value;
  console.log('tkPre args =', args);
  const thunk = tkPre(...args);
  let _cbNext = cl_cbNext(itGen);
  thunk(_cbNext);
  //_cbNext(null, _cbNext); // [12]
  //return _cbNext; // []
};

// Produces thunk wrappers.
thunkify.factory = function factory(genFn, ...fns) { // Produces thunk wrappers.
  return function wrapper(...args) {
    return thunkify.run(genFn, ...(args.concat(fns)));
  };
};

// Produces standard generator functions
thunkify.generatorFactory =
  function generatorFactory(fnToThunkifyOrGnChild, fnPreProcess, ...fns) {
    let fnToThunkify; // "fnToThunkify" may be an asynchronous IO function or a thunk wrapper returned by "thunkify.factory".
    if (module.isGeneratorFunction(fnToThunkifyOrGnChild)) {
      fnToThunkify = thunkify.factory(fnToThunkifyOrGnChild);
    } else if (module.isFunction(fnToThunkifyOrGnChild)) {
      fnToThunkify = fnToThunkifyOrGnChild;
    } else {
      throw new Error(`DevError: method "thunkify.generatorFactory" requires a function or generator function as paramater "fnToThunkifyOrGnChild", but instead recieved a "${typeof fnToThunkifyOrGnChild}".`);
    }
    return function* (...args){
      console.log('generator args =', args);
      //fns = fns || [];
      for (let i = 0, leni = args.length; i < leni; i++){
        if (module.isFunction(args[i])) {
          fns.push(args.splice(i,1)[0]);
          i--, leni--;
        }
      }
      console.log('fns =', fns);
      console.log('args =', args);
      if (fns[0].name === '_cbNext') 
        fns.push(fns.shift());
      console.log('fns =', fns);
      let io;
      yield fnToThunkify;
      let j = 0, lenj = fns.length;
      try {
        io = yield args; 
        if (lenj > 0) { 
          for (; j < lenj; j++) {
            console.log('Running', fns[j].name);
            console.log('io =', io)
            io = yield fns[j](null, io);
          }
        }
        //module.isFunction(fn) ? (io = fn(null, io)) : void 0;
        //module.isFunction(cbParent) ? (cbParent(null, io)) : void 0;
      } catch (err) { // Errors from the thunk are delegate by its callback to the generator.
        if (lenj > 0) {
          for (; j < lenj; j++) {
            yield fns[j](err, null);
          }
        }
        //module.isFunction(fn) ? (err = fn(err, null)) : void 0;
        //module.isFunction(cbParent) ? cbParent(err, null) : void 0;
      }  
      return io;
    };
  };

module.exports = thunkify;


