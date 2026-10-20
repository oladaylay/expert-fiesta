#!/usr/bin/env node
'use strict';
// Wipes the demo database back to its seed state (fresh whitelist, empty
// logs). Useful between UAT rounds. Never run this against production data.
// With DATABASE_URL set, this resets the Postgres row; otherwise the local
// data/db.json file.
const db = require('../server/db');

db.reset()
  .then(() => {
    console.log(db.usingPostgres ? 'Reset the Postgres state row to the seed state.' : `Reset ${db.DB_FILE} to the seed state.`);
  })
  .catch((err) => {
    console.error('Reset failed:', err);
    process.exit(1);
  });
