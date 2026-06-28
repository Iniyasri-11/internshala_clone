const express = require("express");
const router = express.Router();
const admin = require("./admin");
const intern = require("./internship");
const job = require("./job");
const application = require("./application");
const social = require("./social");
const users = require("./users");
const subscription = require("./subscription");
const password = require("./password");
const auth = require("./auth");
const messages = require("./messages");
const resume = require("./resume");

router.use("/admin", admin);
router.use("/internship", intern);
router.use("/job", job);
router.use("/application", application);
router.use("/social", social);
router.use("/users", users);
router.use("/subscription", subscription);
router.use("/password", password);
router.use("/auth", auth);
router.use("/messages", messages);
router.use("/resume", resume);


module.exports = router;
