/**
chain.js
@moduel CMD module
@example

```JavaScript
var chain = new Chain()
chain
  .step(function(next){
    // do something asynchronously
    // go to next step when finish this step
    next()
  }, context, argument1, argument2, argumentN)
  .step(function(next){
    // in the last step handler, you can invoke `next()` or not
    // next()
  })
  .end()
```

**/
define(function(require, exports, module){
  var NOOP_FUNC = function(){}

  function Chain(){
    this._steps = []
  }
  // TODO: context, arguments
  Chain.prototype.step = function(handler, context){
    var steps = this._steps
      , l = steps.length
      , priorStepHandler = steps[l - 1]

    if(priorStepHandler){
      steps[l - 1] = priorStepHandler.bind(null, handler)
    }

    steps.push(handler)

    return this
  }
  Chain.prototype.end = function(){
    var steps = this._steps
      , l = steps.length
      , lastStepHandler = steps[l - 1]

    steps[l - 1] = lastStepHandler.bind(null, NOOP_FUNC)

    // Start chain
    steps[0]()

    return this
  }

  module.exports = Chain
})
