'use strict';

const SPEAK_API = 'http://127.0.0.1:8000/speak';

const RTCPeerConnection = (
  window.RTCPeerConnection ||
  window.webkitRTCPeerConnection ||
  window.mozRTCPeerConnection
).bind(window);

let peerConnection, streamId, sessionId, sessionClientAnswer;

const talkVideo = document.getElementById('talk-video');
const peerStatusLabel = document.getElementById('peer-status-label');
const iceStatusLabel = document.getElementById('ice-status-label');
const iceGatheringStatusLabel = document.getElementById('ice-gathering-status-label');
const signalingStatusLabel = document.getElementById('signaling-status-label');

document.getElementById('connect-button').onclick = async () => {
  if (peerConnection?.connectionState === 'connected') return;
  stopAllStreams();
  closePC();

  const res = await fetch(`${SPEAK_API}/streams`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      source_url: "https://raw.githubusercontent.com/YiPei0602/CareEase/typ2/frontend/assets/doctor_avatar_male.png"
    })
  });

  const { id, offer, ice_servers, session_id } = await res.json();
  streamId = id;
  sessionId = session_id;

  try {
    sessionClientAnswer = await createPeerConnection(offer, ice_servers);
  } catch (e) {
    console.error(e);
    stopAllStreams(); closePC();
    return;
  }

  await fetch(`${SPEAK_API}/streams/${streamId}/sdp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answer: sessionClientAnswer, session_id: sessionId })
  });
};

document.getElementById('talk-button').onclick = async () => {
  if (peerConnection?.signalingState !== 'stable' &&
      peerConnection?.iceConnectionState !== 'connected') {
    console.warn('not ready yet');
    return;
  }

  const userIn = document.getElementById('user-input-field').value;

  const chatRes = await fetch('http://127.0.0.1:8000/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: userIn })
  });
  const chatData = await chatRes.json();
  const botReply = chatData.response;

  await fetch(`${SPEAK_API}/streams/${streamId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: botReply, session_id: sessionId })
  });
};

document.getElementById('destroy-button').onclick = async () => {
  await fetch(`${SPEAK_API}/streams/${streamId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId })
  });
  stopAllStreams();
  closePC();
};

function onIceGatheringStateChange() {
  iceGatheringStatusLabel.innerText = peerConnection.iceGatheringState;
  iceGatheringStatusLabel.className = 'iceGatheringState-' + peerConnection.iceGatheringState;
}
function onIceCandidate(evt) {
  if (evt.candidate) {
    const { candidate, sdpMid, sdpMLineIndex } = evt.candidate;
    fetch(`${SPEAK_API}/streams/${streamId}/ice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ candidate, sdpMid, sdpMLineIndex, session_id: sessionId })
    });
  }
}
function onIceConnectionStateChange() {
  iceStatusLabel.innerText = peerConnection.iceConnectionState;
  iceStatusLabel.className = 'iceConnectionState-' + peerConnection.iceConnectionState;
  if (['failed', 'closed'].includes(peerConnection.iceConnectionState)) {
    stopAllStreams(); closePC();
  }
}
function onConnectionStateChange() {
  peerStatusLabel.innerText = peerConnection.connectionState;
  peerStatusLabel.className = 'peerConnectionState-' + peerConnection.connectionState;
}
function onSignalingStateChange() {
  signalingStatusLabel.innerText = peerConnection.signalingState;
  signalingStatusLabel.className = 'signalingState-' + peerConnection.signalingState;
}
function onTrack(evt) {
  talkVideo.srcObject = evt.streams[0];
  talkVideo.play().catch(() => {});
}

async function createPeerConnection(offer, iceServers) {
  peerConnection = new RTCPeerConnection({ iceServers });
  peerConnection.addEventListener('icegatheringstatechange', onIceGatheringStateChange);
  peerConnection.addEventListener('icecandidate', onIceCandidate);
  peerConnection.addEventListener('iceconnectionstatechange', onIceConnectionStateChange);
  peerConnection.addEventListener('connectionstatechange', onConnectionStateChange);
  peerConnection.addEventListener('signalingstatechange', onSignalingStateChange);
  peerConnection.addEventListener('track', onTrack);

  await peerConnection.setRemoteDescription(offer);
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  return answer;
}

function stopAllStreams() {
  if (talkVideo.srcObject) {
    talkVideo.srcObject.getTracks().forEach(t => t.stop());
    talkVideo.srcObject = null;
  }
}

function closePC() {
  if (!peerConnection) return;
  peerConnection.close();
  peerConnection = null;
  [iceGatheringStatusLabel, iceStatusLabel, peerStatusLabel, signalingStatusLabel]
    .forEach(lbl => lbl.innerText = '');
}
