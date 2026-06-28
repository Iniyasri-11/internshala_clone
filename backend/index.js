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

app.get("/api/diag", async (req, res) => {
  const mongoose = require("mongoose");
  try {
    const cols = await mongoose.connection.db.listCollections().toArray();
    const counts = {};
    for (let col of cols) {
      counts[col.name] = await mongoose.connection.db.collection(col.name).countDocuments();
    }
    
    // Parse DATABASE_URL safely
    const url = process.env.DATABASE_URL || "";
    let dbDetails = {};
    if (url.startsWith("mongodb")) {
      const cleanUrl = url.replace("mongodb+srv://", "http://").replace("mongodb://", "http://");
      const parsed = new URL(cleanUrl);
      dbDetails = {
        host: parsed.host,
        username: parsed.username,
        pathname: parsed.pathname,
        search: parsed.search
      };
    }

    res.json({
      dbName: mongoose.connection.name,
      dbReadyState: mongoose.connection.readyState,
      counts: counts,
      dbDetails: dbDetails
    });
  } catch (err) {
    res.json({ error: err.message });
  }
});

app.get("/api/seed-live", async (req, res) => {
  try {
    const Job = require("./Model/Job");
    const Internship = require("./Model/Internship");
    
    const sampleJobs = [
      {
        title: "Frontend Developer",
        company: "TechNova",
        location: "Mumbai",
        Experience: "2+ years",
        category: "Engineering",
        aboutCompany: "TechNova builds modern web products for startups and enterprises.",
        aboutJob: "We are looking for a frontend developer experienced with React and modern UI development.",
        whoCanApply: "Candidates with strong React, JavaScript, and responsive UI experience.",
        perks: ["Remote friendly", "Health insurance", "Flexible hours"],
        AdditionalInfo: "This role supports hybrid work and fast-growing teams.",
        CTC: "₹8 LPA",
        StartDate: "2026-07-01",
      },
      {
        title: "Backend Engineer",
        company: "CloudBridge",
        location: "Bengaluru",
        Experience: "3+ years",
        category: "Engineering",
        aboutCompany: "CloudBridge provides scalable API platforms for fintech and SaaS companies.",
        aboutJob: "Join our backend team to build performant Node.js and MongoDB services.",
        whoCanApply: "Engineers with Node.js, Express, MongoDB, and REST API experience.",
        perks: ["Stock options", "Team offsites", "Learning stipend"],
        AdditionalInfo: "This role is office-first with flexible remote days.",
        CTC: "₹12 LPA",
        StartDate: "2026-08-01",
      },
      {
        title: "Product Manager",
        company: "GrowthSphere",
        location: "Remote",
        Experience: "4+ years",
        category: "Product",
        aboutCompany: "GrowthSphere builds analytics and growth tools for digital teams.",
        aboutJob: "Lead product initiatives across research, planning, and launch.",
        whoCanApply: "Product managers with SaaS experience and strong stakeholder skills.",
        perks: ["Remote work", "Performance bonus", "Career mentorship"],
        AdditionalInfo: "Applicants should be comfortable working with cross-functional teams.",
        CTC: "₹15 LPA",
        StartDate: "2026-09-01",
      }
    ];
    
    const sampleInternships = [
      {
        title: "Marketing Intern",
        company: "BrandPulse",
        location: "Delhi",
        category: "Marketing",
        aboutCompany: "BrandPulse helps brands amplify their digital presence with creative campaigns.",
        aboutInternship: "Support social media, content creation, and campaign measurement.",
        whoCanApply: "Students with marketing, communications, or business backgrounds.",
        perks: ["Stipend", "Certificate", "Mentorship"],
        numberOfOpening: "2",
        stipend: "₹15,000/month",
        startDate: "2026-07-10",
        additionalInfo: "Flexible hours with hybrid work options.",
      },
      {
        title: "Data Science Intern",
        company: "InsightMatrix",
        location: "Hyderabad",
        category: "Data Science",
        aboutCompany: "InsightMatrix builds AI-driven analytics solutions for enterprise clients.",
        aboutInternship: "Work on data modeling, visualization, and machine learning research.",
        whoCanApply: "Students proficient in Python, statistics, and data visualization.",
        perks: ["Stipend", "Project experience", "Resume review"],
        numberOfOpening: "3",
        stipend: "₹18,000/month",
        startDate: "2026-08-01",
        additionalInfo: "This internship includes mentorship from senior analysts.",
      },
      {
        title: "UI/UX Design Intern",
        company: "PixelForge",
        location: "Pune",
        category: "Design",
        aboutCompany: "PixelForge designs product experiences for early-stage startups.",
        aboutInternship: "Collaborate on user flows, wireframes, and high-fidelity designs.",
        whoCanApply: "Design students familiar with Figma, Sketch, and user research.",
        perks: ["Stipend", "Design mentorship", "Portfolio review"],
        numberOfOpening: "1",
        stipend: "₹12,000/month",
        startDate: "2026-07-15",
        additionalInfo: "Ideal for students seeking hands-on UX project work.",
      }
    ];

    await Job.deleteMany({});
    await Internship.deleteMany({});
    const insertedJobs = await Job.insertMany(sampleJobs);
    const insertedInterns = await Internship.insertMany(sampleInternships);

    res.json({
      message: "Seeded successfully!",
      jobsCount: insertedJobs.length,
      internshipsCount: insertedInterns.length
    });
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