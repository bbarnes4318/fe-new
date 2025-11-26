const { Sequelize } = require('sequelize');
require('dotenv').config();

// Note: In production, this MUST come from process.env.DATABASE_URL
let databaseUrl = process.env.DATABASE_URL;

console.log('🔌 Attempting Database Connection...');
console.log('URL Configured:', databaseUrl ? 'Yes (Hidden)' : 'No');
let dialectOptions = {
  ssl: {
    require: true,
    rejectUnauthorized: false
  }
};

if (databaseUrl) {
  // Parse the URL to remove any existing SSL parameters that might conflict
  try {
    const url = new URL(databaseUrl);
    if (url.searchParams.has('sslmode')) {
      url.searchParams.delete('sslmode');
    }
    if (url.searchParams.has('ssl')) {
      url.searchParams.delete('ssl');
    }
    databaseUrl = url.toString();
    console.log('URL Processed: SSL parameters removed from connection string to avoid conflicts.');
  } catch (e) {
    console.warn('Could not parse DATABASE_URL, using as is.');
  }
}

const sequelize = new Sequelize(databaseUrl, {
  dialect: 'postgres',
  logging: console.log,
  dialectOptions: dialectOptions,
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
