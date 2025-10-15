import React, {useState} from 'react';
import {View, TouchableOpacity, StyleSheet, Dimensions} from 'react-native';
import Icon from './Icon';
import GlobalSettings from './GlobalSettings';
import {useRTL} from '../../hooks/useRTL';

const {width, height} = Dimensions.get('window');

interface FloatingSettingsButtonProps {
  style?: any;
}

export default function FloatingSettingsButton({
  style,
}: FloatingSettingsButtonProps) {
  const [showSettings, setShowSettings] = useState(false);
  const {isRTL, getRTLPosition} = useRTL();

  const buttonStyle = [
    styles.floatingButton,
    getRTLPosition({right: 20}),
    style,
  ];

  return (
    <>
      <TouchableOpacity
        style={buttonStyle}
        onPress={() => setShowSettings(true)}
        activeOpacity={0.8}>
        <Icon name="settings" size={24} color="#ffffff" />
      </TouchableOpacity>

      <GlobalSettings
        visible={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  floatingButton: {
    position: 'absolute',
    top: 60, // Moved down a bit from 50
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(59, 130, 246, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
  },
});
