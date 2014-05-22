define(function(require, exports, module){
  require('socket.io')
  var NOOP_METHOD = function(){ return this }

  function RtcPeer(RTC_CONFIG, MEDIA_CONSTRAINTS, SDP_CONSTRAINTS){
    this._RTC_CONFIG = RTC_CONFIG
    this._MEDIA_CONSTRAINTS = MEDIA_CONSTRAINTS
    this._SDP_CONSTRAINTS = SDP_CONSTRAINTS

    console.log('Instanciate RTC peer connection')
    this._pc = new RTCPeerConnection(RTC_CONFIG, MEDIA_CONSTRAINTS)
  }
  RtcPeer.prototype = {
    constructor: RtcPeer,
    // the stream should be added to the peer connection before generating the answer or offer , that is "addStream" should be called before any of setlocalDescription or setRemoteDescription calls
    addLocalStream: function(stream){
      console.log('Add local stream to peer connection')
      this._pc.addStream(stream)
      return this
    },
    onReceiveRemoteStream: NOOP_METHOD,
    connect: function(roomId){
      var socket
      this.roomId = roomId

      console.log('Socket start connect')
      this._socket = socket = io.connect('/webrtcSignalChannel')
      socket.on('connect', this._onSocketConnect.bind(this))
      socket.on('disconnect', this._onSocketDisconnect.bind(this))
      socket.on('iceCandidate', this._onSocketIceCandidate.bind(this))

      this._pc.onicecandidate = this._onPcIceCandidate.bind(this)
      this._pc.onaddstream = this._onPcAddStream.bind(this)

      return this
    },
    _onSocketConnect: function(){
      console.log('Socket connected')
      this._socket.emit('roomId', this.roomId)
    },
    _onSocketDisconnect: function(){
      console.log('Socket disconnect')
    },
    _onSocketIceCandidate: function(candidate){
      console.log('Receive ICE candidate and add it')
      this._pc.addIceCandidate(
        new RTCIceCandidate( JSON.parse(candidate) )
      )
    },
    _onSocketReceiveRemoteSdp: function(sdp){
      console.log('Receive remote SDP: ' + sdp.type)
      this._pc.setRemoteDescription(
        new RTCSessionDescription( JSON.parse(sdp) )
      )
    },
    // 确保在调用此句柄的时候socket已连接
    _onCreateLocalSdpSuccess: function(sdp){
      var sdpType = sdp.type
      console.log('Created ' + sdpType)
      this._pc.setLocalDescription(sdp)

      console.log('Send ' + sdpType)
      this._socket.emit(sdpType, JSON.stringify(sdp))
    },
    _onFailure: function(error){
      console.log(error)
    },
    // 当 `peerConnection` 收集到ICE candidate时调用的事件句柄，
    // 确保在调用此句柄的时候socket已连接。
    // RTCPeerConnection won't start gathering candidates until `setLocalDescription()` is called
    _onPcIceCandidate: function(event){
      console.log('`icecandidate` event trigger')
      if(!event.candidate){
        console.log('No candidate exists')
        return
      }

      console.log('Have an ICE candidate, stop listening `icecandidate` event')
      event.target.onicecandidate = null

      console.log('Send ICE candidate')
      this._socket.emit('iceCandidate', JSON.stringify(event.candidate))
    },
    _onPcAddStream: function(event){
      console.log('Receive remote stream')
      this.onReceiveRemoteStream(event.stream)
    }
  }

  /**
  @class Caller
  @extend RtcPeer
  **/
  function Caller(RTC_CONFIG, MEDIA_CONSTRAINTS, SDP_CONSTRAINTS){
    // 复用父类的构造函数
    this.__parent__.constructor.apply(this, arguments)
  }
  Caller.prototype = Object.create(RtcPeer.prototype)
  Caller.prototype.constructor = Caller
  Caller.prototype.__parent__ = RtcPeer.prototype
  Caller.prototype.connect = function(roomId){
    this.__parent__.connect.apply(this, arguments)
    this._socket.on('answer', this._onSocketReceiveRemoteSdp.bind(this))
    return this
  }
  Caller.prototype._onSocketConnect = function(socket){
    this.__parent__._onSocketConnect.apply(this, arguments)
    this._pc.createOffer(
      this._onCreateLocalSdpSuccess.bind(this),
      this._onFailure,
      this._SDP_CONSTRAINTS
    )
  }

  /**
  @class Callee
  @extend RtcPeer
  **/
  function Callee(RTC_CONFIG, MEDIA_CONSTRAINTS){
    // 复用父类的构造函数
    this.__parent__.constructor.apply(this, arguments)
  }
  Callee.prototype = Object.create(RtcPeer.prototype)
  Callee.prototype.constructor = Callee
  Callee.prototype.__parent__ = RtcPeer.prototype
  Callee.prototype.connect = function(roomId){
    this.__parent__.connect.apply(this, arguments)
    this._socket.on('offer', this._onSocketOffer.bind(this))
    return this
  }
  Callee.prototype._onSocketOffer = function(offer){
    this._onSocketReceiveRemoteSdp.apply(this, arguments)
    this._pc.createAnswer(
      this._onCreateLocalSdpSuccess.bind(this),
      this._onFailure
    )
  }

  exports.Caller = Caller
  exports.Callee = Callee
})
