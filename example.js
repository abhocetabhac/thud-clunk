// Usage:
//   node ./example testfile1.txt testfile2.txt nonexistent.txt
//

const myFiles = process.argv.slice(2);

const
  fs = require('fs'),
  thunkify = require('./thud-clunk');

// Some ANSI terminal colors
const 
  RST = '\x1b[0m',  // reset
  RED = '\x1b[31m',
  GRE = '\x1b[32m',
  YEL = '\x1b[33m',
  BLU = '\x1b[34m',
  MAG = '\x1b[35m',
  CYA = '\x1b[36m';

//thunkify.debug(true);

const fnReadFile = function fnReadFile(err = null, input = null, args) {
  console.log(CYA+'fnReadFile:'+RST, args);
  if (err) { // Errors from "fs.readFile" arrive here.
    if (err.code === "ENOENT") {
      process.exitCode = 2;
      //let filepath = err.message.match(/'(.*)'/)[1]; 
      err.message = `Failed to find file "${err.path}".`;
    }
    throw err; // Signal an unrecoverable error and stop any post-processing for that file, but will not abort the program continuing on the processing of other files.
  }
  return input;
};

const fnTrimLfEof = function fnTrimLfEof(err = null, input = null, args) {
  console.log(CYA+'fnTrimLfEof:'+RST, args);
  if (Object.prototype.toString.call(input) === '[object String]') {
    let output = input.replace(/[\r\n]+$/, "");
    if (input.match(/[\r\n]{2,}$/)) {
      let exception = new Error(YEL+'Warning:'+RST+' extra "\\r" or "\\n" have been trimmed from the EOF.');
      console.error(exception.message);
      exception.recoverable = output; // Signal a recoverable error to the generator function
      throw exception;                // and pass on the output embedded in the error object.
    }
    return output; 
  } else {
    let exception = new Error(`${YEL}Warning:${RST} post-processing function "${fnTrimLfEof.name}" expects a "${typeof ''}",\n\t but recieved "${Object.prototype.toString.call(input).match(/\s(.+)\]$/)[1]}".`);
    console.error(exception.message);
    exception.recoverable = input; // Signal a recoverable error to the generator function
    throw exception;               // and return the input untouched.
  }
};

const fnPrint = function fnPrint(err = null, input = null, args) {
  console.log(CYA+'fnPrint:'+RST, args);
  console.log(input);
  return input;
};

const fnRender = function fnRender(err = null, input = null, args) {
  console.log(CYA+'fnRender:'+RST, args);
  let output = input.toUpperCase();
  return output;
};

const fnEnd = function fnEnd(err = null, input = null, args, errLog) {
  console.log(CYA+'fnEnd:'+RST, args);
  if (errLog.length === 0) 
    console.log(GRE+'Done successfully.'+RST); 
  else {
    console.log(MAG+'Done, but stumbled upon recoverable errors. See the '+YEL+'warnings'+MAG+'.'+RST); 
    if (thunkify.debug()) {
      for (let e of errLog)
        console.log(MAG, e.fn, e.args, '\n'+RST, e.error.message);
    }
  }
  return input;
};

const fnPreProcess = function fnPreProcess(args) {
  if (!('utf-8' in args))
    args.push('utf-8', 'Usage example 4');
  return args;
};

// Usage example 1
// Step 1: produce the generator function that will be actuated by the 
//         callback internally provided to the asynchronous IO function.
const gnReadFile = thunkify.generatorFactory(fs.readFile, fnReadFile); 
// Step 2: produce the thunk caller responsible for initializing the generator
//         function and altogether starting the asynchronous IO operation.
const readFile = thunkify.factory(gnReadFile);
// Step 3: Execute the thunk caller when desired.
for (let i = 0, len = myFiles.length; i < len; i++)
  readFile(myFiles[i], fnTrimLfEof, fnPrint, fnEnd);
// No argument of function type will be in fact passed to "fs.readfile".
// They are retained by the generator function and regarded as post-processing
// functions.

// Usage example 2
for (let i = 0, len = myFiles.length; i < len; i++)
  readFile(myFiles[i], 'utf-8', fnTrimLfEof, fnPrint, fnEnd, 'Usage example 2');
// Any argument that is not a function will be passed on to the thunkified IO
// function, but, in the case here, "fs.readfile" utilizes only the first two
// strings and ignores further arguments. This can be used to relay information
// to the post-processing functions.

// Usage example 3
//Nesting thunks may be implemented in two ways:
//a) Directly providing the child generator to the parent one.
const gnRender1 = thunkify.generatorFactory(gnReadFile, fnTrimLfEof, fnRender, fnPrint);
const render1 = thunkify.factory(gnRender1); // Named thunk wrapper.
for (let i = 0, len = myFiles.length; i < len; i++)
  render1(myFiles[i], 'utf-8', fnEnd, 'Usage example 3'); 

// Usage example 4
// b) Alternatively, providing the child thunk wrapper to the parent generator.
//    Requires explicitly telling the generator it is parent of a thunk.
const gnRender2 = thunkify.generatorFactory(readFile, fnTrimLfEof, fnRender, fnPrint, fnEnd);
const render2 = thunkify.factory(gnRender2, fnPreProcess); // Include preprocessing function of the arguments to the thunk caller.
for (let i = 0, len = myFiles.length; i < len; i++)
  render2(myFiles[i]);
