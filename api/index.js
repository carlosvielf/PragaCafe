import { createApp } from '../server/app.js';

// Reuse Express without opening a port in the serverless runtime.
export default createApp();
