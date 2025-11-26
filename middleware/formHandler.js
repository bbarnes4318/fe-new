const geoip = require("geoip-lite");
const useragent = require("useragent");
const { Submission } = require("../models");

// Simplified form handler
const formHandler = async (req, res) => {
  console.log("📝 Form handler received request");
  try {
    // Get client IP address
    const clientIP =
      req.headers["x-forwarded-for"] ||
      req.headers["x-real-ip"] ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
      req.ip;

    // Clean IP address (remove IPv6 prefix if present)
    const cleanIP = clientIP?.replace(/^.*:/, "") || "127.0.0.1";

    // Get user agent
    const userAgentString = req.headers["user-agent"] || "";

    // Parse user agent for browser/device info
    const agent = useragent.parse(userAgentString);

    // Get basic geolocation from IP (offline lookup only)
    let geoData = geoip.lookup(cleanIP) || {};

    // Combine geolocation data
    const geolocation = {
      country: geoData.country || "Unknown",
      country_code: geoData.country || "XX",
      region: geoData.region || "Unknown",
      region_code: geoData.region || "",
      city: geoData.city || "Unknown",
      zip: geoData.zip || "",
      latitude: geoData.ll?.[0] || 0,
      longitude: geoData.ll?.[1] || 0,
      timezone: geoData.timezone || "",
      isp: "",
      org: "",
    };

    // Device detection
    const getDeviceType = (userAgent) => {
      const ua = userAgent.toLowerCase();
      if (
        /mobile|android|iphone|ipod|blackberry|opera mini|iemobile/i.test(ua)
      ) {
        return "mobile";
      }
      if (/tablet|ipad/i.test(ua)) {
        return "tablet";
      }
      return "desktop";
    };

    // Parse form data from request
    console.log("Parsing form data...");
    const formData = Array.isArray(req.body) ? req.body[0] : req.body;

    // Create submission object
    const submissionData = {
      // Form fields
      fname: formData.fname?.trim() || "Unknown",
      lname: formData.lname?.trim() || "Unknown",
      email: formData.email?.trim().toLowerCase(),
      phone: formData.phone?.replace(/\D/g, "") || "0000000000",
      state: formData.state?.toUpperCase() || "XX",
      age: formData.age || "0",
      beneficiary: formData.beneficiary || "other",

      // Technical data
      ip_address: cleanIP || "127.0.0.1",
      geolocation: geolocation,
      user_agent: userAgentString || "Unknown",

      // Browser info
      browser_info: {
        family: agent.family || "Unknown",
        version: agent.toVersion() || "Unknown",
        major: agent.major || "Unknown",
      },

      // OS info
      os_info: {
        family: agent.os.family || "Unknown",
        version: agent.os.toVersion() || "Unknown",
        major: agent.os.major || "Unknown",
      },

      // Device info
      device_info: {
        family: agent.device.family || "Unknown",
        brand: agent.device.brand || "Unknown",
        model: agent.device.model || "Unknown",
        type: getDeviceType(userAgentString),
      },

      // Trusted form and metadata
      trusted_form_cert_url:
        formData.xxTrustedFormCertUrl ||
        formData.Trusted_Form_Alt ||
        formData.trusted_form_cert_url ||
        "https://cert.trustedform.com/pending",
      case_type: formData.case_type || "Final Expense",
      ownerid: formData.ownerid || "005TR00000CDuezYAD",
      campaign: formData.campaign || "",
      offer_url: formData.offer_url || req.headers.referer || "",

      // Additional tracking
      referrer: req.headers.referer || "",
      submission_date: new Date(),
    };

    console.log("Saving submission to database...");
    // Save to database
    const submission = await Submission.create(submissionData);

    console.log("✅ New submission saved:", {
      id: submission.id,
      email: submission.email,
      location: `${submission.geolocation.city}, ${submission.geolocation.country}`,
      quality_score: submission.quality_score,
    });

    // Return success response
    res.json({
      status: "SUCCESS",
      message: "Submission received successfully",
      submissionId: submission.id,
    });
  } catch (error) {
    console.error("❌ Form handler error:", error);

    // Still try to save basic submission data even if enhanced features fail
    if (req.body) {
      try {
        console.log("Attempting to save basic submission data...");
        const basicData = Array.isArray(req.body) ? req.body[0] : req.body;
        const basicSubmission = {
          fname: basicData.fname || "Unknown",
          lname: basicData.lname || "Unknown",
          email: basicData.email,
          phone: basicData.phone || "0000000000",
          state: basicData.state || "XX",
          age: basicData.age || "0",
          beneficiary: basicData.beneficiary || "other",
          ip_address: req.ip || "127.0.0.1",
          user_agent: req.headers["user-agent"] || "Unknown",
          trusted_form_cert_url:
            basicData.xxTrustedFormCertUrl ||
            "https://cert.trustedform.com/pending",
          geolocation: {
            country: "Unknown",
            city: "Unknown",
            region: "Unknown",
            zip: "00000",
          },
        };
        await Submission.create(basicSubmission);
        console.log("✅ Basic submission saved despite errors");
      } catch (basicError) {
        console.error("❌ Failed to save basic submission:", basicError);
      }
    }

    res.status(500).json({
      status: "ERROR",
      message: "Submission failed. Please try again.",
      error: error.message, // Always show error for debugging
    });
  }
};

module.exports = formHandler;
