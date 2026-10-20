// Try the classifier from a terminal:
//   npm run classify -- "I need to call mom tomorrow and someday I want to run a marathon"
//   npm run classify -- --eval
import { evaluate, JournalAnalyzer, KIND_LABEL, SEED_EVALUATION, summary } from './index';

const args = process.argv.slice(2);
const analyzer = JournalAnalyzer.baseline();

if (args[0] === '--eval') {
  console.log(summary(evaluate(analyzer, SEED_EVALUATION)));
} else {
  const insights = analyzer.analyze(args.join(' '));
  if (!insights.length) console.log('No tasks, skills or goals found.');
  for (const i of insights) {
    const due = i.dueDate ? `  remind: ${i.dueDate.toLocaleString()}` : '';
    console.log(`[${KIND_LABEL[i.kind]}] ${i.title}  (${Math.round(i.confidence * 100)}%)${due}`);
  }
}
