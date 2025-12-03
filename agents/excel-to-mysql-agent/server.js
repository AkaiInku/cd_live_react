/**
 * ExcelToMySQLAgent - Server Stub (Express.js)
 * 
 * This server provides endpoints for migrating Excel files from OneDrive to MySQL.
 * It implements the agent actions: FetchExcelFromOneDrive, ParseExcelStructure,
 * CreateMySQLSchema, and InsertDataIntoMySQL.
 */

import express from 'express';
import mysql from 'mysql2/promise';
import xlsx from 'xlsx';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '500', 10);
const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10); // 1 minute
const RATE_LIMIT_MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '10', 10);

// Simple in-memory rate limiter
const rateLimitStore = new Map();

function rateLimit(req, res, next) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  
  // Clean up old entries
  if (rateLimitStore.size > 10000) {
    for (const [key, value] of rateLimitStore) {
      if (now - value.windowStart > RATE_LIMIT_WINDOW_MS) {
        rateLimitStore.delete(key);
      }
    }
  }
  
  let record = rateLimitStore.get(ip);
  
  if (!record || now - record.windowStart > RATE_LIMIT_WINDOW_MS) {
    record = { windowStart: now, count: 0 };
  }
  
  record.count++;
  rateLimitStore.set(ip, record);
  
  res.setHeader('X-RateLimit-Limit', RATE_LIMIT_MAX_REQUESTS);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, RATE_LIMIT_MAX_REQUESTS - record.count));
  res.setHeader('X-RateLimit-Reset', record.windowStart + RATE_LIMIT_WINDOW_MS);
  
  if (record.count > RATE_LIMIT_MAX_REQUESTS) {
    return res.status(429).json({
      error: 'Too many requests',
      retryAfter: Math.ceil((record.windowStart + RATE_LIMIT_WINDOW_MS - now) / 1000)
    });
  }
  
  next();
}

// Environment variable validation
const requiredEnvVars = ['ONEDRIVE_OAUTH_TOKEN', 'MYSQL_CONN_URI'];

function validateEnvVars() {
  const missing = requiredEnvVars.filter(v => !process.env[v]);
  if (missing.length > 0) {
    console.error(`Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }
}

/**
 * Parse MySQL connection URI
 * Format: mysql://user:pass@host:port/database
 */
function parseMySQLUri(uri) {
  const url = new URL(uri);
  return {
    host: url.hostname,
    port: parseInt(url.port || '3306', 10),
    user: url.username,
    password: url.password,
    database: url.pathname.slice(1)
  };
}

/**
 * Infer MySQL column type from sample values
 */
function inferColumnType(sampleValues) {
  const nonNullValues = sampleValues.filter(v => v !== null && v !== undefined && v !== '');
  
  if (nonNullValues.length === 0) return 'VARCHAR(255)';
  
  const allNumbers = nonNullValues.every(v => !isNaN(Number(v)));
  if (allNumbers) {
    const hasDecimals = nonNullValues.some(v => String(v).includes('.'));
    return hasDecimals ? 'DECIMAL(15,2)' : 'BIGINT';
  }
  
  const allDates = nonNullValues.every(v => !isNaN(Date.parse(String(v))));
  if (allDates) return 'DATETIME';
  
  const maxLength = Math.max(...nonNullValues.map(v => String(v).length));
  if (maxLength > 255) return 'TEXT';
  
  return `VARCHAR(${Math.min(Math.max(maxLength * 2, 50), 255)})`;
}

/**
 * Sanitize column name for MySQL
 */
function sanitizeColumnName(name) {
  return String(name)
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/^[0-9]/, '_$&')
    .toLowerCase()
    .slice(0, 64);
}

/**
 * Mask PII data (emails, SSNs)
 */
function maskPII(value) {
  if (typeof value !== 'string') return value;
  
  // Mask email addresses
  const emailRegex = /([a-zA-Z0-9._-]+)@([a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi;
  value = value.replace(emailRegex, '***@$2');
  
  // Mask SSN patterns (XXX-XX-XXXX)
  const ssnRegex = /\b\d{3}-\d{2}-\d{4}\b/g;
  value = value.replace(ssnRegex, '***-**-****');
  
  return value;
}

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

/**
 * Action: FetchExcelFromOneDrive
 * Downloads an Excel file from OneDrive using Microsoft Graph API
 */
app.post('/actions/fetch-excel', async (req, res) => {
  try {
    const { onedrive_path } = req.body;
    
    if (!onedrive_path) {
      return res.status(400).json({ error: 'onedrive_path is required' });
    }

    const encodedPath = encodeURIComponent(onedrive_path).replace(/%2F/g, '/');
    const graphUrl = `https://graph.microsoft.com/v1.0/me/drive/root:${encodedPath}`;
    
    const metadataResponse = await fetch(graphUrl, {
      headers: {
        'Authorization': `Bearer ${process.env.ONEDRIVE_OAUTH_TOKEN}`
      }
    });

    if (!metadataResponse.ok) {
      const error = await metadataResponse.json();
      return res.status(metadataResponse.status).json({ 
        error: 'Failed to fetch file metadata', 
        details: error 
      });
    }

    const metadata = await metadataResponse.json();
    
    res.json({
      download_url: metadata['@microsoft.graph.downloadUrl'],
      size_bytes: metadata.size,
      name: metadata.name,
      lastModifiedDateTime: metadata.lastModifiedDateTime
    });
  } catch (error) {
    console.error('FetchExcelFromOneDrive error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

/**
 * Action: ParseExcelStructure
 * Parses the Excel file and returns column information and sample rows
 */
app.post('/actions/parse-excel', async (req, res) => {
  try {
    const { download_url, sheet_name } = req.body;
    
    if (!download_url) {
      return res.status(400).json({ error: 'download_url is required' });
    }

    // Download the Excel file
    const response = await fetch(download_url);
    if (!response.ok) {
      return res.status(400).json({ error: 'Failed to download Excel file' });
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const workbook = xlsx.read(arrayBuffer, { type: 'array' });
    
    // Select the appropriate sheet
    const targetSheet = sheet_name || workbook.SheetNames[0];
    if (!workbook.SheetNames.includes(targetSheet)) {
      return res.status(400).json({ 
        error: `Sheet "${targetSheet}" not found. Available sheets: ${workbook.SheetNames.join(', ')}`
      });
    }
    
    const worksheet = workbook.Sheets[targetSheet];
    const jsonData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
    
    if (jsonData.length < 1) {
      return res.status(400).json({ error: 'Excel file is empty' });
    }
    
    // First row is headers
    const headers = jsonData[0].map((h, i) => h || `column_${i + 1}`);
    const dataRows = jsonData.slice(1);
    
    // Analyze columns
    const columns = headers.map((name, index) => {
      const sampleValues = dataRows.slice(0, 100).map(row => row[index]);
      const sanitizedName = sanitizeColumnName(name);
      return {
        original_name: String(name),
        name: sanitizedName,
        sample_type: inferColumnType(sampleValues),
        sample_values: sampleValues.slice(0, 5)
      };
    });
    
    res.json({
      sheet_name: targetSheet,
      available_sheets: workbook.SheetNames,
      columns,
      total_rows: dataRows.length,
      rows_sample: dataRows.slice(0, 10).map(row => 
        Object.fromEntries(headers.map((h, i) => [sanitizeColumnName(h), row[i]]))
      )
    });
  } catch (error) {
    console.error('ParseExcelStructure error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

/**
 * Action: CreateMySQLSchema
 * Generates and optionally executes DDL for creating a MySQL table
 */
app.post('/actions/create-schema', rateLimit, async (req, res) => {
  try {
    const { table_name, columns, execute = false } = req.body;
    
    if (!table_name || !columns || !Array.isArray(columns)) {
      return res.status(400).json({ error: 'table_name and columns array are required' });
    }

    // Validate table name
    const sanitizedTableName = table_name.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
    
    // Generate DDL
    const columnDefs = columns.map(col => {
      const colName = col.name || sanitizeColumnName(col.original_name);
      const colType = col.sample_type || 'VARCHAR(255)';
      return `  \`${colName}\` ${colType}`;
    });
    
    const ddl = `CREATE TABLE IF NOT EXISTS \`${sanitizedTableName}\` (\n` +
      `  \`id\` BIGINT AUTO_INCREMENT PRIMARY KEY,\n` +
      columnDefs.join(',\n') + ',\n' +
      `  \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n` +
      `) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`;

    let created = false;
    
    if (execute) {
      const dbConfig = parseMySQLUri(process.env.MYSQL_CONN_URI);
      const connection = await mysql.createConnection(dbConfig);
      
      try {
        await connection.execute(ddl);
        created = true;
      } finally {
        await connection.end();
      }
    }
    
    res.json({
      table_name: sanitizedTableName,
      ddl,
      created,
      columns_count: columns.length
    });
  } catch (error) {
    console.error('CreateMySQLSchema error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

/**
 * Action: InsertDataIntoMySQL
 * Inserts data in batches with optional column mapping
 */
app.post('/actions/insert-data', rateLimit, async (req, res) => {
  try {
    const { table_name, rows, column_mapping = {} } = req.body;
    
    if (!table_name || !rows || !Array.isArray(rows)) {
      return res.status(400).json({ error: 'table_name and rows array are required' });
    }

    const dbConfig = parseMySQLUri(process.env.MYSQL_CONN_URI);
    const connection = await mysql.createConnection(dbConfig);
    
    let rowsInserted = 0;
    const errors = [];
    
    try {
      // Get column names from first row
      const sampleRow = rows[0];
      const originalColumns = Object.keys(sampleRow);
      const mappedColumns = originalColumns.map(col => column_mapping[col] || col);
      
      // Process in batches
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        
        const placeholders = batch.map(() => 
          '(' + mappedColumns.map(() => '?').join(', ') + ')'
        ).join(', ');
        
        const values = batch.flatMap(row => 
          originalColumns.map(col => maskPII(row[col]))
        );
        
        const sql = `INSERT INTO \`${table_name}\` (\`${mappedColumns.join('`, `')}\`) VALUES ${placeholders}`;
        
        try {
          await connection.execute(sql, values);
          rowsInserted += batch.length;
        } catch (batchError) {
          errors.push({
            batch_start: i,
            batch_end: i + batch.length,
            error: batchError.message
          });
        }
      }
    } finally {
      await connection.end();
    }
    
    res.json({
      rows_inserted: rowsInserted,
      total_rows: rows.length,
      errors,
      success: errors.length === 0
    });
  } catch (error) {
    console.error('InsertDataIntoMySQL error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

/**
 * Main Migration Endpoint
 * Orchestrates the full migration workflow
 */
app.post('/migrate', rateLimit, async (req, res) => {
  try {
    const { onedrive_path, table_name, column_mapping = {}, sheet_name, confirm_create = false } = req.body;
    
    if (!onedrive_path || !table_name) {
      return res.status(400).json({ 
        error: 'onedrive_path and table_name are required',
        example: {
          onedrive_path: '/reports/sales.xlsx',
          table_name: 'sales_2025',
          column_mapping: { 'Total USD': 'total_usd' },
          sheet_name: 'Sheet1',
          confirm_create: true
        }
      });
    }

    const startTime = Date.now();
    const results = {
      steps: [],
      success: false
    };

    // Step 1: Fetch Excel from OneDrive
    console.log(`[1/4] Fetching Excel file from OneDrive: ${onedrive_path}`);
    const encodedPath = encodeURIComponent(onedrive_path).replace(/%2F/g, '/');
    const graphUrl = `https://graph.microsoft.com/v1.0/me/drive/root:${encodedPath}`;
    
    const metadataResponse = await fetch(graphUrl, {
      headers: {
        'Authorization': `Bearer ${process.env.ONEDRIVE_OAUTH_TOKEN}`
      }
    });

    if (!metadataResponse.ok) {
      const error = await metadataResponse.json();
      return res.status(400).json({ 
        error: 'Failed to fetch file from OneDrive', 
        details: error 
      });
    }

    const metadata = await metadataResponse.json();
    results.steps.push({
      action: 'FetchExcelFromOneDrive',
      status: 'completed',
      download_url: metadata['@microsoft.graph.downloadUrl'],
      size_bytes: metadata.size,
      latency_ms: Date.now() - startTime
    });

    // Step 2: Parse Excel Structure
    console.log('[2/4] Parsing Excel structure...');
    const parseStart = Date.now();
    
    const excelResponse = await fetch(metadata['@microsoft.graph.downloadUrl']);
    if (!excelResponse.ok) {
      return res.status(400).json({ error: 'Failed to download Excel file' });
    }
    
    const arrayBuffer = await excelResponse.arrayBuffer();
    const workbook = xlsx.read(arrayBuffer, { type: 'array' });
    
    const targetSheet = sheet_name || workbook.SheetNames[0];
    const worksheet = workbook.Sheets[targetSheet];
    const jsonData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
    
    const headers = jsonData[0].map((h, i) => h || `column_${i + 1}`);
    const dataRows = jsonData.slice(1);
    
    const columns = headers.map((name, index) => {
      const sampleValues = dataRows.slice(0, 100).map(row => row[index]);
      const originalName = String(name);
      const mappedName = column_mapping[originalName] || sanitizeColumnName(originalName);
      return {
        original_name: originalName,
        name: mappedName,
        sample_type: inferColumnType(sampleValues)
      };
    });
    
    results.steps.push({
      action: 'ParseExcelStructure',
      status: 'completed',
      sheet_name: targetSheet,
      columns_count: columns.length,
      total_rows: dataRows.length,
      latency_ms: Date.now() - parseStart
    });

    // Step 3: Create MySQL Schema
    console.log('[3/4] Creating MySQL schema...');
    const schemaStart = Date.now();
    
    const sanitizedTableName = table_name.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
    
    const columnDefs = columns.map(col => 
      `  \`${col.name}\` ${col.sample_type}`
    );
    
    const ddl = `CREATE TABLE IF NOT EXISTS \`${sanitizedTableName}\` (\n` +
      `  \`id\` BIGINT AUTO_INCREMENT PRIMARY KEY,\n` +
      columnDefs.join(',\n') + ',\n' +
      `  \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n` +
      `) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`;

    if (!confirm_create) {
      // Return preview for confirmation
      return res.json({
        status: 'pending_confirmation',
        message: 'Please confirm table creation by setting confirm_create: true',
        preview: {
          table_name: sanitizedTableName,
          ddl,
          columns,
          total_rows_to_insert: dataRows.length,
          column_mapping: Object.keys(column_mapping).length > 0 ? column_mapping : null
        }
      });
    }

    const dbConfig = parseMySQLUri(process.env.MYSQL_CONN_URI);
    const connection = await mysql.createConnection(dbConfig);
    
    try {
      await connection.execute(ddl);
      results.steps.push({
        action: 'CreateMySQLSchema',
        status: 'completed',
        table_name: sanitizedTableName,
        ddl,
        latency_ms: Date.now() - schemaStart
      });

      // Step 4: Insert Data
      console.log('[4/4] Inserting data...');
      const insertStart = Date.now();
      
      let rowsInserted = 0;
      const errors = [];
      
      // Convert data to row objects
      const rowObjects = dataRows.map(row => 
        Object.fromEntries(columns.map((col, i) => [col.name, row[i]]))
      );
      
      const columnNames = columns.map(c => c.name);
      
      for (let i = 0; i < rowObjects.length; i += BATCH_SIZE) {
        const batch = rowObjects.slice(i, i + BATCH_SIZE);
        
        const placeholders = batch.map(() => 
          '(' + columnNames.map(() => '?').join(', ') + ')'
        ).join(', ');
        
        const values = batch.flatMap(row => 
          columnNames.map(col => maskPII(row[col]))
        );
        
        const sql = `INSERT INTO \`${sanitizedTableName}\` (\`${columnNames.join('`, `')}\`) VALUES ${placeholders}`;
        
        try {
          await connection.execute(sql, values);
          rowsInserted += batch.length;
        } catch (batchError) {
          errors.push({
            batch_start: i,
            batch_end: i + batch.length,
            error: batchError.message
          });
        }
      }
      
      results.steps.push({
        action: 'InsertDataIntoMySQL',
        status: errors.length === 0 ? 'completed' : 'completed_with_errors',
        rows_inserted: rowsInserted,
        total_rows: dataRows.length,
        errors,
        latency_ms: Date.now() - insertStart
      });
      
      results.success = errors.length === 0;
      results.summary = {
        table_name: sanitizedTableName,
        rows_inserted: rowsInserted,
        total_rows: dataRows.length,
        total_latency_ms: Date.now() - startTime
      };
      
    } finally {
      await connection.end();
    }
    
    res.json(results);
    
  } catch (error) {
    console.error('Migration error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Error handling middleware
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
if (process.env.NODE_ENV !== 'test') {
  validateEnvVars();
  app.listen(PORT, () => {
    console.log(`ExcelToMySQLAgent server running on port ${PORT}`);
    console.log(`Batch size: ${BATCH_SIZE}`);
  });
}

export default app;
