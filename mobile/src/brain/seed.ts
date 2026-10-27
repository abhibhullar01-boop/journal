// The training sentences behind the bundled model. Only training and tests use them: the app
// loads the ready-made weights instead, so this large file stays out of the app.
import seedTraining from './data/seed_training.json';
import { JournalAnalyzer } from './analyzer';
import { SoftmaxModel } from './softmax';
import type { LabeledSentence } from './types';

export const SEED_TRAINING = seedTraining as LabeledSentence[];

/** Trains the starting model from the seed data. Used by `npm run train` and the tests. */
export function trainFromSeed(): JournalAnalyzer {
  const model = new SoftmaxModel();
  model.train(SEED_TRAINING);
  return new JournalAnalyzer(model);
}
