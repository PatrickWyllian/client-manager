const db = require('./connection');
const runMigrations = require('./migrations');
const runSeed = require('./seed');

runMigrations();
runSeed();

module.exports = db;
