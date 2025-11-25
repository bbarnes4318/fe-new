const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Submission = sequelize.define('Submission', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  // Form data
  fname: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'Unknown'
  },
  lname: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'Unknown'
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      isEmail: true
    }
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: '0000000000'
  },
  state: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'XX'
  },
  age: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: '0'
  },
  beneficiary: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'other'
  },

  // Technical data
  ip_address: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: '127.0.0.1'
  },

  // Geolocation data (stored as JSONB for flexibility)
  geolocation: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },

  // Browser and device information
  user_agent: {
    type: DataTypes.TEXT,
    allowNull: false,
    defaultValue: 'Unknown'
  },
  browser_info: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  os_info: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  device_info: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },

  // Trusted form certificate
  trusted_form_cert_url: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'https://cert.trustedform.com/pending'
  },

  // Additional metadata
  case_type: {
    type: DataTypes.STRING,
    defaultValue: 'Final Expense'
  },
  ownerid: {
    type: DataTypes.STRING,
    defaultValue: '005TR00000CDuezYAD'
  },
  campaign: {
    type: DataTypes.STRING,
    allowNull: true
  },
  offer_url: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  referrer: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  
  // Status tracking
  status: {
    type: DataTypes.ENUM('pending', 'processed', 'contacted', 'qualified', 'rejected'),
    defaultValue: 'pending'
  },
  quality_score: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  submission_date: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  timestamps: true,
  indexes: [
    {
      fields: ['email']
    },
    {
      fields: ['phone']
    },
    {
      fields: ['submission_date']
    }
  ]
});

module.exports = Submission;
