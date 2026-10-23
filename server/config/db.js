const mongoose = require('mongoose');

// Keep a module-level connection promise so concurrent requests
// during a cold start don't each try to open their own connection.
let connectionPromise = null;

const connectDB = async () => {
  // Already connected — return immediately
  if (mongoose.connection.readyState === 1) return;

  // Connection in progress — wait for it
  if (connectionPromise) return connectionPromise;

  const FALLBACK_URI = 'mongodb+srv://babaroti_admin:babaroti2026%40@cluster0.8ivgh1z.mongodb.net/baba_roti_db?retryWrites=true&w=majority&compressors=zlib';

  let uri =
    process.env.MONGO_URI ||
    process.env.MONGODB_URI ||
    process.env.MONGO_URL ||
    process.env.DATABASE_URL ||
    FALLBACK_URI;

  if (uri.includes('xxxxx') || uri.includes('<db_') || uri.includes('<username>')) {
    console.warn('[DB] Placeholder detected in MONGO_URI, using verified Baba Roti cluster URI');
    uri = FALLBACK_URI;
  }
  const MAX_RETRIES = 5;
  const RETRY_DELAY = 3000; // ms between retries

  const attempt = async (retryCount = 0) => {
    try {
      const conn = await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 10000,
        heartbeatFrequencyMS: 10000,
      });
      global.mongoConnectionError = null;
      console.log(`[DB] MongoDB connected: ${conn.connection.host}`);
      connectionPromise = null; // reset so future calls can reconnect if needed
    } catch (error) {
      global.mongoConnectionError = error.message;
      console.error(`[DB] Connection attempt ${retryCount + 1}/${MAX_RETRIES} failed: ${error.message}`);

      if (retryCount < MAX_RETRIES - 1) {
        console.log(`[DB] Retrying in ${RETRY_DELAY / 1000}s…`);
        await new Promise(r => setTimeout(r, RETRY_DELAY));
        return attempt(retryCount + 1);
      }

      // All retries exhausted — surface a clean error
      connectionPromise = null;
      throw new Error(
        'Could not connect to the database after several attempts. ' +
        'Please check your MONGO_URI and try again in a moment.'
      );
    }
  };
  connectionPromise = attempt();
  return connectionPromise;
};
// Handle unexpected disconnection — log and attempt reconnect
mongoose.connection.on('disconnected', () => {
  console.warn('[DB] MongoDB disconnected. Will reconnect on next request.');
  connectionPromise = null;
});
mongoose.connection.on('error', (err) => {
  console.error('[DB] MongoDB error:', err.message);
  connectionPromise = null;
});
module.exports = connectDB;
