import express from 'express';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
const app = createApp();
app.use(express.static(fileURLToPath(new URL('../dist', import.meta.url))));
app.listen(Number(process.env.PORT || 3001), '0.0.0.0', () => console.log(`PragaCaféIA: http://localhost:${process.env.PORT || 3001}`));
