#!/usr/bin/env node
'use strict';
// Wipes the demo database back to its seed state (fresh whitelist, empty
// logs). Useful between UAT rounds. Never run this against production data.
const db = require('../server/db');
db.reset();
console.log(`Reset ${db.DB_FILE} to the seed state.`);
