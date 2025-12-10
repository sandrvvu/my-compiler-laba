import * as readline from 'readline';
import { ArithmeticExpressionAnalyzer } from './analyzer';
import { cloneExpression, ExpressionNode, formatExpression, parseExpressionTree } from './expressionTree';

function isAdditive(node: ExpressionNode): node is Extract<ExpressionNode, { type: 'binary' }> {
  return node.type === 'binary' && (node.operator === '+' || node.operator === '-');
}

export class DistributiveTransformer {
  public generate(expression: string): string[] {
    console.log(`\n=== Лабораторна робота №4: дистрибутивні перетворення для "${expression}" ===`);
    const tree = parseExpressionTree(expression);
    const variants = this.generateVariants(tree);

    console.log(`\nОтримано ${variants.length} еквівалентних форм (дистрибутивний закон):`);
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
          // Базова форма
          results.push({ type: 'binary', operator: n.operator, left, right });

          // Дистрибутивність для множення
          if (n.operator === '*' && isAdditive(left)) {
            results.push({
              type: 'binary',
              operator: left.operator,
              left: { type: 'binary', operator: '*', left: cloneExpression(left.left), right: cloneExpression(right) },
              right: { type: 'binary', operator: '*', left: cloneExpression(left.right), right: cloneExpression(right) },
            });
          }

          if (n.operator === '*' && isAdditive(right)) {
            results.push({
              type: 'binary',
              operator: right.operator,
              left: { type: 'binary', operator: '*', left: cloneExpression(left), right: cloneExpression(right.left) },
              right: { type: 'binary', operator: '*', left: cloneExpression(left), right: cloneExpression(right.right) },
            });
          }
        }
      }

      return results;
    };

    helper(node).forEach((variant) => variants.add(formatExpression(variant)));

    return Array.from(variants);
  }
}

export function runLab4Interactive(): void {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const analyzer = new ArithmeticExpressionAnalyzer();
  const transformer = new DistributiveTransformer();

  const ask = (): void => {
    rl.question('\nВведіть арифметичний вираз (або quit для виходу): ', (expression: string) => {
      if (expression.toLowerCase() === 'quit' || expression.toLowerCase() === 'exit') {
        console.log('Завершення роботи лабораторної №4.');
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

  console.log('\n=== Лабораторна робота №4. Дистрибутивний закон ===');
  console.log('Введіть вираз, наприклад: A*(B+C) або (X+Y)*Z');
  ask();
}
