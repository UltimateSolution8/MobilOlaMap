import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Screen } from '../../ui/Screen';
import { theme } from '../../ui/theme';
import { useI18n } from '../../i18n/I18nProvider';

export function TermsScreen() {
  const { t } = useI18n();
  const terms = [
    t('terms.line1'),
    t('terms.line2'),
    t('terms.line3'),
    t('terms.line4'),
    t('terms.line5'),
    t('terms.line6'),
    t('terms.line7'),
  ];
  return (
    <Screen>
      <View style={styles.card}>
        <Text style={styles.h1}>{t('terms.title')}</Text>
        <ScrollView>
          {terms.map((line, idx) => (
            <Text key={idx} style={styles.line}>
              • {line}
            </Text>
          ))}
        </ScrollView>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    padding: theme.space.lg,
    gap: theme.space.sm,
    ...theme.shadow.card,
  },
  h1: { color: theme.colors.text, fontSize: 22, fontWeight: '900', marginBottom: 6 },
  line: { color: theme.colors.muted, fontSize: 13, lineHeight: 20, marginBottom: 8 },
});
