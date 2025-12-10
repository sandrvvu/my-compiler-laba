import * as readline from 'readline';
import { ArithmeticExpressionAnalyzer } from './analyzer';
import { ParallelExpressionAnalyzer, ParallelNode } from './lab2';

export type OperatorSymbol = '+' | '-' | '*' | '/';

export interface PipelineConfig {
  processors: number;
  operationDurations: Record<OperatorSymbol, number>;
}

export interface ScheduledOperation {
  nodeId: string;
  operator: OperatorSymbol;
  start: number;
  end: number;
  processor: number;
}

export interface PipelineResult {
  schedule: ScheduledOperation[];
  sequentialTime: number;
  parallelTime: number;
  speedup: number;
  efficiency: number;
}

export class StaticPipelineSimulator {
  constructor(private readonly config: PipelineConfig) {}

  public simulate(root: ParallelNode | undefined): PipelineResult {
    if (!root) {
      return { schedule: [], sequentialTime: 0, parallelTime: 0, speedup: 1, efficiency: 1 };
    }

    const operations = this.collectOperations(root);
    if (operations.length === 0) {
      return { schedule: [], sequentialTime: 0, parallelTime: 0, speedup: 1, efficiency: 1 };
    }

    const nodesById = new Map<string, ParallelNode>();
    const dependencyCount = new Map<string, number>();
    const dependents = new Map<string, string[]>();

    operations.forEach((node) => {
      nodesById.set(node.id, node);
      dependencyCount.set(node.id, 0);
    });

    const addDependency = (parent: ParallelNode, child?: ParallelNode): void => {
      if (!child || child.type !== 'BINARY_OP') return;
      dependencyCount.set(parent.id, (dependencyCount.get(parent.id) ?? 0) + 1);
      const list = dependents.get(child.id) ?? [];
      dependents.set(child.id, [...list, parent.id]);
    };

    operations.forEach((node) => {
      addDependency(node, node.left as ParallelNode);
      addDependency(node, node.right as ParallelNode);
    });

    const readyTimes = new Map<string, number>();
    dependencyCount.forEach((count, id) => {
      if (count === 0) {
        readyTimes.set(id, 0);
      }
    });

    const freeProcessors = Array.from({ length: this.config.processors }, (_, index) => index);
    const schedule: ScheduledOperation[] = [];
    const running: Array<{ nodeId: string; end: number; processor: number }> = [];
    const completed = new Set<string>();

    let currentTime = 0;

    while (completed.size < operations.length) {
      const available = Array.from(readyTimes.entries())
        .filter(([, time]) => time <= currentTime)
        .sort((a, b) => a[1] - b[1])
        .map(([id]) => id);

      while (available.length > 0 && freeProcessors.length > 0) {
        const nodeId = available.shift() as string;
        readyTimes.delete(nodeId);
        const node = nodesById.get(nodeId);
        if (!node || !node.operator) continue;

        const start = currentTime;
        const duration = this.getDuration(node.operator as OperatorSymbol);
        const end = start + duration;
        const processor = freeProcessors.shift() as number;

        schedule.push({ nodeId, operator: node.operator as OperatorSymbol, start, end, processor });
        running.push({ nodeId, end, processor });
      }

      if (running.length === 0) {
        const nextReady = Math.min(...Array.from(readyTimes.values()));
        currentTime = Number.isFinite(nextReady) ? nextReady : currentTime;
        continue;
      }

      const nextEnd = Math.min(...running.map((task) => task.end));
      currentTime = nextEnd;

      const finished = running.filter((task) => task.end === nextEnd);
      for (const task of finished) {
        completed.add(task.nodeId);
        freeProcessors.push(task.processor);

        const children = dependents.get(task.nodeId) ?? [];
        for (const parentId of children) {
          const remaining = (dependencyCount.get(parentId) ?? 0) - 1;
          dependencyCount.set(parentId, remaining);
          if (remaining === 0) {
            const readyTime = Math.max(readyTimes.get(parentId) ?? 0, nextEnd);
            readyTimes.set(parentId, readyTime);
          }
        }
      }

      for (let i = running.length - 1; i >= 0; i--) {
        if (running[i].end === nextEnd) {
          running.splice(i, 1);
        }
      }
    }

    const parallelTime = Math.max(...schedule.map((item) => item.end));
    const sequentialTime = operations.reduce(
      (total, node) => total + this.getDuration(node.operator as OperatorSymbol),
      0
    );
    const speedup = parallelTime === 0 ? 1 : sequentialTime / parallelTime;
    const efficiency = this.config.processors === 0 ? 0 : speedup / this.config.processors;

    return {
      schedule: schedule.sort((a, b) => a.start - b.start || a.processor - b.processor),
      sequentialTime,
      parallelTime,
      speedup,
      efficiency,
    };
  }

  private collectOperations(node: ParallelNode): ParallelNode[] {
    if (node.type === 'OPERAND') return [];

    const leftOps = node.left ? this.collectOperations(node.left as ParallelNode) : [];
    const rightOps = node.right ? this.collectOperations(node.right as ParallelNode) : [];

    return [...leftOps, ...rightOps, node];
  }

  private getDuration(operator: OperatorSymbol): number {
    return this.config.operationDurations[operator] ?? 1;
  }
}

export const defaultPipelineConfig: PipelineConfig = {
  processors: 6,
  operationDurations: {
    '+': 1,
    '-': 1,
    '*': 2,
    '/': 3,
  },
};

export function runLab5Once(expression: string): void {
  const validator = new ArithmeticExpressionAnalyzer();
  const parallelAnalyzer = new ParallelExpressionAnalyzer();
  const simulator = new StaticPipelineSimulator(defaultPipelineConfig);

  const validation = validator.analyze(expression);
  if (!validation.isValid) {
    console.error('\nВираз не пройшов перевірку лабораторної №1. Моделювання не виконано.');
    return;
  }

  const { tree } = parallelAnalyzer.analyze(expression);
  const result = simulator.simulate(tree);

  console.log('\n=== Моделювання статичного конвеєра ===');
  console.log(`Кількість процесорів (шарів): ${defaultPipelineConfig.processors}`);
  console.log('Тривалість операцій:', defaultPipelineConfig.operationDurations);
  console.log(`Послідовний час обчислення: ${result.sequentialTime}`);
  console.log(`Паралельний час (конвеєр): ${result.parallelTime}`);
  console.log(`Коефіцієнт прискорення: ${result.speedup.toFixed(2)}`);
  console.log(`Ефективність: ${(result.efficiency * 100).toFixed(2)}%`);

  console.log('\nРозклад виконання (початок → кінець):');
  result.schedule.forEach((item) => {
    console.log(
      `  Операція ${item.operator} | процесор P${item.processor + 1} | ${item.start} → ${item.end} (вузол ${
        item.nodeId.slice(0, 8)
      })`
    );
  });
}

export function runLab5Interactive(): void {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const validator = new ArithmeticExpressionAnalyzer();
  const parallelAnalyzer = new ParallelExpressionAnalyzer();
  const simulator = new StaticPipelineSimulator(defaultPipelineConfig);

  const ask = (): void => {
    rl.question('\nВведіть арифметичний вираз для моделювання конвеєра (або quit для виходу): ', (expression) => {
      if (expression.toLowerCase() === 'quit' || expression.toLowerCase() === 'exit') {
        console.log('Роботу лабораторної №5 завершено.');
        rl.close();
        return;
      }

      const validation = validator.analyze(expression);
      if (!validation.isValid) {
        console.error('\nВираз не пройшов перевірку лабораторної №1. Моделювання не виконано.');
        ask();
        return;
      }

      const { tree } = parallelAnalyzer.analyze(expression);
      const result = simulator.simulate(tree);

      console.log('\n=== Моделювання статичного конвеєра ===');
      console.log(`Кількість процесорів (шарів): ${defaultPipelineConfig.processors}`);
      console.log('Тривалість операцій:', defaultPipelineConfig.operationDurations);
      console.log(`Послідовний час обчислення: ${result.sequentialTime}`);
      console.log(`Паралельний час (конвеєр): ${result.parallelTime}`);
      console.log(`Коефіцієнт прискорення: ${result.speedup.toFixed(2)}`);
      console.log(`Ефективність: ${(result.efficiency * 100).toFixed(2)}%`);

      console.log('\nРозклад виконання (початок → кінець):');
      result.schedule.forEach((item) => {
        console.log(
          `  Операція ${item.operator} | процесор P${item.processor + 1} | ${item.start} → ${item.end} (вузол ${
            item.nodeId.slice(0, 8)
          })`
        );
      });

      ask();
    });
  };

  console.log('\n=== Лабораторна робота №5. Моделювання статичного конвеєра ===');
  console.log('Початкові параметри: 6 процесорів, тривалості операцій: + = 1, - = 1, * = 2, / = 3.');
  console.log('Введіть вираз, наприклад: (A+B)+C/D+G+(K/L+M+N)');
  ask();
}
