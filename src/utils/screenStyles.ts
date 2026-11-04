import { StyleSheet } from 'react-native';

import { colors, spacing, typography } from '../theme';

export const screenStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: spacing.lg,
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
