import * as fs from 'fs';
import * as path from 'path';
import { ArithmeticExpressionAnalyzer } from './analyzer';
import { ParallelExpressionAnalyzer, ParallelNode } from './lab2';

type OperatorSymbol = '+' | '-' | '*' | '/';

interface OperationTask {
  id: string;
  operator: OperatorSymbol;
  dependencies: string[];
  label: string;
}

interface ScheduledOperation extends OperationTask {
  processor: number;
  start: number;
  finish: number;
  duration: number;
}

export interface PipelineConfig {
  processors: number;
  operationTimes: Record<OperatorSymbol, number>;
}

export interface PipelineSimulationResult {
  tree: ParallelNode;
  tasks: OperationTask[];
  schedule: ScheduledOperation[];
  sequentialTime: number;
  parallelTime: number;
  speedup: number;
  efficiency: number;
  gantt: string[];
  ganttSvg: string;
  ganttFile: string;
}

export class StaticPipelineSimulator {
  private readonly validator = new ArithmeticExpressionAnalyzer();
  private readonly parallelAnalyzer = new ParallelExpressionAnalyzer();

  constructor(private readonly config: PipelineConfig = StaticPipelineSimulator.defaultConfig) {}

  public get configuration(): PipelineConfig {
    return {
      processors: this.config.processors,
      operationTimes: { ...this.config.operationTimes },
    };
  }

  public simulate(expression: string): PipelineSimulationResult {
    const validation = this.validator.analyze(expression);
    if (!validation.isValid) {
      throw new Error('Вираз містить помилки. Неможливо побудувати конвеєрну модель.');
    }

    const tree = this.parallelAnalyzer.buildTree(expression);
    const tasks = this.collectTasks(tree);
    const sequentialTime = tasks.reduce((sum, task) => sum + this.config.operationTimes[task.operator], 0);
    const schedule = this.buildSchedule(tasks);
    const parallelTime = schedule.reduce((max, item) => Math.max(max, item.finish), 0);
    const speedup = parallelTime === 0 ? 0 : sequentialTime / parallelTime;
    const efficiency = this.config.processors === 0 ? 0 : speedup / this.config.processors;
    const ganttSvg = this.renderGanttSvg(schedule);
    const ganttFile = this.persistGanttFile(ganttSvg);

    return {
      tree,
      tasks,
      schedule,
      sequentialTime,
      parallelTime,
      speedup,
      efficiency,
      gantt: this.renderGantt(schedule),
      ganttSvg,
      ganttFile,
    };
  }

  private collectTasks(node: ParallelNode): OperationTask[] {
    const tasks: OperationTask[] = [];

    const traverse = (n: ParallelNode): string | undefined => {
      if (n.type === 'OPERAND') {
        return undefined;
      }

      const leftProducer = n.left ? traverse(n.left) : undefined;
      const rightProducer = n.right ? traverse(n.right) : undefined;

      const task: OperationTask = {
        id: n.id,
        operator: n.operator as OperatorSymbol,
        dependencies: [leftProducer, rightProducer].filter(Boolean) as string[],
        label: `${n.operator}${n.id.slice(0, 4)}`,
      };

      tasks.push(task);
      return n.id;
    };

    traverse(node);
    return tasks;
  }

  private buildSchedule(tasks: OperationTask[]): ScheduledOperation[] {
    const processorReady: number[] = Array(this.config.processors).fill(0);
    const completion = new Map<string, number>();
    const schedule: ScheduledOperation[] = [];

    tasks.forEach((task) => {
      const readyTime = task.dependencies.length
        ? Math.max(...task.dependencies.map((dep) => completion.get(dep) ?? 0))
        : 0;

      const { processorIndex, startTime } = this.findEarliestSlot(processorReady, readyTime);
      const duration = this.config.operationTimes[task.operator];
      const finish = startTime + duration;

      processorReady[processorIndex] = finish;
      completion.set(task.id, finish);

      schedule.push({ ...task, processor: processorIndex, start: startTime, finish, duration });
    });

    return schedule.sort((a, b) => a.start - b.start || a.processor - b.processor);
  }

  private findEarliestSlot(readyTimes: number[], readyFrom: number): { processorIndex: number; startTime: number } {
    let bestProcessor = 0;
    let bestStart = Number.POSITIVE_INFINITY;

    readyTimes.forEach((availableAt, index) => {
      const startTime = Math.max(availableAt, readyFrom);
      if (startTime < bestStart || (startTime === bestStart && index < bestProcessor)) {
        bestProcessor = index;
        bestStart = startTime;
      }
    });

    return { processorIndex: bestProcessor, startTime: bestStart };
  }

  private renderGantt(schedule: ScheduledOperation[]): string[] {
    const lines: string[] = [];

    for (let i = 0; i < this.config.processors; i++) {
      const tasks = schedule
        .filter((item) => item.processor === i)
        .sort((a, b) => a.start - b.start || a.finish - b.finish);

      const segments = tasks.map((task) => `[${task.start}-${task.finish} ${task.label}]`);
      lines.push(`P${i + 1}: ${segments.join(' ')}`.trim());
    }

    return lines;
  }

  private renderGanttSvg(schedule: ScheduledOperation[]): string {
    const rowHeight = 40;
    const padding = 24;
    const labelWidth = 80;
    const timelineHeight = this.config.processors * rowHeight;
    const totalTime = schedule.reduce((max, item) => Math.max(max, item.finish), 0);
    const scale = 60; // pixels per time unit
    const width = labelWidth + padding * 2 + totalTime * scale;
    const height = timelineHeight + padding * 2 + 30;

    const rects = schedule
      .map((task) => {
        const x = labelWidth + padding + task.start * scale;
        const y = padding + task.processor * rowHeight;
        const rectWidth = Math.max(20, task.duration * scale);
        const rectHeight = rowHeight - 10;
        const label = `${task.label} (${task.start}-${task.finish})`;
        return `\n      <g>` +
          `\n        <rect x="${x}" y="${y}" width="${rectWidth}" height="${rectHeight}" rx="6" ry="6" fill="#4F46E5" opacity="0.85" />` +
          `\n        <text x="${x + 6}" y="${y + rectHeight / 2 + 4}" fill="white" font-size="12" font-family="'Segoe UI', sans-serif">${label}</text>` +
          `\n      </g>`;
      })
      .join('');

    const lanes = Array.from({ length: this.config.processors }).map((_, i) => {
      const y = padding + i * rowHeight + rowHeight / 2;
      return `\n      <text x="${padding}" y="${y + 4}" font-size="14" font-family="'Segoe UI', sans-serif" fill="#111827">P${i + 1}</text>` +
        `\n      <line x1="${labelWidth + padding}" y1="${y}" x2="${width - padding}" y2="${y}" stroke="#D1D5DB" stroke-width="1" stroke-dasharray="4 4" />`;
    }).join('');

    const ticks = Array.from({ length: totalTime + 1 }).map((_, t) => {
      const x = labelWidth + padding + t * scale;
      return `\n      <line x1="${x}" y1="${padding - 6}" x2="${x}" y2="${height - padding}" stroke="#9CA3AF" stroke-width="1" />` +
        `\n      <text x="${x}" y="${padding - 10}" font-size="12" font-family="'Segoe UI', sans-serif" fill="#111827" text-anchor="middle">${t}</text>`;
    }).join('');

    return `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" role="img" aria-label="Gantt chart">\n` +
      `  <style>text{dominant-baseline:middle;}</style>\n` +
      `  <rect x="0" y="0" width="100%" height="100%" fill="#F9FAFB" stroke="#E5E7EB" />\n` +
      `  <text x="${padding}" y="${padding / 2}" font-size="16" font-family="'Segoe UI', sans-serif" fill="#111827" font-weight="600">Діаграма Ганта конвеєра</text>` +
      `  ${ticks}` +
      `  ${lanes}` +
      `  ${rects}\n` +
      `</svg>`;
  }

  private persistGanttFile(svg: string): string {
    const outputDir = path.resolve(process.cwd(), 'outputs');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }

    const filename = `gantt-${Date.now()}.svg`;
    const filepath = path.join(outputDir, filename);
    fs.writeFileSync(filepath, svg, 'utf-8');
    return filepath;
  }

  private static get defaultConfig(): PipelineConfig {
    return {
      processors: 6,
      operationTimes: {
        '+': 1,
        '-': 1,
        '*': 2,
        '/': 3,
      },
    };
  }
}
