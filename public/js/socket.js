const realtimeEvents = [
  "session:ready",
  "student:status",
  "movement:created",
  "movement:updated",
  "notification:created",
  "fee:updated",
  "complaint:created",
  "complaint:updated",
  "sos:created",
  "sos:resolved",
  "mess:updated",
  "mess:feedback",
  "mess:leave",
  "config:updated",
  "dashboard:refresh",
  "alert:overdue"
];

let socket = null;

export function connectSocket(onEvent) {
  disconnectSocket();
  if (!window.io) {
    return null;
  }

  socket = window.io({
    withCredentials: true
  });

  realtimeEvents.forEach((event) => {
    socket.on(event, (payload) => onEvent(event, payload));
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
