import * as fs from "fs";
import * as path from "path";
import {
  OptimizationRecord,
  ParallelExpressionAnalyzer,
  ParallelNode,
} from "./lab2";
import { Lexer } from "./lexer";
import { Parser } from "./parser";

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
  originalExpression: string;
  optimizedExpression: string;
  originalTree: ParallelNode;
  tree: ParallelNode;
  optimizations: OptimizationRecord[];
  tasks: OperationTask[];
  schedule: ScheduledOperation[];
  sequentialTime: number;
  parallelTime: number;
  speedup: number;
  efficiency: number;
  usedProcessors: number;
  peakConcurrency: number;
  gantt: string[];
  ganttSvg: string;
  ganttFile: string;
  latestGanttFile: string;
  executionLog: string[];
}

export class StaticPipelineSimulator {
  private readonly parallelAnalyzer = new ParallelExpressionAnalyzer();

  constructor(private readonly config: PipelineConfig = StaticPipelineSimulator.defaultConfig) {}

  public get configuration(): PipelineConfig {
    return {
      processors: this.config.processors,
      operationTimes: { ...this.config.operationTimes },
    };
  }

  public simulate(expression: string): PipelineSimulationResult {
    this.validateExpression(expression);

    const {
      originalTree,
      optimizedTree: tree,
      optimizations,
      optimizedExpression,
    } = this.parallelAnalyzer.analyzeForPipeline(expression);
    const tasks = this.collectTasks(tree);
    const sequentialTime = tasks.reduce((sum, task) => sum + this.config.operationTimes[task.operator], 0);
    const { schedule, executionLog } = this.buildScheduleWithLogging(tasks);
    const parallelTime = schedule.reduce((max, item) => Math.max(max, item.finish), 0);
    const { usedProcessors, peakConcurrency } = this.computeConcurrency(schedule);
    const speedup = parallelTime === 0 ? 0 : sequentialTime / parallelTime;
    const efficiency = this.config.processors === 0 ? 0 : speedup / this.config.processors;
    const ganttSvg = this.renderGanttSvg(schedule);
    const { archivedPath: ganttFile, latestPath: latestGanttFile } = this.persistGanttFile(ganttSvg);

    return {
      originalExpression: expression,
      optimizedExpression,
      originalTree,
      tree,
      optimizations,
      tasks,
      schedule,
      sequentialTime,
      parallelTime,
      speedup,
      efficiency,
      usedProcessors,
      peakConcurrency,
      gantt: this.renderGantt(schedule),
      ganttSvg,
      ganttFile,
      latestGanttFile,
      executionLog,
    };
  }

  private computeConcurrency(schedule: ScheduledOperation[]): { usedProcessors: number; peakConcurrency: number } {
    const usedProcessors = new Set(schedule.map((item) => item.processor)).size;
    const events: Array<{ time: number; delta: number }> = [];

    schedule.forEach((item) => {
      events.push({ time: item.start, delta: 1 });
      events.push({ time: item.finish, delta: -1 });
    });

    events.sort((a, b) => a.time - b.time || a.delta - b.delta);

    let active = 0;
    let peakConcurrency = 0;

    events.forEach((event) => {
      active += event.delta;
      peakConcurrency = Math.max(peakConcurrency, active);
    });

    return { usedProcessors, peakConcurrency };
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

  private buildScheduleWithLogging(tasks: OperationTask[]): { 
    schedule: ScheduledOperation[]; 
    executionLog: string[] 
  } {
    const processorReady: number[] = Array(this.config.processors).fill(0);
    const completion = new Map<string, number>();
    const schedule: ScheduledOperation[] = [];
    const executionLog: string[] = [];

    const remainingDeps = new Map<string, number>();
    const dependents = new Map<string, string[]>();
    const taskById = new Map(tasks.map((task) => [task.id, task]));

    tasks.forEach((task) => {
      remainingDeps.set(task.id, task.dependencies.length);
      task.dependencies.forEach((dep) => {
        const list = dependents.get(dep) ?? [];
        list.push(task.id);
        dependents.set(dep, list);
      });
    });

    const ready: Array<{ task: OperationTask; readyTime: number }> = tasks
      .filter((task) => task.dependencies.length === 0)
      .map((task) => ({ task, readyTime: 0 }));

    executionLog.push('=== ПОЧАТОК СИМУЛЯЦІЇ КОНВЕЄРА ===\n');
    executionLog.push(`Загальна кількість операцій: ${tasks.length}`);
    executionLog.push(`Операції без залежностей (готові): ${ready.length}`);
    executionLog.push(`Доступно процесорів: ${this.config.processors}\n`);

    let currentTime = 0;
    let cycleCount = 0;
    const MAX_CYCLES = tasks.length * 1000;

    while (schedule.length < tasks.length && cycleCount < MAX_CYCLES) {
      cycleCount++;
      
      ready.sort((a, b) => {
        if (a.readyTime !== b.readyTime) return a.readyTime - b.readyTime;
        const durA = this.config.operationTimes[a.task.operator];
        const durB = this.config.operationTimes[b.task.operator];
        return durB - durA;
      });

      const readyNow = ready.filter(r => r.readyTime <= currentTime);
      
      if (readyNow.length === 0) {
        const nextProcessorFree = Math.min(...processorReady.filter(t => t > currentTime));
        const nextTaskReady = ready.length > 0 ? Math.min(...ready.map(r => r.readyTime)) : Infinity;
        const nextTime = Math.min(nextProcessorFree, nextTaskReady);
        
        if (nextTime === Infinity || nextTime <= currentTime) {
          executionLog.push(`\nПОМИЛКА: Не вдається знайти наступний такт`);
          executionLog.push(`  Поточний час: ${currentTime}`);
          executionLog.push(`  Залишилось задач: ${tasks.length - schedule.length}`);
          executionLog.push(`  Готових задач: ${ready.length}`);
          executionLog.push(`  Стан процесорів: [${processorReady.join(', ')}]`);
          break;
        }
        
        currentTime = nextTime;
        continue;
      }

      executionLog.push(`\n--- ТАКТ ${currentTime} (ітерація ${cycleCount}) ---`);
      executionLog.push(`Стан процесорів: [${processorReady.map((t, i) => `P${i+1}:${t}`).join(', ')}]`);
      executionLog.push(`Готових задач на цьому такті: ${readyNow.length}/${ready.length}`);

      let scheduledInThisCycle = 0;

      for (let procIdx = 0; procIdx < this.config.processors; procIdx++) {
        if (processorReady[procIdx] > currentTime) continue;

        const readyIndex = ready.findIndex((item) => item.readyTime <= currentTime);
        if (readyIndex === -1) break;

        const { task } = ready.splice(readyIndex, 1)[0];
        const start = currentTime;
        const duration = this.config.operationTimes[task.operator];
        const finish = start + duration;

        processorReady[procIdx] = finish;
        completion.set(task.id, finish);
        
        const scheduledOp: ScheduledOperation = { 
          ...task, 
          processor: procIdx, 
          start, 
          finish, 
          duration 
        };
        
        schedule.push(scheduledOp);
        scheduledInThisCycle++;

        const depsStr = task.dependencies.length > 0 
          ? task.dependencies.map(d => d.slice(0, 6)).join(', ') 
          : 'немає';
        
        executionLog.push(
          `  P${procIdx + 1}: запущено ${task.label} ` +
          `(${task.operator}, тривалість=${duration}, ${start} -> ${finish}) ` +
          `[залежності: ${depsStr}]`
        );

        const dependentsList = dependents.get(task.id) ?? [];
        dependentsList.forEach((dependentId) => {
          const remaining = (remainingDeps.get(dependentId) ?? 1) - 1;
          remainingDeps.set(dependentId, remaining);

          if (remaining === 0) {
            const dependentTask = taskById.get(dependentId);
            if (dependentTask) {
              const depFinishTimes = dependentTask.dependencies
                .map(depId => completion.get(depId) ?? 0);
              const readyAt = depFinishTimes.length > 0 ? Math.max(...depFinishTimes) : finish;
              
              ready.push({ task: dependentTask, readyTime: readyAt });
              executionLog.push(
                `    -> ${dependentTask.label} розблокована (готова з такту ${readyAt})`
              );
            }
          }
        });
      }

      executionLog.push(`  Заплановано операцій у цьому такті: ${scheduledInThisCycle}`);
      
      if (schedule.length < tasks.length) {
        const nextProcessorFree = Math.min(...processorReady.filter(t => t > currentTime));
        const nextTaskReady = ready.length > 0 ? Math.min(...ready.map(r => r.readyTime)) : Infinity;
        const nextTime = Math.min(nextProcessorFree, nextTaskReady);
        
        if (nextTime > currentTime && nextTime !== Infinity) {
          currentTime = nextTime;
        }
      }
    }

    if (cycleCount >= MAX_CYCLES) {
      executionLog.push('\nПОПЕРЕДЖЕННЯ: Досягнуто ліміт ітерацій!');
    }

    executionLog.push('\n=== ЗАВЕРШЕННЯ СИМУЛЯЦІЇ ===');
    executionLog.push(`Всього ітерацій: ${cycleCount}`);
    executionLog.push(`Всього операцій виконано: ${schedule.length}/${tasks.length}`);

    return { 
      schedule: schedule.sort((a, b) => a.start - b.start || a.processor - b.processor),
      executionLog 
    };
  }

  private validateExpression(expression: string): void {
    const lexer = new Lexer(expression);
    const tokens = lexer.tokenize();
    const lexicalErrors = lexer.getErrors();

    const parser = new Parser(tokens);
    parser.parse();
    const syntacticErrors = parser.getErrors();

    if (lexicalErrors.length || syntacticErrors.length) {
      const message = [...lexicalErrors, ...syntacticErrors]
        .map((error) => `${error.message} (позиція: ${error.position})`)
        .join('; ');
      throw new Error(`Вираз містить помилки: ${message || 'невідома помилка'}`);
    }
  }

  private renderGantt(schedule: ScheduledOperation[]): string[] {
    const lines: string[] = [];

    for (let i = 0; i < this.config.processors; i++) {
      const tasks = schedule
        .filter((item) => item.processor === i)
        .sort((a, b) => a.start - b.start);

      const segments = tasks.map((task) => `[${task.start}-${task.finish} ${task.label}]`);
      lines.push(`P${i + 1}: ${segments.length ? segments.join(' ') : '—'}`);
    }

    return lines;
  }

  private renderGanttSvg(schedule: ScheduledOperation[]): string {
    const rowHeight = 52;
    const paddingTop = 56;
    const paddingSide = 32;
    const paddingBottom = 44;
    const labelWidth = 88;
    const timelineHeight = this.config.processors * rowHeight;
    const totalTime = schedule.reduce((max, item) => Math.max(max, item.finish), 0);
    const scale = 56;
    const width = labelWidth + paddingSide * 2 + totalTime * scale + 48;
    const height = timelineHeight + paddingTop + paddingBottom + 28;

    const rects = schedule
      .map((task) => {
        const x = labelWidth + paddingSide + task.start * scale;
        const y = paddingTop + task.processor * rowHeight + 6;
        const rectWidth = Math.max(38, task.duration * scale - 10);
        const rectHeight = rowHeight - 16;
        const label = `${task.label} (${task.start}-${task.finish})`;
        const maxChars = Math.floor((rectWidth - 16) / 7);
        const visibleLabel = label.length > maxChars ? `${label.slice(0, Math.max(0, maxChars - 1))}…` : label;
        return `\n      <g>` +
          `\n        <rect x="${x}" y="${y}" width="${rectWidth}" height="${rectHeight}" rx="10" ry="10" fill="#4F46E5" stroke="#312E81" stroke-width="1.5" opacity="0.9" />` +
          `\n        <text x="${x + 10}" y="${y + rectHeight / 2}" fill="#F9FAFB" font-size="12" font-family="'Segoe UI', sans-serif" font-weight="600" text-anchor="start">${visibleLabel}</text>` +
          `\n      </g>`;
      })
      .join('');

    const lanes = Array.from({ length: this.config.processors }).map((_, i) => {
      const y = paddingTop + i * rowHeight + rowHeight / 2;
      const bandTop = paddingTop + i * rowHeight + 2;
      const bandHeight = rowHeight - 8;
      return `\n      <g>` +
        `\n        <rect x="${labelWidth + paddingSide}" y="${bandTop}" width="${width - labelWidth - paddingSide * 2}" height="${bandHeight}" fill="${i % 2 === 0 ? '#EEF2FF' : '#E0E7FF'}" rx="8" ry="8" />` +
        `\n        <text x="${paddingSide}" y="${y}" font-size="14" font-family="'Segoe UI', sans-serif" fill="#111827" font-weight="600">P${i + 1}</text>` +
        `\n        <line x1="${labelWidth + paddingSide}" y1="${y}" x2="${width - paddingSide - 8}" y2="${y}" stroke="#C7D2FE" stroke-width="1" stroke-dasharray="6 6" />` +
        `\n      </g>`;
    }).join('');

    const ticks = Array.from({ length: totalTime + 1 }).map((_, t) => {
      const x = labelWidth + paddingSide + t * scale;
      return `\n      <g>` +
        `\n        <line x1="${x}" y1="${paddingTop - 18}" x2="${x}" y2="${height - paddingBottom + 6}" stroke="#9CA3AF" stroke-width="1" />` +
        `\n        <text x="${x}" y="${paddingTop - 26}" font-size="12" font-family="'Segoe UI', sans-serif" fill="#111827" text-anchor="middle">${t}</text>` +
        `\n      </g>`;
    }).join('');

    return `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Gantt chart">\n` +
      `  <style>text{dominant-baseline:middle;}</style>\n` +
      `  <rect x="0" y="0" width="100%" height="100%" fill="#F9FAFB" stroke="#E5E7EB" />\n` +
      `  ${ticks}` +
      `  ${lanes}` +
      `  ${rects}\n` +
      `</svg>`;
  }

  private persistGanttFile(svg: string): { archivedPath: string; latestPath: string } {
    const outputDir = path.resolve(process.cwd(), 'outputs');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }

    const filename = `gantt-${Date.now()}.svg`;
    const filepath = path.join(outputDir, filename);
    fs.writeFileSync(filepath, svg, 'utf-8');
    const latestPath = path.join(outputDir, 'gantt-latest.svg');
    fs.writeFileSync(latestPath, svg, 'utf-8');
    return { archivedPath: filepath, latestPath };
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