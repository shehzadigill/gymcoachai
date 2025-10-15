import React, {useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import {useSettings} from '../../contexts/SettingsContext';
import {useTranslation} from 'react-i18next';
import {useRTL} from '../../hooks/useRTL';

interface GlobalSettingsProps {
  visible: boolean;
  onClose: () => void;
}

export default function GlobalSettings({
  visible,
  onClose,
}: GlobalSettingsProps) {
  const {themeMode, language, setThemeMode, setLanguage} = useSettings();
  const {t} = useTranslation();
  const {isRTL, getRTLFlexDirection} = useRTL();
  const [selectedTheme, setSelectedTheme] = useState(themeMode);
  const [selectedLanguage, setSelectedLanguage] = useState(language);

  const themeOptions = [
    {key: 'light', label: t('settings.theme.light'), icon: '☀️'},
    {key: 'dark', label: t('settings.theme.dark'), icon: '🌙'},
    {key: 'system', label: t('settings.theme.system'), icon: '⚙️'},
  ] as const;

  const languageOptions = [
    {key: 'en', label: 'English', flag: '🇺🇸'},
    {key: 'ar', label: 'العربية', flag: '🇸🇦'},
    {key: 'sv', label: 'Svenska', flag: '🇸🇪'},
  ] as const;

  const handleSave = () => {
    if (selectedTheme !== themeMode) {
      setThemeMode(selectedTheme);
    }
    if (selectedLanguage !== language) {
      setLanguage(selectedLanguage);
    }
    onClose();
  };

  const handleCancel = () => {
    setSelectedTheme(themeMode);
    setSelectedLanguage(language);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleCancel}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View
            style={[
              styles.header,
              {flexDirection: getRTLFlexDirection('row')},
            ]}>
            <Text style={styles.title}>{t('settings.title')}</Text>
            <TouchableOpacity onPress={handleCancel} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}>
            {/* Theme Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {t('settings.theme.title')}
              </Text>
              <Text style={styles.sectionSubtitle}>
                {t('settings.theme.subtitle')}
              </Text>
              <View style={styles.optionsContainer}>
                {themeOptions.map(option => (
                  <TouchableOpacity
                    key={option.key}
                    style={[
                      styles.optionItem,
                      selectedTheme === option.key && styles.optionItemSelected,
                    ]}
                    onPress={() => setSelectedTheme(option.key)}>
                    <Text style={styles.optionIcon}>{option.icon}</Text>
                    <Text
                      style={[
                        styles.optionLabel,
                        selectedTheme === option.key &&
                          styles.optionLabelSelected,
                      ]}>
                      {option.label}
                    </Text>
                    {selectedTheme === option.key && (
                      <Text style={styles.checkIcon}>✓</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Language Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {t('settings.language.title')}
              </Text>
              <Text style={styles.sectionSubtitle}>
                {t('settings.language.subtitle')}
              </Text>
              <View style={styles.optionsContainer}>
                {languageOptions.map(option => (
                  <TouchableOpacity
                    key={option.key}
                    style={[
                      styles.optionItem,
                      selectedLanguage === option.key &&
                        styles.optionItemSelected,
                    ]}
                    onPress={() => setSelectedLanguage(option.key)}>
                    <Text style={styles.optionIcon}>{option.flag}</Text>
                    <Text
                      style={[
                        styles.optionLabel,
                        selectedLanguage === option.key &&
                          styles.optionLabelSelected,
                      ]}>
                      {option.label}
                    </Text>
                    {selectedLanguage === option.key && (
                      <Text style={styles.checkIcon}>✓</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </ScrollView>

          {/* Footer */}
          <View
            style={[
              styles.footer,
              {flexDirection: getRTLFlexDirection('row')},
            ]}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancel}>
              <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
              <Text style={styles.saveButtonText}>{t('common.save')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    minHeight: '50%',
    width: '100%',
  },
  header: {
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  closeButton: {
    padding: 4,
  },
  closeButtonText: {
    fontSize: 18,
    color: '#6b7280',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    paddingVertical: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
  },
  optionsContainer: {
    gap: 8,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  optionItemSelected: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
  },
  optionIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  optionLabel: {
    flex: 1,
    fontSize: 16,
    color: '#374151',
  },
  optionLabelSelected: {
    color: '#1e40af',
    fontWeight: '500',
  },
  checkIcon: {
    fontSize: 16,
    color: '#3b82f6',
    fontWeight: 'bold',
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '500',
  },
  saveButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '600',
  },
});
