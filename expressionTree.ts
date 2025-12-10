export type ExpressionNode =
  | { type: 'operand'; value: string }
  | { type: 'binary'; operator: string; left: ExpressionNode; right: ExpressionNode };

interface Token {
  type: 'OPERAND' | 'OPERATOR' | 'LPAREN' | 'RPAREN';
  value: string;
}

function tokenize(expression: string): Token[] {
  const tokens: Token[] = [];
  const expr = expression.replace(/\s+/g, '');
  let i = 0;

  while (i < expr.length) {
    const char = expr[i];

    if (/[A-Za-z0-9]/.test(char)) {
      let operand = char;
      i++;
      while (i < expr.length && /[A-Za-z0-9]/.test(expr[i])) {
        operand += expr[i];
        i++;
      }
      tokens.push({ type: 'OPERAND', value: operand });
      continue;
    }

    if (['+', '-', '*', '/'].includes(char)) {
      tokens.push({ type: 'OPERATOR', value: char });
      i++;
      continue;
    }

    if (char === '(') {
      tokens.push({ type: 'LPAREN', value: char });
      i++;
      continue;
    }

    if (char === ')') {
      tokens.push({ type: 'RPAREN', value: char });
      i++;
      continue;
    }

    throw new Error(`Невідомий символ '${char}' на позиції ${i}`);
  }

  return tokens;
}

export function parseExpressionTree(expression: string): ExpressionNode {
  const tokens = tokenize(expression);
  let pos = 0;

  const peek = () => tokens[pos];
  const consume = () => tokens[pos++];
  const isEnd = () => pos >= tokens.length;

  const parseAdditive = (): ExpressionNode => {
    let left = parseMultiplicative();

    while (!isEnd() && peek()?.type === 'OPERATOR' && ['+', '-'].includes(peek().value)) {
      const op = consume();
      const right = parseMultiplicative();
      left = { type: 'binary', operator: op.value, left, right };
    }

    return left;
  };

  const parseMultiplicative = (): ExpressionNode => {
    let left = parsePrimary();

    while (!isEnd() && peek()?.type === 'OPERATOR' && ['*', '/'].includes(peek().value)) {
      const op = consume();
      const right = parsePrimary();
      left = { type: 'binary', operator: op.value, left, right };
    }

    return left;
  };

  const parsePrimary = (): ExpressionNode => {
    if (isEnd()) {
      throw new Error('Неочікуваний кінець виразу');
    }

    const token = peek();

    if (token.type === 'OPERAND') {
      consume();
      return { type: 'operand', value: token.value };
    }

    if (token.type === 'LPAREN') {
      consume();
      const exprNode = parseAdditive();
      if (isEnd() || peek()?.type !== 'RPAREN') {
        throw new Error('Очікується закриваюча дужка ")"');
      }
      consume();
      return exprNode;
    }

    throw new Error(`Неочікуваний токен: ${token.value}`);
  };

  const ast = parseAdditive();

  if (!isEnd()) {
    throw new Error(`Неочікувані символи після виразу: ${tokens.slice(pos).map((t) => t.value).join('')}`);
  }

  return ast;
}

function precedence(operator: string): number {
  if (operator === '+' || operator === '-') return 1;
  if (operator === '*' || operator === '/') return 2;
  return 0;
}

export function cloneExpression(node: ExpressionNode): ExpressionNode {
  if (node.type === 'operand') {
    return { ...node };
  }

  return {
    type: 'binary',
    operator: node.operator,
    left: cloneExpression(node.left),
    right: cloneExpression(node.right),
  };
}

export function formatExpression(node: ExpressionNode): string {
  if (node.type === 'operand') {
    return node.value;
  }

  const leftStr = formatExpression(node.left);
  const rightStr = formatExpression(node.right);

  const leftNeedsParens =
    node.left.type === 'binary' && precedence(node.left.operator) < precedence(node.operator);
  const rightNeedsParens =
    node.right.type === 'binary' &&
    (precedence(node.right.operator) < precedence(node.operator) ||
      (node.operator === '-' && node.right.operator === node.operator));

  const left = leftNeedsParens ? `(${leftStr})` : leftStr;
  const right = rightNeedsParens ? `(${rightStr})` : rightStr;

  return `${left} ${node.operator} ${right}`;
}
