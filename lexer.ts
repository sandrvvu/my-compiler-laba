// lexer.ts
import { Token, TokenType, AnalysisError } from "./types";

export class Lexer {
  private input: string;
  private position: number;
  private currentChar: string | null;
  private errors: AnalysisError[];

  // Підтримувані математичні функції
  private readonly functions = new Set([
    "sin",
    "cos",
    "tan",
    "log",
    "ln",
    "sqrt",
    "abs",
    "exp",
  ]);

  // Підтримувані оператори
  private readonly operators = new Set(["+", "-", "*", "/", "^"]);

  constructor(input: string) {
    this.input = input.replace(/\s+/g, ""); // Видаляємо пробіли
    this.position = 0;
    this.currentChar = this.input.length > 0 ? this.input[0] : null;
    this.errors = [];
  }

  private advance(): void {
    this.position++;
    this.currentChar =
      this.position < this.input.length ? this.input[this.position] : null;
  }

  private peek(offset: number = 1): string | null {
    const peekPos = this.position + offset;
    return peekPos < this.input.length ? this.input[peekPos] : null;
  }

  private skipWhitespace(): void {
    while (this.currentChar && /\s/.test(this.currentChar)) {
      this.advance();
    }
  }

  private readNumber(): Token {
    const startPos = this.position;
    let value = "";
    let hasDot = false;

    // Перевірка на початок з крапки
    if (this.currentChar === ".") {
      const nextChar = this.peek();
      if (!nextChar || !/\d/.test(nextChar)) {
        this.errors.push({
          message: `Неправильний формат числа: крапка повинна супроводжуватися цифрами`,
          position: this.position,
          type: "LEXICAL",
        });
        this.advance();
        return { type: TokenType.INVALID, value: ".", position: startPos };
      }
    }

    while (
      this.currentChar &&
      (/\d/.test(this.currentChar) || this.currentChar === ".")
    ) {
      if (this.currentChar === ".") {
        if (hasDot) {
          this.errors.push({
            message: `Неправильний формат числа: подвійна крапка`,
            position: this.position,
            type: "LEXICAL",
          });
          return {
            type: TokenType.INVALID,
            value: value + this.currentChar,
            position: startPos,
          };
        }
        hasDot = true;
      }
      value += this.currentChar;
      this.advance();
    }

    // Перевірка, чи число не закінчується крапкою
    if (value.endsWith(".")) {
      this.errors.push({
        message: `Неправильний формат числа: не може закінчуватися крапкою`,
        position: startPos,
        type: "LEXICAL",
      });
      return { type: TokenType.INVALID, value, position: startPos };
    }

    // Перевірка на початок з нуля (наприклад 007)
    if (value.length > 1 && value[0] === "0" && value[1] !== ".") {
      this.errors.push({
        message: `Неправильний формат числа: не може починатися з нуля (крім десяткових дробів)`,
        position: startPos,
        type: "LEXICAL",
      });
      return { type: TokenType.INVALID, value, position: startPos };
    }

    // Перевірка на занадто довге число
    if (value.length > 15) {
      this.errors.push({
        message: `Число занадто довге (максимум 15 символів): ${value}`,
        position: startPos,
        type: "LEXICAL",
      });
      return { type: TokenType.INVALID, value, position: startPos };
    }

    return { type: TokenType.NUMBER, value, position: startPos };
  }

  private readIdentifier(): Token {
    const startPos = this.position;
    let value = "";

    // Перша літера ПОВИННА бути літерою (a-z, A-Z), не цифрою і не підкресленням
    if (!this.currentChar || !/[a-zA-Z]/.test(this.currentChar)) {
      this.errors.push({
        message: `Неправильне ім'я змінної/функції: повинно починатися з літери (a-z, A-Z)`,
        position: this.position,
        type: "LEXICAL",
      });

      // Пропускаємо неправильний символ
      const invalidChar = this.currentChar || "";
      if (this.currentChar) this.advance();

      return {
        type: TokenType.INVALID,
        value: invalidChar,
        position: startPos,
      };
    }

    // Читаємо ідентифікатор
    while (this.currentChar && /[a-zA-Z0-9_]/.test(this.currentChar)) {
      value += this.currentChar;
      this.advance();
    }

    // Перевірка чи це функція (слідує відкрита дужка)
    if (this.currentChar === "(") {
      if (this.functions.has(value.toLowerCase())) {
        return { type: TokenType.FUNCTION, value, position: startPos };
      } else {
        this.errors.push({
          message: `Невідома функція: ${value}`,
          position: startPos,
          type: "LEXICAL",
        });
        return { type: TokenType.INVALID, value, position: startPos };
      }
    }

    // 2. Не повинно містити більше одного підкреслення підряд
    if (/__/.test(value)) {
      this.errors.push({
        message: `Неправильне ім'я змінної: не може містити декілька підкреслень підряд`,
        position: startPos,
        type: "LEXICAL",
      });
      return { type: TokenType.INVALID, value, position: startPos };
    }

    // 3. Не може закінчуватися підкресленням
    if (value.endsWith("_")) {
      this.errors.push({
        message: `Неправильне ім'я змінної: не може закінчуватися підкресленням`,
        position: startPos,
        type: "LEXICAL",
      });
      return { type: TokenType.INVALID, value, position: startPos };
    }

    // 4. Перевірка на зарезервовані слова
    const reservedWords = [
      "if",
      "then",
      "else",
      "while",
      "for",
      "do",
      "function",
      "return",
      "var",
      "let",
      "const",
    ];
    if (reservedWords.includes(value.toLowerCase())) {
      this.errors.push({
        message: `Зарезервоване слово не може бути ім'ям змінної: ${value}`,
        position: startPos,
        type: "LEXICAL",
      });
      return { type: TokenType.INVALID, value, position: startPos };
    }

    return { type: TokenType.VARIABLE, value, position: startPos };
  }

  public tokenize(): Token[] {
    const tokens: Token[] = [];
    this.errors = []; // Очищуємо помилки

    while (this.currentChar) {
      this.skipWhitespace();

      if (!this.currentChar) break;

      const startPos = this.position;

      // Числа
      if (/\d/.test(this.currentChar)) {
        tokens.push(this.readNumber());
        continue;
      }

      // Літери (змінні та функції)
      if (/[a-zA-Z]/.test(this.currentChar)) {
        tokens.push(this.readIdentifier());
        continue;
      }

      // Підкреслення - помилка (ідентифікатор не може починатися з підкреслення)
      if (this.currentChar === "_") {
        this.errors.push({
          message: `Неправильне ім'я змінної: не може починатися з підкреслення '_'`,
          position: this.position,
          type: "LEXICAL",
        });
        tokens.push({
          type: TokenType.INVALID,
          value: this.currentChar,
          position: startPos,
        });
        this.advance();
        continue;
      }

      // Оператори
      if (this.operators.has(this.currentChar)) {
        tokens.push({
          type: TokenType.OPERATOR,
          value: this.currentChar,
          position: startPos,
        });
        this.advance();
        continue;
      }

      // Дужки
      if (this.currentChar === "(") {
        tokens.push({
          type: TokenType.LEFT_PAREN,
          value: this.currentChar,
          position: startPos,
        });
        this.advance();
        continue;
      }

      if (this.currentChar === ")") {
        tokens.push({
          type: TokenType.RIGHT_PAREN,
          value: this.currentChar,
          position: startPos,
        });
        this.advance();
        continue;
      }

      // Невідомий символ
      this.errors.push({
        message: `Невідомий символ: ${this.currentChar}`,
        position: this.position,
        type: "LEXICAL",
      });

      tokens.push({
        type: TokenType.INVALID,
        value: this.currentChar,
        position: startPos,
      });
      this.advance();
    }

    tokens.push({ type: TokenType.EOF, value: "", position: this.position });
    return tokens;
  }

  public getErrors(): AnalysisError[] {
    return this.errors;
  }
}
