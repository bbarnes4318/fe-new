const express = require('express');
const { Op, Sequelize } = require('sequelize');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');
const Submission = require('../models/Submission'); // Assuming this is now a Sequelize model
const { authenticateToken, requirePermission } = require('../middleware/auth');

const router = express.Router();

// Get dashboard analytics
router.get('/dashboard', authenticateToken, requirePermission('viewAnalytics'), async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    
    // 1. Total Submissions (All Time)
    const totalAllTime = await Submission.count();

    // 2. Today's Submissions
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todaySubmissions = await Submission.count({
      where: {
        submission_date: { [Op.gte]: startOfToday }
      }
    });

    // 3. Period Submissions
    const totalPeriod = await Submission.count({
      where: {
        submission_date: { [Op.gte]: startDate }
      }
    });

    // 4. Quality Rate (Period)
    const highQualitySubmissions = await Submission.count({
      where: {
        submission_date: { [Op.gte]: startDate },
        quality_score: { [Op.gte]: 80 }
      }
    });
    const qualityRate = totalPeriod > 0 ? (highQualitySubmissions / totalPeriod * 100) : 0;

    // 5. Daily Submissions (Chart)
    // Note: Sequelize grouping by date can be DB-specific. 
    // For PostgreSQL: DATE(submission_date)
    const dailySubmissionsData = await Submission.findAll({
      attributes: [
        [Sequelize.fn('DATE', Sequelize.col('submission_date')), '_id'],
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
      ],
      where: {
        submission_date: { [Op.gte]: startDate }
      },
      group: [Sequelize.fn('DATE', Sequelize.col('submission_date'))],
      order: [[Sequelize.fn('DATE', Sequelize.col('submission_date')), 'ASC']],
      raw: true
    });
    
    // 6. Top Locations
    // Assuming geolocation is JSONB and has 'country' field.
    // Grouping by JSONB field in Sequelize/Postgres:
    const topLocations = await Submission.findAll({
      attributes: [
        [Sequelize.literal("geolocation->>'country'"), '_id'],
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'count'],
        [Sequelize.fn('AVG', Sequelize.col('quality_score')), 'avgQuality']
      ],
      where: {
        submission_date: { [Op.gte]: startDate },
        // Ensure country is not 'Unknown' (approximate check)
        [Op.and]: [
            Sequelize.literal("geolocation->>'country' IS NOT NULL"),
            Sequelize.literal("geolocation->>'country' != 'Unknown'")
        ]
      },
      group: [Sequelize.literal("geolocation->>'country'")],
      order: [[Sequelize.literal('count'), 'DESC']],
      limit: 10,
      raw: true
    });

    // 7. Device Stats
    const deviceStats = await Submission.findAll({
      attributes: [
        [Sequelize.literal("device_info->>'type'"), '_id'],
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
      ],
      where: {
        submission_date: { [Op.gte]: startDate }
      },
      group: [Sequelize.literal("device_info->>'type'")],
      raw: true
    });

    // 8. Status Stats
    const statusStats = await Submission.findAll({
      attributes: [
        'status',
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
      ],
      where: {
        submission_date: { [Op.gte]: startDate }
      },
      group: ['status'],
      raw: true
    });
    // Map status stats to match expected format { _id: status, count: N }
    const byStatus = statusStats.map(s => ({ _id: s.status, count: parseInt(s.count) }));

    // 9. Recent Submissions
    const recentSubmissions = await Submission.findAll({
      where: {
        submission_date: { [Op.gte]: startDate }
      },
      order: [['submission_date', 'DESC']],
      limit: 5,
      attributes: ['fname', 'lname', 'email', 'submission_date', 'geolocation', 'quality_score', 'status'],
      raw: true
    });

    res.json({
      period: {
        days: parseInt(days),
        startDate,
        endDate: new Date()
      },
      totals: {
        allTime: totalAllTime,
        period: totalPeriod,
        today: todaySubmissions,
        qualityRate: Math.round(qualityRate)
      },
      analytics: {
        totalSubmissions: [{ count: totalPeriod }], // Mocking structure for frontend compatibility
        byCountry: topLocations,
        byDevice: deviceStats,
        byStatus: byStatus,
        dailySubmissions: dailySubmissionsData,
        avgQualityScore: 0 // Placeholder, as original getAnalytics had this
      },
      additional: {
        topLocations,
        deviceStats,
        browserStats: [], // Skipping for brevity, as original getAnalytics had this
        hourlyStats: [], // Skipping for brevity, as original getAnalytics had this
        recentSubmissions
      }
    });
    
  } catch (error) {
    console.error('Dashboard analytics error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get conversion funnel data
router.get('/funnel', authenticateToken, requirePermission('viewAnalytics'), async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    
    const funnelData = await Submission.findAll({
      attributes: [
        'status',
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'count'],
        [Sequelize.fn('AVG', Sequelize.col('quality_score')), 'avgQuality']
      ],
      where: {
        submission_date: { [Op.gte]: startDate }
      },
      group: ['status'],
      raw: true
    });
    
    // Define funnel order
    const funnelOrder = ['pending', 'processed', 'contacted', 'qualified'];
    const funnel = funnelOrder.map(status => {
      const data = funnelData.find(item => item.status === status);
      return {
        status,
        count: data ? parseInt(data.count) : 0,
        avgQuality: data ? parseFloat(data.avgQuality) : 0
      };
    });
    
    // Calculate conversion rates
    const totalSubmissions = funnel.reduce((sum, stage) => sum + stage.count, 0);
    funnel.forEach((stage, index) => {
      if (index === 0) {
        stage.conversionRate = 100; // First stage is 100%
      } else {
        const previousCount = funnel[index - 1].count;
        stage.conversionRate = previousCount > 0 ? (stage.count / previousCount * 100) : 0;
      }
    });
    
    res.json({
      period: { days: parseInt(days), startDate },
      totalSubmissions,
      funnel
    });
    
  } catch (error) {
    console.error('Funnel analytics error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Export data to CSV
router.get('/export/csv', authenticateToken, requirePermission('exportData'), async (req, res) => {
  try {
    const { dateFrom, dateTo, status, country } = req.query;
    
    // Build filter
    const where = {};
    if (dateFrom || dateTo) {
      where.submission_date = {};
      if (dateFrom) where.submission_date[Op.gte] = new Date(dateFrom);
      if (dateTo) where.submission_date[Op.lte] = new Date(dateTo);
    }
    if (status) where.status = status;
    // For JSONB field 'geolocation.country'
    if (country) {
      where[Op.and] = [
        ...(where[Op.and] || []),
        Sequelize.literal(`geolocation->>'country' = '${country}'`)
      ];
    }
    
    // Get submissions
    const submissions = await Submission.findAll({
      where,
      order: [['submission_date', 'DESC']],
      raw: true
    });
    
    if (submissions.length === 0) {
      return res.status(404).json({ message: 'No data found for export' });
    }
    
    // Prepare CSV data
    const csvData = submissions.map(sub => ({
      id: sub.id,
      firstName: sub.fname,
      lastName: sub.lname,
      email: sub.email,
      phone: sub.phone,
      address: sub.address,
      city: sub.city,
      state: sub.state,
      zip: sub.zip,
      gender: sub.gender,
      dateOfBirth: sub.date_of_birth ? new Date(sub.date_of_birth).toISOString().split('T')[0] : '',
      incidentDate: sub.diagnosis_year ? new Date(sub.diagnosis_year).toISOString().split('T')[0] : '',
      country: sub.geolocation?.country,
      region: sub.geolocation?.region,
      ipAddress: sub.ip_address,
      browser: sub.browser_info?.family,
      device: sub.device_info?.type,
      status: sub.status,
      qualityScore: sub.quality_score,
      submissionDate: sub.submission_date ? new Date(sub.submission_date).toISOString() : '',
      trustedFormCert: sub.trusted_form_cert_url
    }));
    
    // Generate filename
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = `rideshare_submissions_${timestamp}.csv`;
    const filepath = path.join(__dirname, '..', 'exports', filename);
    
    // Ensure exports directory exists
    const exportsDir = path.dirname(filepath);
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }
    
    // Create CSV writer
    const csvWriter = createCsvWriter({
      path: filepath,
      header: Object.keys(csvData[0]).map(key => ({
        id: key,
        title: key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())
      }))
    });
    
    await csvWriter.writeRecords(csvData);
    
    // Send file
    res.download(filepath, filename, (err) => {
      if (err) {
        console.error('CSV download error:', err);
        res.status(500).json({ message: 'Export failed' });
      }
      // Clean up file after download
      setTimeout(() => {
        fs.unlink(filepath, () => {});
      }, 60000); // Delete after 1 minute
    });
    
  } catch (error) {
    console.error('CSV export error:', error);
    res.status(500).json({ message: 'Export failed' });
  }
});

// Export data to Excel
router.get('/export/excel', authenticateToken, requirePermission('exportData'), async (req, res) => {
  try {
    const { dateFrom, dateTo, status, country } = req.query;
    
    // Build filter (same as CSV)
    const where = {};
    if (dateFrom || dateTo) {
      where.submission_date = {};
      if (dateFrom) where.submission_date[Op.gte] = new Date(dateFrom);
      if (dateTo) where.submission_date[Op.lte] = new Date(dateTo);
    }
    if (status) where.status = status;
    // For JSONB field 'geolocation.country'
    if (country) {
      where[Op.and] = [
        ...(where[Op.and] || []),
        Sequelize.literal(`geolocation->>'country' = '${country}'`)
      ];
    }
    
    const submissions = await Submission.findAll({
      where,
      order: [['submission_date', 'DESC']],
      raw: true
    });
    
    if (submissions.length === 0) {
      return res.status(404).json({ message: 'No data found for export' });
    }
    
    // Create workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Rideshare Submissions');
    
    // Define columns
    worksheet.columns = [
      { header: 'ID', key: 'id', width: 25 },
      { header: 'First Name', key: 'firstName', width: 15 },
      { header: 'Last Name', key: 'lastName', width: 15 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Phone', key: 'phone', width: 15 },
      { header: 'Address', key: 'address', width: 30 },
      { header: 'City', key: 'city', width: 15 },
      { header: 'State', key: 'state', width: 8 },
      { header: 'ZIP', key: 'zip', width: 10 },
      { header: 'Gender', key: 'gender', width: 10 },
      { header: 'Date of Birth', key: 'dateOfBirth', width: 15 },
      { header: 'Incident Date', key: 'incidentDate', width: 15 },
      { header: 'Country', key: 'country', width: 15 },
      { header: 'Region', key: 'region', width: 15 },
      { header: 'IP Address', key: 'ipAddress', width: 15 },
      { header: 'Browser', key: 'browser', width: 15 },
      { header: 'Device', key: 'device', width: 10 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Quality Score', key: 'qualityScore', width: 12 },
      { header: 'Submission Date', key: 'submissionDate', width: 20 },
      { header: 'Trusted Form Cert', key: 'trustedFormCert', width: 40 }
    ];
    
    // Style header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    };
    worksheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };
    
    // Add data
    submissions.forEach(sub => {
      worksheet.addRow({
        id: sub.id,
        firstName: sub.fname,
        lastName: sub.lname,
        email: sub.email,
        phone: sub.phone,
        address: sub.address,
        city: sub.city,
        state: sub.state,
        zip: sub.zip,
        gender: sub.gender,
        dateOfBirth: sub.date_of_birth ? new Date(sub.date_of_birth).toISOString().split('T')[0] : '',
        incidentDate: sub.diagnosis_year ? new Date(sub.diagnosis_year).toISOString().split('T')[0] : '',
        country: sub.geolocation?.country,
        region: sub.geolocation?.region,
        ipAddress: sub.ip_address,
        browser: sub.browser_info?.family,
        device: sub.device_info?.type,
        status: sub.status,
        qualityScore: sub.quality_score,
        submissionDate: sub.submission_date ? new Date(sub.submission_date).toISOString() : '',
        trustedFormCert: sub.trusted_form_cert_url
      });
    });
    
    // Generate filename and write file
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = `rideshare_submissions_${timestamp}.xlsx`;
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    await workbook.xlsx.write(res);
    res.end();
    
  } catch (error) {
    console.error('Excel export error:', error);
    res.status(500).json({ message: 'Export failed' });
  }
});

// Get map data for visualizations
router.get('/map-data', authenticateToken, requirePermission('viewAnalytics'), async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    
    // Group by city/country
    const mapData = await Submission.findAll({
      attributes: [
        [Sequelize.literal("geolocation->>'city'"), 'city'],
        [Sequelize.literal("geolocation->>'country'"), 'country'],
        [Sequelize.literal("geolocation->>'latitude'"), 'lat'],
        [Sequelize.literal("geolocation->>'longitude'"), 'lng'],
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
      ],
      where: {
        submission_date: { [Op.gte]: startDate },
        [Op.and]: [
            Sequelize.literal("geolocation->>'latitude' IS NOT NULL"),
            Sequelize.literal("geolocation->>'longitude' IS NOT NULL"),
            Sequelize.literal("geolocation->>'latitude' != '0'"), // Exclude 0,0 coordinates
            Sequelize.literal("geolocation->>'longitude' != '0'") // Exclude 0,0 coordinates
        ]
      },
      group: [
        Sequelize.literal("geolocation->>'city'"),
        Sequelize.literal("geolocation->>'country'"),
        Sequelize.literal("geolocation->>'latitude'"),
        Sequelize.literal("geolocation->>'longitude'")
      ],
      order: [[Sequelize.literal('count'), 'DESC']],
      limit: 100, // Limit the number of distinct locations for performance
      raw: true
    });
    
    // Transform to match frontend expectation
    const formattedData = mapData.map(item => ({
        coordinates: { lat: parseFloat(item.lat), lng: parseFloat(item.lng) },
        location: { city: item.city, country: item.country },
        count: parseInt(item.count),
        submissions: [] // Populating submissions per location is expensive, skipping for now
    }));

    res.json(formattedData);
    
  } catch (error) {
    console.error('Map data error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;