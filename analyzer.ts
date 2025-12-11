import { Lexer } from "./lexer";
import { Parser } from "./parser";
import { AnalysisResult, AnalysisError, TokenType } from "./types";

export class ArithmeticExpressionAnalyzer {
  public analyze(expression: string): AnalysisResult {
    console.log(`\n=== Аналіз виразу: "${expression}" ===`);

    console.log("\n1. ЛЕКСИЧНИЙ АНАЛІЗ:");
    const lexer = new Lexer(expression);
    const tokens = lexer.tokenize();
    const lexicalErrors = lexer.getErrors();

    console.log("Токени:");
    tokens.forEach((token, index) => {
      if (token.type !== "EOF") {
        console.log(
          `  ${index}: ${token.type} - "${token.value}" (позиція: ${token.position})`
        );
      }
    });

    if (lexicalErrors.length > 0) {
      console.log("\nЛексичні помилки:");
      lexicalErrors.forEach((error, index) => {
        console.log(
          `  ${index + 1}. ${error.message} (позиція: ${error.position})`
        );
      });
    } else {
      console.log("\nЛексичних помилок не знайдено.");
    }

    console.log("\n2. СИНТАКСИЧНИЙ АНАЛІЗ:");
    const parser = new Parser(tokens);
    const isValid = parser.parse();
    const syntacticErrors = parser.getErrors();

    if (syntacticErrors.length > 0) {
      console.log("Синтаксичні помилки:");
      syntacticErrors.forEach((error, index) => {
        console.log(
          `  ${index + 1}. ${error.message} (позиція: ${error.position})`
        );
      });
    } else {
      console.log("Синтаксичних помилок не знайдено.");
    }

    const allErrors: AnalysisError[] = [...lexicalErrors, ...syntacticErrors];
    const overallValid = allErrors.length === 0;

    console.log("\n3. РЕЗУЛЬТАТ АНАЛІЗУ:");
    console.log(`Вираз ${overallValid ? "ПРАВИЛЬНИЙ" : "НЕПРАВИЛЬНИЙ"}`);
    console.log(`Всього знайдено помилок: ${allErrors.length}`);

    return {
      isValid: overallValid,
      errors: allErrors,
      tokens: tokens.filter((token) => token.type !== "EOF"),
    };
  }

  public analyzeMultiple(expressions: string[]): void {
    console.log("=".repeat(60));
    console.log("АНАЛІЗ ДЕКІЛЬКОХ АРИФМЕТИЧНИХ ВИРАЗІВ");
    console.log("=".repeat(60));

    expressions.forEach((expr, index) => {
      console.log(`\n${index + 1}/${expressions.length}`);
      this.analyze(expr);
    });

    console.log("\n" + "=".repeat(60));
    console.log("АНАЛІЗ ЗАВЕРШЕНО");
    console.log("=".repeat(60));
  }
}
