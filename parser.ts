// parser.ts
import { Token, TokenType, AnalysisError, State } from "./types";

export class Parser {
  private tokens: Token[];
  private currentIndex: number;
  private currentToken: Token;
  private errors: AnalysisError[];
  private state: State;
  private parenStack: number[];

  constructor(tokens: Token[]) {
    this.tokens = tokens;
    this.currentIndex = 0;
    this.currentToken = tokens[0] || {
      type: TokenType.EOF,
      value: "",
      position: 0,
    };
    this.errors = [];
    this.state = State.START;
    this.parenStack = [];
  }

  private advance(): void {
    if (this.currentIndex < this.tokens.length - 1) {
      this.currentIndex++;
      this.currentToken = this.tokens[this.currentIndex];
    }
  }

  private addError(message: string, position?: number): void {
    this.errors.push({
      message,
      position: position ?? this.currentToken.position,
      type: "SYNTACTIC",
    });
    this.state = State.ERROR;
  }

  private processStartState(): void {
    const token = this.currentToken;

    if (token.type === TokenType.EOF) {
      this.addError("Порожній вираз");
      return;
    }

    if (token.type === TokenType.RIGHT_PAREN) {
      this.addError("Вираз не може починатися з закритої дужки");
      return;
    }

    if (token.type === TokenType.OPERATOR) {
      if (token.value === "*" || token.value === "/" || token.value === "^") {
        this.addError(`Вираз не може починатися з оператора '${token.value}'`);
        return;
      }
      // Унарні оператори + і -
      if (token.value === "+" || token.value === "-") {
        this.state = State.EXPECT_OPERAND;
        this.advance();
        return;
      }
    }

    if (token.type === TokenType.INVALID) {
      this.addError(`Недійсний токен на початку виразу: '${token.value}'`);
      return;
    }

    if (token.type === TokenType.NUMBER || token.type === TokenType.VARIABLE) {
      this.state = State.EXPECT_OPERATOR;
      this.advance();
      return;
    }

    if (token.type === TokenType.FUNCTION) {
      this.state = State.IN_FUNCTION;
      this.advance();
      return;
    }

    if (token.type === TokenType.LEFT_PAREN) {
      this.parenStack.push(token.position);
      this.state = State.EXPECT_OPERAND;
      this.advance();
      return;
    }

    this.addError(`Неочікуваний токен на початку: '${token.value}'`);
  }

  private processExpectOperandState(): void {
    const token = this.currentToken;

    if (token.type === TokenType.EOF) {
      this.addError("Очікувався операнд, але досягнуто кінця виразу");
      return;
    }

    if (token.type === TokenType.NUMBER || token.type === TokenType.VARIABLE) {
      this.state = State.EXPECT_OPERATOR;
      this.advance();
      return;
    }

    if (token.type === TokenType.FUNCTION) {
      this.state = State.IN_FUNCTION;
      this.advance();
      return;
    }

    if (token.type === TokenType.LEFT_PAREN) {
      this.parenStack.push(token.position);
      // Залишаємося в стані EXPECT_OPERAND для вмісту дужок
      this.advance();
      return;
    }

    if (
      token.type === TokenType.OPERATOR &&
      (token.value === "+" || token.value === "-")
    ) {
      // Унарні оператори - залишаємося в стані EXPECT_OPERAND
      this.advance();
      return;
    }

    if (
      token.type === TokenType.OPERATOR &&
      (token.value === "*" || token.value === "/" || token.value === "^")
    ) {
      const prevToken = this.tokens[this.currentIndex - 1];
      if (prevToken && prevToken.type === TokenType.LEFT_PAREN) {
        this.addError(
          `Оператор '${token.value}' не може йти після відкритої дужки`
        );
      } else {
        this.addError(
          `Подвійні оператори: '${prevToken?.value || ""}${token.value}'`
        );
      }
      return;
    }

    if (token.type === TokenType.RIGHT_PAREN) {
      if (this.parenStack.length === 0) {
        this.addError("Зайва закрита дужка");
        return;
      }
      // Перевірка на пусті дужки
      const prevToken = this.tokens[this.currentIndex - 1];
      if (prevToken && prevToken.type === TokenType.LEFT_PAREN) {
        this.addError("Пусті дужки не дозволені");
        return;
      }
      this.addError("Очікувався операнд перед закритою дужкою");
      return;
    }

    this.addError(`Очікувався операнд, але отримано: '${token.value}'`);
  }

  private processExpectOperatorState(): void {
    const token = this.currentToken;

    if (token.type === TokenType.EOF) {
      // Кінець виразу після операнда - це нормально
      return;
    }

    if (token.type === TokenType.OPERATOR) {
      this.state = State.EXPECT_OPERAND;
      this.advance();
      return;
    }

    if (token.type === TokenType.RIGHT_PAREN) {
      if (this.parenStack.length === 0) {
        this.addError("Зайва закрита дужка");
        return;
      }
      this.parenStack.pop();
      // Залишаємося в стані EXPECT_OPERATOR
      this.advance();
      return;
    }

    if (token.type === TokenType.NUMBER || token.type === TokenType.VARIABLE) {
      this.addError("Відсутній оператор між операндами");
      return;
    }

    if (token.type === TokenType.FUNCTION) {
      this.addError("Відсутній оператор перед функцією");
      return;
    }

    if (token.type === TokenType.LEFT_PAREN) {
      this.addError("Відсутній оператор перед дужкою");
      return;
    }

    this.addError(`Очікувався оператор, але отримано: '${token.value}'`);
  }

  private processInFunctionState(): void {
    const token = this.currentToken;

    if (token.type === TokenType.LEFT_PAREN) {
      this.parenStack.push(token.position);
      this.state = State.EXPECT_OPERAND;
      this.advance();
      return;
    }

    // Функція без дужки
    const prevToken = this.tokens[this.currentIndex - 1];
    if (prevToken && prevToken.type === TokenType.FUNCTION) {
      this.addError(
        `Функція '${prevToken.value}' повинна супроводжуватися дужкою`
      );
      return;
    }

    this.addError(
      `Після функції очікувалася відкрита дужка, але отримано: '${token.value}'`
    );
  }

  private processErrorState(): void {
    // В стані помилки просто пропускаємо токени до кінця
    while (this.currentToken.type !== TokenType.EOF) {
      this.advance();
    }
  }

  private validateFinalState(): void {
    // Перевірка кінцевого стану
    if (this.state === State.EXPECT_OPERAND) {
      const lastRealToken = this.tokens[this.tokens.length - 2]; // -2 тому що останній це EOF
      if (lastRealToken) {
        if (lastRealToken.type === TokenType.OPERATOR) {
          this.addError(
            `Вираз не може закінчуватися оператором '${lastRealToken.value}'`,
            lastRealToken.position
          );
        } else if (lastRealToken.type === TokenType.LEFT_PAREN) {
          this.addError(
            "Вираз не може закінчуватися відкритою дужкою",
            lastRealToken.position
          );
        } else if (lastRealToken.type === TokenType.FUNCTION) {
          this.addError(
            `Функція '${lastRealToken.value}' повинна мати дужки`,
            lastRealToken.position
          );
        }
      }
    }

    // Перевірка незакритих дужок
    if (this.parenStack.length > 0) {
      this.addError(
        "Незакрита дужка",
        this.parenStack[this.parenStack.length - 1]
      );
    }

    // Перевірка недійсних токенів
    for (const token of this.tokens) {
      if (token.type === TokenType.INVALID) {
        this.addError(`Недійсний токен: '${token.value}'`, token.position);
      }
    }
  }

  private validateAdditionalRules(): void {
    for (let i = 0; i < this.tokens.length - 1; i++) {
      const current = this.tokens[i];
      const next = this.tokens[i + 1];

      if (next.type === TokenType.EOF) break;

      // Перевірка подвійних операторів
      if (
        current.type === TokenType.OPERATOR &&
        next.type === TokenType.OPERATOR
      ) {
        const allowedUnary = ["+", "-"];

        // Якщо другий оператор не унарний — помилка
        if (!allowedUnary.includes(next.value)) {
          this.addError(
            `Подвійні оператори: '${current.value}${next.value}'`,
            next.position
          );
        }

        // Якщо ++ або -- → теж помилка
        if (current.value === next.value && allowedUnary.includes(next.value)) {
          this.addError(
            `Некоректна послідовність операторів: '${current.value}${next.value}'`,
            next.position
          );
        }
      }

      // Відсутній оператор після дужки (наприклад, ")2" або ")x")
      if (
        current.type === TokenType.RIGHT_PAREN &&
        (next.type === TokenType.NUMBER ||
          next.type === TokenType.VARIABLE ||
          next.type === TokenType.FUNCTION)
      ) {
        this.addError("Відсутній оператор після дужки", next.position);
      }
    }
  }

  public parse(): boolean {
    if (this.tokens.length === 0) {
      this.addError("Відсутні токени для аналізу");
      return false;
    }

    // Головний цикл кінцевого автомата
    while (
      this.currentToken.type !== TokenType.EOF &&
      this.state !== State.ERROR
    ) {
      switch (this.state) {
        case State.START:
          this.processStartState();
          break;
        case State.EXPECT_OPERAND:
          this.processExpectOperandState();
          break;
        case State.EXPECT_OPERATOR:
          this.processExpectOperatorState();
          break;
        case State.IN_FUNCTION:
          this.processInFunctionState();
          break;
        default:
          break;
      }
    }

    // Перевірка кінцевого стану та додаткових правил
    if (this.state !== State.ERROR) {
      this.validateFinalState();
      this.validateAdditionalRules();
    }

    return this.errors.length === 0;
  }

  public getErrors(): AnalysisError[] {
    return this.errors;
  }
}
