const express = require("express");
const router = express.Router();
const Application = require("../Model/Application");
const User = require("../Model/User");
const auth = require("../middleware/auth");
const { getISTDate, startOfMonth } = require("../utils/timeUtils");
const { checkAndResetMonthlyApplications } = require("../utils/resetHelper");

const plans = {
  Free: { applicationLimit: 1 },
  Bronze: { applicationLimit: 3 },
  Silver: { applicationLimit: 5 },
  Gold: { applicationLimit: Infinity },
};

function getPlan(user) {
  const now = getISTDate();
  if (!user || user.subscriptionStatus !== 'active' || !user.subscriptionStartDate || !user.subscriptionEndDate) {
    return plans.Free;
  }
  const endDate = new Date(user.subscriptionEndDate);
  if (endDate < now) {
    return plans.Free;
  }
  return plans[user.subscriptionPlan] || plans.Free;
}

function getApplicationCountStartDate(user) {
  if (user && user.subscriptionStatus === 'active' && user.subscriptionStartDate) {
    return new Date(user.subscriptionStartDate);
  }
  return startOfMonth(getISTDate());
}

router.post("/", auth, async (req, res) => {
  try {
    const backendUser = await User.findOne({ uid: req.user.uid });
    if (!backendUser) {
      return res.status(404).json({ error: 'User not found.' });
    }

    await checkAndResetMonthlyApplications(backendUser);

    const countStart = getApplicationCountStartDate(backendUser);
    const appCount = await Application.countDocuments({
      userId: backendUser.uid,
      createdAt: { $gte: countStart },
    });

    const plan = getPlan(backendUser);
    const limit = plan.applicationLimit;
    const remaining = limit === Infinity ? Infinity : Math.max(0, limit - appCount);

    if (limit !== Infinity && appCount >= limit) {
      return res.status(403).json({
        error: 'Application limit exceeded for your current plan.',
        currentPlan: backendUser.subscriptionPlan || 'Free',
        applicationsUsed: appCount,
        applicationsRemaining: remaining,
      });
    }

    const applicationData = new Application({
      company: req.body.company,
      category: req.body.category,
      coverLetter: req.body.coverLetter,
      availability: req.body.availability,
      user: {
        uid: backendUser.uid,
        name: backendUser.name,
        email: backendUser.email,
        photo: backendUser.photo,
      },
      userId: backendUser.uid,
      internshipId: req.body.Application,
      Application: req.body.Application,
    });

    await applicationData.save();
    backendUser.applicationsUsed = appCount + 1;
    await backendUser.save();

    return res.status(201).json({
      message: 'Application submitted successfully.',
      application: applicationData,
      applicationsUsed: appCount + 1,
      applicationsRemaining: limit === Infinity ? Infinity : Math.max(0, limit - (appCount + 1)),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Unable to submit application.' });
  }
});

router.get("/", async (req, res) => {
  try {
    const data = await Application.find();
    res.status(200).json(data);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "internal server error" });
  }
});
router.get("/user", auth, async (req, res) => {
  try {
    const data = await Application.find({ userId: req.user.uid });
    res.status(200).json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "internal server error" });
  }
});
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const data = await Application.findById(id);
    if (!data) {
      res.status(404).json({ error: "application not found" });
    }
    res.json(data).status(200);
  } catch (error) {
    console.log(error);
    res.status(404).json({ error: "internal server error" });
  }
});
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { action } = req.body;
  let status;
  if (action === "accepted") {
    status = "accepted";
  } else if (action === "rejected") {
    status = "rejected";
  } else {
    res.status(404).json({ error: "Invalid action" });
    return;
  }
  try {
    const updateapplication = await Application.findByIdAndUpdate(
      id,
      { $set: { status } },
      { new: true }
    );
    if (!updateapplication) {
      res.status(404).json({ error: "Not able to update the application" });
      return;
    }
    res.status(200).json({ sucess: true, data: updateapplication });
  } catch (error) {
    res.status(500).json({ error: "internal server error" });
  }
});
module.exports = router;
