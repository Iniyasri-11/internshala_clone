const dotenv = require("dotenv");
const { connect } = require("./db");
const Job = require("./Model/Job");
const Internship = require("./Model/Internship");

dotenv.config();

const sampleJobs = [
  {
    title: "Frontend Developer",
    company: "TechNova",
    location: "Mumbai",
    Experience: "2+ years",
    category: "Engineering",
    aboutCompany:
      "TechNova builds modern web products for startups and enterprises.",
    aboutJob:
      "We are looking for a frontend developer experienced with React and modern UI development.",
    whoCanApply:
      "Candidates with strong React, JavaScript, and responsive UI experience.",
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
    aboutCompany:
      "CloudBridge provides scalable API platforms for fintech and SaaS companies.",
    aboutJob:
      "Join our backend team to build performant Node.js and MongoDB services.",
    whoCanApply:
      "Engineers with Node.js, Express, MongoDB, and REST API experience.",
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
    aboutCompany:
      "GrowthSphere builds analytics and growth tools for digital teams.",
    aboutJob:
      "Lead product initiatives across research, planning, and launch.",
    whoCanApply:
      "Product managers with SaaS experience and strong stakeholder skills.",
    perks: ["Remote work", "Performance bonus", "Career mentorship"],
    AdditionalInfo: "Applicants should be comfortable working with cross-functional teams.",
    CTC: "₹15 LPA",
    StartDate: "2026-09-01",
  },
];

const sampleInternships = [
  {
    title: "Marketing Intern",
    company: "BrandPulse",
    location: "Delhi",
    category: "Marketing",
    aboutCompany:
      "BrandPulse helps brands amplify their digital presence with creative campaigns.",
    aboutInternship:
      "Support social media, content creation, and campaign measurement.",
    whoCanApply:
      "Students with marketing, communications, or business backgrounds.",
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
    aboutCompany:
      "InsightMatrix builds AI-driven analytics solutions for enterprise clients.",
    aboutInternship:
      "Work on data modeling, visualization, and machine learning research.",
    whoCanApply:
      "Students proficient in Python, statistics, and data visualization.",
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
    aboutCompany:
      "PixelForge designs product experiences for early-stage startups.",
    aboutInternship:
      "Collaborate on user flows, wireframes, and high-fidelity designs.",
    whoCanApply:
      "Design students familiar with Figma, Sketch, and user research.",
    perks: ["Stipend", "Design mentorship", "Portfolio review"],
    numberOfOpening: "1",
    stipend: "₹12,000/month",
    startDate: "2026-07-15",
    additionalInfo: "Ideal for students seeking hands-on UX project work.",
  },
];

async function seed() {
  try {
    await connect();

    const jobCount = await Job.countDocuments();
    const internshipCount = await Internship.countDocuments();

    if (jobCount === 0) {
      await Job.insertMany(sampleJobs);
      console.log("Seeded sample job records.");
    } else {
      console.log(`Jobs collection already has ${jobCount} record(s). Skipping job seeding.`);
    }

    if (internshipCount === 0) {
      await Internship.insertMany(sampleInternships);
      console.log("Seeded sample internship records.");
    } else {
      console.log(`Internships collection already has ${internshipCount} record(s). Skipping internship seeding.`);
    }
  } catch (error) {
    console.error("Seeding failed:", error);
  } finally {
    process.exit(0);
  }
}

seed();
