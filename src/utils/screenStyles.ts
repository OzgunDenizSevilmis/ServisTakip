import { StyleSheet } from 'react-native';

import { colors, spacing, typography } from '../theme';

export const screenStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  title: {
    color: colors.text,
    ...typography.heading,
  },
  description: {
    color: colors.textMuted,
    ...typography.body,
    marginTop: spacing.sm,
  },
});