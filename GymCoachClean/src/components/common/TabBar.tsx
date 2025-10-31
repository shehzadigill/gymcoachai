import React from 'react';
import {View, Text, Pressable, ScrollView, StyleSheet} from 'react-native';
import {Icon} from './Icon';

interface Tab {
  id: string;
  title: string;
  icon: string;
}

interface TabBarProps {
  tabs: Tab[];
  activeTab: string;
  onTabPress: (tabId: string) => void;
}

export const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTab,
  onTabPress,
}) => {
  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContainer}
        style={styles.scrollView}>
        {tabs.map(tab => (
          <Pressable
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.activeTab]}
            onPress={() => onTabPress(tab.id)}
            accessible={true}
            accessibilityRole="tab"
            accessibilityLabel={`${tab.title} tab`}
            accessibilityState={{selected: activeTab === tab.id}}
            accessibilityHint={`Switches to ${tab.title} section`}>
            <Icon
              name={tab.icon}
              size={16}
              color={activeTab === tab.id ? '#3b82f6' : '#6b7280'}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === tab.id && styles.activeTabText,
              ]}
              numberOfLines={1}>
              {tab.title}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  scrollView: {
    paddingHorizontal: 20,
  },
  scrollContainer: {
    paddingRight: 20,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginRight: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
    minWidth: 70,
  },
  activeTab: {
    backgroundColor: '#3b82f6',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
    marginLeft: 6,
    flexShrink: 1,
  },
  activeTabText: {
    color: '#ffffff',
    fontWeight: '600',
  },
});

export default TabBar;
