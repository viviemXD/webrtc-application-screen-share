// Replace with your server domain or ip address, or use configure button on app to set this
var serverAddress = '192.168.1.5' ;
var socket = null;
var shareVideo = null;
var localVideo = null;
var remoteVideo = null;
var shareStream = null;
var videoStream = null;
var shareFlowing = false;
var videoFlowing = false;
var isPresentor = false;
var shareVideoActive = false;
var remoteVideoActive = false;
var removeVP8Codec = false;
var joinReceived = false;
var pending_request_id = null;
var pconns = {};

var mediaConstraints = {'mandatory': {
                        'offerToReceiveAudio':true, 
                        'offerToReceiveVideo':true}};

shareVideo = document.getElementById("shareVideo");

var serverString = 'wss://' + serverAddress + ':443';                                                                                                                                                                                       
socket = new WebSocket(serverString);
socket.addEventListener("message", onWebSocketMessage, false);

function gotShareStream(stream) {
  shareVideo.src = URL.createObjectURL(stream);
  shareStream = stream;
  share();

  if ("WebSocket" in window) {
    socket.onopen = function() {
      console.log("WebSocket connection open");
    };
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
  if (isPresentor) {
    connect();
  }
  stream.onended = function() { console.log("Audio Video stream ended"); };
}

function errorCallback(error) {
  console.error('An error occurred: [CODE ' + error + ']');
  return;
}

function onAccessApproved(id) {
  isPresentor = true;
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
  isPresentor = true;
  joinReceived = false;

  // turn on audio \ video on attendee
  socket.send(JSON.stringify({
                "pc": 0,
                "messageType": "publish"
             }));
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
  joinReceived = false; 
  var overlay = document.getElementById("overlay");
  var popup = document.getElementById("popup");
  overlay.style.display = "none";
  popup.style.display = "none"; 
  removeVP8Codec = document.getElementById('h264').checked;

  if (document.getElementById('small').checked) {
    document.getElementById("remoteVideo").className = "video-small";
  } else if (document.getElementById('medium').checked) {
    document.getElementById("remoteVideo").className = "video-medium";
  } else {
    document.getElementById("remoteVideo").className = "video-large";
  }

  serverAddress = document.getElementById("serverAddress").value;
  serverString = 'wss://' + serverAddress + ':443';                                                                                                                                                                                       
  socket = new WebSocket(serverString);
  socket.addEventListener("message", onWebSocketMessage, false);
});

function raiseMeetingNotification() {
  var overlay = document.getElementById("overlayMedia");
  var popup = document.getElementById("popupMedia");
  overlay.style.display = "block";
  popup.style.display = "block";
}

document.querySelector('#joinMeeting').addEventListener('click', function(e) {
  startVideo();

  socket.send(JSON.stringify({
                "pc": 0,
                "messageType": "join"
             }));

  closeMeetingNotification();
});

document.querySelector('#cancelMeeting').addEventListener('click', function(e) {
  closeMeetingNotification();
});

function closeMeetingNotification() {
  var overlay = document.getElementById("overlayMedia");
  var popup = document.getElementById("popupMedia");
  overlay.style.display = "none";
  popup.style.display = "none"; 
}

function removeVP8(sdp) {
  console.log("SDP before manipulation: " + sdp);

  // TODO An easier way to select h.264 is to just move the payload type number of the codec you want selected to the start of the list.
  // instead of all the SDP replace calls.
  updated_sdp = sdp.replace("m=video 9 RTP/SAVPF 100 116 117 120 96\r\n","m=video 9 RTP/SAVPF 120\r\n");
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
  
  console.log("SDP after manipulation: " + updated_sdp);

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

function share() {
  if (shareStream) {
    if (!pconns[0]) {
      createPeerConnection(0);
    }
    console.log('Adding local stream...');
    pconns[0].addStream(shareStream);
    shareFlowing = true;

    pconns[0].createOffer(setLocalDescAndSendMessagePC0Offer, errorCallback, mediaConstraints);

    startVideo();

  } else {
    console.log("Local share stream not running.");
  }
}

function startVideo() {
    // grab camera and mic
    navigator.webkitGetUserMedia({
      audio: true,
      video: true
    }, gotAudioVideoStream, errorCallback);
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
  if (videoStream.active) {
    var track = videoStream.getTracks()[0]; 
    track.stop();
    videoStream = null;
    localVideo.src = "";
    remoteVideo.src = "";
  }
  if (shareStream) {
    var track = shareStream.getTracks()[0];  
    track.stop();
    shareStream = null;
  }
  if (shareVideo) {
    shareVideo.src = "";
  } 
  shareFlowing = false;
  videoFlowing = false;
  isPresentor = false;
  shareVideoActive = false;
  remoteVideoActive = false;
  joinReceived = false;
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
      // Remove VP8 from offer
      remoteDescription.sdp = removeVP8(remoteDescription.sdp);
    }

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

  } else if (message.messageType === "publish" ) {
    console.log("Received publish");
    if (!isPresentor) {
      raiseMeetingNotification();
    }

  } else if (message.messageType === "join" ) {
    console.log("Received join");
    if (isPresentor && !joinReceived) {
      joinReceived = true;
      pending_request_id = chrome.desktopCapture.chooseDesktopMedia(
        ["screen", "window"], onAccessApproved);
    }
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
  if (!isPresentor) {
    pconns[pcID].addStream(videoStream);
  }

  pconns[pcID].addEventListener("addstream", onRemoteStreamAdded, false);
  pconns[pcID].addEventListener("removestream", onRemoteStreamRemoved, false)

  function onRemoteStreamAdded(event) {
    console.log("Added remote stream");

    if (!shareVideoActive && !isPresentor) {
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
  }

  function onRemoteStreamRemoved(event) {
    console.log("Remove remote stream");
    remoteVideo.src = "";
  }
}
