// main.ts
import * as readline from 'readline';
import { ArithmeticExpressionAnalyzer } from './analyzer';

const analyzer = new ArithmeticExpressionAnalyzer();

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

function runInteractiveMode(): void {
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

function main(): void {
  const args = process.argv.slice(2);

  if (args.includes('--test') || args.includes('-t')) {
    runTests();
    return;
  }

  if (args.length > 0) {
    const expression = args.join(' ');
    analyzer.analyze(expression);
    return;
  }

  runInteractiveMode();
}

if (require.main === module) {
  main();
}