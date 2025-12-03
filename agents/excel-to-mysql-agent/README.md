# ExcelToMySQLAgent

Agent that automates the migration of Excel data stored in OneDrive to MySQL databases.

## Features

- **Download Excel from OneDrive**: Fetches Excel files using Microsoft Graph API
- **Automatic Schema Inference**: Analyzes Excel structure to determine column types
- **DDL Generation**: Creates MySQL CREATE TABLE statements
- **Optional Column Renaming**: Supports custom column name mapping
- **Batch Insertion**: Inserts data in configurable batch sizes
- **PII Masking**: Automatically masks emails and SSNs before insertion
- **Human Confirmation**: Requires confirmation before creating/modifying tables

## Quick Start

### Prerequisites

- Node.js >= 20.0.0
- Access to OneDrive (Microsoft Graph API token)
- MySQL database with CREATE, INSERT, SELECT permissions

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ONEDRIVE_OAUTH_TOKEN` | Yes | OAuth token for Microsoft Graph API |
| `MYSQL_CONN_URI` | Yes | MySQL connection string (mysql://user:pass@host:port/db) |
| `BATCH_SIZE` | No | Number of rows per batch insert (default: 500) |
| `PORT` | No | Server port (default: 8080) |

### Installation

```bash
cd agents/excel-to-mysql-agent
npm install
```

### Running Locally

```bash
export ONEDRIVE_OAUTH_TOKEN="your-oauth-token"
export MYSQL_CONN_URI="mysql://user:password@localhost:3306/mydb"
npm start
```

### Docker Deployment

```bash
# Build the image
docker build -t excel-to-mysql-agent .

# Run the container
docker run -d \
  -p 8080:8080 \
  -e ONEDRIVE_OAUTH_TOKEN="your-token" \
  -e MYSQL_CONN_URI="mysql://user:pass@host:3306/db" \
  -e BATCH_SIZE=500 \
  excel-to-mysql-agent
```

## API Endpoints

### Health Check
```
GET /health
```

### Full Migration (Recommended)
```
POST /migrate
Content-Type: application/json

{
  "onedrive_path": "/reports/sales.xlsx",
  "table_name": "sales_2025",
  "column_mapping": {
    "Total USD": "total_usd"
  },
  "sheet_name": "Sheet1",
  "confirm_create": true
}
```

### Individual Actions

#### Fetch Excel from OneDrive
```
POST /actions/fetch-excel
{ "onedrive_path": "/path/to/file.xlsx" }
```

#### Parse Excel Structure
```
POST /actions/parse-excel
{ "download_url": "https://...", "sheet_name": "Sheet1" }
```

#### Create MySQL Schema
```
POST /actions/create-schema
{ "table_name": "my_table", "columns": [...], "execute": true }
```

#### Insert Data
```
POST /actions/insert-data
{ "table_name": "my_table", "rows": [...], "column_mapping": {...} }
```

## Security

- Credentials are never exposed in API responses
- PII (emails, SSNs) is automatically masked before database insertion
- Human confirmation required before table creation
- Runs as non-root user in Docker container

## Known Limitations

- Type inference may fail with mixed-type cells; review mappings before insertion
- Does not support legacy .xls files without conversion
- Large-scale operations may require monitoring and batch size tuning

## API Documentation

See [openapi.yaml](./openapi.yaml) for the complete OpenAPI 3.0 specification.
