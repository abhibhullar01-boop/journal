/// <reference types="node" />
// Retrains the starting model from the seed data and saves its weights for the app.
//   npm run train
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { JournalAnalyzer } from './analyzer';

const weights = JournalAnalyzer.trainFromSeed().model.exportWeights();
const path = join(__dirname, 'data', 'model_weights.json');
writeFileSync(path, JSON.stringify(weights) + '\n');
console.log(`Saved ${Object.keys(weights.weights).length} feature weights to ${path}`);
