
// Replace with your server domain or ip address
var socket = new WebSocket('ws://10.148.81.29:1337');
var video1 = null;
var video2 = null;
var localStream = null;
var localStream1 = null;
var mediaFlowing = false;
var mediaFlowing1 = false;
var pc = null; 
var pending_request_id = null;

var mediaConstraints = {'mandatory': {
                        'OfferToReceiveAudio':false, 
                        'OfferToReceiveVideo':false}};

function gotStream1(stream) {
  video1 = document.getElementById("video1");
  video1.src = URL.createObjectURL(stream);
  localStream = stream;

  if ("WebSocket" in window) {
    socket.onopen = function() {
      console.log("WebSocket connection open");
    };
    share();
  } else {
    console.log("No web socket connection");
  }

  stream.onended = function() { console.log("Stream ended"); };
}

function gotStream2(stream) {
  video2 = document.getElementById("video2");
  video2.src = URL.createObjectURL(stream);
  localStream1 = stream;
  connect();
  stream.onended = function() { console.log("Stream ended"); };
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
  }, gotStream1, getUserMediaError);
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

// send SDP over web socket 
function setLocalDescAndSendMessage(sessionDescription) {
  pc.setLocalDescription(sessionDescription);
  console.log("Sending: SDP");
  console.log(sessionDescription);
  socket.send(JSON.stringify({
                    "messageType": "offer",
                    "peerDescription": sessionDescription
              }));
}

function onCreateOfferFailed() {
  console.log("Create Offer failed");
}

function share() {
  if (!mediaFlowing && localStream) {
    if (!pc) {
      createPeerConnection();
    }
    console.log('Adding local stream...');
    pc.addStream(localStream);
    mediaFlowing = true;

    // grab camera and mic also
    navigator.webkitGetUserMedia({
      audio: true,
      video: true
    }, gotStream2, getUserMediaError);

  } else {
    console.log("Local stream not running.");
  }
}

function connect() {
  if (!mediaFlowing1 && localStream1) {
    if (!pc) {
      createPeerConnection();
    }
    console.log('Adding local stream...');
    pc.addStream(localStream1);
    mediaFlowing1 = true;
    pc.createOffer(setLocalDescAndSendMessage, onCreateOfferFailed, mediaConstraints);
  } else {
    console.log("Local stream not running.");
  }
}

// stop the connection on button click 
function disconnect() {
  console.log("disconnect()");    
  socket.send(JSON.stringify({
                "messageType": "bye"
             }));
  stop();
}

function stop() {
  if (pc != null) {
    pc.close();
    pc = null;
  }
  video1.src = null;
  video2.src = null;
  mediaFlowing = false;
  mediaFlowing1 = false;
}

function onCreateOfferFailed() {
  console.log("Create Offer failed");
}

function onCreateAnswerFailed() {
  console.log("Create Answer failed");
}

socket.addEventListener("message", onWebSocketMessage, false);

// process messages from web socket
function onWebSocketMessage(evt) {
  var message = JSON.parse(evt.data);

  if (message.messageType === "answer" && mediaFlowing) {
    var remoteDescription = message.peerDescription;
    console.log(remoteDescription);
    console.log('Received answer...');
    console.log('Setting remote session description...' );
    var RTCSessionDescription = window.mozRTCSessionDescription || window.webkitRTCSessionDescription || window.RTCSessionDescription;
    pc.setRemoteDescription(new RTCSessionDescription(remoteDescription));

  } else if (message.messageType === "iceCandidate" && mediaFlowing) {
    console.log('Received ICE candidate...');
    var candidate = new RTCIceCandidate({sdpMLineIndex:message.candidate.sdpMLineIndex, sdpMid:message.candidate.sdpMid, candidate:message.candidate.candidate});
    console.log(candidate);
    pc.addIceCandidate(candidate);

  } else if (message.messageType === "bye" && mediaFlowing) {
    console.log("Received bye");
    stop();
  }
}

function createPeerConnection() {
  console.log("Creating peer connection");
  RTCPeerConnection = window.webkitRTCPeerConnection || window.mozRTCPeerConnection;
  var pc_config = {"iceServers":[]};
  try {
    pc = new RTCPeerConnection(pc_config);
  } catch (e) {
    console.log("Failed to create PeerConnection, exception: " + e.message);
  }

  // send any ice candidates to the other peer
  pc.onicecandidate = function (evt) {
    if (evt.candidate) {
      console.log('Sending ICE candidate...');
      console.log(evt.candidate);

      socket.send(JSON.stringify({
                    "messageType": "iceCandidate",
                    "candidate": evt.candidate
                  }));   
    } else {
      console.log("End of candidates.");
    }
  };
  console.log('Adding local stream...');
  pc.addStream(localStream);

  pc.addEventListener("addstream", onRemoteStreamAdded, false);
  pc.addEventListener("removestream", onRemoteStreamRemoved, false)

  function onRemoteStreamAdded(event) {
    console.log("Added remote stream");
  }

  function onRemoteStreamRemoved(event) {
    console.log("Remove remote stream");
  }
}

