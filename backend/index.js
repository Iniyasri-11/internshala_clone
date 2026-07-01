require('dotenv').config();
const bodyparser = require("body-parser");
const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const app = express();
const cors = require("cors");
const { connect } = require("./db");
const router = require("./Routes/index");
const port = process.env.PORT || 5000;
app.use(cors());
app.use(bodyparser.json({ limit: "50mb" }));
app.use(bodyparser.urlencoded({ extended: true, limit: "50mb" }));
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/", (req, res) => {
  res.send("hello this is internshala backend");
});

app.get("/api/diag-users", async (req, res) => {
  try {
    const User = require("./Model/User");
    const LoginHistory = require("./Model/LoginHistory");
    const users = await User.find({}, "name email createdAt").lean();
    const history = await LoginHistory.find({}).sort({ createdAt: -1 }).limit(20).lean();
    res.json({ users, history });
  } catch (err) {
    res.json({ error: err.message });
  }
});

app.use("/api", router);
connect();

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Make io globally accessible for routes
global.io = io;
app.set("io", io);

// Socket.io connection handling
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Join user's personal room for messaging
  socket.on("join", (uid) => {
    if (uid) {
      socket.join(uid);
      console.log(`User ${uid} joined their room`);
    }
  });

  // Handle typing indicator
  socket.on("typing", ({ senderId, recipientId }) => {
    io.to(recipientId).emit("typing", { senderId });
  });

  // Handle stop typing
  socket.on("stopTyping", ({ senderId, recipientId }) => {
    io.to(recipientId).emit("stopTyping", { senderId });
  });

  // Handle message read
  socket.on("messageRead", ({ senderId, recipientId }) => {
    io.to(senderId).emit("conversationRead", { recipientId });
  });

  // Handle disconnect
  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

app.use((req, res, next) => {
  req.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Origin", "*");
  next();
});

server.listen(port, () => {
  console.log(`Server is running on the port ${port}`);
});

// force restart
// force restart
// force restart
// force restart
// force restart
// force restart