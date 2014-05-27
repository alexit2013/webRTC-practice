define(function(require, exports, module){
  require('socket.io')
  var NOOP_METHOD = function(){ return this }
    , NOOP_HANDLER = function(){}
    , Chain = require('chain')

  function RtcPeer(RTC_CONFIG, MEDIA_CONSTRAINTS, SDP_CONSTRAINTS){
    this._RTC_CONFIG = RTC_CONFIG
    this._MEDIA_CONSTRAINTS = MEDIA_CONSTRAINTS
    this._SDP_CONSTRAINTS = SDP_CONSTRAINTS

    console.log('Instanciate RTC peer connection')
    this._pc = new RTCPeerConnection(RTC_CONFIG, MEDIA_CONSTRAINTS)

    // Define event
    this.onReceiveRemoteStream = NOOP_HANDLER
    // TODO: auto trigger event `onStateChange` when `this.state` change
    this.onStateChange = NOOP_HANDLER

    this.state = {
      'setOffer': false,
      'setAnswer': false,
      'addedLocalIceCandidate': false,
      'addedRemoteIceCandidate': false
    }
  }
  RtcPeer.prototype = {
    constructor: RtcPeer,
    // the stream should be added to the peer connection before generating the answer or offer , that is "addStream" should be called before any of setlocalDescription or setRemoteDescription calls
    addLocalStream: function(stream){
      console.log('Add local stream to peer connection')
      this._pc.addStream(stream)
      return this
    },
    // TODO: check local stream is added, if not, throw error
    connect: function(roomId){
      this.roomId = roomId
    }
  }

  /**
  @class Caller
  @extend RtcPeer
  **/
  function Caller(RTC_CONFIG, MEDIA_CONSTRAINTS, SDP_CONSTRAINTS){
    this.__parent__.constructor.apply(this, arguments)
    initIceCandidateArray.call(this)
  }
  // Inherit static properties
  Object.keys(RtcPeer).forEach(function(key){
    Caller[key] = this[key]
  }, RtcPeer)
  // Inherit properties accessed by instance
  Caller.prototype = Object.create(RtcPeer.prototype)
  Caller.prototype.constructor = Caller
  Caller.prototype.__parent__ = RtcPeer.prototype
  Caller.prototype.connect = function(roomId){
    var that = this
    this.__parent__.connect.apply(this, arguments)

    // step by step to simply program logic
    new Chain()
      .step(function(next){
        var socket
        // 使用socket.io库实现信号通道
        console.log('Socket start connect')
        // TODO: make socket.io namespace configurable
        that._socket = socket = io.connect('/webrtcSignalChannel')

        // Wait for network info. & remote stream,
        // but donot start exchanging network info. util finish exchanging media info
        that._pc.onicecandidate = that._onPcIceCandidate.bind(that)
        that._socket.on('iceCandidate', onSocketIceCandidate.bind(that))
        that._pc.onaddstream = onPcAddStream.bind(that)

        // Exchange media info.
        // 建立起连接后才能发送room id
        socket.on('connect', that._onSocketConnect.bind(that, roomId))
        socket.on('disconnect', onSocketDisconnect.bind(null, that._socket))
        // 作为caller，需要通过信号通道来接收answer
        socket.on('answer', that._onSocketReceiveAnswer.bind(that, next))
      })
      // Exchange network info. and wait to receive remote stream
      .step(function(next){
        exchangeNetworkInfo.call(that)
        // BUG: `next` is `undefined`
        // next()
      })
      .end()

    return this
  }
  Caller.prototype._onSocketConnect = function(roomId){
    console.log('Socket connected\nSend room id')
    this._socket.emit('roomId', roomId)

    console.log('Start creating offer')
    this._pc.createOffer(
      this._onCreateOfferSuccess.bind(this),
      handleError,
      this._SDP_CONSTRAINTS
    )
  }
  Caller.prototype._onCreateOfferSuccess = function(offer){
    console.log('Created offer and send it')
    this._pc.setLocalDescription(offer)
    this.state.setOffer = true
    this._socket.emit('offer', JSON.stringify(offer))
  }
  Caller.prototype._onSocketReceiveAnswer = function(next, answer){
    console.log('Receive answer\nExchanged media info.')
    this._pc.setRemoteDescription(
      new RTCSessionDescription( JSON.parse(answer) )
    )
    this.state.setAnswer = true
    // Exchanged media info., go to next step
    next()
  }
  Caller.prototype._onPcIceCandidate = function(event){
    onPcIceCandidate.apply(this, arguments)
  }

  /**
  @class Callee
  @extend RtcPeer
  **/
  function Callee(RTC_CONFIG, MEDIA_CONSTRAINTS){
    this.__parent__.constructor.apply(this, arguments)
    initIceCandidateArray.call(this)
  }
  // Inherit static properties
  Object.keys(RtcPeer).forEach(function(key){
    Callee[key] = this[key]
  }, RtcPeer)
  // Inherit properties accessed by instance
  Callee.prototype = Object.create(RtcPeer.prototype)
  Callee.prototype.constructor = Callee
  Callee.prototype.__parent__ = RtcPeer.prototype
  Callee.prototype.connect = function(roomId){
    var that = this
    this.__parent__.connect.apply(this, arguments)

    new Chain()
      .step(function(next){
        var socket
        // 使用socket.io库实现信号通道
        console.log('Socket start connect')
        that._socket = socket = io.connect('/webrtcSignalChannel')

        // Wait for network info. & remote stream,
        // but donot start exchanging network info. util finish exchanging media info
        that._pc.onicecandidate = that._onPcIceCandidate.bind(that)
        that._socket.on('iceCandidate', onSocketIceCandidate.bind(that))
        that._pc.onaddstream = onPcAddStream.bind(that)

        // Exchange media info.
        socket.on('connect', that._onSocketConnect.bind(that, roomId))
        socket.on('disconnect', onSocketDisconnect.bind(null, that._socket))
        // 作为callee，需要通过信号通道来接收offer
        that._socket.on('offer', that._onSocketOffer.bind(that, next))
      })
      // Exchange network info. after finish exchanging media info.
      .step(function(next){
        exchangeNetworkInfo.call(that)
        next()
      })
      .end()

    return this
  }
  Callee.prototype._onSocketConnect = function(roomId){
    console.log('Socket connected\nSend room id')
    this._socket.emit('roomId', roomId)
  }
  Callee.prototype._onSocketOffer = function(next, offer){
    console.log('Receive offer')
    this._pc.setRemoteDescription(
      new RTCSessionDescription( JSON.parse(offer) )
    )
    this.state.setOffer = true
    console.log('Create answer')
    this._pc.createAnswer(
      this._onCreateAnswerSuccess.bind(this, next),
      this._onFailure,
      this._SDP_CONSTRAINTS
    )
  }
  Callee.prototype._onCreateAnswerSuccess = function(next, answer){
    console.log('Created answer and send it')
    this._pc.setLocalDescription(answer)
    this.state.setAnswer = true
    // TODO: donot go to next step until receiving caller's ack
    this._socket.emit('answer', JSON.stringify(answer))

    next()
  }
  Callee.prototype._onPcIceCandidate = function(event){
    onPcIceCandidate.apply(this, arguments)
  }


  // Common function for both caller & callee

  /**
  @context instance of `Caller` or `Callee`
  **/
  function initIceCandidateArray(){
    this._localIceCandidateToSend = []
    this._remoteIceCandidateToAdd = []

    // Override `push` method of these two array
    // for surpose of wrapping store
    this._localIceCandidateToSend.push = onPushLocalIceCandidateToSend.bind(this)
    this._remoteIceCandidateToAdd.push = onPushRemoteIceCandidateToAdd.bind(this)
  }
  /**
  @context instance of `Caller` or `Callee`
  **/
  function onPushLocalIceCandidateToSend(candidate){
    // Have set answer means that exchanged media info.
    // Ensure finish exchanging media info. before start exchanging network info.
    if(this.state.setAnswer){
      console.log('Send local ICE candidate')
      this._socket.emit('iceCandidate', JSON.stringify(candidate) )
    }
    else{
      // Use this way to append item to this array,
      // cannot use `push` method which is overrided
      this._localIceCandidateToSend[this._localIceCandidateToSend.length] = candidate
    }
  }
  /**
  @context instance of `Caller` or `Callee`
  **/
  function onPushRemoteIceCandidateToAdd(candidate){
    var l
    // Have set answer means that exchanged media info.
    // Ensure finish exchanging media info. before start exchanging network info.
    if(this.state.setAnswer){
      console.log('Add remote ICE candidate')
      this._pc.addIceCandidate(
        new RTCIceCandidate(candidate)
      )
      this.state.addedRemoteIceCandidate = true
    }
    else{
      // Use this way to append item to this array,
      // cannot use `push` method which is overrided
      this._remoteIceCandidateToAdd[this._localIceCandidateToSend.length] = candidate
    }
  }
  function onSocketDisconnect(socket){
    console.log('Socket disconnect')
  }
  function handleError(error){
    console.error(error)
  }
  /**
  @context `Caller` 或 `Callee` 的实例
  @param candidate {String}
  **/
  function onSocketIceCandidate(candidate){
    console.log('Receive remote ICE candidate')
    candidate = JSON.parse(candidate)
    // Must use `push` method to store ICE candiate object,
    // because we wrap handle logic in `push` method
    this._remoteIceCandidateToAdd.push(candidate)
  }
  /**
  当 `RTCPeerConnection` 获取到ICE candidate时调用的事件句柄，
  确保在调用此句柄的时候socket已连接。
  `RTCPeerConnection` won't start gathering candidates until `setLocalDescription()` is called
  @context `Caller` 或 `Callee` 的实例
  @param event {Event} `icecandidate` 事件的事件对象
  **/
  function onPcIceCandidate(event){
    var candidate = event.candidate
    console.log('`icecandidate` event trigger')
    if(!candidate){
      console.log('No candidate exists')
      return
    }

    console.log('Add local ICE candidate, stop listening `icecandidate` event')
    // 这么做会删除 `icecandidate` 事件的所有句柄，
    // 而我们想做的只是 `icecandidate` 事件触发的时候不再调用此函数，
    // 所以能够这么做的前提是此函数就是唯一的句柄
    event.target.onicecandidate = null

    // When `icecandidate` event trigger,
    // `RTCPeerConnection` automatically add ICE candidate
    this.state.addedLocalIceCandidate = true

    // Must use `push` method to store ICE candiate object,
    // because we wrap handle logic in `push` method
    this._localIceCandidateToSend.push(candidate)
  }
  /**
  @context instance of `Caller` or `Callee`
  **/
  function exchangeNetworkInfo(){
    var candidate
    if(this._localIceCandidateToSend.length){
      console.log('Send local ICE candidate')
      this.state.addedLocalIceCandidate = true
      while(candidate = this._localIceCandidateToSend.pop()){
        this._socket.emit('iceCandidate', JSON.stringify(candidate))
      }
    }
    if(this._remoteIceCandidateToAdd.length){
      console.log('Add remote ICE candidate')
      this.state.addedRemoteIceCandidate = true
      while(candidate = this._remoteIceCandidateToAdd.pop()){
        this._pc.addIceCandidate(
          new RTCIceCandidate(candidate)
        )
      }
    }
  }
  /**
  @context `Caller` 或 `Callee` 的实例
  @param event {Event} `addstream` 事件的事件对象
  **/
  function onPcAddStream(event){
    console.log('Receive remote stream')
    this.onReceiveRemoteStream(event.stream)
  }

  exports.Caller = Caller
  exports.Callee = Callee
})
