webrtc-application-screen-share
===============================

This repo has three things.

1. Chrome packaged app to share screen or applications (Presenter).
2. Server application using node.js and web socket.
3. Client web page that receives and displays the shared video stream (Attendee).


- Only works using Google Chrome, (Stable, Canary or Chromium).
- No need for a Web Server, uses node.js which acts as both signaling and web server. 


#### screen or application capture uses getUserMedia API 

```javascript

function onAccessApproved(id) {
  if (!id) {
    console.log("Access rejected");
    return;
  }
  navigator.webkitGetUserMedia({                                                                                                                                                                                                                    audio: false,
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

- Install Node.js and websocket (sudo npm install websocket)

####  Server Steps (Tested on Linux and MacOS so far)

- clone this repo to your machine, does not need to be to a web server.
- Edit index.html (insert this machines ip address for WebSocket connection).
- Edit packaged_app/app.html (insert this machines ip address for WebSocket connection).
- run 'sudo node app.js'

####  Share Presenter \ Host steps

- Install packaged app in chrome
- Open 'chrome://extensions'
- Click button 'Load unpacked extension'
- Navigate to the packaged_app folder of this repo
- Launch app by clicking 'launch' link in chrome://extensions
-  Or use Chrome App Launcher to launch it.

####  Client Attendee Steps

- Start Chrome browser.
- Point browser to  e.g. http://\<your ip address\>:1337

