define(function(){
  navigator.getUserMedia =
    navigator.getUserMedia ||
    navigator.webkitGetUserMedia ||
    navigator.mozGetUserMedia

  [
    'requestAnimationFrame',
    'cancelAnimationFrame',
    'URL',
    'RTCPeerConnection'
  ].forEach(function(w3cName){
    var venderNameComponent = w3cName[0].toUpperCase() + w3cName.slice(1)
    this[w3cName] =
      this[w3cName] ||
      this['webkit' + venderNameComponent] ||
      this['moz' + venderNameComponent] ||
      this['ms' + venderNameComponent]
  }, window)
})
