const { Sequelize } = require('sequelize');
require('dotenv').config();

// Use the connection string from environment variables
// Note: In production, this MUST come from process.env.DATABASE_URL
const databaseUrl = process.env.DATABASE_URL;

const sequelize = new Sequelize(databaseUrl, {
  dialect: 'postgres',
  logging: false, // Set to console.log to see SQL queries
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false // Required for DigitalOcean managed databases
    }
  },
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});

const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Connected to PostgreSQL database successfully.');
  } catch (error) {
    console.error('❌ Unable to connect to the PostgreSQL database:', error);
  }
};

testConnection();

module.exports = sequelize;
