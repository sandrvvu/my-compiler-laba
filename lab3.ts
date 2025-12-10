import * as readline from 'readline';
import { ArithmeticExpressionAnalyzer } from './analyzer';
import { cloneExpression, ExpressionNode, formatExpression, parseExpressionTree } from './expressionTree';

export class CommutativeTransformer {
  public generate(expression: string): string[] {
    console.log(`\n=== Лабораторна робота №3: комутативні перетворення для "${expression}" ===`);
    const tree = parseExpressionTree(expression);
    const variants = this.generateVariants(tree);

    console.log(`\nОтримано ${variants.length} еквівалентних форм (комутативний закон):`);
    variants.forEach((variant, index) => {
      console.log(`  ${index + 1}. ${variant}`);
    });

    return variants;
  }

  private generateVariants(node: ExpressionNode): string[] {
    const variants = new Set<string>();

    const helper = (n: ExpressionNode): ExpressionNode[] => {
      if (n.type === 'operand') {
        return [n];
      }

      const leftVariants = helper(n.left);
      const rightVariants = helper(n.right);
      const results: ExpressionNode[] = [];

      for (const left of leftVariants) {
        for (const right of rightVariants) {
          results.push({ type: 'binary', operator: n.operator, left, right });
          if (n.operator === '+' || n.operator === '*') {
            results.push({ type: 'binary', operator: n.operator, left: cloneExpression(right), right: cloneExpression(left) });
          }
        }
      }

      return results;
    };

    helper(node).forEach((variant) => variants.add(formatExpression(variant)));

    return Array.from(variants);
  }
}

export function runLab3Interactive(): void {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const analyzer = new ArithmeticExpressionAnalyzer();
  const transformer = new CommutativeTransformer();

  const ask = (): void => {
    rl.question('\nВведіть арифметичний вираз (або quit для виходу): ', (expression: string) => {
      if (expression.toLowerCase() === 'quit' || expression.toLowerCase() === 'exit') {
        console.log('Завершення роботи лабораторної №3.');
        rl.close();
        return;
      }

      const validation = analyzer.analyze(expression);
      if (!validation.isValid) {
        console.error('\nВираз не пройшов перевірку лабораторної №1. Перетворення не виконано.');
        ask();
        return;
      }

      try {
        transformer.generate(expression);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Невідома помилка';
        console.error(`Помилка: ${message}`);
      }

      ask();
    });
  };

  console.log('\n=== Лабораторна робота №3. Комутативний закон ===');
  console.log('Введіть вираз, наприклад: A+B*C або (X*Y)+Z');
  ask();
}
