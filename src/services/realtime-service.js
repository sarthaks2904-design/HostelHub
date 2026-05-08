const { ROLES } = require("../config");

class RealtimeService {
  constructor() {
    this.io = null;
  }

  attach(io, authService) {
    this.io = io;

    io.use(async (socket, next) => {
      try {
        socket.user = await authService.resolveSocketUser(socket.handshake.headers.cookie);
        next();
      } catch (error) {
        next(new Error("Unauthorized"));
      }
    });

    io.on("connection", (socket) => {
      const user = socket.user;
      socket.join(`user:${user.id}`);
      socket.join(`role:${user.role}`);
      socket.emit("session:ready", { user });
    });
  }

  emitToUser(userId, event, payload) {
    if (this.io) {
      this.io.to(`user:${userId}`).emit(event, payload);
    }
  }

  emitToUsers(userIds, event, payload) {
    [...new Set(userIds)].forEach((userId) => this.emitToUser(userId, event, payload));
  }

  emitToRole(role, event, payload) {
    if (this.io) {
      this.io.to(`role:${role}`).emit(event, payload);
    }
  }

  emitToRoles(roles, event, payload) {
    [...new Set(roles)].forEach((role) => this.emitToRole(role, event, payload));
  }

  emitDashboardRefresh() {
    this.emitToRoles([ROLES.ADMIN, ROLES.WARDEN], "dashboard:refresh", {
      at: new Date().toISOString()
    });
  }
}

module.exports = {
  RealtimeService
};
