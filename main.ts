// main.ts
import * as readline from 'readline';
import { ArithmeticExpressionAnalyzer } from './analyzer';
import { EquivalentExpressionGenerator, printVariants, runLab3Interactive, runLab4Interactive } from './lab34';
import { ParallelExpressionAnalyzer, runLab2Interactive } from './lab2';

const analyzer = new ArithmeticExpressionAnalyzer();
const parallelAnalyzer = new ParallelExpressionAnalyzer();
const equivalentsGenerator = new EquivalentExpressionGenerator();

const testExpressions = [
  // Правильні вирази
  "2 + 3 * 4",
  "sin(x) + cos(y)",
  "(a + b) * (c - d)",
  "-5 + 3",
  "2 * (3 + 4) / 5",
  "sqrt(25) + log(10)",
  
  // Помилки на початку
  ")2 + 3",           // закрита дужка
  "*2 + 3",           // множення
  "/2 + 3",           // ділення
  "^2 + 3",           // степінь
  
  // Помилки в кінці
  "2 + 3 +",          // оператор в кінці
  "2 + 3 *",          // множення в кінці
  "sin(",             // функція без закриття
  "2 + (",            // відкрита дужка в кінці
  
  // Помилки в середині
  "2 ++ 3",           // подвійні оператори
  "2 3",              // відсутній оператор
  "2 * * 3",          // подвійні множення
  "(* 2)",            // множення після відкритої дужки
  "2 (3 + 4)",        // відсутній оператор перед дужкою
  "(2 + 3) 4",        // відсутній оператор після дужки
  
  // Помилки зі змінними
  "2var + 1",         // змінна починається з цифри
  "_underscore + 1",  // змінна починається з підкреслення
  "var_ + 1",         // змінна закінчується підкресленням
  "var__name + 1",    // подвійне підкреслення
  "_ + 1",            // тільки підкреслення
  "___ + 1",          // тільки підкреслення
  "if + 1",           // зарезервоване слово
  "function + 1",     // зарезервоване слово

  // Помилки з дужками
  "((2 + 3)",         // незакрита дужка
  "(2 + 3))",         // зайва закрита дужка
  "()",               // пусті дужки
  "2 + ()",           // пусті дужки в середині
  
  // Помилки з функціями
  "unknown(2)",       // невідома функція
  
  // Помилки з константами
  "2.3.4 + 1",        // неправильне число
  "2. + 3",           // число закінчується крапкою
  
  // Помилки зі змінними
  "2var + 1",         // змінна починається з цифри
  
  // Недійсні символи
  "2 @ 3",            // недійсний символ
  "2 # 3",            // недійсний символ
];

function runInteractiveModeLab1(): void {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log('\n=== ІНТЕРАКТИВНИЙ РЕЖИМ АНАЛІЗАТОРА ===');
  console.log('Введіть арифметичний вираз для аналізу (або "quit" для виходу, "test" для тестування):');

  const askExpression = (): void => {
    rl.question('\nВведіть вираз: ', (expression: string) => {
      if (expression.toLowerCase() === 'quit' || expression.toLowerCase() === 'exit') {
        console.log('До побачення!');
        rl.close();
        return;
      }

      if (expression.toLowerCase() === 'test') {
        rl.close();
        runTests();
        return;
      }

      analyzer.analyze(expression);
      askExpression();
    });
  };

  askExpression();
}

function runTests(): void {
  console.log('\n=== ЗАПУСК ТЕСТОВИХ ПРИКЛАДІВ ===\n');
  analyzer.analyzeMultiple(testExpressions);
}

function parseLabChoice(args: string[]): { lab: 1 | 2 | 3 | 4; rest: string[]; runTests: boolean } {
  let lab: 1 | 2 | 3 | 4 = 1;
  let runTests = false;
  const rest: string[] = [];
  let skipNext = false;

  args.forEach((arg, index) => {
    if (skipNext) {
      skipNext = false;
      return;
    }

    const match = arg.match(/^--lab=?([1-4])$/);
    if (match) {
      lab = Number(match[1]) as 1 | 2 | 3 | 4;
      return;
    }

    if (arg === '--lab1') {
      lab = 1;
      return;
    }

    if (arg === '--lab2') {
      lab = 2;
      return;
    }

    if (arg === '--lab3') {
      lab = 3;
      return;
    }

    if (arg === '--lab4') {
      lab = 4;
      return;
    }

    if ((arg === '--lab' || arg === '-l') && args[index + 1]) {
      const nextValue = Number(args[index + 1]);
      lab = nextValue === 2 ? 2 : nextValue === 3 ? 3 : nextValue === 4 ? 4 : 1;
      skipNext = true;
      return;
    }

    if (arg === '--test' || arg === '-t') {
      runTests = true;
      return;
    }

    if (!arg.startsWith('--lab=')) {
      rest.push(arg);
    }
  });

  return { lab, rest, runTests };
}

function runLab2(expressionArgs: string[]): void {
  if (expressionArgs.length > 0) {
    const expression = expressionArgs.join(' ');
    try {
      const validation = analyzer.analyze(expression);
      if (!validation.isValid) {
        console.error('\nВираз не пройшов перевірку лабораторної №1. Розпаралелювання не виконано.');
        return;
      }

      parallelAnalyzer.analyze(expression);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Невідома помилка';
      console.error(`Помилка: ${message}`);
    }
    return;
  }

  runLab2Interactive();
}

function runLab3(expressionArgs: string[]): void {
  if (expressionArgs.length > 0) {
    const expression = expressionArgs.join(' ');
    try {
      const validation = analyzer.analyze(expression);
      if (!validation.isValid) {
        console.error('\nВираз не пройшов перевірку лабораторної №1. Перетворення не виконано.');
        return;
      }

      const { original, variants } = equivalentsGenerator.generateCommutativeForms(expression);
      console.log(`\nПочаткова форма: ${original}`);
      console.log('Еквівалентні форми (комутативний закон):');
      printVariants(variants);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Невідома помилка';
      console.error(`Помилка: ${message}`);
    }
    return;
  }

  runLab3Interactive();
}

function runLab4(expressionArgs: string[]): void {
  if (expressionArgs.length > 0) {
    const expression = expressionArgs.join(' ');
    try {
      const validation = analyzer.analyze(expression);
      if (!validation.isValid) {
        console.error('\nВираз не пройшов перевірку лабораторної №1. Перетворення не виконано.');
        return;
      }

      const { original, distributed, variants } = equivalentsGenerator.generateDistributiveForms(expression);
      console.log(`\nПочаткова форма: ${original}`);
      console.log(`Після застосування дистрибутивності: ${distributed}`);
      console.log('Еквівалентні форми (дистрибутивний та комутативний закони):');
      printVariants(variants);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Невідома помилка';
      console.error(`Помилка: ${message}`);
    }
    return;
  }

  runLab4Interactive();
}


function main(): void {
  const args = process.argv.slice(2);
  const { lab, rest, runTests: shouldRunTests } = parseLabChoice(args);

  if (lab === 2) {
    runLab2(rest);
    return;
  }

  if (lab === 3) {
    runLab3(rest);
    return;
  }

  if (lab === 4) {
    runLab4(rest);
    return;
  }

  if (shouldRunTests) {
    runTests();
    return;
  }

  if (rest.length > 0) {
    const expression = rest.join(' ');
    analyzer.analyze(expression);
    return;
  }

  runInteractiveModeLab1();
}

if (require.main === module) {
  main();
}