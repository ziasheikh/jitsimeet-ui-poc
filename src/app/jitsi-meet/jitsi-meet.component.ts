import { Component, OnDestroy, OnInit } from '@angular/core';

declare var JitsiMeetJS: any;

@Component({
  selector: 'app-jitsi-meet',
  imports: [],
  templateUrl: './jitsi-meet.component.html',
  styleUrl: './jitsi-meet.component.scss'
})
export class JitsiMeetComponent {
  private connection: any;
  private room: any;
  private localTracks: any[] = [];
  private isJoined = false;
  private screenTrack: any;

  private confOptions = {
    hosts: {
      domain: 'meet.jitsi',
      muc: 'muc.meet.jitsi'
    },
    serviceUrl: 'wss://localhost:8443/xmpp-websocket',
    clientNode: 'http://jitsi.org/jitsimeet'
  };

  constructor() {}

  ngOnInit(): void {
    this.initializeJitsi();
  }

  ngOnDestroy(): void {
    if (this.connection) {
      this.connection.disconnect();
    }
  }

  initializeJitsi() {
    JitsiMeetJS.init();

    this.connection = new JitsiMeetJS.JitsiConnection(null, null, this.confOptions);

    this.connection.addEventListener(JitsiMeetJS.events.connection.CONNECTION_ESTABLISHED, this.onConnectionSuccess.bind(this));
    this.connection.addEventListener(JitsiMeetJS.events.connection.CONNECTION_FAILED, this.onConnectionFailed.bind(this));
    this.connection.addEventListener(JitsiMeetJS.events.connection.CONNECTION_DISCONNECTED, this.disconnect.bind(this));

    this.connection.connect();
  }

  onConnectionSuccess() {
    console.log('Connected to Jitsi Server');
    
    this.room = this.connection.initJitsiConference('my-test-room', {
      openBridgeChannel: true
    });

    this.room.on(JitsiMeetJS.events.conference.TRACK_ADDED, (track: any) => {
      if (track.isLocal()) {
        return;
      }
    
      const participantId = track.getParticipantId(); // who owns this track
      const trackType = track.getType(); // 'audio' or 'video'
    
      console.log('Remote track added:', participantId, trackType);
    
      if (trackType === 'video') {
        const videoElement = document.createElement('video');
        videoElement.id = `remote-video-${participantId}`;
        videoElement.autoplay = true;
        videoElement.playsInline = true;
        videoElement.srcObject = track.stream;
        
        document.getElementById('remote-video-container')?.appendChild(videoElement);
      }
    
      if (trackType === 'audio') {
        const audioElement = document.createElement('audio');
        audioElement.id = `remote-audio-${participantId}`;
        audioElement.autoplay = true;
        audioElement.srcObject = track.stream;
    
        document.getElementById('remote-video-container')?.appendChild(audioElement);
      }
    });
    

    this.room.on(JitsiMeetJS.events.conference.CONFERENCE_JOINED, () => {
      console.log('Conference joined!');
      this.isJoined = true;

      for (let track of this.localTracks) {
        this.room.addTrack(track);
      }
    });

    this.room.join();

    // Create local tracks (camera + microphone)
    JitsiMeetJS.createLocalTracks({ devices: ['audio', 'video'] })
      .then(this.onLocalTracks.bind(this))
      .catch((error: any) => {
        throw error;
      });

      this.room.on(JitsiMeetJS.events.conference.TRACK_REMOVED, (track: any) => {
        const participantId = track.getParticipantId();
        const trackType = track.getType();
      
        if (trackType === 'video') {
          const videoElement = document.getElementById(`remote-video-${participantId}`);
          videoElement?.remove();
        }
      
        if (trackType === 'audio') {
          const audioElement = document.getElementById(`remote-audio-${participantId}`);
          audioElement?.remove();
        }
      });
      
  }

  onConnectionFailed() {
    console.error('Connection Failed!');
  }

  disconnect() {
    console.log('Disconnected!');
    this.connection.removeEventListener(JitsiMeetJS.events.connection.CONNECTION_ESTABLISHED, this.onConnectionSuccess);
    this.connection.removeEventListener(JitsiMeetJS.events.connection.CONNECTION_FAILED, this.onConnectionFailed);
    this.connection.removeEventListener(JitsiMeetJS.events.connection.CONNECTION_DISCONNECTED, this.disconnect);
  }

  onLocalTracks(tracks: any[]) {
    this.localTracks = tracks;
    if (this.isJoined) {
      for (let track of this.localTracks) {
        this.room.addTrack(track);
      }
    }

    // Attach local video stream to DOM
    tracks.forEach((track: any) => {
      if (track.getType() === 'video') {
        const videoElement = document.createElement('video');
        videoElement.autoplay = true;
        videoElement.muted = true;
        videoElement.srcObject = track.stream;
        document.body.appendChild(videoElement);
      }
    });
  }

  muteMic() {
    this.localTracks.forEach(track => {
      if (track.getType() === 'audio') {
        track.mute();
      }
    });
  }
  
  unmuteMic() {
    this.localTracks.forEach(track => {
      if (track.getType() === 'audio') {
        track.unmute();
      }
    });
  }

  turnOffCamera() {
    this.localTracks.forEach((track, index) => {
      if (track.getType() === 'video') {
        track.dispose(); // Properly dispose the video track
        this.localTracks.splice(index, 1); // Remove from localTracks array
      }
    });
    console.log('Camera turned off');
  }
  
  async turnOnCamera() {
    try {
      const newTracks = await JitsiMeetJS.createLocalTracks({ devices: ['video'] });
      const videoTrack = newTracks[0];
  
      if (this.isJoined && this.room) {
        this.room.addTrack(videoTrack); // Add the new video track to the room
      }
  
      // Also show on UI
      const localContainer = document.getElementById('local-video-container');
      if (localContainer) {
        localContainer.innerHTML = ''; // Clear previous video if any
  
        const videoElement = document.createElement('video');
        videoElement.autoplay = true;
        videoElement.muted = true;
        videoElement.srcObject = videoTrack.stream;
        localContainer.appendChild(videoElement);
      }
  
      this.localTracks.push(videoTrack);
      console.log('Camera turned on');
    } catch (error) {
      console.error('Failed to turn on camera', error);
    }
  }

  startScreenShare() {
    if (this.screenTrack) {
      console.warn('Already sharing screen');
      return;
    }
  
    JitsiMeetJS.createLocalTracks({ devices: ['desktop'] })
      .then(([track]: any) => {
        this.screenTrack = track;
  
        if (this.isJoined && this.room) {
          this.room.addTrack(track);
        }
  
        const screenElement = document.createElement('video');
        screenElement.autoplay = true;
        screenElement.muted = true;
        screenElement.srcObject = track.stream;
        screenElement.style.border = '2px solid blue';
        screenElement.id = 'screen-share-video';
        document.body.appendChild(screenElement);
  
        // Listen for when the user stops sharing from the browser
        track.addEventListener(JitsiMeetJS.events.track.LOCAL_TRACK_STOPPED, () => {
          this.stopScreenShare();
        });
      })
      .catch((error: any) => {
        console.error('Failed to start screen sharing', error);
      });
  }
  
  stopScreenShare() {
    if (!this.screenTrack) return;
  
    this.room.removeTrack(this.screenTrack);
    this.screenTrack.dispose();
    this.screenTrack = null;
  
    const screenElement = document.getElementById('screen-share-video');
    if (screenElement) {
      screenElement.remove();
    }
  
    console.log('Screen sharing stopped.');
  }
}
