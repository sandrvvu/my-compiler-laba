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
  truncated?: boolean;
}

export const VARIANT_DISPLAY_LIMIT = 50;

export function printVariants(variants: string[], limit: number = VARIANT_DISPLAY_LIMIT): void {
  const total = variants.length;
  const capped = variants.slice(0, limit);

  capped.forEach((variant, index) => console.log(`  ${index + 1}. ${variant}`));

  if (total > limit) {
    console.log(`  ... (показано ${limit} з ${total} форм)`);
  }
}

export class EquivalentExpressionGenerator {
  public generateCommutativeForms(
    expression: string,
    options: { maxVariants?: number } = {}
  ): EquivalentFormsResult {
    const { maxVariants = Infinity } = options;
    const ast = this.parseExpression(this.tokenize(expression));
    const { variants, truncated } = this.generateCommutativeVariants(ast, maxVariants);

    return {
      original: this.formatNode(ast),
      variants,
      truncated,
    };
  }

  public generateDistributiveForms(
    expression: string,
    options: { maxVariants?: number } = {}
  ): EquivalentFormsResult {
    const { maxVariants = Infinity } = options;
    const ast = this.parseExpression(this.tokenize(expression));
    const distributedAst = this.applyDistributiveLaw(this.cloneNode(ast));
    const distributed = this.formatNode(distributedAst);
    const { variants: distributedVariants, truncated } = this.generateCommutativeVariants(
      distributedAst,
      maxVariants
    );

    const variants = Array.from(
      new Set([
        this.formatNode(ast),
        distributed,
        ...distributedVariants,
      ])
    ).slice(0, maxVariants);

    return {
      original: this.formatNode(ast),
      distributed,
      variants,
      truncated: truncated || variants.length >= maxVariants,
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
      if (!isEnd() && peek()?.type === 'OPERATOR' && ['+', '-'].includes(peek().value)) {
        const op = consume();
        const operand = parseUnary();

        if (op.value === '+') {
          return operand;
        }

        return {
          type: 'BINARY_OP',
          operator: '-',
          left: { type: 'OPERAND', value: '0', id: randomUUID() },
          right: operand,
          id: randomUUID(),
        };
      }

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

  private generateCommutativeVariants(
    node: ExpressionNode | undefined,
    limit: number,
  ): { variants: string[]; truncated: boolean } {
    const results = new Set<string>();
    let truncated = false;

    const addVariant = (value: string): void => {
      if (results.size < limit) {
        results.add(value);
      } else {
        truncated = true;
      }
    };

    const collectVariants = (current: ExpressionNode | undefined): void => {
      if (!current || truncated) return;

      if (current.type === 'OPERAND') {
        addVariant(this.formatNode(current));
        return;
      }

      if (this.isAdditive(current)) {
        const terms = this.flattenAdditive(current);
        const termVariants = terms.map((term) => this.getMultiplicativeVariants(term.node, limit));
        const orderings = this.permute(Array.from(terms.keys()), limit);

        for (const order of orderings) {
          const assembled = this.buildAdditiveExpressions(order, terms, termVariants, limit - results.size);
          assembled.forEach((expr) => addVariant(expr));
          if (results.size >= limit) {
            truncated = true;
            break;
          }
        }
        return;
      }

      if (this.isPureMultiplication(current)) {
        const factors = this.flattenMultiplication(current);
        const orderings = this.permute(Array.from(factors.keys()), limit);

        for (const order of orderings) {
          addVariant(order.map((index) => this.formatNode(factors[index])).join(' * '));
          if (results.size >= limit) {
            truncated = true;
            break;
          }
        }
        return;
      }

      const leftVariants = this.generateCommutativeVariants(current.left, limit - results.size);
      const rightVariants = this.generateCommutativeVariants(current.right, limit - results.size);

      for (const left of leftVariants.variants) {
        for (const right of rightVariants.variants) {
          addVariant(`(${left} ${current.operator} ${right})`);
          if (results.size >= limit) {
            truncated = true;
            break;
          }
        }
        if (results.size >= limit) {
          break;
        }
      }

      truncated ||= leftVariants.truncated || rightVariants.truncated;
    };

    collectVariants(node);
    return { variants: Array.from(results), truncated };
  }

  private buildAdditiveExpressions(
    order: number[],
    terms: { node: ExpressionNode; sign: 1 | -1 }[],
    termVariants: string[][],
    limit: number,
  ): string[] {
    const results: string[] = [''];

    for (let position = 0; position < order.length; position++) {
      const termIndex = order[position];
      const sign = terms[termIndex].sign;
      const variants = termVariants[termIndex];
      const updated: string[] = [];

      for (const variant of variants) {
        const formatted = this.formatSignedTerm(variant, sign, position === 0);
        for (const partial of results) {
          if (updated.length >= limit) break;
          const combined = partial ? `${partial} ${formatted}`.trim() : formatted;
          updated.push(combined.trim());
        }
        if (updated.length >= limit) break;
      }

      results.splice(0, results.length, ...updated.slice(0, limit));
      if (results.length >= limit) {
        break;
      }
    }

    return results.slice(0, limit);
  }

  private formatSignedTerm(term: string, sign: 1 | -1, isFirst: boolean): string {
    if (isFirst) {
      return sign === -1 ? `-(${term})` : term;
    }
    return sign === -1 ? `- (${term})` : `+ ${term}`;
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

  private getMultiplicativeVariants(node: ExpressionNode, limit: number): string[] {
    if (this.isPureMultiplication(node)) {
      const factors = this.flattenMultiplication(node);
      const orderings = this.permute(Array.from(factors.keys()), limit);
      const variants = new Set<string>();

      for (const order of orderings) {
        if (variants.size >= limit) break;
        const expression = order.map((index) => this.formatNode(factors[index])).join(' * ');
        variants.add(expression);
      }

      return Array.from(variants).slice(0, limit);
    }

    return [this.formatNode(node)];
  }

  private permute<T>(items: T[], limit: number): T[][] {
    const results: T[][] = [];

    const backtrack = (path: T[], remaining: T[]): void => {
      if (results.length >= limit) {
        return;
      }

      if (remaining.length === 0) {
        results.push(path);
        return;
      }

      remaining.forEach((item, index) => {
        if (results.length >= limit) return;
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
      printVariants(variants);

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
      printVariants(variants);

      ask();
    });
  };

  console.log('\n=== Лабораторна робота №4. Дистрибутивний закон ===');
  console.log('Введіть вираз, наприклад: (A+B)*C або (x+y)*(z+t)');
  ask();
}