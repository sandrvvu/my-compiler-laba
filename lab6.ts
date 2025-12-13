import { ArithmeticExpressionAnalyzer } from "./analyzer";
import { EquivalentExpressionGenerator } from "./lab34";
import { PipelineConfig, StaticPipelineSimulator } from "./pipelineSimulator";

type OperatorSymbol = "+" | "-" | "*" | "/";

export interface ArchitectureOptions extends PipelineConfig {}

export interface VariantMetrics {
  expression: string;
  sequentialTime: number;
  parallelTime: number;
  speedup: number;
  efficiency: number;
}

export interface OptimizationResult {
  expression: string;
  metrics: VariantMetrics[];
  best: VariantMetrics[];
  config: ArchitectureOptions;
}

export function getDefaultArchitecture(): ArchitectureOptions {
  const simulator = new StaticPipelineSimulator();
  return simulator.configuration;
}

export function parseArchitectureArgs(args: string[]): {
  options: ArchitectureOptions;
  expressionParts: string[];
} {
  const defaults = getDefaultArchitecture();
  const options: ArchitectureOptions = {
    processors: defaults.processors,
    operationTimes: { ...defaults.operationTimes },
  };

  const rest: string[] = [];
  let skip = false;

  args.forEach((arg, index) => {
    if (skip) {
      skip = false;
      return;
    }

    const matchProcessors = arg.match(/^--procs=?([0-9]+)$/);
    if (matchProcessors) {
      options.processors = Number(matchProcessors[1]);
      return;
    }

    const matchOpTime = arg.match(/^--t([+\-*/])$/);
    if (matchOpTime && args[index + 1]) {
      const op = matchOpTime[1] as OperatorSymbol;
      const value = Number(args[index + 1]);
      if (!Number.isNaN(value)) {
        options.operationTimes[op] = value;
      }
      skip = true;
      return;
    }

    const inlineOpTime = arg.match(/^--t([+\-*/])=([0-9]+)$/);
    if (inlineOpTime) {
      const op = inlineOpTime[1] as OperatorSymbol;
      const value = Number(inlineOpTime[2]);
      options.operationTimes[op] = value;
      return;
    }

    rest.push(arg);
  });

  return { options, expressionParts: rest };
}

export class ParallelFormOptimizer {
  private readonly analyzer = new ArithmeticExpressionAnalyzer();
  private readonly equivalents = new EquivalentExpressionGenerator();

  constructor(private readonly options: ArchitectureOptions = getDefaultArchitecture()) {}

  public evaluate(expression: string): OptimizationResult {
    const validation = this.analyzer.analyze(expression);
    if (!validation.isValid) {
      throw new Error("Вираз містить помилки та не може бути оптимізований.");
    }

    const variants = this.collectVariants(expression);
    const simulator = new StaticPipelineSimulator(this.options);

    const metrics = variants.map((variant) => {
      const result = simulator.simulate(variant);
      return {
        expression: variant,
        sequentialTime: result.sequentialTime,
        parallelTime: result.parallelTime,
        speedup: Number(result.speedup.toFixed(2)),
        efficiency: Number(result.efficiency),
      } as VariantMetrics;
    });

    const best = this.selectBest(metrics);

    return {
      expression,
      metrics: metrics.sort((a, b) => a.parallelTime - b.parallelTime),
      best,
      config: this.options,
    };
  }

  private collectVariants(expression: string): string[] {
    const { original, distributed, variants } = this.equivalents.generateDistributiveForms(expression);
    const set = new Set<string>([original]);
    if (distributed) {
      set.add(distributed);
    }
    variants.forEach((variant) => set.add(variant));
    return Array.from(set);
  }

  private selectBest(metrics: VariantMetrics[]): VariantMetrics[] {
    if (metrics.length === 0) return [];
    const minTime = Math.min(...metrics.map((item) => item.parallelTime));
    return metrics.filter((item) => item.parallelTime === minTime);
  }
}

export function runLab6(expressionArgs: string[]): void {
  const { options, expressionParts } = parseArchitectureArgs(expressionArgs);
  if (expressionParts.length === 0) {
    console.log("\nВкажіть вираз після параметрів архітектури. Приклад:");
    console.log("  npm run lab6 -- --procs=4 --t*=2 (A+B)*C/D");
    return;
  }

  const expression = expressionParts.join(" ");
  const optimizer = new ParallelFormOptimizer(options);

  try {
    const { metrics, best, config } = optimizer.evaluate(expression);

    console.log("\n=== Лабораторна робота №6: вибір оптимальної паралельної форми ===");
    console.log(`Вираз: ${expression}`);
    console.log(`Архітектура: ${config.processors} процесорів`);
    console.log(
      "Тривалості операцій (такти): " +
        Object.entries(config.operationTimes)
          .map(([op, t]) => `${op}=${t}`)
          .join(", ")
    );

    console.log("\nЕквівалентні форми та метрики виконання:");
    printTable(metrics);

    console.log("\nОптимальна(і) форма(и) за часом виконання:");
    best.forEach((item, index) => {
      console.log(
        `  ${index + 1}. ${item.expression} | Tпарал=${item.parallelTime} | ` +
          `S=${item.speedup.toFixed(2)} | E=${(item.efficiency * 100).toFixed(2)}%`
      );
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Невідома помилка";
    console.error(`Помилка: ${message}`);
  }
}

function printTable(metrics: VariantMetrics[]): void {
  if (metrics.length === 0) {
    console.log("Немає доступних еквівалентних форм.");
    return;
  }

  const header = ["№", "Форма", "Tпосл", "Tпарал", "S", "E"];
  const rows = metrics.map((item, index) => [
    (index + 1).toString(),
    item.expression,
    item.sequentialTime.toString(),
    item.parallelTime.toString(),
    item.speedup.toFixed(2),
    `${(item.efficiency * 100).toFixed(2)}%`,
  ]);

  const widths = header.map((_, colIndex) =>
    Math.max(
      header[colIndex].length,
      ...rows.map((row) => row[colIndex].length)
    )
  );

  const formatRow = (cells: string[]) =>
    cells
      .map((cell, i) => cell.padEnd(widths[i]))
      .join(" | ");

  console.log(formatRow(header));
  console.log(widths.map((w) => "-".repeat(w)).join("-+-"));
  rows.forEach((row) => console.log(formatRow(row)));
}
