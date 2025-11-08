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
        origin: ["http://localhost", "https://kh-brokers-main.webflow.io", "https://www.khbrokers.com", , "https://khbrokers.com"],
        methods: ["GET", "POST"],
        allowedHeaders: ["Content-Type", "Authorization"],
    })
);

app.post("/api/submit", async (req, res) => {
    const token = req.body.recaptcha_token;
    const action = req.body.recaptcha_action || "submit";

    const {
        firstName,
        phone,
        email,
        page_type,
        page_extra,
        utm_source,
        utm_medium,
        utm_campaign,
        utm_content,
        utm_term,
        gclid,
        recaptcha_token
    } = req.body;

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
        
        // Add to Mailchimp
        const res_data = await fetch(`https://us6.api.mailchimp.com/3.0/lists/${process.env.MAILCHIMP_LIST_ID}/members`, {
            method: "POST",
            headers: {
                "Authorization": `apikey ${process.env.MAILCHIMP_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                email_address: email,
                status: "subscribed",
                merge_fields: {
                    FNAME: firstName,
                    PHONE: phone,
                    MMERGE2: page_type,
                    UTM_SOURCE: utm_source,
                    UTM_MEDIUM: utm_medium,
                    UTM_CAMP: utm_campaign,
                    UTM_CONTEN: utm_content,
                    UTM_TERM: utm_term,
                    GCLID: gclid
                }
            })
        });


        const mailchimp_res = await res_data.json();

        if (res_data.status >= 400) {
            return res.status(400).json({ success: false, message: mailchimp_res.detail || "Mailchimp error." });
        }

        return res.status(400).json({ success: true, message: "Submission successful! Thank you for subscribing." });



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