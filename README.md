# thud + clunk = thunk

## Node.js module to "thunkify" asynchronous IO functions

Converts node's asynchronous IO functions to thunks. The thunks can then
be used like synchronous functions in try/catch error scheme while preserving
the non-blocking advantages.