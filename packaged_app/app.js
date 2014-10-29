// Replace with your server domain or ip address, or use configure button on app to set this
var serverAddress = '192.168.1.2';
var socket = null;
var shareVideo = null;
var localVideo = null;
var remoteVideo = null;
var shareStream = null;
var videoStream = null;
var shareFlowing = false;
var videoFlowing = false;
var pending_request_id = null;
var pconns = {};

var mediaConstraints = {'mandatory': {
                        'OfferToReceiveAudio':true, 
                        'OfferToReceiveVideo':true}};

function gotShareStream(stream) {
  shareVideo = document.getElementById("shareVideo");
  shareVideo.src = URL.createObjectURL(stream);
  shareStream = stream;

  var serverString = 'ws://' + serverAddress + ':1337';
  socket = new WebSocket(serverString);
  socket.addEventListener("message", onWebSocketMessage, false);
  
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
  localVideo = document.getElementById("localVideo");
  remoteVideo = document.getElementById("remoteVideo");  // may move this
  localVideo.src = URL.createObjectURL(stream);
  videoStream = stream;
  connect();
  stream.onended = function() { console.log("Audio Video stream ended"); };
}

function errorCallback(error) {
  console.error('An error occurred: [CODE ' + error + ']');
  return;
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
  }, gotShareStream, errorCallback);
}

document.querySelector('#share').addEventListener('click', function(e) {
  pending_request_id = chrome.desktopCapture.chooseDesktopMedia(
      ["screen", "window"], onAccessApproved);
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

function share() {
  if (shareStream) {
    if (!pconns[0]) {
      createPeerConnection(0);
    }
    console.log('Adding local stream...');
    pconns[0].addStream(shareStream);
    shareFlowing = true;

    pconns[0].createOffer(setLocalDescAndSendMessagePC0Offer, errorCallback, mediaConstraints);

    // grab camera and mic also
    navigator.webkitGetUserMedia({
      audio: true,
      video: true
    }, gotAudioVideoStream, errorCallback);

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
    pconns[1].createOffer(setLocalDescAndSendMessagePC1Offer, errorCallback, mediaConstraints);
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

  if (pconns[0] != null) {
    pconns[0].close();
    pconns[0] = null;
  }
  if (pconns[1] != null) {
    pconns[1].close();
    pconns[1] = null;
  }
  if (videoStream) {
    videoStream.stop(); 
    videoStream = null;
    localVideo.src = "";
    remoteVideo.src = "";
  }
  if (shareStream) {
    shareStream.stop();
    shareStream = null;
    shareVideo.src = "";
  } 
  shareFlowing = false;
  videoFlowing = false;
}

//socket.addEventListener("message", onWebSocketMessage, false);

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
    var RTCSessionDescription = window.mozRTCSessionDescription || window.webkitRTCSessionDescription || window.RTCSessionDescription;
    pconns[pcID].setRemoteDescription(new RTCSessionDescription(remoteDescription), function() {
      console.log('Sending answer...');
      if (pcID == 0)
        pconns[0].createAnswer(setLocalDescAndSendMessagePC0Answer, errorCallback, mediaConstraints);
      else
        pconns[1].createAnswer(setLocalDescAndSendMessagePC1Answer, errorCallback, mediaConstraints);
    }, errorCallback);

  } else if (message.messageType === "answer" && shareFlowing) {
    var remoteDescription = message.peerDescription;
    console.log(remoteDescription);
    console.log('Received answer...');
    console.log('Setting remote session description...' );
    var RTCSessionDescription = window.mozRTCSessionDescription || window.webkitRTCSessionDescription || window.RTCSessionDescription;
    pconns[pcID].setRemoteDescription(new RTCSessionDescription(remoteDescription));

  } else if (message.messageType === "iceCandidate" && shareFlowing) {
    console.log('Received ICE candidate...');
    var candidate = new RTCIceCandidate({sdpMLineIndex:message.candidate.sdpMLineIndex, sdpMid:message.candidate.sdpMid, candidate:message.candidate.candidate});
    console.log(candidate);
    pconns[pcID].addIceCandidate(candidate);

  } else if (message.messageType === "bye" && shareFlowing) {
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
  pconns[pcID].addStream(shareStream);

  pconns[pcID].addEventListener("addstream", onRemoteStreamAdded, false);
  pconns[pcID].addEventListener("removestream", onRemoteStreamRemoved, false)

  function onRemoteStreamAdded(event) {
    console.log("Added remote stream");
    remoteVideo.src = window.URL.createObjectURL(event.stream);
    remoteVideo.play();
  }

  function onRemoteStreamRemoved(event) {
    console.log("Remove remote stream");
    remoteVideo.src = "";
  }
}

