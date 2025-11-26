const { Sequelize } = require('sequelize');
require('dotenv').config();

// Use the connection string from environment variables
// Note: In production, this MUST come from process.env.DATABASE_URL
const databaseUrl = process.env.DATABASE_URL;

console.log('🔌 Attempting Database Connection...');
console.log('URL Configured:', databaseUrl ? 'Yes (Hidden)' : 'No');

const sequelize = new Sequelize(databaseUrl, {
  dialect: 'postgres',
  logging: console.log, // Enable logging to see what's happening
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false // Required for DigitalOcean managed databases with self-signed certs
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
    console.error('Error details:', error.message);
  }
};

testConnection();

module.exports = sequelize;
