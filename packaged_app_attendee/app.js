// This is the attendee packaged app
// Replace with your server domain or ip address, or use configure button on app to set this 
var serverAddress = '10.148.80.255';
var shareVideo = null;
var localVideo = null;
var remoteVideo = null;
var shareStream = null;
var videoStream = null;
var shareFlowing = false;
var videoFlowing = false;
var pending_request_id = null;
var pconns = {};
var shareVideoActive = false;
var remoteVideoActive = false;
var removeVP8Codec = false;

var mediaConstraints = {'mandatory': {
                        'OfferToReceiveAudio':true, 
                        'OfferToReceiveVideo':true}};

function gotShareStream(stream) {
  shareVideo = document.getElementById("shareVideo");
  shareVideo.src = URL.createObjectURL(stream);
  shareStream = stream;

  if ("WebSocket" in window) {
    socket.onopen = function() {
      console.log("WebSocket connection open");
    };
    share();
  } else {
    console.log("No web socket connection");
  }

  stream.onended = function() { console.log("Share stream ended"); };
}

function gotAudioVideoStream(stream) {

  var serverString = 'ws://' + serverAddress + ':1337';
  socket = new WebSocket(serverString);
  socket.addEventListener("message", onWebSocketMessage, false);hareVideo = document.getElementById("shareVideo");
  shareVideo = document.getElementById("shareVideo");
  localVideo = document.getElementById("localVideo");
  remoteVideo = document.getElementById("remoteVideo");  // may move this
  localVideo.src = URL.createObjectURL(stream);
  videoStream = stream;
  stream.onended = function() { console.log("Audio Video stream ended"); };
}

function getUserMediaError() {
  console.log("getUserMedia() failed");
}

function onAccessApproved(id) {
  if (!id) {
    console.log("Access rejected.");
    return;
  }
  navigator.webkitGetUserMedia({
      audio: false,
      video: { mandatory: { chromeMediaSource: "desktop",
                            chromeMediaSourceId: id,
                            maxWidth: screen.width,
                            maxHeight: screen.height,
                            minFrameRate: 1,
                            maxFrameRate: 5 }}
  }, gotShareStream, getUserMediaError);
}

document.querySelector('#startVideo').addEventListener('click', function(e) {

    // grab camera and mic also
    navigator.webkitGetUserMedia({
      audio: true,
      video: true
    }, gotAudioVideoStream, getUserMediaError);

});

document.querySelector('#cancel').addEventListener('click', function(e) {
  if (pending_request_id != null) {
    chrome.desktopCapture.cancelChooseDesktopMedia(pending_request_id);
  }
  disconnect();
});

document.querySelector('#configure').addEventListener('click', function(e) {
  var overlay = document.getElementById("overlay");
  var popup = document.getElementById("popup");
  overlay.style.display = "block";
  popup.style.display = "block";
  document.getElementById("serverAddress").value = serverAddress;
});

document.querySelector('#closeConfiguration').addEventListener('click', function(e) {
  var overlay = document.getElementById("overlay");
  var popup = document.getElementById("popup");
  overlay.style.display = "none";
  popup.style.display = "none"; 
  serverAddress = document.getElementById("serverAddress").value;
});

function removeVP8(sdp) {
  //updated_sdp = sdp.replace("m=video 1 RTP/SAVPF 100 116 117 96 120 121\r\n","m=video 1 RTP/SAVPF 120 121\r\n");
  updated_sdp = sdp.replace("m=video 1 RTP/SAVPF 100 116 117 96 120 121\r\n","m=video 1 RTP/SAVPF 120\r\n");
  updated_sdp = updated_sdp.replace("","");
  updated_sdp = updated_sdp.replace("a=rtpmap:100 VP8/90000\r\n","");
  updated_sdp = updated_sdp.replace("a=rtpmap:120 H264/90000\r\n","a=rtpmap:120 H264/90000\r\na=fmtp:120 profile-level-id=42e01f;packetization-mode=1\r\n");

  updated_sdp = updated_sdp.replace("a=rtcp-fb:100 nack\r\n","");
  updated_sdp = updated_sdp.replace("a=rtcp-fb:100 nack pli\r\n","");
  updated_sdp = updated_sdp.replace("a=rtcp-fb:100 ccm fir\r\n","");
  updated_sdp = updated_sdp.replace("a=rtcp-fb:100 goog-remb\r\n","");
  updated_sdp = updated_sdp.replace("a=rtpmap:116 red/90000\r\n","");
  updated_sdp = updated_sdp.replace("a=rtpmap:117 ulpfec/90000\r\n","");
  updated_sdp = updated_sdp.replace("a=rtpmap:96 rtx/90000\r\n","");
  updated_sdp = updated_sdp.replace("a=fmtp:96 apt=100\r\n","");

  updated_sdp = updated_sdp.replace("a=rtpmap:121 CAST1/90000\r\n","");
  updated_sdp = updated_sdp.replace("a=rtcp-fb:121 ccm fir\r\n","");
  updated_sdp = updated_sdp.replace("a=rtcp-fb:121 nack\r\n","");
  updated_sdp = updated_sdp.replace("a=rtcp-fb:121 nack pli\r\n","");
  updated_sdp = updated_sdp.replace("a=rtcp-fb:121 goog-remb\r\n","");

  return updated_sdp;
}

// Two peerconnections are used for Firefox compatability, this is
// because Chrome can do share and video using one PeerConnection but FF needs two.
function setLocalDescAndSendMessagePC0Offer(sessionDescription) {
  pconns[0].setLocalDescription(sessionDescription);
  console.log("Sending: SDP");
  console.log(sessionDescription);
  socket.send(JSON.stringify({
                    "pc": 0,
                    "messageType": "offer",
                    "peerDescription": sessionDescription
              }));
}

function setLocalDescAndSendMessagePC1Offer(sessionDescription) {
  pconns[1].setLocalDescription(sessionDescription);
  console.log("Sending: SDP");
  console.log(sessionDescription);
  socket.send(JSON.stringify({
                    "pc": 1,
                    "messageType": "offer",
                    "peerDescription": sessionDescription
              }));
}

function setLocalDescAndSendMessagePC0Answer(sessionDescription) {
  pconns[0].setLocalDescription(sessionDescription);
  console.log("Sending: SDP");
  console.log(sessionDescription);
  socket.send(JSON.stringify({
                    "pc": 0,
                    "messageType": "answer",
                    "peerDescription": sessionDescription
              }));
}

function setLocalDescAndSendMessagePC1Answer(sessionDescription) {
  pconns[1].setLocalDescription(sessionDescription);
  console.log("Sending: SDP");
  console.log(sessionDescription);
  socket.send(JSON.stringify({
                    "pc": 1,
                    "messageType": "answer",
                    "peerDescription": sessionDescription
              }));
}

function onCreateOfferFailed() {
  console.log("Create Offer failed");
}

function share() {
  if (shareStream) {
    if (!pconns[0]) {
      createPeerConnection(0);
    }
    console.log('Adding local stream...');
    pconns[0].addStream(shareStream);
    shareFlowing = true;

    pconns[0].createOffer(setLocalDescAndSendMessagePC0Offer, onCreateOfferFailed, mediaConstraints);

    // grab camera and mic also
    navigator.webkitGetUserMedia({
      audio: true,
      video: true
    }, gotAudioVideoStream, getUserMediaError);

  } else {
    console.log("Local share stream not running.");
  }
}

function connect() {
  if (!videoFlowing && videoStream) {
    if (!pconns[1]) {
      createPeerConnection(1);
    }
    console.log('Adding local stream...');
    pconns[1].addStream(videoStream);
    videoFlowing = true;
    pconns[1].createOffer(setLocalDescAndSendMessagePC1Offer, onCreateOfferFailed, mediaConstraints);
  } else {
    console.log("Local stream not running.");
  }
}

// stop the connection on button click 
function disconnect() {
  console.log("disconnect()");    
  socket.send(JSON.stringify({
                "pc": 0,
                "messageType": "bye"
             }));
  stop();
}

function stop() {

  if (videoStream) {
    videoStream.stop();
    videoStream = null;
  }

  if (pconns[0] != null) {
    pconns[0].close();
    pconns[0] = null;
  }
  if (pconns[1] != null) {
    pconns[1].close();
    pconns[1] = null;
  }
  shareVideo.src = "";
  localVideo.src = "";
  remoteVideo.src = "";
  shareFlowing = false;
  videoFlowing = false;
  shareVideoActive = false;
  remoteVideoActive = false;
}

function onCreateOfferFailed() {
  console.log("Create Offer failed");
}

function onCreateAnswerFailed() {
  console.log("Create Answer failed");
}

// process messages from web socket
function onWebSocketMessage(evt) {
  var message = JSON.parse(evt.data);
  var pcID = message.pc;

  if(message.messageType === "offer") {
    console.log("Received offer...")
    if (!pconns[pcID]) {
      createPeerConnection(pcID);
    }
    shareFlowing = true;
    console.log('Creating remote session description...' );

    var remoteDescription = message.peerDescription;

    if (removeVP8Codec) {
      // Remove VP8 from offer every time
      remoteDescription.sdp = removeVP8(remoteDescription.sdp);
    }   

    var RTCSessionDescription = window.mozRTCSessionDescription || window.webkitRTCSessionDescription || window.RTCSessionDescription;
    pconns[pcID].setRemoteDescription(new RTCSessionDescription(remoteDescription), function() {
      console.log('Sending answer...');
      if (pcID == 0)
        pconns[0].createAnswer(setLocalDescAndSendMessagePC0Answer, onCreateAnswerFailed, mediaConstraints);
      else
        pconns[1].createAnswer(setLocalDescAndSendMessagePC1Answer, onCreateAnswerFailed, mediaConstraints);
    }, function() {
      console.log('Error setting remote description');
    });

  } else if (message.messageType === "answer") {
    var remoteDescription = message.peerDescription;
    console.log(remoteDescription);
    console.log('Received answer...');
    console.log('Setting remote session description...' );

    var remoteDescription = message.peerDescription;

    if (removeVP8Codec) {
      // Remove VP8 from offer every time
      remoteDescription.sdp = removeVP8(remoteDescription.sdp);
    }  

    var RTCSessionDescription = window.mozRTCSessionDescription || window.webkitRTCSessionDescription || window.RTCSessionDescription;
    pconns[pcID].setRemoteDescription(new RTCSessionDescription(remoteDescription));

  } else if (message.messageType === "iceCandidate") {
    console.log('Received ICE candidate...');
    var candidate = new RTCIceCandidate({sdpMLineIndex:message.candidate.sdpMLineIndex, sdpMid:message.candidate.sdpMid, candidate:message.candidate.candidate});
    console.log(candidate);
    pconns[pcID].addIceCandidate(candidate);

  } else if (message.messageType === "bye") {
    console.log("Received bye");
    stop();

  }
}

function createPeerConnection(pcID) {
  console.log("Creating peer connection");
  RTCPeerConnection = window.webkitRTCPeerConnection || window.mozRTCPeerConnection;
  var pc_config = {"iceServers":[]};
  try {
    pconns[pcID] = new RTCPeerConnection(pc_config);
  } catch (e) {
    console.log("Failed to create PeerConnection, exception: " + e.message);
  }

  // send any ice candidates to the other peer
  pconns[pcID].onicecandidate = function (evt) {
    if (evt.candidate) {
      console.log('Sending ICE candidate...');
      console.log(evt.candidate);

      socket.send(JSON.stringify({
                    "pc": pcID,
                    "messageType": "iceCandidate",
                    "candidate": evt.candidate
                  }));   
    } else {
      console.log("End of candidates.");
    }
  };

  console.log('Adding local stream...');
  pconns[pcID].addStream(videoStream);

  pconns[pcID].addEventListener("addstream", onRemoteStreamAdded, false);
  pconns[pcID].addEventListener("removestream", onRemoteStreamRemoved, false)

  function onRemoteStreamAdded(event) {
    console.log("Added remote stream");

    if (!shareVideoActive) {
      shareVideo.src = window.URL.createObjectURL(event.stream);
      shareVideo.play();
      shareVideoActive = true;
      return;
    }

    if (!remoteVideoActive) {
      remoteVideo.src = window.URL.createObjectURL(event.stream);
      remoteVideo.play();
      remoteVideoActive = true;
    }
    if (pcID == 0)
      pconns[0].createAnswer(setLocalDescAndSendMessagePC0Answer, onCreateAnswerFailed, mediaConstraints);
    else
      pconns[1].createAnswer(setLocalDescAndSendMessagePC1Answer, onCreateAnswerFailed, mediaConstraints);

  }

  function onRemoteStreamRemoved(event) {
    console.log("Remove remote stream");
    remoteVideo.src = "";
  }
}

