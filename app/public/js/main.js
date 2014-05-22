define(function(require, exports, module){
// variables init
var document = window.document
  , $ = require('baseLib')
  , VideoRecorder = require('recorder')

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
  , signalSocket
  , peerConnection
  , $startVideoShareBtn = $('#startVideoShareBtn')
  , $remoteVideo = $('#remoteVideo')
  , remoteVideo = $remoteVideo.get(0)
  , role
  , ROLE_CALLER = 'caller'
  , ROLE_CALLEE = 'callee'
  , roomId
  , SDP_CONSTRAINTS = {
    mandatory: {
      OfferToReceiveVideo: true,
      OfferToReceiveAudio: true
    }
  }

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
    console.log(role + ' display local video')
    liveVideo.src = URL.createObjectURL(stream)

    if(peerConnection){
      console.log(role + ' add local video stream to peer connection')
      peerConnection.addStream(stream)

      if(role === ROLE_CALLER){
        peerConnection.createOffer(
          handlers.onCreateSdpSuccess,
          handlers.onFailure,
          SDP_CONSTRAINTS
        )
      }
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
    peerConnection = new RTCPeerConnection(
      {
        iceServers: [
          {url: "stun:23.21.150.121"},
          {url: "stun:stun.l.google.com:19302"},
          {url: "turn:numb.viagenie.ca", credential: "webrtcdemo", username: "louis%40mozilla.com"}
        ]
      },
      {
        optional: [
          // Enable interoperation between Chrome and Firefox
          {DtlsSrtpKeyAgreement: true}
        ]
      }
    )
    peerConnection.addEventListener('icecandidate', handlers.onIceCandidate)
    peerConnection.addEventListener('addstream', handlers.onAddStream)

    signalSocket = io.connect('/signalSockets')
    signalSocket.on('connect', handlers.onSignalSocketConnect)
    signalSocket.on('iceCandidate', handlers.onSignalSocketReceiveIceCandidate)

    roomId = location.hash.slice(1)
    if(roomId){
      role = ROLE_CALLEE
    }
    else{
      role = ROLE_CALLER
      roomId = '' + parseInt(Math.random() * Math.pow(10, 10))
      location.hash = roomId
    }

    if(role === ROLE_CALLER){
      signalSocket.on('answer', handlers.onSignalSocketGetAnswer)
    }
    else{
      signalSocket.on('offer', handlers.onSignalSocketGetOffer)
    }

    $openCameraBtn.click()
  },
  onIceCandidate: function onIceCandidate(event){
    console.log('`icecandidate` event trigger')
    if(!event.candidate){
      console.log('No candidate exists')
      return
    }

    console.log(role + ' has an ICE candidate, and stop listen `icecandidate` event')
    event.target.removeEventListener(event.type, onIceCandidate)

    if(signalSocket.socket.connected){
      console.log(role + ' send ICE candidate')
      signalSocket.emit('iceCandidate', JSON.stringify(event.candidate))
    }
    else{
      signalSocket.on('connect', function(){
        console.log(role + ' send ICE candidate')
        signalSocket.emit('iceCandidate', JSON.stringify(event.candidate))
      })
    }
  },
  onSignalSocketReceiveIceCandidate: function(candidate){
    console.log(role + ' receive ICE candidate and add it: %O', candidate)
    peerConnection.addIceCandidate(
      new RTCIceCandidate( JSON.parse(candidate) )
    )
  },
  onAddStream: function(event){
    console.log(role + ' get remote stream and display it')
    remoteVideo.src = URL.createObjectURL(event.stream)
  },
  onSignalSocketConnect: function(){
    console.log(role + ' has connected signal socket and send room id to server')
    signalSocket.emit('roomId', roomId)
  },
  onSignalSocketDisconnect: function(){
    console.log(role + ' has disconnected signal socket')
  },
  onSignalSocketGetAnswer: function(answer){
    console.log(role + ' receives answer %O', answer)
    peerConnection.setRemoteDescription(
      new RTCSessionDescription( JSON.parse(answer) )
    )
  },
  onSignalSocketGetOffer: function(offer){
    console.log(role + ' receives offer %O and creates answer', offer)
    peerConnection.setRemoteDescription(
      new RTCSessionDescription( JSON.parse(offer) )
    )
    peerConnection.createAnswer(
      handlers.onCreateSdpSuccess,
      handlers.onFailure
    )
  },
  onCreateSdpSuccess: function(sdp){
    var sdpType = role === ROLE_CALLER ? 'offer' : 'answer'
    console.log(role + ' has created ' + sdpType)
    peerConnection.setLocalDescription(sdp)

    if(signalSocket.socket.connected){
      console.log(role + ' sends ' + sdpType)
      signalSocket.emit(sdpType, JSON.stringify(sdp))
    }
    else{
      signalSocket.on('connect', function(){
        console.log(role + ' sends ' + sdpType)
        signalSocket.emit(sdpType, JSON.stringify(sdp))
      })
    }
  },
  onFailure: function(error){
    console.error(error)
  }
}

$liveVideo.on('play', handlers.onSelfVideoPlay)
$openCameraBtn.on('click', handlers.onClickOpenCameraBtn)
$recordBtn.on('click', handlers.onClickRecordBtn)
$finishRecordBtn.on('click', handlers.onClickFinishRecordBtn)
$startVideoShareBtn.on('click', handlers.onClickStartVideoShareBtn)

liveVideo.autoplay = true
recordVideo.autoplay = true
recordVideo.controls = true
recordVideo.loop = true
remoteVideo.autoplay = true

recordVideoLink.download = 'record.webm'


})
