webrtc-application-screen-share    
===============================

Capture the users screen, application, audio or video and share over a WebRTC PeerConnection. This simple demo consists of a presenter who shares their screen or applications and an attendee who views that share video on a web page or a chrome extension.  The attendee can be either a Chrome extension or Firefox browser. The presenter must be using Chrome or a Chrome extension.  So right now this is a two user demo, one presentor and one attendee only.

This repo has three pieces.

1. Chrome packaged app to share screen applications and audio\video. Can be used both peers being presentor or attendee depending who shares first.
2. Server application using node.js and web socket to relay messages between peers.
3. Attendee: Web page that receives and displays the shared video stream (Chrome or Firefox).


- Presenter and Attendee packaged apps only work using Google Chrome, (Stable, Canary or Chromium).
- No need for a Web Server, it uses node.js which does both the WebRTC signaling and serves up the presentor web page.

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

####  Server Steps (Tested on Linux, MacOS and Windows)

- clone this repo to your machine, does not need to be to a web server.
- Edit packaged_app/app.js (insert this machines ip address for WebSocket connection). Or use configure button when running.
- run 'node app.js'  or 'sudo node app.js' depending on your user, try both.

####  Client Packaged App steps (Chrome browser or Chromebook)

- Install packaged app in chrome
- i.e. open 'chrome://extensions'
- click 'Developer Mode' check box.
- Click button 'Load unpacked extension'
- Navigate to the packaged_app folder of this repo
- Launch app by clicking 'launch' link in chrome://extensions
-  Or use Chrome App Launcher to launch it.

####  Client Attendee Web Page Steps 

- Start Chrome or Firefox browser
- Point browser to  e.g. http://\<your node.js ip address\>:1337
- You can test this on the same machine or across the network over two machines.

