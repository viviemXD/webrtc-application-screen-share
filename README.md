webrtc-application-screen-share    
===============================

Very simple Chrome demo that captures either the users screen or a selected application and shares the video stream over a WebRTC PeerConnection. Demo consists of a presenter who shares their screen or applications and an attendee who views the share on a web page.  The presentor also sends audio and video to attendee.

This repo has three things.

1. Chrome packaged app to share screen or applications (Presenter).
2. Server application using node.js and web socket.
3. Client web page that receives and displays the shared video stream (Chrome).


- Presenter only works using Google Chrome, (Stable, Canary or Chromium).
- No need for a Web Server, uses node.js which acts as both signaling and web server.

![Architecture diagram](https://github.com/emannion/webrtc-application-screen-share/blob/master/arch.png "Arch diagram")

#### screen or application capture uses getUserMedia API and chrome.desktopCapture

```javascript

function onAccessApproved(id) {
  if (!id) {
    console.log("Access rejected");
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
  }, gotStream, getUserMediaError);
}

document.querySelector('#share').addEventListener('click', function(e) {
  pending_request_id = chrome.desktopCapture.chooseDesktopMedia(
      ["screen", "window"], onAccessApproved);
});


```

####  Setup prerequesites

- Install Node.js  and  websocket (sudo npm install websocket)

####  Server Steps (Tested on Linux and MacOS so far)

- clone this repo to your machine, does not need to be to a web server.
- Edit index.html (insert this machines ip address for WebSocket connection).
- Edit packaged_app/app.html (insert this machines ip address for WebSocket connection).
- run 'sudo node app.js'

####  Client Presenter steps (Chrome browser or Chromebook)

- Install packaged app in chrome
- i.e. open 'chrome://extensions'
- click 'Developer Mode' check box.
- Click button 'Load unpacked extension'
- Navigate to the packaged_app folder of this repo
- Launch app by clicking 'launch' link in chrome://extensions
-  Or use Chrome App Launcher to launch it.

####  Client Attendee Steps 

- Start Chrome browser. Firefox can not add two video streams to same peerConnection yet so only use Chrome for now.
- Point browser to  e.g. http://\<your ip address\>:1337

- You can test this on the same machine or across the network over two machines.


