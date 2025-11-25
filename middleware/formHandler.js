const geoip = require('geoip-lite');
const useragent = require('useragent');
const Submission = require('../models/Submission');

// Simplified form handler
const formHandler = async (req, res) => {
  try {
    // Get client IP address
    const clientIP = req.headers['x-forwarded-for'] || 
                    req.headers['x-real-ip'] || 
                    req.connection.remoteAddress || 
                    req.socket.remoteAddress ||
                    (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
                    req.ip;

    // Clean IP address (remove IPv6 prefix if present)
    const cleanIP = clientIP?.replace(/^.*:/, '') || '127.0.0.1';
    
    // Get user agent
    const userAgentString = req.headers['user-agent'] || '';
    
    // Parse user agent for browser/device info
    const agent = useragent.parse(userAgentString);
    
    // Get basic geolocation from IP (offline lookup only)
    let geoData = geoip.lookup(cleanIP) || {};
    
    // Combine geolocation data
    const geolocation = {
      country: geoData.country || 'Unknown',
      country_code: geoData.country || 'XX',
      region: geoData.region || 'Unknown',
      region_code: geoData.region || '',
      city: geoData.city || 'Unknown',
      zip: geoData.zip || '',
      latitude: geoData.ll?.[0] || 0,
      longitude: geoData.ll?.[1] || 0,
      timezone: geoData.timezone || '',
      isp: '',
      org: ''
    };
    
    // Device detection
    const getDeviceType = (userAgent) => {
      const ua = userAgent.toLowerCase();
      if (/mobile|android|iphone|ipod|blackberry|opera mini|iemobile/i.test(ua)) {
        return 'mobile';
      }
      if (/tablet|ipad/i.test(ua)) {
        return 'tablet';
      }
      return 'desktop';
    };
    
    // Parse form data from request
    const formData = Array.isArray(req.body) ? req.body[0] : req.body;
    
    // Create submission object
    const submissionData = {
      // Form fields
      fname: formData.fname?.trim(),
      lname: formData.lname?.trim(),
      email: formData.email?.trim().toLowerCase(),
      phone: formData.phone?.replace(/\D/g, ''), // Remove non-digits
      state: formData.state?.toUpperCase(),
      age: formData.age,
      beneficiary: formData.beneficiary,
      
      // Technical data
      ip_address: cleanIP,
      geolocation,
      user_agent: userAgentString,
      
      // Browser info
      browser_info: {
        family: agent.family || 'Unknown',
        version: agent.toVersion() || 'Unknown',
        major: agent.major || 'Unknown'
      },
      
      // OS info
      os_info: {
        family: agent.os.family || 'Unknown',
        version: agent.os.toVersion() || 'Unknown',
        major: agent.os.major || 'Unknown'
      },
      
      // Device info - flatten to match schema
      'device_info.family': agent.device.family || 'Unknown',
      'device_info.brand': agent.device.brand || 'Unknown',
      'device_info.model': agent.device.model || 'Unknown',
      'device_info.type': getDeviceType(userAgentString),
      
      // Trusted form and metadata
      trusted_form_cert_url: formData.xxTrustedFormCertUrl || formData.Trusted_Form_Alt || formData.trusted_form_cert_url || 'https://cert.trustedform.com/pending',
      case_type: formData.case_type || 'Final Expense',
      ownerid: formData.ownerid || '005TR00000CDuezYAD',
      campaign: formData.campaign || '',
      offer_url: formData.offer_url || req.headers.referer || '',
      
      // Additional tracking
      referrer: req.headers.referer || '',
      submission_date: new Date()
    };
    
    // Save to database
    const submission = new Submission(submissionData);
    await submission.save();
    
    console.log('✅ New submission saved:', {
      id: submission._id,
      email: submission.email,
      location: `${submission.geolocation.city}, ${submission.geolocation.country}`,
      quality_score: submission.quality_score
    });
    
    // Return success response
    res.json({
      status: 'SUCCESS',
      message: 'Submission received successfully',
      submissionId: submission._id
    });
    
  } catch (error) {
    console.error('Form handler error:', error);
    
    // Still try to save basic submission data even if enhanced features fail
    if (req.body) {
      try {
        const basicData = Array.isArray(req.body) ? req.body[0] : req.body;
        const basicSubmission = new Submission({
          fname: basicData.fname || 'Unknown',
          lname: basicData.lname || 'Unknown',
          email: basicData.email,
          phone: basicData.phone || '0000000000',
          state: basicData.state || 'XX',
          age: basicData.age || '0',
          beneficiary: basicData.beneficiary || 'other',
          ip_address: req.ip || '127.0.0.1',
          user_agent: req.headers['user-agent'] || 'Unknown',
          trusted_form_cert_url: basicData.xxTrustedFormCertUrl || 'https://cert.trustedform.com/pending',
          geolocation: { 
            country: 'Unknown', 
            city: 'Unknown',
            region: 'Unknown',
            zip: '00000'
          }
        });
        await basicSubmission.save();
        console.log('✅ Basic submission saved despite errors');
      } catch (basicError) {
        console.error('Failed to save basic submission:', basicError);
      }
    }
    
    res.status(500).json({
      status: 'ERROR',
      message: 'Submission failed. Please try again.',
      error: error.message // Always show error for debugging
    });
  }
};

module.exports = formHandler;