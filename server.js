import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import fetch from "node-fetch";
import dotenv from "dotenv";


dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(
    cors({
        origin: "https://kh-brokers-main.webflow.io", // allow your frontend origin
        methods: ["GET", "POST"],
        allowedHeaders: ["Content-Type", "Authorization"],
    })
);

app.post("/api/submit", async (req, res) => {
    const token = req.body.recaptcha_token;
    const action = req.body.recaptcha_action || "submit";

    if(!token) {
        return res.status(400).json({ success: false, message: "Missing reCAPTCHA token" });
    }

    try {
        // Verify with Google
        const response = await fetch("https://www.google.com/recaptcha/api/siteverify",{
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                secret: process.env.RECAPTCHA_SECRET,
                response: token,
                remoteip: req.ip,
            })
        });

        const data = await response.json();

        if(!data.success) {
            console.error("reCAPTCHA failed:", data["error-codes"]);
            return res.status(400).json({ success: false, message: "reCAPTCHA failed", data });
        }

        // Verify expected action and score threshold
        if(data.action !== action) {
            return res.status(400).json({ success: false, message: "reCAPTCHA action mismatch" });
        }

        if(data.score < 0.5) {
            return res.status(403).json({success: false ,message: `Low reCAPTCHA score (${data.score}). Possible bot.`, score: data.score});
        }

        // reCAPTCHA verified successfully
        console.log("reCAPTCHA success, score:", data.score);
        return res.json({success: true,message: "reCAPTCHA verified successfully.", score: data.score});
    } catch (err) {
        console.error("Error verifying reCAPTCHA:", err);
        return res.status(500).json({ success: false, message: "Server error verifying reCAPTCHA" });
    }
});

// Optional: handle preflight manually (some Render setups need this)
app.options("/api/submit", (req, res) => {
  res.header("Access-Control-Allow-Origin", "https://kh-brokers-main.webflow.io");
  res.header("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.sendStatus(200);
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});