import React from 'react';
import {View, Text, StyleSheet, SafeAreaView} from 'react-native';
import {useTranslation} from 'react-i18next';
import FloatingSettingsButton from '../../components/common/FloatingSettingsButton';

export default function FoodSearchScreen({route}: any) {
  const {t} = useTranslation();
  const {onSelectFood} = route.params || {};

  return (
    <SafeAreaView style={styles.container}>
      <FloatingSettingsButton />
      <View style={styles.content}>
        <Text style={styles.title}>{t('nutrition.search_food')}</Text>
        <Text style={styles.placeholder}>{t('nutrition.coming_soon')}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  placeholder: {
    fontSize: 14,
    color: '#9ca3af',
    fontStyle: 'italic',
    marginTop: 20,
  },
});
