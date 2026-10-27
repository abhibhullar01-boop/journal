/// <reference types="node" />
// Retrains the starting model from the seed data and saves its weights for the app.
//   npm run train
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { SEED_TRAINING, trainFromSeed } from './seed';

const weights = { ...trainFromSeed().model.exportWeights(), examples: SEED_TRAINING.length };
const path = join(__dirname, 'data', 'model_weights.json');
writeFileSync(path, JSON.stringify(weights) + '\n');
console.log(`Saved ${Object.keys(weights.weights).length} feature weights to ${path}`);
