import { randomUUID } from 'crypto';
import * as readline from 'readline';
import { ArithmeticExpressionAnalyzer } from './analyzer';
import { renderParallelTree } from './treeVisualizer';

export type NodeType = 'OPERAND' | 'BINARY_OP';

export interface ParallelNode {
  type: NodeType;
  value?: string;
  operator?: string;
  left?: ParallelNode;
  right?: ParallelNode;
  id: string;
}

export interface ParallelStats {
  levels: Array<Array<{ node: ParallelNode; type: 'operand' | 'operation' }>>;
  maxWidth: number;
  height: number;
  depth: number;
  operationsCount: number;
  operandsCount: number;
}

export interface OptimizationRecord {
  type: 'subtraction' | 'division';
  original: string;
  optimized: string;
}

export interface ParallelAnalysisResult {
  tree: ParallelNode;
  stats: ParallelStats;
  optimizations: OptimizationRecord[];
}

interface Token {
  type: 'OPERAND' | 'OPERATOR' | 'LPAREN' | 'RPAREN';
  value: string;
}

export class ParallelExpressionAnalyzer {
  public analyze(expression: string): ParallelAnalysisResult {
    console.log(`\n=== Лабораторна робота №2: розпаралелювання виразу "${expression}" ===`);
    const tokens = this.tokenize(expression);
    console.log('\nТокени:', tokens.map((t) => t.value).join(' '));

    const ast = this.parseExpression(tokens);
    const originalTree = this.cloneNode(ast);
    const { tree, log } = this.optimizeTree(ast);
    const stats = this.calculateTreeLevels(tree);

    this.printTree('Початкове дерево', originalTree);
    this.printTree('Оптимізоване дерево', tree);
    this.printOptimizations(log);
    this.printStats(stats);

    return { tree, stats, optimizations: log };
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

  private parseExpression(tokens: Token[]): ParallelNode {
    let pos = 0;

    const peek = () => tokens[pos];
    const consume = () => tokens[pos++];
    const isEnd = () => pos >= tokens.length;

    const parseAdditive = (): ParallelNode => {
      let left = parseMultiplicative();

      while (!isEnd() && peek()?.type === 'OPERATOR' && ['+', '-'].includes(peek().value)) {
        const op = consume();
        const right = parseMultiplicative();
        left = {
          type: 'BINARY_OP',
          operator: op.value,
          left,
          right,
          id: randomUUID(),
        };
      }
      return left;
    };

    
    const parseMultiplicative = (): ParallelNode => {
      let left = parseUnary();

      while (!isEnd() && peek()?.type === 'OPERATOR' && ['*', '/'].includes(peek().value)) {
        const op = consume();
        const right = parseUnary();
        left = {
          type: 'BINARY_OP',
          operator: op.value,
          left,
          right,
          id: randomUUID(),
        };
      }
      return left;
    };

    const parseUnary = (): ParallelNode => {
      return parsePrimary();
    };

    const parsePrimary = (): ParallelNode => {
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

  private cloneNode(node: ParallelNode | undefined): ParallelNode {
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

  private printTree(title: string, root: ParallelNode): void {
    console.log(`\n${title}:`);
    console.log(renderParallelTree(root));
  }

  private optimizeTree(node: ParallelNode): { tree: ParallelNode; log: OptimizationRecord[] } {
    const log: OptimizationRecord[] = [];

    const optimize = (n: ParallelNode): ParallelNode => {
      if (!n || n.type === 'OPERAND') {
        return n;
      }

      if (n.type === 'BINARY_OP') {
        n.left = optimize(n.left as ParallelNode);
        n.right = optimize(n.right as ParallelNode);

        if (n.operator === '-') {
          const chain = this.collectSubtractionChain(n);
          if (chain.length >= 3) {
            log.push({
              type: 'subtraction',
              original: this.formatChain(chain, '-'),
              optimized: `${this.formatNode(chain[0])}-(${this.formatChain(chain.slice(1), '+')})`,
            });
            return this.createOptimizedSubtraction(chain);
          }
        }

        if (n.operator === '/') {
          const chain = this.collectDivisionChain(n);
          if (chain.length >= 3) {
            log.push({
              type: 'division',
              original: this.formatChain(chain, '/'),
              optimized: `${this.formatNode(chain[0])}/(${this.formatChain(chain.slice(1), '*')})`,
            });
            return this.createOptimizedDivision(chain);
          }
        }
      }

      return n;
    };

    const optimized = optimize(node);
    return { tree: optimized, log };
  }

  private collectSubtractionChain(node: ParallelNode): ParallelNode[] {
    const chain: ParallelNode[] = [];

    const collect = (n: ParallelNode | undefined, isFirst = true): void => {
      if (!n) return;

      if (n.type === 'OPERAND') {
        chain.push(n);
        return;
      }

      if (n.type === 'BINARY_OP' && n.operator === '-' && isFirst) {
        collect(n.left, true);
        collect(n.right, false);
        return;
      }

      if (n.type === 'BINARY_OP' && n.operator === '-' && !isFirst) {
        collect(n.left, false);
        collect(n.right, false);
        return;
      }

      chain.push(n);
    };

    collect(node);
    return chain;
  }

  private collectDivisionChain(node: ParallelNode): ParallelNode[] {
    const chain: ParallelNode[] = [];

    const collect = (n: ParallelNode | undefined, isFirst = true): void => {
      if (!n) return;

      if (n.type === 'OPERAND') {
        chain.push(n);
        return;
      }

      if (n.type === 'BINARY_OP' && n.operator === '/' && isFirst) {
        collect(n.left, true);
        collect(n.right, false);
        return;
      }

      if (n.type === 'BINARY_OP' && n.operator === '/' && !isFirst) {
        collect(n.left, false);
        collect(n.right, false);
        return;
      }

      chain.push(n);
    };

    collect(node);
    return chain;
  }

  private createOptimizedSubtraction(chain: ParallelNode[]): ParallelNode {
    if (chain.length < 2) return chain[0];

    const [first, ...rest] = chain;
    let sumTree = rest[0];

    for (let i = 1; i < rest.length; i++) {
      sumTree = {
        type: 'BINARY_OP',
        operator: '+',
        left: sumTree,
        right: rest[i],
        id: randomUUID(),
      };
    }

    return {
      type: 'BINARY_OP',
      operator: '-',
      left: first,
      right: sumTree,
      id: randomUUID(),
    };
  }

  private createOptimizedDivision(chain: ParallelNode[]): ParallelNode {
    if (chain.length < 2) return chain[0];

    const [first, ...rest] = chain;
    let productTree = rest[0];

    for (let i = 1; i < rest.length; i++) {
      productTree = {
        type: 'BINARY_OP',
        operator: '*',
        left: productTree,
        right: rest[i],
        id: randomUUID(),
      };
    }

    return {
      type: 'BINARY_OP',
      operator: '/',
      left: first,
      right: productTree,
      id: randomUUID(),
    };
  }

  private formatNode(node: ParallelNode | undefined): string {
    if (!node) return '';
    if (node.type === 'OPERAND') return node.value ?? '';
    return `(${this.formatNode(node.left)}${node.operator}${this.formatNode(node.right)})`;
  }

  private formatChain(chain: ParallelNode[], op: string): string {
    return chain.map((node) => this.formatNode(node)).join(op);
  }

  private calculateTreeLevels(node: ParallelNode): ParallelStats {
    if (!node) {
      return { depth: 0, levels: [], maxWidth: 0, height: 0, operationsCount: 0, operandsCount: 0 };
    }

    const assignLevels = (n: ParallelNode, depth = 0): void => {
      if (!n) return;
      (n as ParallelNode & { depth?: number }).depth = depth;

      if (n.type === 'BINARY_OP') {
        assignLevels(n.left as ParallelNode, depth + 1);
        assignLevels(n.right as ParallelNode, depth + 1);
      }
    };

    assignLevels(node);

    const getMaxDepth = (n: ParallelNode | undefined): number => {
      if (!n) return -1;
      if (n.type === 'OPERAND') return 0;
      return Math.max(getMaxDepth(n.left as ParallelNode), getMaxDepth(n.right as ParallelNode)) + 1;
    };

    const maxDepth = getMaxDepth(node);
    const levels: Array<Array<{ node: ParallelNode; type: 'operand' | 'operation' }>> = [];

    const collectLevels = (n: ParallelNode | undefined, fromBottom: number): void => {
      if (!n) return;

      if (n.type === 'OPERAND') {
        if (!levels[fromBottom]) levels[fromBottom] = [];
        levels[fromBottom].push({ node: n, type: 'operand' });
        return;
      }

      const leftDepth = getMaxDepth(n.left as ParallelNode);
      const rightDepth = getMaxDepth(n.right as ParallelNode);
      const myFromBottom = Math.max(leftDepth, rightDepth) + 1;

      if (!levels[myFromBottom]) levels[myFromBottom] = [];
      levels[myFromBottom].push({ node: n, type: 'operation' });

      collectLevels(n.left as ParallelNode, leftDepth);
      collectLevels(n.right as ParallelNode, rightDepth);
    };

    collectLevels(node, maxDepth);
    const cleanLevels = levels.filter(Boolean);
    const width = cleanLevels.length ? Math.max(...cleanLevels.map((level) => level.length)) : 0;

    return {
      depth: maxDepth + 1,
      levels: cleanLevels,
      maxWidth: width,
      height: cleanLevels.length,
      operationsCount: this.countOperations(node),
      operandsCount: this.countOperands(node),
    };
  }

  private countOperations(node: ParallelNode | undefined): number {
    if (!node || node.type === 'OPERAND') return 0;
    return 1 + this.countOperations(node.left as ParallelNode) + this.countOperations(node.right as ParallelNode);
  }

  private countOperands(node: ParallelNode | undefined): number {
    if (!node) return 0;
    if (node.type === 'OPERAND') return 1;
    return this.countOperands(node.left as ParallelNode) + this.countOperands(node.right as ParallelNode);
  }

  private printOptimizations(log: OptimizationRecord[]): void {
    if (log.length === 0) {
      console.log('\nОптимізації не виконувалися.');
      return;
    }

    console.log(`\nВиконано оптимізацій: ${log.length}`);
    log.forEach((item, index) => {
      const label = item.type === 'subtraction' ? 'Ланцюг віднімання' : 'Ланцюг ділення';
      console.log(`  ${index + 1}. ${label}: ${item.original} → ${item.optimized}`);
    });
  }

  private printStats(stats: ParallelStats): void {
    console.log('\nХарактеристики дерева:');
    console.log(`  Максимальна ширина (операцій в ярусі): ${stats.maxWidth}`);
    console.log(`  Мінімальна довжина (кількість ярусів): ${stats.height}`);
    console.log(`  Кількість операцій: ${stats.operationsCount}`);
    console.log(`  Кількість операндів: ${stats.operandsCount}`);

    console.log('\nЯруси (знизу вгору):');
    stats.levels.forEach((level, index) => {
      const items = level
        .map((item) => (item.type === 'operand' ? item.node.value : item.node.operator))
        .join(' ');
      console.log(`  Ярус ${index} (${level.length} елементів): ${items}`);
    });
  }
}

export function runLab2Interactive(): void {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const analyzer = new ParallelExpressionAnalyzer();
  const validator = new ArithmeticExpressionAnalyzer();

  const ask = (): void => {
    rl.question('\nВведіть арифметичний вираз (або quit для виходу): ', (expression: string) => {
      if (expression.toLowerCase() === 'quit' || expression.toLowerCase() === 'exit') {
        console.log('Завершення роботи лабораторної №2.');
        rl.close();
        return;
      }

      try {
        const validationResult = validator.analyze(expression);
        if (!validationResult.isValid) {
          console.error('\nВираз не пройшов перевірку лабораторної №1. Розпаралелювання не виконано.');
          ask();
          return;
        }

        analyzer.analyze(expression);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Невідома помилка';
        console.error(`Помилка: ${message}`);
      }

      ask();
    });
  };

  console.log('\n=== Лабораторна робота №2. Побудова дерева паралельної форми ===');
  console.log('Введіть вираз, наприклад: (A+B)+C/D+G+(K/L+M+N)');
  ask();
}
