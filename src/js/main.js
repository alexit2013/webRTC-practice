(function(window){
    function query(selector){
        return window.document.querySelectorAll(selector) || null;
    }

    // variables init
    var selfVideo = query('#selfVideo'),
        startBtn = query('#startBtn');

    var handlers = {
        onClickStartBtn: function(){
            selfVideo.autoPlay = true;
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
            );
        },
        onGetUserMediaSuccess: function(stream){
            selfVideo.src = window.URL.createObjectURL(stream);
        },
        onGetUserMediaFail: function(event){
            console.error('Getting user media fails: %O', event);
        }
    };

    // polyfill
    navigator.getUserMedia =
        navigator.getUserMedia ||
        navigator.webkitGetUserMedia ||
        navigator.mozGetUserMedia;

    startBtn.addEventListener('click', handlers.onClickStartBtn);
})(this);
