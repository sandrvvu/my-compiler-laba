import { randomUUID } from 'crypto';
import * as readline from 'readline';
import { ArithmeticExpressionAnalyzer } from './analyzer';

type NodeType = 'OPERAND' | 'BINARY_OP';

type Operator = '+' | '-' | '*' | '/';

type TokenType = 'OPERAND' | 'OPERATOR' | 'LPAREN' | 'RPAREN';

interface Token {
  type: TokenType;
  value: string;
}

export interface ExpressionNode {
  type: NodeType;
  value?: string;
  operator?: Operator;
  left?: ExpressionNode;
  right?: ExpressionNode;
  id: string;
}

export interface EquivalentFormsResult {
  original: string;
  distributed?: string;
  variants: string[];
}

export class EquivalentExpressionGenerator {
  public generateCommutativeForms(expression: string): EquivalentFormsResult {
    const ast = this.parseExpression(this.tokenize(expression));
    const variants = Array.from(this.generateCommutativeVariants(ast));

    return {
      original: this.formatNode(ast),
      variants,
    };
  }

  public generateDistributiveForms(expression: string): EquivalentFormsResult {
    const ast = this.parseExpression(this.tokenize(expression));
    const distributedAst = this.applyDistributiveLaw(this.cloneNode(ast));
    const distributed = this.formatNode(distributedAst);
    const variants = Array.from(
      new Set([
        this.formatNode(ast),
        distributed,
        ...this.generateCommutativeVariants(distributedAst),
      ])
    );

    return {
      original: this.formatNode(ast),
      distributed,
      variants,
    };
  }

  private tokenize(expr: string): Token[] {
    const tokens: Token[] = [];
    let i = 0;
    const expression = expr.replace(/\s+/g, '');

    while (i < expression.length) {
      const char = expression[i];

      if (/[A-Za-z0-9]/.test(char)) {
        let operand = char;
        i++;
        while (i < expression.length && /[A-Za-z0-9]/.test(expression[i])) {
          operand += expression[i];
          i++;
        }
        tokens.push({ type: 'OPERAND', value: operand });
        continue;
      }

      if (['+', '-', '*', '/'].includes(char)) {
        tokens.push({ type: 'OPERATOR', value: char });
        i++;
        continue;
      }

      if (char === '(') {
        tokens.push({ type: 'LPAREN', value: char });
        i++;
        continue;
      }

      if (char === ')') {
        tokens.push({ type: 'RPAREN', value: char });
        i++;
        continue;
      }

      throw new Error(`Невідомий символ '${char}' на позиції ${i}`);
    }

    return tokens;
  }

  private parseExpression(tokens: Token[]): ExpressionNode {
    let pos = 0;

    const peek = () => tokens[pos];
    const consume = () => tokens[pos++];
    const isEnd = () => pos >= tokens.length;

    const parseAdditive = (): ExpressionNode => {
      let left = parseMultiplicative();

      while (!isEnd() && peek()?.type === 'OPERATOR' && ['+', '-'].includes(peek().value)) {
        const op = consume();
        const right = parseMultiplicative();
        left = {
          type: 'BINARY_OP',
          operator: op.value as Operator,
          left,
          right,
          id: randomUUID(),
        };
      }
      return left;
    };

    const parseMultiplicative = (): ExpressionNode => {
      let left = parseUnary();

      while (!isEnd() && peek()?.type === 'OPERATOR' && ['*', '/'].includes(peek().value)) {
        const op = consume();
        const right = parseUnary();
        left = {
          type: 'BINARY_OP',
          operator: op.value as Operator,
          left,
          right,
          id: randomUUID(),
        };
      }
      return left;
    };

    const parseUnary = (): ExpressionNode => {
      return parsePrimary();
    };

    const parsePrimary = (): ExpressionNode => {
      if (isEnd()) {
        throw new Error('Неочікуваний кінець виразу');
      }

      const token = peek();

      if (token.type === 'OPERAND') {
        consume();
        return {
          type: 'OPERAND',
          value: token.value,
          id: randomUUID(),
        };
      }

      if (token.type === 'LPAREN') {
        consume();
        const expr = parseAdditive();

        if (isEnd() || peek()?.type !== 'RPAREN') {
          throw new Error('Очікується закриваюча дужка ")"');
        }
        consume();
        return expr;
      }

      throw new Error(`Неочікуваний токен: ${token.value}`);
    };

    const ast = parseAdditive();

    if (!isEnd()) {
      throw new Error(`Неочікувані символи після виразу: ${tokens.slice(pos).map((t) => t.value).join('')}`);
    }

    return ast;
  }

  private cloneNode(node: ExpressionNode | undefined): ExpressionNode {
    if (!node) {
      throw new Error('Неможливо клонувати порожній вузол');
    }

    if (node.type === 'OPERAND') {
      return { ...node };
    }

    return {
      ...node,
      left: node.left ? this.cloneNode(node.left) : undefined,
      right: node.right ? this.cloneNode(node.right) : undefined,
    };
  }

  private formatNode(node: ExpressionNode | undefined): string {
    if (!node) return '';
    if (node.type === 'OPERAND') return node.value ?? '';
    return `(${this.formatNode(node.left)} ${node.operator} ${this.formatNode(node.right)})`;
  }

  private generateCommutativeVariants(node: ExpressionNode | undefined): Set<string> {
    if (!node) return new Set();

    if (node.type === 'OPERAND') {
      return new Set([this.formatNode(node)]);
    }

    if (this.isAdditive(node)) {
      const terms = this.flattenAdditive(node);
      const termVariants = terms.map((term) => this.getMultiplicativeVariants(term.node));
      const orderings = this.permute(Array.from(terms.keys()));
      const results = new Set<string>();

      orderings.forEach((order) => {
        const assembled = this.buildAdditiveExpressions(order, terms, termVariants);
        assembled.forEach((expr) => results.add(expr));
      });

      return results;
    }

    if (this.isPureMultiplication(node)) {
      const factors = this.flattenMultiplication(node);
      const orderings = this.permute(Array.from(factors.keys()));
      const results = new Set<string>();

      orderings.forEach((order) => {
        const expression = order.map((index) => this.formatNode(factors[index])).join(' * ');
        results.add(expression);
      });

      return results;
    }

    const leftVariants = this.generateCommutativeVariants(node.left);
    const rightVariants = this.generateCommutativeVariants(node.right);
    const results = new Set<string>();

    leftVariants.forEach((left) => {
      rightVariants.forEach((right) => {
        results.add(`(${left} ${node.operator} ${right})`);
      });
    });

    return results;
  }

  private buildAdditiveExpressions(
    order: number[],
    terms: { node: ExpressionNode; sign: 1 | -1 }[],
    termVariants: string[][]
  ): string[] {
    const results: string[] = [''];

    order.forEach((termIndex, position) => {
      const sign = terms[termIndex].sign;
      const variants = termVariants[termIndex];
      const updated: string[] = [];

      variants.forEach((variant) => {
        const formatted = this.formatSignedTerm(variant, sign, position === 0);
        results.forEach((partial) => {
          const combined = partial ? `${partial} ${formatted}`.trim() : formatted;
          updated.push(combined.trim());
        });
      });

      results.splice(0, results.length, ...updated);
    });

    return results;
  }

  private formatSignedTerm(term: string, sign: 1 | -1, isFirst: boolean): string {
    if (isFirst) {
      return sign === -1 ? `-${term}` : term;
    }
    return sign === -1 ? `- ${term}` : `+ ${term}`;
  }

  private flattenAdditive(node: ExpressionNode | undefined, sign: 1 | -1 = 1): { node: ExpressionNode; sign: 1 | -1 }[] {
    if (!node) return [];

    if (this.isAdditive(node)) {
      const left = this.flattenAdditive(node.left, sign);
      const rightSign: 1 | -1 = node.operator === '-' ? (sign === 1 ? -1 : 1) : sign;
      const right = this.flattenAdditive(node.right, rightSign);
      return [...left, ...right];
    }

    return [{ node, sign }];
  }

  private flattenMultiplication(node: ExpressionNode | undefined): ExpressionNode[] {
    if (!node) return [];

    if (node.type === 'BINARY_OP' && node.operator === '*') {
      return [...this.flattenMultiplication(node.left), ...this.flattenMultiplication(node.right)];
    }

    return [node];
  }

  private getMultiplicativeVariants(node: ExpressionNode): string[] {
    if (this.isPureMultiplication(node)) {
      const factors = this.flattenMultiplication(node);
      const orderings = this.permute(Array.from(factors.keys()));
      const variants = new Set<string>();

      orderings.forEach((order) => {
        const expression = order.map((index) => this.formatNode(factors[index])).join(' * ');
        variants.add(expression);
      });

      return Array.from(variants);
    }

    return [this.formatNode(node)];
  }

  private permute<T>(items: T[]): T[][] {
    const results: T[][] = [];

    const backtrack = (path: T[], remaining: T[]): void => {
      if (remaining.length === 0) {
        results.push(path);
        return;
      }

      remaining.forEach((item, index) => {
        const nextRemaining = [...remaining.slice(0, index), ...remaining.slice(index + 1)];
        backtrack([...path, item], nextRemaining);
      });
    };

    backtrack([], items);
    return results;
  }

  private isPureMultiplication(node: ExpressionNode | undefined): boolean {
    if (!node) return false;
    if (node.type === 'OPERAND') return true;
    if (node.operator !== '*') return false;
    return this.isPureMultiplication(node.left) && this.isPureMultiplication(node.right);
  }

  private applyDistributiveLaw(node: ExpressionNode): ExpressionNode {
    const distribute = (n: ExpressionNode | undefined): ExpressionNode | undefined => {
      if (!n || n.type === 'OPERAND') {
        return n;
      }

      n.left = distribute(n.left);
      n.right = distribute(n.right);

      if (n.operator === '*' && this.isAdditive(n.left)) {
        const leftNode = n.left as ExpressionNode;
        return {
          type: 'BINARY_OP',
          operator: leftNode.operator as Operator,
          left: distribute({
            type: 'BINARY_OP',
            operator: '*',
            left: leftNode.left,
            right: n.right,
            id: randomUUID(),
          }) as ExpressionNode,
          right: distribute({
            type: 'BINARY_OP',
            operator: '*',
            left: leftNode.right,
            right: n.right,
            id: randomUUID(),
          }) as ExpressionNode,
          id: randomUUID(),
        };
      }

      if (n.operator === '*' && this.isAdditive(n.right)) {
        const rightNode = n.right as ExpressionNode;
        return {
          type: 'BINARY_OP',
          operator: rightNode.operator as Operator,
          left: distribute({
            type: 'BINARY_OP',
            operator: '*',
            left: n.left,
            right: rightNode.left,
            id: randomUUID(),
          }) as ExpressionNode,
          right: distribute({
            type: 'BINARY_OP',
            operator: '*',
            left: n.left,
            right: rightNode.right,
            id: randomUUID(),
          }) as ExpressionNode,
          id: randomUUID(),
        };
      }

      return n;
    };

    const distributed = distribute(node);
    if (!distributed) {
      throw new Error('Не вдалося застосувати дистрибутивний закон');
    }
    return distributed;
  }

  private isAdditive(node: ExpressionNode | undefined): boolean {
    return !!node && node.type === 'BINARY_OP' && (node.operator === '+' || node.operator === '-');
  }
}

export function runLab3Interactive(): void {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const analyzer = new ArithmeticExpressionAnalyzer();
  const generator = new EquivalentExpressionGenerator();

  const ask = (): void => {
    rl.question('\nВведіть вираз для застосування комутативного закону (або quit для виходу): ', (expression: string) => {
      if (expression.toLowerCase() === 'quit' || expression.toLowerCase() === 'exit') {
        console.log('Завершення роботи лабораторної №3.');
        rl.close();
        return;
      }

      const result = analyzer.analyze(expression);
      if (!result.isValid) {
        console.error('\nВираз не пройшов перевірку лабораторної №1. Перетворення не виконано.');
        ask();
        return;
      }

      const { original, variants } = generator.generateCommutativeForms(expression);
      console.log(`\nПочаткова форма: ${original}`);
      console.log('Еквівалентні форми (комутативність):');
      variants.forEach((variant, index) => console.log(`  ${index + 1}. ${variant}`));

      ask();
    });
  };

  console.log('\n=== Лабораторна робота №3. Комутативний закон ===');
  console.log('Введіть вираз, наприклад: A+B*C або (x+y)*z');
  ask();
}

export function runLab4Interactive(): void {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const analyzer = new ArithmeticExpressionAnalyzer();
  const generator = new EquivalentExpressionGenerator();

  const ask = (): void => {
    rl.question('\nВведіть вираз для застосування дистрибутивного закону (або quit для виходу): ', (expression: string) => {
      if (expression.toLowerCase() === 'quit' || expression.toLowerCase() === 'exit') {
        console.log('Завершення роботи лабораторної №4.');
        rl.close();
        return;
      }

      const result = analyzer.analyze(expression);
      if (!result.isValid) {
        console.error('\nВираз не пройшов перевірку лабораторної №1. Перетворення не виконано.');
        ask();
        return;
      }

      const { original, distributed, variants } = generator.generateDistributiveForms(expression);
      console.log(`\nПочаткова форма: ${original}`);
      console.log(`Після застосування дистрибутивності: ${distributed}`);
      console.log('Еквівалентні форми (комбінації дистрибутивності та комутативності):');
      variants.forEach((variant, index) => console.log(`  ${index + 1}. ${variant}`));

      ask();
    });
  };

  console.log('\n=== Лабораторна робота №4. Дистрибутивний закон ===');
  console.log('Введіть вираз, наприклад: (A+B)*C або (x+y)*(z+t)');
  ask();
}