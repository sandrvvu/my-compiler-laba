import * as readline from 'readline';
import { ArithmeticExpressionAnalyzer } from './analyzer';
import { EquivalentExpressionGenerator, VARIANT_DISPLAY_LIMIT } from './lab34';
import { PipelineConfig, StaticPipelineSimulator } from './pipelineSimulator';

export interface VariantEvaluation {
  expression: string;
  sequentialTime: number;
  parallelTime: number;
  speedup: number;
  efficiency: number;
}

export interface OptimizationResult {
  config: PipelineConfig;
  totalVariants: number;
  evaluatedVariants: number;
  truncated: boolean;
  evaluations: VariantEvaluation[];
}

const DEFAULT_VARIANT_LIMIT = 120;

export class ParallelFormOptimizer {
  private readonly generator = new EquivalentExpressionGenerator();
  private readonly simulator: StaticPipelineSimulator;

  constructor(private readonly config?: PipelineConfig) {
    this.simulator = new StaticPipelineSimulator(config);
  }

  public analyze(expression: string, maxVariants: number = DEFAULT_VARIANT_LIMIT): OptimizationResult {
    const limit = Math.max(1, maxVariants);
    const commutative = this.generator.generateCommutativeForms(expression, { maxVariants: limit });
    const distributive = this.generator.generateDistributiveForms(expression, { maxVariants: limit });

    const uniqueVariants = Array.from(
      new Set([expression, ...commutative.variants, ...distributive.variants])
    );
    const limitedVariants = uniqueVariants.slice(0, limit);

    const evaluations = limitedVariants.map((variant) => {
      const result = this.simulator.simulate(variant);
      return {
        expression: variant,
        sequentialTime: result.sequentialTime,
        parallelTime: result.parallelTime,
        speedup: result.speedup,
        efficiency: result.efficiency,
      } as VariantEvaluation;
    });

    evaluations.sort((a, b) => a.parallelTime - b.parallelTime || b.speedup - a.speedup);

    return {
      config: this.simulator.configuration,
      totalVariants: uniqueVariants.length,
      evaluatedVariants: limitedVariants.length,
      truncated:
        commutative.truncated ||
        distributive.truncated ||
        uniqueVariants.length > limitedVariants.length,
      evaluations,
    };
  }
}

function printOptimization(expression: string, result: OptimizationResult): void {
  const { processors, operationTimes } = result.config;
  console.log('\n=== Лабораторна №6: вибір оптимального графа ===');
  console.log(`Вираз: ${expression}`);
  console.log(`Архітектура: ${processors} процесорів; тривалості операцій ${JSON.stringify(operationTimes)}`);
  console.log(
    `Згенеровано форм: ${result.totalVariants}. Оцінено: ${result.evaluatedVariants}` +
      (result.truncated ? ' (обмежено лімітом для уникнення зациклення)' : '')
  );

  console.log('\nНайкращі варіанти за часом виконання:');
  console.log(' № | tпарал | tпосл | S | E | Вираз');
  console.log('---|--------|-------|---|---|------------------------------------------------');
  result.evaluations.slice(0, 5).forEach((item, index) => {
    const line = `${(index + 1).toString().padStart(2, ' ')} | ${item.parallelTime
      .toFixed(2)
      .padStart(6, ' ')} | ${item.sequentialTime
      .toFixed(2)
      .padStart(5, ' ')} | ${item.speedup.toFixed(2).padStart(3, ' ')} | ${(item.efficiency * 100)
      .toFixed(1)
      .padStart(3, ' ')} | ${item.expression}`;
    console.log(line);
  });
}

export function runLab6(expressionArgs: string[], maxVariants?: number): void {
  const limit = Math.max(1, maxVariants ?? DEFAULT_VARIANT_LIMIT);
  const analyzer = new ArithmeticExpressionAnalyzer();
  const optimizer = new ParallelFormOptimizer();

  if (expressionArgs.length > 0) {
    const expression = expressionArgs.join(' ');
    const validation = analyzer.analyze(expression);
    if (!validation.isValid) {
      console.error('\nВираз не пройшов перевірку лабораторної №1. Підбір оптимальної форми не виконано.');
      return;
    }

    const result = optimizer.analyze(expression, limit);
    printOptimization(expression, result);
    return;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const ask = (): void => {
    rl.question(`\nВведіть вираз (або quit для виходу, ліміт варіантів=${limit}): `, (expression: string) => {
      if (expression.toLowerCase() === 'quit' || expression.toLowerCase() === 'exit') {
        console.log('Завершення роботи лабораторної №6.');
        rl.close();
        return;
      }

      const validation = analyzer.analyze(expression);
      if (!validation.isValid) {
        console.error('\nВираз не пройшов перевірку лабораторної №1. Спробуйте інший.');
        ask();
        return;
      }

      const result = optimizer.analyze(expression, limit);
      printOptimization(expression, result);
      ask();
    });
  };

  console.log('\n=== Лабораторна робота №6. Оптимізація паралельних форм ===');
  console.log(`Ліміт форм для симуляції: ${limit} (для уникнення зациклення)`);
  console.log(`Для перегляду лише перших ${VARIANT_DISPLAY_LIMIT} форм використовуйте попередні лабораторні.`);
  ask();
}
