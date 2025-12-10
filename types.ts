// types.ts
export enum TokenType {
  NUMBER = "NUMBER",
  VARIABLE = "VARIABLE",
  FUNCTION = "FUNCTION",
  OPERATOR = "OPERATOR",
  LEFT_PAREN = "LEFT_PAREN",
  RIGHT_PAREN = "RIGHT_PAREN",
  EOF = "EOF",
  INVALID = "INVALID",
}

export interface Token {
  type: TokenType;
  value: string;
  position: number;
}

export interface AnalysisError {
  message: string;
  position: number;
  type: "LEXICAL" | "SYNTACTIC";
}

export interface AnalysisResult {
  isValid: boolean;
  errors: AnalysisError[];
  tokens: Token[];
}

export enum State {
  START = "START",
  EXPECT_OPERAND = "EXPECT_OPERAND",
  EXPECT_OPERATOR = "EXPECT_OPERATOR",
  IN_FUNCTION = "IN_FUNCTION",
  ERROR = "ERROR",
}
