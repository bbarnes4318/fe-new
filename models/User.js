const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const bcrypt = require('bcryptjs');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      len: [3, 50]
    }
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      len: [6, 100]
    }
  },
  role: {
    type: DataTypes.ENUM('admin', 'manager', 'analyst'),
    defaultValue: 'analyst'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  lastLogin: {
    type: DataTypes.DATE
  },
  permissions: {
    type: DataTypes.JSONB,
    defaultValue: {
      viewSubmissions: true,
      exportData: false,
      manageUsers: false,
      viewAnalytics: true
    }
  }
}, {
  timestamps: true,
  hooks: {
    beforeSave: async (user) => {
      if (user.changed('password')) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(user.password, salt);
      }
      
      if (user.changed('role')) {
        switch (user.role) {
          case 'admin':
            user.permissions = {
              viewSubmissions: true,
              exportData: true,
              manageUsers: true,
              viewAnalytics: true
            };
            break;
          case 'manager':
            user.permissions = {
              viewSubmissions: true,
              exportData: true,
              manageUsers: false,
              viewAnalytics: true
            };
            break;
          case 'analyst':
            user.permissions = {
              viewSubmissions: true,
              exportData: false,
              manageUsers: false,
              viewAnalytics: true
            };
            break;
        }
      }
    }
  }
});

// Instance method to check password
User.prototype.comparePassword = async function(password) {
  return await bcrypt.compare(password, this.password);
};

module.exports = User;