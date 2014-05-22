define(function(require, exports, module){
// variables init
var document = window.document
  , $ = require('baseLib')
  , VideoRecorder = require('recorder')
  , rtcPeer = require('rtcPeer')
  , Caller = rtcPeer.Caller
  , Callee = rtcPeer.Callee

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
  , liveVideoRecorder
  , recordStartTime
  , recordTimerId = null
  , $startVideoShareBtn = $('#startVideoShareBtn')
  , $remoteVideo = $('#remoteVideo')
  , remoteVideo = $remoteVideo.get(0)
  , RTC_CONFIGURATION = {
    iceServers: [
      {url: "stun:23.21.150.121"},
      {url: "stun:stun.l.google.com:19302"},
      {url: "turn:numb.viagenie.ca", credential: "webrtcdemo", username: "louis%40mozilla.com"}
    ]
  }
  , MEDIA_CONSTRAINTS = {
    optional: [
      // Enable interoperation between Chrome and Firefox
      {DtlsSrtpKeyAgreement: true}
    ]
  }
  , SDP_CONSTRAINTS = {
    mandatory: {
      OfferToReceiveVideo: true,
      OfferToReceiveAudio: true
    }
  }
  , localVideoStream

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
    console.log('Display local video')
    liveVideo.src = URL.createObjectURL(stream)
    localVideoStream = stream

    if(handlers.onGetUserMediaSuccess2){
      handlers.onGetUserMediaSuccess2()
    }
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
  },
  onClickStartVideoShareBtn: function(event){
    var roomId = location.hash.slice(1)
      , role

    // 如果还没判断是哪个角色
    if(!role){
      // 根据hash中是否有 `roomId` 来判断是caller还是callee
      if(!roomId){
        // 如果是caller，生成 `roomId` 放在hash中，
        // 以便后续callee加入room
        roomId = '' + parseInt(Math.random() * Math.pow(10, 10))
        location.hash = roomId
        role = new Caller(RTC_CONFIGURATION, MEDIA_CONSTRAINTS)
        console.log('It is caller')
      }
      else{
        role = new Callee(RTC_CONFIGURATION, MEDIA_CONSTRAINTS)
        console.log('It is callee')
      }
    }

    role.onReceiveRemoteStream = handlers.onReceiveRemoteStream
    addStreamToRtcRole(role, function(){
      role.connect(roomId)
    })
  },
  onReceiveRemoteStream: function(stream){
    console.log('Receive remote stream and display it')
    remoteVideo.src = URL.createObjectURL(stream)
  }
}

function addStreamToRtcRole(role, next){
  if(localVideoStream){
    role.addLocalStream(localVideoStream)
    next()
  }
  else{
    // TODO
    handlers.onGetUserMediaSuccess2 = function(){
      role.addLocalStream(localVideoStream)
      next()
    }
  }
}

$liveVideo.on('play', handlers.onSelfVideoPlay)
$openCameraBtn.on('click', handlers.onClickOpenCameraBtn)
$recordBtn.on('click', handlers.onClickRecordBtn)
$finishRecordBtn.on('click', handlers.onClickFinishRecordBtn)
$startVideoShareBtn.on('click', handlers.onClickStartVideoShareBtn)


})
