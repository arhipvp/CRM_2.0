import colors from './colors.json';
import typography from './typography.json';
import spacing from './spacing.json';

export { colors, typography, spacing };

export type ColorTokens = typeof colors;
export type TypographyTokens = typeof typography;
export type SpacingTokens = typeof spacing;

export const designTokens = {
  colors,
  typography,
  spacing,
};
