define(function(require, exports, module){
// variables init
var document = window.document
  , $ = require('baseLib')

var $liveBox = $('#liveBox')
  , $recordBox = $('#recordBox')
  , $resolutionBox = $('#resolutionBox')
  , $recordDurationBox = $('#recordDuration')
  , $recordDuration = $('#recordDuration')
  , $liveVideo = $('#liveVideo')
  , liveVideo = $liveVideo.get(0)
  , $openCameraBtn = $('#openCameraBtn')
  , $finishRecordBtn = $('#finishRecordBtn')
  , $recordBtn = $('#recordBtn')
  , $resolution = $('#resolution')
  , $recordVideo = $('#recordVideo')
  , recordVideo = $recordVideo.get(0)
  , $recordVideoLink = $('#recordVideoLink')
  , recordVideoLink = $recordVideoLink.get(0)
  , VideoRecorder = require('recorder')
  , liveVideoRecorder
  , recordStartTime
  , recordTimerId = null

var handlers = {
  onSelfVideoPlay: function(){
    var width, height
    width = liveVideo.width = liveVideo.videoWidth
    height = liveVideo.height = liveVideo.videoHeight
    // TODO: display resolution, considering enough factors
    $resolution.text(width + 'x' + height + 'px')
  },
  onClickOpenCameraBtn: function(){
    navigator.getUserMedia(
      {
        video: {
          mandatory: {
            minWidth: 640,
            minHeight: 480
          },
          optional: [{
            minFrameRate: 30
          }]
        }
      },
      handlers.onGetUserMediaSuccess,
      handlers.onGetUserMediaFail
    )
  },
  onGetUserMediaSuccess: function(stream){
    $liveBox.show()
    liveVideo.src = URL.createObjectURL(stream)
  },
  onGetUserMediaFail: function(event){
    alert('Get user media fails')
    console.error('Get user media fails: %O', event)
  },
  onClickRecordBtn: function(event){
    liveVideoRecorder = new VideoRecorder(liveVideo)
    recordStartTime = liveVideoRecorder.start()

    handlers.updateRecordDuration()
    recordTimerId = setInterval(handlers.updateRecordDuration, 1000)
    $recordDurationBox.show()
  },
  onClickFinishRecordBtn: function(event){
    var objectUrl, record, webmBlob, fps

    clearInterval(recordTimerId)

    record = liveVideoRecorder.finish()

    handlers.updateRecordDuration(record.duration)
    recordVideo.width = liveVideo.width
    recordVideo.height = liveVideo.height

    fps = Math.round( record.frames.length / (record.duration / 1000) )
    webmBlob = Whammy.fromImageArray(record.frames, fps)
    objectUrl = window.URL.createObjectURL( webmBlob )
    recordVideo.src = objectUrl

    recordVideoLink.href = objectUrl

    $recordBox.show()

    console.log('%d fps: %d frames in %d ms', fps, record.frames.length, record.duration)
  },
  updateRecordDuration: function(duration){
    duration = duration !== undefined ? duration : Date.now() - recordStartTime
    $recordDuration.text( parseInt(duration / 1000) + 's' )
  }
}

$liveVideo.on('play', handlers.onSelfVideoPlay)
$openCameraBtn.on('click', handlers.onClickOpenCameraBtn)
$recordBtn.on('click', handlers.onClickRecordBtn)
$finishRecordBtn.on('click', handlers.onClickFinishRecordBtn)

liveVideo.autoplay = true
recordVideo.autoplay = true
recordVideo.controls = true
recordVideo.loop = true

recordVideoLink.download = 'record.webm'

})
