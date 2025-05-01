import { Component, OnDestroy, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ToolbarModule } from 'primeng/toolbar';
import { ButtonModule } from 'primeng/button';
import { PanelModule } from 'primeng/panel';
import { ToggleButtonModule } from 'primeng/togglebutton';

import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';

declare var JitsiMeetJS: any;

@Component({
  selector: 'app-jitsi-meet',
  imports: [ToolbarModule, ButtonModule, PanelModule, ToggleButtonModule, MatIconModule, CommonModule, MatToolbarModule],
  templateUrl: './jitsi-meet.component.html',
  styleUrl: './jitsi-meet.component.scss'
})
export class JitsiMeetComponent {
  @ViewChild('localVideo', { static: true }) localVideo!: ElementRef<HTMLVideoElement>;
  @ViewChild('remoteContainer', { static: true }) remoteContainer!: ElementRef<HTMLDivElement>;


  private connection: any;
  private room: any;
  private localTracks: any[] = [];
  private isJoined = false;
  private screenTrack: any;

  isMuted = false;
  isCameraOn = true;
  isSharingScreen = false;

  private confOptions = {
    hosts: {
      domain: 'meet.jitsi',
      muc: 'muc.meet.jitsi'
    },
    serviceUrl: 'wss://localhost:8443/xmpp-websocket',
    clientNode: 'http://jitsi.org/jitsimeet'
  };

  constructor() { }

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
        const container = document.createElement('div');
        container.className = 'participant-container';

        const videoElement = document.createElement('video');
        videoElement.autoplay = true;
        videoElement.playsInline = true;
        videoElement.srcObject = track.getOriginalStream();
        videoElement.id = `remote-video-${participantId}`;
        videoElement.style.width = '100%';
        container.appendChild(videoElement);
        this.remoteContainer.nativeElement.appendChild(videoElement);

      }

      if (trackType === 'audio') {
        const audioElement = document.createElement('audio');
        audioElement.id = `remote-audio-${participantId}`;
        audioElement.autoplay = true;
        audioElement.srcObject = track.getOriginalStream();
        this.remoteContainer.nativeElement.appendChild(audioElement);

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

    this.localTracks.forEach((track: any) => {
      if (track.getType() === 'video') {
        this.localVideo.nativeElement.srcObject = track.getOriginalStream();
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
    this.localTracks = this.localTracks.filter((track) => {
      if (track.getType() === 'video') {
        if (this.room) {
          this.room.removeTrack(track); // Remove track from the room first warna freezing hogi
        }
        track.dispose();
        return false; // remove from list
      }
      return true;
    });

    const videoElement = this.localVideo.nativeElement;
    videoElement.pause();
    videoElement.srcObject = null;

    this.isCameraOn = false;
    console.log('Camera turned off');
  }




  async turnOnCamera() {
    try {
      const newTracks = await JitsiMeetJS.createLocalTracks({ devices: ['video'] });
      const videoTrack = newTracks[0];

      if (this.isJoined && this.room) {
        this.room.addTrack(videoTrack);
      }

      const stream = videoTrack.getOriginalStream();
      if (!stream) {
        console.error('No stream found on new video track');
        return;
      }

      const videoElement = this.localVideo.nativeElement;
      videoElement.srcObject = stream;
      videoElement.onloadedmetadata = () => {
        videoElement.play().catch((err) => {
          console.error('Playback error:', err);
        });
      };

      this.localTracks.push(videoTrack);
      this.isCameraOn = true;
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
        screenElement.srcObject = track.getOriginalStream();
        screenElement.style.border = '2px solid blue';
        screenElement.id = 'screen-share-video';
        this.remoteContainer.nativeElement.appendChild(screenElement);

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

  toggleMic() {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.muteMic();
    } else {
      this.unmuteMic();
    }
  }

  toggleCamera() {
    this.isCameraOn = !this.isCameraOn;
    if (this.isCameraOn) {
      this.turnOnCamera();
    } else {
      this.turnOffCamera();
    }
  }

  toggleScreenShare() {
    this.isSharingScreen = !this.isSharingScreen;
    if (this.isSharingScreen) {
      this.startScreenShare();
    } else {
      this.stopScreenShare();
    }
  }

  endCall() {
    // Dispose all local tracks
    this.localTracks.forEach(track => {
      if (track) {
        if (this.room) {
          this.room.removeTrack(track);
        }
        track.dispose();
      }
    });
    this.localTracks = [];

    // Leave the room
    if (this.room) {
      this.room.leave();
      this.room = null;
    }

    // Disconnect the Jitsi connection
    if (this.connection) {
      this.connection.disconnect();
      this.connection = null;
    }

    // Clear UI elements
    const remoteContainer = this.remoteContainer.nativeElement;
    if (remoteContainer) {
      remoteContainer.innerHTML = '';
    }

    const localVideo = this.localVideo.nativeElement;
    if (localVideo) {
      localVideo.srcObject = null;
    }

    // Reset flags
    this.isJoined = false;
    this.isCameraOn = false;
    this.isMuted = true;
    this.isSharingScreen = false;

    console.log('Call ended');
  }
}
