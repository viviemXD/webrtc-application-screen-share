
// Replace with your server domain or ip address
var socket = new WebSocket('ws://10.148.80.54:1337');
var video1 = null;
var video2 = null;
var localStream = null;
var localStream1 = null;
var mediaFlowing = false;
var mediaFlowing1 = false;
var pending_request_id = null;
var pconns = {};

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

// Two peerconnections are used to have Firefox compatability, this is
// because Chrome can do share and video using one PeerConnection but FF needs two.
function setLocalDescAndSendMessagePC0(sessionDescription) {
  pconns[0].setLocalDescription(sessionDescription);
  console.log("Sending: SDP");
  console.log(sessionDescription);
  socket.send(JSON.stringify({
                    "pc": 0,
                    "messageType": "offer",
                    "peerDescription": sessionDescription
              }));
}

function setLocalDescAndSendMessagePC1(sessionDescription) {
  pconns[1].setLocalDescription(sessionDescription);
  console.log("Sending: SDP");
  console.log(sessionDescription);
  socket.send(JSON.stringify({
                    "pc": 1,
                    "messageType": "offer",
                    "peerDescription": sessionDescription
              }));
}

function onCreateOfferFailed() {
  console.log("Create Offer failed");
}

function share() {
  if (!mediaFlowing && localStream) {
    if (!pconns[0]) {
      createPeerConnection(0);
    }
    console.log('Adding local stream...');
    pconns[0].addStream(localStream);
    mediaFlowing = true;

    pconns[0].createOffer(setLocalDescAndSendMessagePC0, onCreateOfferFailed, mediaConstraints);

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
    if (!pconns[1]) {
      createPeerConnection(1);
    }
    console.log('Adding local stream...');
    pconns[1].addStream(localStream1);
    mediaFlowing1 = true;
    pconns[1].createOffer(setLocalDescAndSendMessagePC1, onCreateOfferFailed, mediaConstraints);
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
    pconns[1].close();
    pconns[1] = null;
  }
  video1.src = "";
  video2.src = "";
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
  var pcID = message.pc;

  if (message.messageType === "answer" && mediaFlowing) {
    var remoteDescription = message.peerDescription;
    console.log(remoteDescription);
    console.log('Received answer...');
    console.log('Setting remote session description...' );
    var RTCSessionDescription = window.mozRTCSessionDescription || window.webkitRTCSessionDescription || window.RTCSessionDescription;
    pconns[pcID].setRemoteDescription(new RTCSessionDescription(remoteDescription));

  } else if (message.messageType === "iceCandidate" && mediaFlowing) {
    console.log('Received ICE candidate...');
    var candidate = new RTCIceCandidate({sdpMLineIndex:message.candidate.sdpMLineIndex, sdpMid:message.candidate.sdpMid, candidate:message.candidate.candidate});
    console.log(candidate);
    pconns[pcID].addIceCandidate(candidate);

  } else if (message.messageType === "bye" && mediaFlowing) {
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
  pconns[pcID].addStream(localStream);

  pconns[pcID].addEventListener("addstream", onRemoteStreamAdded, false);
  pconns[pcID].addEventListener("removestream", onRemoteStreamRemoved, false)

  function onRemoteStreamAdded(event) {
    console.log("Added remote stream");
  }

  function onRemoteStreamRemoved(event) {
    console.log("Remove remote stream");
  }
}

