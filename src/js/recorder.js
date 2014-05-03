// @param video {Element} video element to record
function VideoRecorder(video){
  var canvas
  this._video = video
  canvas = this._canvas = document.createElement('canvas')
  canvas.width = video.width
  canvas.height = video.height
  this._frames = []
  this._ctx = canvas.getContext('2d')
  this._startTime = null
  this._rafId = null
  this._recordFrame = this._recordFrame.bind(this)
}

VideoRecorder.prototype = {
  constructor: VideoRecorder,

  // Start to record
  start: function(){
    // TODO: check whether video is playing
    this._startTime = Date.now()
    this._rafId = this._requestAnimationFrame.call(null, this._recordFrame)
    return this._startTime
  },

  finish: function(){
    this._cancelAnimationFrame.call(null, this._rafId)
    this._rafId = null
    return {
      frames: this._frames,
      duration: Date.now() - this._startTime
    }
  },

  _requestAnimationFrame: window.requestAnimationFrame,

  _cancelAnimationFrame: window.cancelAnimationFrame,

  _recordFrame: function(time){
    var canvas, dataUrl
    this._rafId = this._requestAnimationFrame.call(null, this._recordFrame)
    canvas = this._canvas
    this._ctx.drawImage(this._video, 0, 0, canvas.width, canvas.height)
    dataUrl = canvas.toDataURL('image/webp', 1)
    this._frames.push(dataUrl)
  }
}
