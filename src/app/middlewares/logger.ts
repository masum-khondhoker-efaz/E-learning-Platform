import morgan from 'morgan';
import fs from 'fs';
import path from 'path';

// Use /tmp which is writable in Vercel
const logDir = path.join('/tmp', 'logs'); // <-- /tmp/logs
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Custom format with a clear prefix
const customFormat =
  '\n[API REQUEST] :date[iso]\nMethod: :method\nURL: :url\nStatus: :status\nResponse Time: :response-time ms\n-----------------------------';

// Log to file in /tmp
const logStream = fs.createWriteStream(
  path.join(logDir, 'access.log'),
  { flags: 'a' }
);

// Morgan instances
const logger = morgan('combined', { stream: logStream });
const loggerConsole = morgan(customFormat);

export { logger, loggerConsole };